"""Calendar + scheduling endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    ContentItem,
    ContentStatus,
    ContentVariant,
    ScheduledPost,
    User,
    UserRole,
)
from ..schemas import ScheduleCreate, ScheduledPostOut

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.post("/schedule", response_model=ScheduledPostOut)
def schedule_post(
    payload: ScheduleCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == UserRole.CLIENT:
        raise HTTPException(403, "Clients cannot schedule posts")
    c = db.get(ContentItem, payload.content_id)
    v = db.get(ContentVariant, payload.variant_id)
    if not c or not v or v.content_id != c.id:
        raise HTTPException(404, "Content/variant not found")
    if c.status not in (ContentStatus.APPROVED, ContentStatus.IN_REVIEW, ContentStatus.DRAFT):
        # still allow scheduling from review so agencies can pre-queue
        pass
    sp = ScheduledPost(
        content_id=c.id,
        variant_id=v.id,
        platform=payload.platform,
        scheduled_for=payload.scheduled_for,
        status=ContentStatus.SCHEDULED,
    )
    db.add(sp)
    c.status = ContentStatus.SCHEDULED
    db.commit()
    db.refresh(sp)
    return ScheduledPostOut.model_validate(sp)


@router.get("", response_model=list[ScheduledPostOut])
def list_scheduled(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    client_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
):
    q = db.query(ScheduledPost).join(ContentItem, ScheduledPost.content_id == ContentItem.id)
    if client_id:
        q = q.filter(ContentItem.client_id == client_id)
    if start:
        q = q.filter(ScheduledPost.scheduled_for >= start)
    if end:
        q = q.filter(ScheduledPost.scheduled_for <= end)
    return [
        ScheduledPostOut.model_validate(s)
        for s in q.order_by(ScheduledPost.scheduled_for.asc()).all()
    ]


@router.delete("/{scheduled_id}")
def cancel_scheduled(
    scheduled_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == UserRole.CLIENT:
        raise HTTPException(403, "Forbidden")
    sp = db.get(ScheduledPost, scheduled_id)
    if not sp:
        raise HTTPException(404, "Not found")
    if sp.status == ContentStatus.PUBLISHED:
        raise HTTPException(400, "Cannot cancel a published post")
    db.delete(sp)
    db.commit()
    return {"ok": True}


@router.get("/overview")
def calendar_overview(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    days: int = 30,
):
    """Daily counts of scheduled posts for the next N days."""
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=days)
    rows = (
        db.query(ScheduledPost)
        .filter(and_(ScheduledPost.scheduled_for >= start, ScheduledPost.scheduled_for < end))
        .all()
    )
    buckets: dict[str, int] = {}
    for r in rows:
        k = r.scheduled_for.strftime("%Y-%m-%d")
        buckets[k] = buckets.get(k, 0) + 1
    return {"days": days, "buckets": buckets, "total": len(rows)}
