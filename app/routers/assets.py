"""Asset/document uploads (information hub + reference images + logos)."""
from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import Asset, AssetKind, BrandCI, Client, User
from ..schemas import AssetOut
from ..services.storage_service import extract_text, save_upload

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/by-client/{client_id}", response_model=list[AssetOut])
def list_assets(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    kind: AssetKind | None = None,
):
    q = db.query(Asset).filter_by(client_id=client_id)
    if kind is not None:
        q = q.filter_by(kind=kind)
    return [AssetOut.model_validate(a) for a in q.order_by(Asset.created_at.desc()).all()]


@router.post("/upload", response_model=AssetOut)
async def upload_asset(
    client_id: Annotated[int, Form(...)],
    kind: Annotated[AssetKind, Form(...)],
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    data = await file.read()
    subdir = f"client-{client_id}"
    rel, abs_path = save_upload(data, file.filename or "upload", subdir=subdir)

    text = ""
    width = None
    height = None
    if kind in (AssetKind.DOCUMENT,):
        text = extract_text(abs_path, file.content_type or "")
    if kind in (AssetKind.REFERENCE_IMAGE, AssetKind.LOGO, AssetKind.BRAND_ASSET):
        try:
            with Image.open(abs_path) as im:
                width, height = im.size
        except Exception:  # noqa: BLE001
            pass

    asset = Asset(
        client_id=client_id,
        kind=kind,
        filename=Path(rel).name,
        original_name=file.filename or "upload",
        mime_type=file.content_type or "",
        size_bytes=len(data),
        path=rel,
        extracted_text=text,
        width=width,
        height=height,
    )
    db.add(asset)
    db.flush()

    # If it's a logo, set it on brand CI
    if kind == AssetKind.LOGO:
        ci = client.brand_ci or BrandCI(client_id=client_id)
        if ci.id is None:
            db.add(ci)
            db.flush()
        ci.logo_asset_id = asset.id

    db.commit()
    db.refresh(asset)
    return AssetOut.model_validate(asset)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    a = db.get(Asset, asset_id)
    if not a:
        raise HTTPException(404, "Asset not found")
    # Try delete file
    try:
        abs_path = (settings.upload_path.parent / a.path).resolve()
        if abs_path.exists() and abs_path.is_file():
            abs_path.unlink()
    except Exception:  # noqa: BLE001
        pass
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.get("/download/{asset_id}")
def download_asset(
    asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    a = db.get(Asset, asset_id)
    if not a:
        raise HTTPException(404, "Not found")
    abs_path = (settings.upload_path.parent / a.path).resolve()
    if not abs_path.exists():
        raise HTTPException(404, "File missing")
    return FileResponse(
        str(abs_path),
        media_type=a.mime_type or "application/octet-stream",
        filename=a.original_name,
    )
