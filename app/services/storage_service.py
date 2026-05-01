"""File storage + text extraction for information-hub documents."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from ..config import settings

log = logging.getLogger("rosaroad.storage")


def save_upload(file_bytes: bytes, original_name: str, subdir: str = "") -> tuple[str, Path]:
    """Save a binary upload and return (relative_path, absolute_path)."""
    base = settings.upload_path
    if subdir:
        base = base / subdir
        base.mkdir(parents=True, exist_ok=True)
    ext = Path(original_name).suffix.lower() or ".bin"
    fname = f"{uuid.uuid4().hex}{ext}"
    path = base / fname
    path.write_bytes(file_bytes)
    rel = path.relative_to(settings.upload_path.parent)
    return str(rel).replace("\\", "/"), path


def extract_text(path: Path, mime: str) -> str:
    """Best-effort text extraction for PDFs, text files, and markdown."""
    try:
        suffix = path.suffix.lower()
        if suffix == ".pdf" or "pdf" in mime:
            try:
                from pypdf import PdfReader

                reader = PdfReader(str(path))
                chunks: list[str] = []
                for page in reader.pages[:25]:  # cap at 25 pages
                    try:
                        chunks.append(page.extract_text() or "")
                    except Exception:  # noqa: BLE001
                        pass
                return "\n".join(chunks).strip()
            except Exception as e:  # noqa: BLE001
                log.warning("PDF extraction failed: %s", e)
                return ""
        if suffix in (".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm"):
            return path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:  # noqa: BLE001
        log.warning("Text extraction failed for %s: %s", path, e)
    return ""
