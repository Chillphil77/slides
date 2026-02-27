import os
import re
import sqlite3
import hashlib
import mimetypes
import random
import string
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup
from flask import Flask, render_template, request, jsonify, send_from_directory, abort

app = Flask(__name__)

DB_PATH    = os.path.join(os.path.dirname(__file__), "data", "articles.db")
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
            CREATE TABLE IF NOT EXISTS topics (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                icon        TEXT    DEFAULT '📰',
                color       TEXT    DEFAULT '#2563eb',
                position    INTEGER DEFAULT 0,
                is_custom   INTEGER DEFAULT 0,
                is_active   INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS faq_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                question    TEXT    NOT NULL,
                answer      TEXT    NOT NULL,
                category    TEXT    DEFAULT 'Allgemein',
                position    INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS coupons (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code        TEXT    UNIQUE NOT NULL,
                discount_pct INTEGER DEFAULT 10,
                plan        TEXT    DEFAULT 'lifetime',
                max_uses    INTEGER DEFAULT 1,
                uses        INTEGER DEFAULT 0,
                valid_until TEXT,
                created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                username    TEXT,
                email       TEXT,
                plan        TEXT    DEFAULT 'free',
                api_key     TEXT,
                credits     INTEGER DEFAULT 0,
                created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Seed topics
        if conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0] == 0:
            topics = [
                ("Technologie", "💻", "#2563eb", 0),
                ("Wissenschaft", "🔬", "#7c3aed", 1),
                ("Business",     "📈", "#059669", 2),
                ("Gesundheit",   "❤️",  "#dc2626", 3),
                ("Design",       "🎨", "#d97706", 4),
                ("KI & ML",      "🤖", "#0891b2", 5),
                ("Kultur",       "🎭", "#6d28d9", 6),
                ("Sport",        "⚽", "#84cc16", 7),
            ]
            conn.executemany(
                "INSERT INTO topics (name, icon, color, position) VALUES (?,?,?,?)", topics
            )

        # Seed FAQ
        if conn.execute("SELECT COUNT(*) FROM faq_items").fetchone()[0] == 0:
            faq = [
                ("Was ist Noozly?",
                 "Noozly ist deine persönliche Read-it-Later App. Speichere Artikel von überall, lese sie offline in einem ruhigen Reader-Format und entdecke neue Inhalte in deinen Lieblingsthemen.",
                 "Allgemein", 0),
                ("Wie füge ich Artikel hinzu?",
                 "Gehe zur Bibliothek, füge eine URL in das Eingabefeld ein und drücke Enter oder den + Button. Noozly extrahiert automatisch Titel, Inhalt und Bild – auch für den Offline-Lesemodus.",
                 "Nutzung", 1),
                ("Kann ich Noozly offline nutzen?",
                 "Ja! Alle gespeicherten Artikel inklusive Bilder werden lokal auf deinem Gerät gespeichert. Du kannst sie jederzeit ohne Internetverbindung lesen.",
                 "Nutzung", 2),
                ("Wie viele Artikel kann ich speichern?",
                 "Free: bis zu 100 Artikel. Lifetime Deal & Premium Deluxe: unbegrenzte Speicherung.",
                 "Nutzung", 3),
                ("Was ist BYOK?",
                 "BYOK steht für 'Bring Your Own Key'. Du verwendest deinen eigenen KI-API-Schlüssel (z.B. OpenAI). Damit nutzt du KI-Funktionen direkt – du zahlst nur die tatsächlichen API-Kosten, ohne Aufpreise.",
                 "KI-Funktionen", 4),
                ("Lifetime Deal: Sind KI-Credits enthalten?",
                 "Nein. Der Lifetime Deal beinhaltet dauerhaften Zugang zu allen App-Funktionen, aber KEINE monatlichen KI-Credits. KI-Funktionen (Zusammenfassungen etc.) nutzt du mit deinem eigenen API-Schlüssel (BYOK).",
                 "Abonnement", 5),
                ("Was bekomme ich mit Premium Deluxe?",
                 "Premium Deluxe beinhaltet monatliche KI-Credits für automatische Artikel-Zusammenfassungen und -Übersetzungen – kein eigener API-Schlüssel nötig. Dazu unbegrenzte Speicherung und Priority-Support.",
                 "Abonnement", 6),
                ("Wie füge ich meinen API-Schlüssel hinzu?",
                 "Gehe zu Einstellungen → KI-Integration und füge deinen OpenAI-API-Schlüssel ein. Dieser wird sicher gespeichert und ausschließlich für deine Anfragen verwendet.",
                 "KI-Funktionen", 7),
                ("Wie funktioniert die Discover-Seite?",
                 "Auf der Discover-Seite findest du Themen, die dich interessieren. Du kannst die Reihenfolge per Drag & Drop anpassen und eigene Themen hinzufügen.",
                 "Nutzung", 8),
                ("Wie kündige ich mein Abo?",
                 "Abonnements werden über den App Store (iOS) verwaltet. Gehe zu Einstellungen → Apple ID → Abonnements, um dein Abonnement zu verwalten oder zu kündigen.",
                 "Abonnement", 9),
                ("Wie sichere ich meine Daten?",
                 "Deine Artikel werden lokal gespeichert. Du kannst jederzeit ein Backup exportieren. Wir verkaufen keine persönlichen Daten an Dritte – Datenschutz hat für uns höchste Priorität.",
                 "Datenschutz", 10),
                ("Was passiert wenn ich das Abo kündige?",
                 "Du behältst Zugang bis zum Ende des bezahlten Zeitraums. Danach wechselst du automatisch zum Free-Plan. Deine gespeicherten Artikel bleiben erhalten (bis zum Free-Limit von 100 Artikeln).",
                 "Abonnement", 11),
            ]
            conn.executemany(
                "INSERT INTO faq_items (question, answer, category, position) VALUES (?,?,?,?)", faq
            )


# ---------------------------------------------------------------------------
# Article fetching helpers
# ---------------------------------------------------------------------------

def _url_to_filename(url: str, content_type: str = "") -> str:
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
    for tag in soup.find_all(["script", "iframe", "video", "audio"]):
        tag.decompose()
    return str(soup)


def _extract_cover(soup: BeautifulSoup, base_url: str) -> str | None:
    for prop in ("og:image", "twitter:image", "twitter:image:src"):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            return urljoin(base_url, tag["content"])
    return None


def _reading_time(text: str) -> int:
    words = len(re.findall(r"\w+", text))
    return max(1, round(words / 200))


def fetch_article(url: str) -> dict:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"Seite konnte nicht geladen werden: {e}")

    html_raw = resp.text
    soup = BeautifulSoup(html_raw, "lxml")

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
# Routes – Pages
# ---------------------------------------------------------------------------

