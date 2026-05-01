"""Content generation + approval workflow."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import (
    Asset,
    AssetKind,
    BrandCI,
    Client,
    ContentItem,
    ContentStatus,
    ContentVariant,
    Platform,
    User,
    UserRole,
    Comment,
)
from ..schemas import (
    CommentCreate,
    CommentOut,
    ContentOut,
    GenerateRequest,
    VariantOut,
)
from ..services import ai_service

router = APIRouter(prefix="/api/content", tags=["content"])


def _gather_document_context(db: Session, ids: list[int]) -> str:
    if not ids:
        return ""
    rows = db.query(Asset).filter(Asset.id.in_(ids)).all()
    parts: list[str] = []
    for a in rows:
        if a.extracted_text:
            parts.append(f"# {a.original_name}\n{a.extracted_text[:4000]}")
    return "\n\n---\n\n".join(parts)


def _gather_ref_paths(db: Session, ids: list[int]) -> list[Path]:
    if not ids:
        return []
    rows = db.query(Asset).filter(Asset.id.in_(ids)).all()
    out: list[Path] = []
    for a in rows:
        p = (settings.upload_path.parent / a.path).resolve()
        if p.exists():
            out.append(p)
    return out


@router.get("", response_model=list[ContentOut])
def list_content(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    client_id: int | None = None,
    status: ContentStatus | None = None,
):
    q = db.query(ContentItem)
    if client_id:
        q = q.filter_by(client_id=client_id)
    if status:
        q = q.filter_by(status=status)
    return [ContentOut.model_validate(c) for c in q.order_by(ContentItem.created_at.desc()).all()]


@router.get("/{content_id}", response_model=ContentOut)
def get_content(
    content_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(ContentItem, content_id)
    if not c:
        raise HTTPException(404, "Not found")
    return ContentOut.model_validate(c)


@router.post("/generate", response_model=ContentOut)
async def generate_content(
    req: GenerateRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client = db.get(Client, req.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    brand: BrandCI | None = client.brand_ci

    primary_platform = req.platforms[0] if req.platforms else Platform.INSTAGRAM
    doc_context = _gather_document_context(db, req.document_asset_ids)
    ref_paths = _gather_ref_paths(db, req.reference_asset_ids)

    # 1) Create the content item
    content = ContentItem(
        client_id=req.client_id,
        title=req.title,
        prompt=req.prompt,
        extra_context=req.extra_context,
        reference_asset_ids=req.reference_asset_ids,
        document_asset_ids=req.document_asset_ids,
        platforms=[p.value if isinstance(p, Platform) else p for p in req.platforms],
        formats=req.formats,
        status=ContentStatus.DRAFT,
        created_by_id=user.id,
    )
    db.add(content)
    db.flush()

    # 2) Generate caption variants
    drafts = await ai_service.generate_caption_variants(
        brand=brand,
        prompt=req.prompt,
        extra_context=req.extra_context,
        platform=primary_platform,
        document_context=doc_context,
        count=max(1, req.num_variants),
    )

    # 3) For each draft variant, generate images for every requested format
    out_dir = settings.generated_path / f"client-{req.client_id}" / f"content-{content.id}"

    async def make_variant(i: int, d) -> ContentVariant:
        image_assets: list[int] = []
        aspect_ratios: list[str] = []
        provider_used = "stub"
        for ratio in req.formats:
            path, provider = await ai_service.generate_image(
                prompt=f"{req.prompt}. {d.headline}",
                aspect_ratio=ratio,
                brand=brand,
                reference_image_paths=ref_paths,
                variant_label=d.label,
                out_dir=out_dir,
            )
            provider_used = provider
            rel = path.relative_to(settings.generated_path.parent)
            asset = Asset(
                client_id=req.client_id,
                kind=AssetKind.GENERATED,
                filename=path.name,
                original_name=path.name,
                mime_type="image/png",
                size_bytes=path.stat().st_size,
                path=str(rel).replace("\\", "/"),
                width=ai_service.ASPECT_SIZES.get(ratio, (1080, 1080))[0],
                height=ai_service.ASPECT_SIZES.get(ratio, (1080, 1080))[1],
                meta={"aspect_ratio": ratio, "variant_label": d.label, "provider": provider},
            )
            db.add(asset)
            db.flush()
            image_assets.append(asset.id)
            aspect_ratios.append(ratio)

        v = ContentVariant(
            content_id=content.id,
            label=d.label or f"Variant {chr(65 + i)}",
            caption=d.caption,
            headline=d.headline,
            cta=d.cta,
            hashtags=d.hashtags,
            keywords=d.keywords,
            image_asset_ids=image_assets,
            aspect_ratios=aspect_ratios,
            provider=provider_used,
        )
        db.add(v)
        db.flush()
        return v

    # Run variants sequentially to keep DB writes safe
    for i, d in enumerate(drafts):
        await make_variant(i, d)

    content.status = ContentStatus.IN_REVIEW
    db.commit()
    db.refresh(content)
    return ContentOut.model_validate(content)


@router.post("/{content_id}/variants/{variant_id}/select", response_model=VariantOut)
def select_variant(
    content_id: int,
    variant_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    v = db.get(ContentVariant, variant_id)
    if not v or v.content_id != content_id:
        raise HTTPException(404, "Variant not found")
    # Unselect others
    for other in v.content.variants:
        other.selected = other.id == variant_id
    db.commit()
    db.refresh(v)
    return VariantOut.model_validate(v)


@router.post("/{content_id}/status")
def change_status(
    content_id: int,
    status: ContentStatus,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(ContentItem, content_id)
    if not c:
        raise HTTPException(404, "Not found")
    # Role rules
    if status == ContentStatus.APPROVED and user.role == UserRole.CLIENT:
        pass  # clients can approve
    if status in (ContentStatus.DRAFT, ContentStatus.IN_REVIEW) and user.role == UserRole.CLIENT:
        raise HTTPException(403, "Clients can only approve or comment")
    c.status = status
    db.commit()
    return {"ok": True, "status": status.value}


@router.post("/{content_id}/comments", response_model=CommentOut)
def add_comment(
    content_id: int,
    payload: CommentCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(ContentItem, content_id)
    if not c:
        raise HTTPException(404, "Content not found")
    comment = Comment(content_id=content_id, author_id=user.id, body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.get("/{content_id}/comments", response_model=list[CommentOut])
def list_comments(
    content_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        db.query(Comment)
        .filter_by(content_id=content_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return [CommentOut.model_validate(c) for c in rows]


@router.delete("/{content_id}")
def delete_content(
    content_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    c = db.get(ContentItem, content_id)
    if not c:
        raise HTTPException(404, "Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
