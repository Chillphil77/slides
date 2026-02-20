import os
import re
import sqlite3
import hashlib
import mimetypes
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup
from flask import Flask, render_template, request, jsonify, send_from_directory, abort

app = Flask(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "articles.db")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "data", "images")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS articles (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                url         TEXT    NOT NULL,
                title       TEXT,
                author      TEXT,
                date        TEXT,
                site_name   TEXT,
                excerpt     TEXT,
                content     TEXT,
                cover_image TEXT,
                reading_time INTEGER,
                saved_at    TEXT    NOT NULL,
                is_read     INTEGER DEFAULT 0,
                is_starred  INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS images (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id  INTEGER NOT NULL,
                original_url TEXT   NOT NULL,
                local_path  TEXT    NOT NULL,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );
        """)


# ---------------------------------------------------------------------------
# Article fetching helpers
# ---------------------------------------------------------------------------

def _url_to_filename(url: str, content_type: str = "") -> str:
    """Create a stable local filename from a URL."""
    digest = hashlib.md5(url.encode()).hexdigest()
    ext = ""
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ""
        if ext == ".jpe":
            ext = ".jpg"
    if not ext:
        path = urlparse(url).path
        _, possible_ext = os.path.splitext(path)
        ext = possible_ext if possible_ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"} else ".jpg"
    return f"{digest}{ext}"


def _download_image(url: str) -> str | None:
    """Download an image and return its local filename, or None on failure."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        filename = _url_to_filename(url, content_type)
        local_path = os.path.join(IMAGES_DIR, filename)
        if not os.path.exists(local_path):
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
        return filename
    except Exception:
        return None


def _rewrite_images(html: str, base_url: str, article_id: int, conn) -> str:
    """Download all <img> sources and rewrite src to local URLs."""
    soup = BeautifulSoup(html, "lxml")
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src:
            continue
        abs_url = urljoin(base_url, src)
        if not abs_url.startswith("http"):
            img.decompose()
            continue
        filename = _download_image(abs_url)
        if filename:
            conn.execute(
                "INSERT OR IGNORE INTO images (article_id, original_url, local_path) VALUES (?, ?, ?)",
                (article_id, abs_url, filename),
            )
            img["src"] = f"/image/{filename}"
            img.attrs = {k: v for k, v in img.attrs.items() if k in ("src", "alt", "class")}
        else:
            img.decompose()
    # Remove all external links that load resources
    for tag in soup.find_all(["script", "iframe", "video", "audio"]):
        tag.decompose()
    return str(soup)


def _extract_cover(soup: BeautifulSoup, base_url: str) -> str | None:
    """Try to find the main article image (og:image, twitter:image, or first large img)."""
    for prop in ("og:image", "twitter:image", "twitter:image:src"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            return urljoin(base_url, tag["content"])
    return None


def _reading_time(text: str) -> int:
    """Estimate reading time in minutes (200 wpm)."""
    words = len(re.findall(r"\w+", text))
    return max(1, round(words / 200))


def fetch_article(url: str) -> dict:
    """Fetch a URL and extract article metadata + content."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"Seite konnte nicht geladen werden: {e}")

    html_raw = resp.text
    soup = BeautifulSoup(html_raw, "lxml")

    # --- Metadata ---
    def meta(prop):
        tag = (
            soup.find("meta", property=prop)
            or soup.find("meta", attrs={"name": prop})
        )
        return tag["content"].strip() if tag and tag.get("content") else ""

    title = (
        meta("og:title")
        or (soup.find("title") and soup.find("title").get_text().strip())
        or url
    )
    author = meta("author") or meta("article:author") or meta("og:article:author")
    date = (
        meta("article:published_time")
        or meta("og:article:published_time")
        or meta("date")
    )
    if date and "T" in date:
        date = date.split("T")[0]
    site_name = meta("og:site_name") or urlparse(url).netloc
    excerpt = meta("og:description") or meta("description")
    cover_url = _extract_cover(soup, url)

    # --- Content via trafilatura ---
    content_html = trafilatura.extract(
        html_raw,
        output_format="html",
        include_images=True,
        include_links=False,
        include_tables=True,
        favor_recall=True,
        url=url,
    )

    if not content_html:
        raise ValueError("Kein Artikelinhalt gefunden.")

    return {
        "url": url,
        "title": title,
        "author": author,
        "date": date,
        "site_name": site_name,
        "excerpt": excerpt[:300] if excerpt else "",
        "content_html": content_html,
        "cover_url": cover_url,
        "reading_time": _reading_time(content_html),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    filter_mode = request.args.get("filter", "all")
    search = request.args.get("q", "").strip()
    with get_db() as conn:
        if search:
            rows = conn.execute(
                """SELECT id, url, title, author, date, site_name, excerpt,
                          cover_image, reading_time, saved_at, is_read, is_starred
                   FROM articles
                   WHERE title LIKE ? OR excerpt LIKE ? OR site_name LIKE ?
                   ORDER BY saved_at DESC""",
                (f"%{search}%", f"%{search}%", f"%{search}%"),
            ).fetchall()
        elif filter_mode == "unread":
            rows = conn.execute(
                "SELECT * FROM articles WHERE is_read=0 ORDER BY saved_at DESC"
            ).fetchall()
        elif filter_mode == "starred":
            rows = conn.execute(
                "SELECT * FROM articles WHERE is_starred=1 ORDER BY saved_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM articles ORDER BY saved_at DESC"
            ).fetchall()
    return render_template("index.html", articles=rows, filter_mode=filter_mode, search=search)


@app.route("/add", methods=["POST"])
def add_article():
    url = (request.json or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "Keine URL angegeben"}), 400
    if not url.startswith("http"):
        url = "https://" + url

    # Check duplicate
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM articles WHERE url=?", (url,)).fetchone()
        if existing:
            return jsonify({"error": "Artikel bereits gespeichert", "id": existing["id"]}), 409

    try:
        data = fetch_article(url)
    except ValueError as e:
        return jsonify({"error": str(e)}), 422

    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO articles
               (url, title, author, date, site_name, excerpt, content, cover_image,
                reading_time, saved_at, is_read, is_starred)
               VALUES (?,?,?,?,?,?,?,?,?,?,0,0)""",
            (
                data["url"], data["title"], data["author"], data["date"],
                data["site_name"], data["excerpt"], data["content_html"],
                None,  # cover saved separately below
                data["reading_time"],
                datetime.now().strftime("%Y-%m-%d %H:%M"),
            ),
        )
        article_id = cur.lastrowid

        # Download & rewrite images inside content
        rewritten = _rewrite_images(data["content_html"], url, article_id, conn)
        conn.execute("UPDATE articles SET content=? WHERE id=?", (rewritten, article_id))

        # Download cover image
        cover_local = None
        if data["cover_url"]:
            cover_local = _download_image(data["cover_url"])
            if cover_local:
                conn.execute(
                    "UPDATE articles SET cover_image=? WHERE id=?",
                    (cover_local, article_id),
                )

    return jsonify({"id": article_id, "title": data["title"]}), 201


@app.route("/article/<int:article_id>")
def read_article(article_id):
    with get_db() as conn:
        article = conn.execute(
            "SELECT * FROM articles WHERE id=?", (article_id,)
        ).fetchone()
        if not article:
            abort(404)
        conn.execute("UPDATE articles SET is_read=1 WHERE id=?", (article_id,))
    return render_template("article.html", article=article)


@app.route("/api/article/<int:article_id>", methods=["DELETE"])
def delete_article(article_id):
    with get_db() as conn:
        # Remove local images
        imgs = conn.execute(
            "SELECT local_path FROM images WHERE article_id=?", (article_id,)
        ).fetchall()
        for img in imgs:
            path = os.path.join(IMAGES_DIR, img["local_path"])
            if os.path.exists(path):
                os.remove(path)
        conn.execute("DELETE FROM images WHERE article_id=?", (article_id,))
        conn.execute("DELETE FROM articles WHERE id=?", (article_id,))
    return jsonify({"ok": True})


@app.route("/api/article/<int:article_id>/star", methods=["POST"])
def toggle_star(article_id):
    with get_db() as conn:
        row = conn.execute("SELECT is_starred FROM articles WHERE id=?", (article_id,)).fetchone()
        if not row:
            abort(404)
        new_val = 0 if row["is_starred"] else 1
        conn.execute("UPDATE articles SET is_starred=? WHERE id=?", (new_val, article_id))
    return jsonify({"starred": bool(new_val)})


@app.route("/api/article/<int:article_id>/read", methods=["POST"])
def toggle_read(article_id):
    with get_db() as conn:
        row = conn.execute("SELECT is_read FROM articles WHERE id=?", (article_id,)).fetchone()
        if not row:
            abort(404)
        new_val = 0 if row["is_read"] else 1
        conn.execute("UPDATE articles SET is_read=? WHERE id=?", (new_val, article_id))
    return jsonify({"read": bool(new_val)})


@app.route("/image/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