@app.route("/")
def dashboard():
    with get_db() as conn:
        total   = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
        unread  = conn.execute("SELECT COUNT(*) FROM articles WHERE is_read=0").fetchone()[0]
        starred = conn.execute("SELECT COUNT(*) FROM articles WHERE is_starred=1").fetchone()[0]
        recent  = conn.execute(
            "SELECT * FROM articles ORDER BY saved_at DESC LIMIT 6"
        ).fetchall()
    return render_template("dashboard.html",
        total=total, unread=unread, starred=starred, recent=recent)


@app.route("/library")
def library():
    filter_mode = request.args.get("filter", "all")
    search = request.args.get("q", "").strip()
    with get_db() as conn:
        if search:
            rows = conn.execute(
                """SELECT * FROM articles
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
    return render_template("library.html", articles=rows, filter_mode=filter_mode, search=search)


# Keep old "/" route working as redirect for bookmarks
@app.route("/index")
def index_redirect():
    return library()


@app.route("/discover")
def discover():
    with get_db() as conn:
        topics = conn.execute(
            "SELECT * FROM topics WHERE is_active=1 ORDER BY position"
        ).fetchall()
    return render_template("discover.html", topics=topics)


@app.route("/faq")
def faq():
    with get_db() as conn:
        items = conn.execute(
            "SELECT * FROM faq_items ORDER BY category, position"
        ).fetchall()
    # Group by category
    categories = {}
    for item in items:
        cat = item["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)
    return render_template("faq.html", categories=categories)


@app.route("/pricing")
def pricing():
    return render_template("pricing.html")


@app.route("/admin")
def admin():
    with get_db() as conn:
        total_articles = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
        total_users    = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_coupons  = conn.execute("SELECT COUNT(*) FROM coupons").fetchone()[0]
        read_articles  = conn.execute("SELECT COUNT(*) FROM articles WHERE is_read=1").fetchone()[0]
        users          = conn.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT 50").fetchall()
        coupons        = conn.execute("SELECT * FROM coupons ORDER BY created_at DESC").fetchall()
    return render_template("admin.html",
        total_articles=total_articles,
        total_users=total_users,
        total_coupons=total_coupons,
        read_articles=read_articles,
        users=users,
        coupons=coupons,
    )


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


@app.route("/image/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)


# ---------------------------------------------------------------------------
# Routes – API (Articles)
# ---------------------------------------------------------------------------

@app.route("/add", methods=["POST"])
def add_article():
    url = (request.json or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "Keine URL angegeben"}), 400
    if not url.startswith("http"):
        url = "https://" + url

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
                None,
                data["reading_time"],
                datetime.now().strftime("%Y-%m-%d %H:%M"),
            ),
        )
        article_id = cur.lastrowid

        rewritten = _rewrite_images(data["content_html"], url, article_id, conn)
        conn.execute("UPDATE articles SET content=? WHERE id=?", (rewritten, article_id))

        cover_local = None
        if data["cover_url"]:
            cover_local = _download_image(data["cover_url"])
            if cover_local:
                conn.execute(
                    "UPDATE articles SET cover_image=? WHERE id=?",
                    (cover_local, article_id),
                )

    return jsonify({"id": article_id, "title": data["title"]}), 201


@app.route("/api/article/<int:article_id>", methods=["DELETE"])
def delete_article(article_id):
    with get_db() as conn:
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


# ---------------------------------------------------------------------------
# Routes – API (Topics)
# ---------------------------------------------------------------------------

@app.route("/api/topics", methods=["GET"])
def api_topics():
    with get_db() as conn:
        topics = [dict(t) for t in
            conn.execute("SELECT * FROM topics WHERE is_active=1 ORDER BY position").fetchall()]
    return jsonify(topics)


@app.route("/api/topics/reorder", methods=["POST"])
def api_topics_reorder():
    order = (request.json or {}).get("order", [])  # list of ids
    with get_db() as conn:
        for i, tid in enumerate(order):
            conn.execute("UPDATE topics SET position=? WHERE id=?", (i, tid))
    return jsonify({"ok": True})


@app.route("/api/topics/add", methods=["POST"])
def api_topics_add():
    data  = request.json or {}
    name  = data.get("name", "").strip()
    icon  = data.get("icon", "📌").strip() or "📌"
    color = data.get("color", "#2563eb")
    if not name:
        return jsonify({"error": "Name erforderlich"}), 400
    with get_db() as conn:
        max_pos = conn.execute("SELECT MAX(position) FROM topics").fetchone()[0] or 0
        cur = conn.execute(
            "INSERT INTO topics (name, icon, color, position, is_custom) VALUES (?,?,?,?,1)",
            (name, icon, color, max_pos + 1)
        )
        tid = cur.lastrowid
    return jsonify({"ok": True, "id": tid, "name": name, "icon": icon, "color": color})


@app.route("/api/topics/<int:tid>", methods=["DELETE"])
def api_topics_delete(tid):
    with get_db() as conn:
        conn.execute(
            "UPDATE topics SET is_active=0 WHERE id=? AND is_custom=1", (tid,)
        )
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Routes – API (FAQ)
# ---------------------------------------------------------------------------

@app.route("/api/faq/search")
def api_faq_search():
    q = request.args.get("q", "").strip().lower()
    with get_db() as conn:
        items = conn.execute(
            "SELECT * FROM faq_items ORDER BY category, position"
        ).fetchall()
    if q:
        items = [i for i in items if q in i["question"].lower() or q in i["answer"].lower()]
    return jsonify([dict(i) for i in items])


# ---------------------------------------------------------------------------
# Routes – API (Admin)
# ---------------------------------------------------------------------------

@app.route("/api/admin/coupon", methods=["POST"])
def api_admin_coupon():
    data       = request.json or {}
    code       = data.get("code", "").strip().upper()
    discount   = int(data.get("discount", 20))
    plan       = data.get("plan", "lifetime")
    max_uses   = int(data.get("max_uses", 1))
    valid_until = data.get("valid_until", "")

    if not code:
        code = "NOOZLY-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    with get_db() as conn:
        try:
            conn.execute(
                "INSERT INTO coupons (code, discount_pct, plan, max_uses, valid_until) VALUES (?,?,?,?,?)",
                (code, discount, plan, max_uses, valid_until)
            )
        except sqlite3.IntegrityError:
            return jsonify({"error": "Code existiert bereits"}), 400

    return jsonify({"ok": True, "code": code})


@app.route("/api/admin/coupon/<int:cid>", methods=["DELETE"])
def api_admin_coupon_delete(cid):
    with get_db() as conn:
        conn.execute("DELETE FROM coupons WHERE id=?", (cid,))
    return jsonify({"ok": True})


@app.route("/api/admin/user", methods=["POST"])
def api_admin_user_add():
    data = request.json or {}
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()
    plan     = data.get("plan", "free")
    credits  = int(data.get("credits", 0))
    if not username:
        return jsonify({"error": "Username erforderlich"}), 400
    with get_db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, email, plan, credits, created_at) VALUES (?,?,?,?,?)",
                (username, email, plan, credits, datetime.now().strftime("%Y-%m-%d %H:%M"))
            )
        except sqlite3.IntegrityError:
            return jsonify({"error": "Email bereits vergeben"}), 400
    return jsonify({"ok": True, "id": cur.lastrowid})


@app.route("/api/admin/user/<int:uid>", methods=["DELETE"])
def api_admin_user_delete(uid):
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE id=?", (uid,))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
