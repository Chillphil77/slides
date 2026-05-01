"""Keyword, hashtag, and text-suggestion research endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Client, HashtagSet, KeywordResearch, User
from ..schemas import (
    HashtagRequest,
    HashtagSetOut,
    KeywordRequest,
    KeywordResearchOut,
    TextSuggestOut,
    TextSuggestRequest,
)
from ..services import ai_service

router = APIRouter(prefix="/api/research", tags=["research"])


@router.post("/keywords", response_model=KeywordResearchOut)
async def keyword_research(
    payload: KeywordRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client = db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    kws = await ai_service.research_keywords(
        topic=payload.topic,
        brand=client.brand_ci,
        language=payload.language,
        region=payload.region,
    )
    rec = KeywordResearch(
        client_id=payload.client_id,
        topic=payload.topic,
        keywords=kws,
        provider="gemini" if kws else "stub",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return KeywordResearchOut.model_validate(rec)


@router.get("/keywords/{client_id}", response_model=list[KeywordResearchOut])
def list_keyword_research(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        db.query(KeywordResearch)
        .filter_by(client_id=client_id)
        .order_by(KeywordResearch.created_at.desc())
        .all()
    )
    return [KeywordResearchOut.model_validate(r) for r in rows]


@router.post("/hashtags", response_model=HashtagSetOut)
async def hashtag_research(
    payload: HashtagRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client = db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    tags = await ai_service.research_hashtags(
        topic=payload.topic,
        platform=payload.platform,
        count=payload.count,
        brand=client.brand_ci,
    )
    rec = HashtagSet(
        client_id=payload.client_id,
        name=payload.topic,
        topic=payload.topic,
        platform=payload.platform,
        hashtags=tags,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return HashtagSetOut.model_validate(rec)


@router.get("/hashtags/{client_id}", response_model=list[HashtagSetOut])
def list_hashtag_sets(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        db.query(HashtagSet)
        .filter_by(client_id=client_id)
        .order_by(HashtagSet.created_at.desc())
        .all()
    )
    return [HashtagSetOut.model_validate(r) for r in rows]


@router.post("/suggest", response_model=TextSuggestOut)
async def text_suggest(
    payload: TextSuggestRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client = db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    suggestions = await ai_service.suggest_texts(
        brand=client.brand_ci,
        seed=payload.seed,
        kind=payload.kind,
        platform=payload.platform,
        count=payload.count,
    )
    return TextSuggestOut(suggestions=suggestions)
