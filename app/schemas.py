"""Pydantic response/request schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr

from .models import AssetKind, ContentStatus, Platform, UserRole


# ---------- Base ----------

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Users ----------

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.EDITOR


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMBase):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Clients ----------

class ClientCreate(BaseModel):
    name: str
    industry: str = ""
    website: str = ""
    description: str = ""
    contact_email: str = ""
    contact_phone: str = ""


class ClientUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    website: str | None = None
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    archived: bool | None = None


class ClientOut(ORMBase):
    id: int
    name: str
    industry: str
    website: str
    description: str
    contact_email: str
    contact_phone: str
    archived: bool
    created_at: datetime


# ---------- Brand CI ----------

class BrandCIUpdate(BaseModel):
    primary_color: str | None = None
    secondary_color: str | None = None
    accent_color: str | None = None
    font_heading: str | None = None
    font_body: str | None = None
    voice: str | None = None
    tone: str | None = None
    tagline: str | None = None
    do_words: str | None = None
    dont_words: str | None = None
    target_audience: str | None = None
    key_messages: str | None = None
    guidelines: str | None = None


class BrandCIOut(ORMBase):
    id: int
    client_id: int
    primary_color: str
    secondary_color: str
    accent_color: str
    font_heading: str
    font_body: str
    logo_asset_id: int | None
    voice: str
    tone: str
    tagline: str
    do_words: str
    dont_words: str
    target_audience: str
    key_messages: str
    guidelines: str


# ---------- Assets ----------

class AssetOut(ORMBase):
    id: int
    client_id: int
    kind: AssetKind
    filename: str
    original_name: str
    mime_type: str
    size_bytes: int
    path: str
    width: int | None
    height: int | None
    created_at: datetime


# ---------- Content ----------

class GenerateRequest(BaseModel):
    client_id: int
    title: str = "Untitled campaign"
    prompt: str
    extra_context: str = ""
    reference_asset_ids: list[int] = []
    document_asset_ids: list[int] = []
    platforms: list[Platform] = [Platform.INSTAGRAM]
    formats: list[str] = ["1:1", "4:5", "9:16"]   # Nano Banana 2 ratios
    num_variants: int = 3
    tone_override: str = ""                        # optional runtime tone tweak


class VariantOut(ORMBase):
    id: int
    content_id: int
    label: str
    caption: str
    headline: str
    cta: str
    hashtags: list
    keywords: list
    image_asset_ids: list
    aspect_ratios: list
    provider: str
    selected: bool
    created_at: datetime


class ContentOut(ORMBase):
    id: int
    client_id: int
    title: str
    prompt: str
    extra_context: str
    platforms: list
    formats: list
    status: ContentStatus
    created_at: datetime
    updated_at: datetime
    variants: list[VariantOut] = []


# ---------- Comments ----------

class CommentCreate(BaseModel):
    body: str


class CommentOut(ORMBase):
    id: int
    content_id: int
    author_id: int | None
    body: str
    created_at: datetime


# ---------- Scheduling ----------

class ScheduleCreate(BaseModel):
    content_id: int
    variant_id: int
    platform: Platform
    scheduled_for: datetime


class ScheduledPostOut(ORMBase):
    id: int
    content_id: int
    variant_id: int
    platform: Platform
    scheduled_for: datetime
    published_at: datetime | None
    status: ContentStatus
    external_post_id: str
    error: str


# ---------- Research ----------

class KeywordRequest(BaseModel):
    client_id: int
    topic: str
    language: str = "en"
    region: str = ""


class KeywordOut(BaseModel):
    keyword: str
    volume: int
    difficulty: int
    intent: str
    trend: str


class KeywordResearchOut(ORMBase):
    id: int
    client_id: int
    topic: str
    keywords: list[dict[str, Any]]
    provider: str
    created_at: datetime


class HashtagRequest(BaseModel):
    client_id: int
    topic: str
    platform: Platform = Platform.INSTAGRAM
    count: int = 20


class HashtagOut(BaseModel):
    tag: str
    reach_estimate: int
    competition: str


class HashtagSetOut(ORMBase):
    id: int
    client_id: int
    name: str
    topic: str
    platform: Platform | None
    hashtags: list[dict[str, Any]]
    created_at: datetime


# ---------- Text suggestions ----------

class TextSuggestRequest(BaseModel):
    client_id: int
    seed: str                       # what the user has started typing
    kind: str = "caption"           # caption | headline | cta | hook
    platform: Platform = Platform.INSTAGRAM
    count: int = 5


class TextSuggestOut(BaseModel):
    suggestions: list[str]


# ---------- Analytics ----------

class AnalyticsSummary(BaseModel):
    client_id: int
    range_days: int
    total_followers: int
    total_impressions: int
    total_reach: int
    total_engagement: int
    total_clicks: int
    total_spend: float
    total_conversions: int
    engagement_rate: float
    per_platform: dict[str, dict[str, float]]
    daily: list[dict[str, Any]]
