"""Analytics ingestion + reporting."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import AnalyticsSnapshot, Client, Platform, User
from ..schemas import AnalyticsSummary
from ..services import social_service
from ..services.report_service import csv_export, pdf_report

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.post("/refresh/{client_id}")
async def refresh_analytics(
    client_id: int,
    days: int = 30,
    db: Annotated[Session, Depends(get_db)] = None,  # type: ignore[assignment]
    user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore[assignment]
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    since = datetime.utcnow() - timedelta(days=days)
    until = datetime.utcnow()

    # Pull for each supported platform
    total_inserted = 0
    for platform in [
        Platform.INSTAGRAM,
        Platform.FACEBOOK,
        Platform.LINKEDIN,
        Platform.X,
        Platform.TIKTOK,
        Platform.YOUTUBE,
    ]:
        rows = await social_service.fetch_analytics_for_client(
            client_id=client_id, platform=platform, since=since, until=until
        )
        # Clear & replace window to keep idempotent
        db.query(AnalyticsSnapshot).filter(
            AnalyticsSnapshot.client_id == client_id,
            AnalyticsSnapshot.platform == platform,
            AnalyticsSnapshot.date >= since,
        ).delete()
        for r in rows:
            snap = AnalyticsSnapshot(
                client_id=client_id,
                platform=platform,
                date=datetime.strptime(r["date"], "%Y-%m-%d"),
                followers=r.get("followers", 0),
                impressions=r.get("impressions", 0),
                reach=r.get("reach", 0),
                engagement=r.get("engagement", 0),
                clicks=r.get("clicks", 0),
                profile_visits=r.get("profile_visits", 0),
                video_views=r.get("video_views", 0),
                spend=r.get("spend", 0.0),
                conversions=r.get("conversions", 0),
                raw=r.get("raw", {}),
            )
            db.add(snap)
            total_inserted += 1
    db.commit()
    return {"ok": True, "inserted": total_inserted}


def _summarize(db: Session, client_id: int, days: int) -> AnalyticsSummary:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(AnalyticsSnapshot)
        .filter(AnalyticsSnapshot.client_id == client_id, AnalyticsSnapshot.date >= since)
        .order_by(AnalyticsSnapshot.date.asc())
        .all()
    )
    if not rows:
        return AnalyticsSummary(
            client_id=client_id,
            range_days=days,
            total_followers=0,
            total_impressions=0,
            total_reach=0,
            total_engagement=0,
            total_clicks=0,
            total_spend=0.0,
            total_conversions=0,
            engagement_rate=0.0,
            per_platform={},
            daily=[],
        )

    latest_followers_per_platform: dict[str, int] = {}
    per_platform: dict[str, dict[str, float]] = {}
    totals = {
        "impressions": 0,
        "reach": 0,
        "engagement": 0,
        "clicks": 0,
        "spend": 0.0,
        "conversions": 0,
    }
    daily: dict[str, dict[str, float]] = {}
    for r in rows:
        k = r.platform.value
        per = per_platform.setdefault(
            k,
            {
                "followers": 0,
                "impressions": 0,
                "reach": 0,
                "engagement": 0,
                "clicks": 0,
                "spend": 0.0,
                "conversions": 0,
            },
        )
        per["impressions"] += r.impressions
        per["reach"] += r.reach
        per["engagement"] += r.engagement
        per["clicks"] += r.clicks
        per["spend"] += r.spend
        per["conversions"] += r.conversions
        latest_followers_per_platform[k] = r.followers  # rows are asc-ordered

        totals["impressions"] += r.impressions
        totals["reach"] += r.reach
        totals["engagement"] += r.engagement
        totals["clicks"] += r.clicks
        totals["spend"] += r.spend
        totals["conversions"] += r.conversions

        day_key = r.date.strftime("%Y-%m-%d")
        d = daily.setdefault(
            day_key,
            {
                "date": day_key,
                "impressions": 0,
                "reach": 0,
                "engagement": 0,
                "clicks": 0,
                "spend": 0.0,
            },
        )
        d["impressions"] += r.impressions
        d["reach"] += r.reach
        d["engagement"] += r.engagement
        d["clicks"] += r.clicks
        d["spend"] += r.spend

    for k, v in latest_followers_per_platform.items():
        per_platform[k]["followers"] = v

    total_followers = sum(latest_followers_per_platform.values())
    eng_rate = (
        totals["engagement"] / totals["impressions"]
        if totals["impressions"] > 0
        else 0.0
    )
    return AnalyticsSummary(
        client_id=client_id,
        range_days=days,
        total_followers=total_followers,
        total_impressions=int(totals["impressions"]),
        total_reach=int(totals["reach"]),
        total_engagement=int(totals["engagement"]),
        total_clicks=int(totals["clicks"]),
        total_spend=float(totals["spend"]),
        total_conversions=int(totals["conversions"]),
        engagement_rate=round(eng_rate, 4),
        per_platform=per_platform,
        daily=sorted(daily.values(), key=lambda x: x["date"]),
    )


@router.get("/summary/{client_id}", response_model=AnalyticsSummary)
def summary(
    client_id: int,
    days: int = 30,
    db: Annotated[Session, Depends(get_db)] = None,  # type: ignore[assignment]
    user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore[assignment]
):
    return _summarize(db, client_id, days)


@router.get("/export/{client_id}.csv")
def export_csv(
    client_id: int,
    days: int = 30,
    db: Annotated[Session, Depends(get_db)] = None,  # type: ignore[assignment]
    user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore[assignment]
):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(AnalyticsSnapshot)
        .filter(AnalyticsSnapshot.client_id == client_id, AnalyticsSnapshot.date >= since)
        .order_by(AnalyticsSnapshot.date.asc())
        .all()
    )
    data = [
        {
            "date": r.date.strftime("%Y-%m-%d"),
            "platform": r.platform.value,
            "followers": r.followers,
            "impressions": r.impressions,
            "reach": r.reach,
            "engagement": r.engagement,
            "clicks": r.clicks,
            "video_views": r.video_views,
            "profile_visits": r.profile_visits,
            "spend": r.spend,
            "conversions": r.conversions,
        }
        for r in rows
    ]
    body = csv_export(data) if data else b"date,platform\n"
    return Response(
        body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="client-{client_id}-analytics.csv"'},
    )


@router.get("/export/{client_id}.pdf")
def export_pdf(
    client_id: int,
    days: int = 30,
    db: Annotated[Session, Depends(get_db)] = None,  # type: ignore[assignment]
    user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore[assignment]
):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    summary = _summarize(db, client_id, days).model_dump()
    primary = (client.brand_ci.primary_color if client.brand_ci else "#E0115F") or "#E0115F"
    pdf = pdf_report(
        agency_name=settings.app_name,
        client_name=client.name,
        summary=summary,
        per_platform=summary["per_platform"],
        brand_primary=primary,
    )
    return Response(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="client-{client_id}-report.pdf"'
        },
    )
