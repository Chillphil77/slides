"""Application settings loaded from environment variables."""
from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Rosa Road Studio"
    secret_key: str = "change-me"
    environment: str = "development"
    base_url: str = "http://localhost:8000"

    database_url: str = "sqlite:///./data/rosaroad.db"

    # AI
    gemini_api_key: str = ""
    gemini_text_model: str = "gemini-2.5-flash"
    gemini_image_model: str = "gemini-3.0-flash-image"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-6"

    serpapi_key: str = ""

    # Social
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_page_access_token: str = ""
    instagram_business_account_id: str = ""
    facebook_page_id: str = ""

    linkedin_access_token: str = ""
    linkedin_organization_urn: str = ""

    x_api_key: str = ""
    x_api_secret: str = ""
    x_access_token: str = ""
    x_access_token_secret: str = ""

    tiktok_access_token: str = ""

    # Storage
    upload_dir: str = "./uploads"
    generated_dir: str = "./generated"
    data_dir: str = "./data"

    # Scheduler
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 30

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def generated_path(self) -> Path:
        p = Path(self.generated_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def data_path(self) -> Path:
        p = Path(self.data_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)

    def has_meta(self) -> bool:
        return bool(self.meta_page_access_token)

    def has_linkedin(self) -> bool:
        return bool(self.linkedin_access_token)

    def has_x(self) -> bool:
        return bool(self.x_access_token)

    def has_tiktok(self) -> bool:
        return bool(self.tiktok_access_token)


settings = Settings()
