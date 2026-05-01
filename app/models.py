"""SQLAlchemy ORM models for Rosa Road Studio.

Covers: Users, Clients, Brand CI, Documents/Assets, Content, Variants,
ScheduledPosts, Approvals, Comments, AnalyticsSnapshots, KeywordResearch,
HashtagSets, Platforms per client, and AuditLog.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ---------- Enums ----------

class UserRole(str, enum.Enum):
    ADMIN = "admin"       # Agency owner — full access
    EDITOR = "editor"     # Agency team member — create/edit
    CLIENT = "client"     # External client — view/approve only


class ContentStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    ARCHIVED = "archived"


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    X = "x"
    TIKTOK = "tiktok"
    PINTEREST = "pinterest"
    THREADS = "threads"
    YOUTUBE = "youtube"


class AssetKind(str, enum.Enum):
    DOCUMENT = "document"        # PDF, DOCX, TXT — information hub
    REFERENCE_IMAGE = "reference_image"  # image used as reference for generation
    LOGO = "logo"
    BRAND_ASSET = "brand_asset"  # any other brand file
    GENERATED = "generated"      # AI-generated output


# ---------- Users ----------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.EDITOR)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    comments: Mapped[list["Comment"]] = relationship(back_populates="author", cascade="all, delete-orphan")


# ---------- Clients ----------

class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    industry: Mapped[str] = mapped_column(String(120), default="")
    website: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    brand_ci: Mapped["BrandCI"] = relationship(
        back_populates="client", uselist=False, cascade="all, delete-orphan"
    )
    documents: Mapped[list["Asset"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    contents: Mapped[list["ContentItem"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    platform_connections: Mapped[list["PlatformConnection"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    analytics: Mapped[list["AnalyticsSnapshot"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    keyword_research: Mapped[list["KeywordResearch"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    hashtag_sets: Mapped[list["HashtagSet"]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


# ---------- Brand CI (Corporate Identity) ----------

class BrandCI(Base):
    """Client brand kit — logos, colors, fonts, voice, tone, guidelines."""
    __tablename__ = "brand_ci"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), unique=True)

    # Visual identity
    primary_color: Mapped[str] = mapped_column(String(16), default="#E0115F")   # Rosa by default
    secondary_color: Mapped[str] = mapped_column(String(16), default="#111111")
    accent_color: Mapped[str] = mapped_column(String(16), default="#F5F5F5")
    font_heading: Mapped[str] = mapped_column(String(120), default="Inter")
    font_body: Mapped[str] = mapped_column(String(120), default="Inter")
    logo_asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)

    # Verbal identity
    voice: Mapped[str] = mapped_column(Text, default="")             # e.g. "confident, warm, direct"
    tone: Mapped[str] = mapped_column(Text, default="")              # e.g. "friendly, professional"
    tagline: Mapped[str] = mapped_column(String(500), default="")
    do_words: Mapped[str] = mapped_column(Text, default="")          # comma separated words to use
    dont_words: Mapped[str] = mapped_column(Text, default="")        # comma separated words to avoid
    target_audience: Mapped[str] = mapped_column(Text, default="")
    key_messages: Mapped[str] = mapped_column(Text, default="")
    guidelines: Mapped[str] = mapped_column(Text, default="")        # freeform extra guidelines

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    client: Mapped["Client"] = relationship(back_populates="brand_ci")


# ---------- Assets (documents, reference images, logos, generated) ----------

class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    kind: Mapped[AssetKind] = mapped_column(Enum(AssetKind), default=AssetKind.DOCUMENT)
    filename: Mapped[str] = mapped_column(String(512))
    original_name: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    path: Mapped[str] = mapped_column(String(1024))                  # relative path under uploads/ or generated/
    extracted_text: Mapped[str] = mapped_column(Text, default="")    # for information-hub context (PDF/txt/md)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="documents")


# ---------- Content items & variants ----------

class ContentItem(Base):
    __tablename__ = "content_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    prompt: Mapped[str] = mapped_column(Text)                         # user's creative prompt
    extra_context: Mapped[str] = mapped_column(Text, default="")      # additional text context
    reference_asset_ids: Mapped[list] = mapped_column(JSON, default=list)  # ids of Asset(REFERENCE_IMAGE)
    document_asset_ids: Mapped[list] = mapped_column(JSON, default=list)   # ids of Asset(DOCUMENT) used
    platforms: Mapped[list] = mapped_column(JSON, default=list)       # list[str] of Platform values
    formats: Mapped[list] = mapped_column(JSON, default=list)         # list[str] e.g. ["1:1","4:5","9:16","16:9"]
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus), default=ContentStatus.DRAFT)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    client: Mapped["Client"] = relationship(back_populates="contents")
    variants: Mapped[list["ContentVariant"]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    scheduled_posts: Mapped[list["ScheduledPost"]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="content", cascade="all, delete-orphan"
    )


class ContentVariant(Base):
    """One generated variant: a caption, hashtags, and 0..N images for specific formats."""
    __tablename__ = "content_variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), index=True)

    label: Mapped[str] = mapped_column(String(120), default="")     # e.g. "Variant A"
    caption: Mapped[str] = mapped_column(Text, default="")
    headline: Mapped[str] = mapped_column(String(500), default="")
    cta: Mapped[str] = mapped_column(String(255), default="")       # call to action
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    image_asset_ids: Mapped[list] = mapped_column(JSON, default=list)  # Asset(GENERATED) ids
    aspect_ratios: Mapped[list] = mapped_column(JSON, default=list)    # parallel to image_asset_ids
    provider: Mapped[str] = mapped_column(String(64), default="stub")  # gemini / anthropic / stub
    selected: Mapped[bool] = mapped_column(Boolean, default=False)     # marked as chosen
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    content: Mapped["ContentItem"] = relationship(back_populates="variants")


# ---------- Scheduling & publishing ----------

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("content_variants.id"))
    platform: Mapped[Platform] = mapped_column(Enum(Platform))
    scheduled_for: Mapped[datetime] = mapped_column(DateTime, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus), default=ContentStatus.SCHEDULED)
    external_post_id: Mapped[str] = mapped_column(String(255), default="")
    error: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)   # resolved caption/hashtags/image paths

    content: Mapped["ContentItem"] = relationship(back_populates="scheduled_posts")


# ---------- Approvals & comments ----------

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    content: Mapped["ContentItem"] = relationship(back_populates="comments")
    author: Mapped["User | None"] = relationship(back_populates="comments")


# ---------- Platforms per client ----------

class PlatformConnection(Base):
    __tablename__ = "platform_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform))
    handle: Mapped[str] = mapped_column(String(255), default="")   # @rosa_road
    external_id: Mapped[str] = mapped_column(String(255), default="")
    access_token: Mapped[str] = mapped_column(Text, default="")    # encrypted in production
    refresh_token: Mapped[str] = mapped_column(Text, default="")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    client: Mapped["Client"] = relationship(back_populates="platform_connections")


# ---------- Analytics ----------

class AnalyticsSnapshot(Base):
    """Daily snapshot of performance metrics per platform."""
    __tablename__ = "analytics_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    platform: Mapped[Platform] = mapped_column(Enum(Platform))
    date: Mapped[datetime] = mapped_column(DateTime, index=True)
    followers: Mapped[int] = mapped_column(Integer, default=0)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    reach: Mapped[int] = mapped_column(Integer, default=0)
    engagement: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    profile_visits: Mapped[int] = mapped_column(Integer, default=0)
    video_views: Mapped[int] = mapped_column(Integer, default=0)
    spend: Mapped[float] = mapped_column(Float, default=0.0)
    conversions: Mapped[int] = mapped_column(Integer, default=0)
    raw: Mapped[dict] = mapped_column(JSON, default=dict)

    client: Mapped["Client"] = relationship(back_populates="analytics")


# ---------- Keyword & Hashtag research (saved sets) ----------

class KeywordResearch(Base):
    __tablename__ = "keyword_research"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    topic: Mapped[str] = mapped_column(String(500))
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    # each item: {"keyword": str, "volume": int, "difficulty": int, "intent": str, "trend": str}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    provider: Mapped[str] = mapped_column(String(64), default="ai")

    client: Mapped["Client"] = relationship(back_populates="keyword_research")


class HashtagSet(Base):
    __tablename__ = "hashtag_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    topic: Mapped[str] = mapped_column(String(500), default="")
    platform: Mapped[Platform | None] = mapped_column(Enum(Platform), nullable=True)
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    # each: {"tag": "#foo", "reach_estimate": int, "competition": str}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="hashtag_sets")


# ---------- Audit log ----------

class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(255))
    subject_type: Mapped[str] = mapped_column(String(64), default="")
    subject_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
