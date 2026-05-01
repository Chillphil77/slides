"""Social publishing + analytics ingestion.

Real implementations call into:
  * Meta Graph API (Instagram Business + Facebook Page)
  * LinkedIn UGC API
  * X (Twitter) v2 API
  * TikTok Content Posting API

When credentials are missing, the service runs in DRY-RUN mode: it records
what *would* have been posted into the ScheduledPost payload and marks the
post as "published" with a simulated external_post_id. Analytics will
generate realistic sample data so the dashboard always has something to show.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta
from typing import Any

import httpx

from ..config import settings
from ..models import Platform

log = logging.getLogger("rosaroad.social")


class PublishResult:
    def __init__(self, ok: bool, external_id: str = "", error: str = "", dry_run: bool = False):
        self.ok = ok
        self.external_id = external_id
        self.error = error
        self.dry_run = dry_run

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "external_id": self.external_id,
            "error": self.error,
            "dry_run": self.dry_run,
        }


# ------------------------ Publishing ------------------------

async def publish_post(
    *,
    platform: Platform,
    caption: str,
    hashtags: list[str],
    image_paths: list[str],
    link: str = "",
) -> PublishResult:
    text = caption.strip()
    if hashtags:
        text = text + "\n\n" + " ".join(hashtags)

    try:
        if platform in (Platform.INSTAGRAM, Platform.FACEBOOK) and settings.has_meta():
            return await _publish_meta(platform, text, image_paths, link)
        if platform == Platform.LINKEDIN and settings.has_linkedin():
            return await _publish_linkedin(text, image_paths)
        if platform == Platform.X and settings.has_x():
            return await _publish_x(text, image_paths)
        if platform == Platform.TIKTOK and settings.has_tiktok():
            return await _publish_tiktok(text, image_paths)
    except Exception as e:  # noqa: BLE001
        log.warning("Publish to %s failed: %s", platform.value, e)
        return PublishResult(ok=False, error=str(e))

    # DRY RUN fallback
    log.info("DRY-RUN publish to %s: %s", platform.value, text[:120])
    return PublishResult(
        ok=True,
        external_id=f"dryrun-{platform.value}-{uuid.uuid4().hex[:10]}",
        dry_run=True,
    )


async def _publish_meta(
    platform: Platform, text: str, image_paths: list[str], link: str
) -> PublishResult:
    """Publish to Instagram Business or a Facebook Page via Graph API."""
    token = settings.meta_page_access_token
    if platform == Platform.INSTAGRAM:
        ig_id = settings.instagram_business_account_id
        if not ig_id:
            return PublishResult(ok=False, error="INSTAGRAM_BUSINESS_ACCOUNT_ID missing")
        if not image_paths:
            return PublishResult(ok=False, error="Instagram requires at least one image")
        async with httpx.AsyncClient(timeout=60.0) as client:
            create = await client.post(
                f"https://graph.facebook.com/v21.0/{ig_id}/media",
                data={"image_url": image_paths[0], "caption": text, "access_token": token},
            )
            create.raise_for_status()
            cid = create.json().get("id")
            pub = await client.post(
                f"https://graph.facebook.com/v21.0/{ig_id}/media_publish",
                data={"creation_id": cid, "access_token": token},
            )
            pub.raise_for_status()
            return PublishResult(ok=True, external_id=str(pub.json().get("id", "")))

    # Facebook Page
    page_id = settings.facebook_page_id
    if not page_id:
        return PublishResult(ok=False, error="FACEBOOK_PAGE_ID missing")
    async with httpx.AsyncClient(timeout=60.0) as client:
        if image_paths:
            resp = await client.post(
                f"https://graph.facebook.com/v21.0/{page_id}/photos",
                data={"url": image_paths[0], "caption": text, "access_token": token},
            )
        else:
            resp = await client.post(
                f"https://graph.facebook.com/v21.0/{page_id}/feed",
                data={"message": text, "link": link, "access_token": token},
            )
        resp.raise_for_status()
        return PublishResult(ok=True, external_id=str(resp.json().get("id", "")))


async def _publish_linkedin(text: str, image_paths: list[str]) -> PublishResult:
    token = settings.linkedin_access_token
    urn = settings.linkedin_organization_urn
    if not urn:
        return PublishResult(ok=False, error="LINKEDIN_ORGANIZATION_URN missing")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    payload = {
        "author": urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.linkedin.com/v2/ugcPosts", headers=headers, json=payload
        )
        resp.raise_for_status()
        return PublishResult(ok=True, external_id=str(resp.json().get("id", "")))


async def _publish_x(text: str, image_paths: list[str]) -> PublishResult:
    # Real OAuth1 signing omitted for brevity — in production use tweepy or requests-oauthlib.
    return PublishResult(ok=False, error="X OAuth1 signing not implemented — use dry run")


async def _publish_tiktok(text: str, image_paths: list[str]) -> PublishResult:
    return PublishResult(ok=False, error="TikTok upload not implemented — use dry run")


# ------------------------ Analytics ingestion ------------------------

async def fetch_analytics_for_client(
    *, client_id: int, platform: Platform, since: datetime, until: datetime
) -> list[dict[str, Any]]:
    """Return a list of daily snapshots. Real fetches if credentials exist,
    otherwise a realistic simulated series."""
    if platform in (Platform.INSTAGRAM, Platform.FACEBOOK) and settings.has_meta():
        try:
            return await _fetch_meta_insights(platform, since, until)
        except Exception as e:  # noqa: BLE001
            log.warning("Meta insights failed: %s", e)
    if platform == Platform.LINKEDIN and settings.has_linkedin():
        try:
            return await _fetch_linkedin_insights(since, until)
        except Exception as e:  # noqa: BLE001
            log.warning("LinkedIn insights failed: %s", e)

    return _simulated_series(client_id, platform, since, until)


async def _fetch_meta_insights(
    platform: Platform, since: datetime, until: datetime
) -> list[dict[str, Any]]:
    token = settings.meta_page_access_token
    node = (
        settings.instagram_business_account_id
        if platform == Platform.INSTAGRAM
        else settings.facebook_page_id
    )
    if not node:
        return []
    metrics = "impressions,reach,profile_views,follower_count"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            f"https://graph.facebook.com/v21.0/{node}/insights",
            params={
                "metric": metrics,
                "since": int(since.timestamp()),
                "until": int(until.timestamp()),
                "access_token": token,
            },
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
    # Shape into daily rows
    rows: dict[str, dict[str, Any]] = {}
    for series in data:
        name = series.get("name")
        for v in series.get("values", []):
            d = v.get("end_time", "")[:10]
            rows.setdefault(d, {"date": d})[name] = v.get("value", 0)
    return [
        {
            "date": r["date"],
            "impressions": int(r.get("impressions", 0) or 0),
            "reach": int(r.get("reach", 0) or 0),
            "profile_visits": int(r.get("profile_views", 0) or 0),
            "followers": int(r.get("follower_count", 0) or 0),
            "engagement": 0,
            "clicks": 0,
            "video_views": 0,
            "spend": 0.0,
            "conversions": 0,
            "raw": r,
        }
        for r in rows.values()
    ]


async def _fetch_linkedin_insights(since: datetime, until: datetime) -> list[dict[str, Any]]:
    return []  # Real endpoint: /v2/organizationalEntityShareStatistics


def _simulated_series(
    client_id: int, platform: Platform, since: datetime, until: datetime
) -> list[dict[str, Any]]:
    random.seed(hash((client_id, platform.value)) & 0xFFFFFFFF)
    base = {
        Platform.INSTAGRAM: 12000,
        Platform.FACEBOOK: 8500,
        Platform.LINKEDIN: 5200,
        Platform.X: 3400,
        Platform.TIKTOK: 18000,
        Platform.PINTEREST: 4100,
        Platform.THREADS: 1500,
        Platform.YOUTUBE: 22000,
    }.get(platform, 5000)
    days = max(1, (until - since).days + 1)
    out: list[dict[str, Any]] = []
    followers = base
    for i in range(days):
        day = since + timedelta(days=i)
        impressions = int(base * random.uniform(0.6, 1.4))
        reach = int(impressions * random.uniform(0.5, 0.85))
        engagement = int(impressions * random.uniform(0.02, 0.09))
        clicks = int(engagement * random.uniform(0.1, 0.4))
        conversions = int(clicks * random.uniform(0.02, 0.08))
        video_views = int(impressions * random.uniform(0.1, 0.5))
        spend = round(random.uniform(5, 80), 2)
        followers += random.randint(-3, 22)
        out.append(
            {
                "date": day.strftime("%Y-%m-%d"),
                "followers": followers,
                "impressions": impressions,
                "reach": reach,
                "engagement": engagement,
                "clicks": clicks,
                "profile_visits": int(reach * random.uniform(0.02, 0.06)),
                "video_views": video_views,
                "spend": spend,
                "conversions": conversions,
                "raw": {"simulated": True},
            }
        )
    return out
