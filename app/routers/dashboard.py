"""Top-level dashboard aggregate."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    AnalyticsSnapshot,
    Client,
    ContentItem,
    ContentStatus,
    ScheduledPost,
    User,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    clients = db.query(Client).filter_by(archived=False).count()
    draft = db.query(ContentItem).filter_by(status=ContentStatus.DRAFT).count()
    review = db.query(ContentItem).filter_by(status=ContentStatus.IN_REVIEW).count()
    approved = db.query(ContentItem).filter_by(status=ContentStatus.APPROVED).count()
    scheduled = db.query(ContentItem).filter_by(status=ContentStatus.SCHEDULED).count()
    published = db.query(ContentItem).filter_by(status=ContentStatus.PUBLISHED).count()

    upcoming = (
        db.query(ScheduledPost)
        .filter(ScheduledPost.scheduled_for >= datetime.utcnow())
        .order_by(ScheduledPost.scheduled_for.asc())
        .limit(10)
        .all()
    )

    # 30-day engagement across all clients
    since = datetime.utcnow() - timedelta(days=30)
    totals = db.query(
        func.coalesce(func.sum(AnalyticsSnapshot.impressions), 0),
        func.coalesce(func.sum(AnalyticsSnapshot.engagement), 0),
        func.coalesce(func.sum(AnalyticsSnapshot.clicks), 0),
        func.coalesce(func.sum(AnalyticsSnapshot.spend), 0.0),
    ).filter(AnalyticsSnapshot.date >= since).first() or (0, 0, 0, 0.0)

    return {
        "clients": clients,
        "pipeline": {
            "draft": draft,
            "in_review": review,
            "approved": approved,
            "scheduled": scheduled,
            "published": published,
        },
        "last_30_days": {
            "impressions": int(totals[0] or 0),
            "engagement": int(totals[1] or 0),
            "clicks": int(totals[2] or 0),
            "spend": float(totals[3] or 0.0),
        },
        "upcoming_posts": [
            {
                "id": p.id,
                "platform": p.platform.value,
                "scheduled_for": p.scheduled_for.isoformat(),
                "content_id": p.content_id,
                "status": p.status.value,
            }
            for p in upcoming
        ],
    }
