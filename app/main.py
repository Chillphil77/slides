"""Rosa Road Studio — FastAPI application entry."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .routers import (
    analytics,
    assets,
    auth as auth_router,
    calendar,
    clients,
    content,
    dashboard,
    research,
)
from .services.scheduler_service import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("rosaroad")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    log.info("%s started — env=%s", settings.app_name, settings.environment)
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Rosa Road Studio — AI-powered advertising content automation platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(auth_router.router)
app.include_router(dashboard.router)
app.include_router(clients.router)
app.include_router(assets.router)
app.include_router(content.router)
app.include_router(research.router)
app.include_router(calendar.router)
app.include_router(analytics.router)

# ---- Static (frontend SPA + generated/uploaded files) ----
BASE = Path(__file__).resolve().parent.parent
static_dir = BASE / "static"
templates_dir = BASE / "templates"

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/files/{path:path}")
def serve_file(path: str):
    """Serve any file from uploads/ or generated/ by its stored relative path."""
    candidate = (BASE / path).resolve()
    # Prevent traversal
    allowed_roots = [
        (BASE / "uploads").resolve(),
        (BASE / "generated").resolve(),
    ]
    if not any(str(candidate).startswith(str(root)) for root in allowed_roots):
        return HTMLResponse("Forbidden", status_code=403)
    if not candidate.exists() or not candidate.is_file():
        return HTMLResponse("Not found", status_code=404)
    return FileResponse(str(candidate))


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    html = (templates_dir / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "gemini": "connected" if settings.has_gemini() else "dry-run",
        "anthropic": "connected" if settings.has_anthropic() else "dry-run",
        "meta": "connected" if settings.has_meta() else "dry-run",
        "linkedin": "connected" if settings.has_linkedin() else "dry-run",
    }


# SPA fallback — let the frontend router handle unknown routes
@app.get("/{full_path:path}", response_class=HTMLResponse)
def spa_fallback(full_path: str, request: Request) -> HTMLResponse:
    if full_path.startswith(("api/", "static/", "files/")):
        return HTMLResponse("Not found", status_code=404)
    html = (templates_dir / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)
