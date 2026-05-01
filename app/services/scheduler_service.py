"""Background scheduler that publishes scheduled posts when their time arrives."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models import (
    Asset,
    ContentStatus,
    ContentVariant,
    ScheduledPost,
)
from .social_service import publish_post

log = logging.getLogger("rosaroad.scheduler")

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


async def _run_tick() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        due = (
            db.execute(
                select(ScheduledPost).where(
                    ScheduledPost.status == ContentStatus.SCHEDULED,
                    ScheduledPost.scheduled_for <= now,
                )
            )
            .scalars()
            .all()
        )
        for post in due:
            await _publish_one(db, post)
    except Exception as e:  # noqa: BLE001
        log.exception("Scheduler tick failed: %s", e)
    finally:
        db.close()


async def _publish_one(db: Session, post: ScheduledPost) -> None:
    variant = db.get(ContentVariant, post.variant_id)
    if not variant:
        post.status = ContentStatus.FAILED
        post.error = "variant missing"
        db.commit()
        return

    image_urls: list[str] = []
    for aid in variant.image_asset_ids or []:
        a = db.get(Asset, aid)
        if a:
            image_urls.append(f"{settings.base_url}/files/{a.path}")

    result = await publish_post(
        platform=post.platform,
        caption=variant.caption,
        hashtags=variant.hashtags or [],
        image_paths=image_urls,
    )
    post.published_at = datetime.utcnow()
    post.payload = {
        "caption": variant.caption,
        "hashtags": variant.hashtags,
        "image_urls": image_urls,
        "result": result.to_dict(),
    }
    if result.ok:
        post.status = ContentStatus.PUBLISHED
        post.external_post_id = result.external_id
        post.error = ""
        # Also flip the parent content to published if all posts are done
        variant.content.status = ContentStatus.PUBLISHED
    else:
        post.status = ContentStatus.FAILED
        post.error = result.error
    db.commit()


def start_scheduler() -> None:
    if not settings.scheduler_enabled:
        log.info("Scheduler disabled via settings.")
        return
    sched = get_scheduler()
    if sched.running:
        return
    sched.add_job(
        lambda: asyncio.create_task(_run_tick()),
        "interval",
        seconds=settings.scheduler_interval_seconds,
        id="publish_tick",
        replace_existing=True,
    )
    sched.start()
    log.info("Scheduler started (tick %ss)", settings.scheduler_interval_seconds)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
