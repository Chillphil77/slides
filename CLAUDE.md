# Noozly – Claude Code Kontext

## Was ist Noozly?
Noozly ist eine persönliche **Read-it-Later Web-App** (Flask + SQLite).
Nutzer können Artikel-URLs speichern, offline lesen, Themen entdecken und ihren Lese-Fortschritt verfolgen.

**Betreiber:** Philipp Jeker (Chillphil77)
**Sprache der App:** Deutsch
**Git-Branch:** `claude/read-it-later-app-ydBff`

---

## Projekt starten

```bash
# 1. Terminal öffnen im Projektordner
cd /home/user/slides

# 2. Abhängigkeiten installieren (einmalig)
pip install -r requirements.txt

# 3. Server starten
python3 app.py

# 4. Im Browser öffnen
# http://localhost:5000
```

> Falls Claude Code Änderungen vornehmen soll, muss `claude` im Verzeichnis `/home/user/slides` gestartet werden.

---

## Projektstruktur

```
/home/user/slides/
├── app.py                  # Flask-Backend (alle Routen, DB-Logik, Gamification)
├── requirements.txt        # Python-Abhängigkeiten
├── data/
│   ├── articles.db         # SQLite-Datenbank
│   └── images/             # Offline gespeicherte Artikel-Bilder
├── templates/
│   ├── base.html           # Navigation, Username-Animation, Theme-Toggle
│   ├── dashboard.html      # Gamification-Dashboard (Streak, Level, Charts)
│   ├── library.html        # Artikel-Bibliothek mit Suche & Filter
│   ├── discover.html       # Themen-Seite (Drag & Drop, eigene Themen)
│   ├── faq.html            # FAQ mit Suchfunktion
│   ├── pricing.html        # Preispläne + Tutorial-Modal
│   ├── admin.html          # Admin-Dashboard (Nutzer, Coupons)
│   └── article.html        # Reader-Ansicht (standalone, kein Nav)
└── static/
    ├── css/style.css       # Komplettes Stylesheet (1600+ Zeilen, Dark Mode)
    └── js/
        ├── base.js         # Username-Animation, Theme, Shine-Effekt
        ├── dashboard.js    # Wetter, Stats, Charts (Chart.js), Errungenschaften
        ├── app.js          # Library-Seite: Artikel hinzufügen, Karten-Aktionen
        ├── discover.js     # Sortable.js Drag & Drop, Themen hinzufügen
        ├── faq.js          # Live-Suche mit Highlighting
        ├── pricing.js      # Tutorial-Modal (5 Schritte)
        └── admin.js        # Coupon- und Nutzerverwaltung
```

---

## Datenbank-Schema (SQLite)

| Tabelle | Beschreibung |
|---|---|
| `articles` | Gespeicherte Artikel (URL, Titel, Content, is_read, is_starred) |
| `images` | Offline-Bilder pro Artikel |
| `topics` | Discover-Themen (voreingestellt + benutzerdefiniert) |
| `faq_items` | FAQ-Einträge nach Kategorie |
| `coupons` | Rabatt-Codes (Code, %, Plan, max. Nutzungen) |
| `users` | Nutzer (Benutzername, E-Mail, Plan, KI-Credits) |
| `reading_sessions` | Protokoll der Lesezeiten (für Streak + Statistiken) |

---

## Seiten & Routen

| Route | Seite | Beschreibung |
|---|---|---|
| `/` | Dashboard | Begrüssung, Wetter+Datum, Streak, Level/XP, Wochenziel, Charts, Errungenschaften |
| `/library` | Bibliothek | Alle Artikel, Filter (ungelesen/markiert), Suche |
| `/discover` | Entdecken | Themen-Kacheln, Drag & Drop, eigene Themen hinzufügen |
| `/faq` | FAQ | Häufige Fragen mit Live-Suche |
| `/pricing` | Preise | Free / Lifetime (BYOK) / Premium Deluxe (Credits) |
| `/admin` | Admin | Nutzerverwaltung, Coupons, App Store Connect Links |
| `/article/<id>` | Reader | Ruhige Lese-Ansicht ohne Navigation |

**API-Endpunkte:** `/add`, `/api/article/<id>`, `/api/article/<id>/star`, `/api/article/<id>/read`, `/api/stats`, `/api/topics`, `/api/topics/reorder`, `/api/topics/add`, `/api/topics/<id>`, `/api/faq/search`, `/api/admin/coupon`, `/api/admin/user`

---

## Implementierte Features

### Dashboard & Gamification
- **Wetter-Widget** (Open-Meteo API, gratis, kein Key nötig) + aktuelles Datum
- **Streak-Tracker** – aufeinanderfolgende Lesetage (aus `reading_sessions`)
- **Level/XP-System** – 7 Stufen: Neuling → Legende (XP = Artikel × 20 + Gespeichert × 5)
- **Wochenziel-Ring** – SVG-Fortschrittsring, anpassbar (3/5/7/10/14)
- **Lesezeit-Tracker** – Minuten basierend auf `reading_time` der gelesenen Artikel
- **Statistik-Karten** – Gespeichert / Ungelesen / Gelesen / Markiert
- **Bar-Chart** – gelesene Artikel letzte 7 Tage (Chart.js)
- **Donut-Chart** – Top-Quellen nach Lesehäufigkeit (Chart.js)
- **12 Errungenschaften** – incl. Nacht-Eule, Schnellleser, Streak-Meilensteine

### Navigation & UI
- **Username-Animation** – Shine/Gradient-Effekt alle 8–14 Sekunden (CSS + JS)
- **Dark Mode** – vollständiger Dark Mode per Toggle (localStorage)
- **Responsive** – angepasst für Mobile, Tablet, Desktop

### Discover-Seite
- **Drag & Drop** – Themen per Sortable.js umsortieren (persistiert in DB)
- **Eigene Themen** – hinzufügen mit Emoji + Farbe, löschen

### FAQ
- **Live-Suche** – debounced, Treffer werden hervorgehoben (`<mark>`)

### Preise
- **Free** – bis 100 Artikel, kein KI
- **Lifetime (49€)** – unbegrenzt, BYOK (kein API-Key enthalten!)
- **Premium Deluxe (7.99€/Mo)** – 50 KI-Credits/Monat enthalten
- **Tutorial-Modal** – 5-Schritte-Einführung mit animiertem Farbverlauf-Rahmen

### Admin
- Nutzerliste, Nutzer manuell hinzufügen/löschen
- Coupon-Codes erstellen (Rabatt-%, Plan, max. Nutzungen, Ablaufdatum)
- Direkt-Links zu App Store Connect (Analytics, Promo Codes, Reviews)

---

## Bekannte Offene Punkte / Zukünftige Erweiterungen
- KI-Zusammenfassungen (OpenAI Integration, benötigt echten Backend-Service)
- Push-Notifications für tägliche Lese-Erinnerungen
- Import/Export von Artikeln (OPML, Pocket-Export)
- Browser-Extension / Share-Sheet für schnelles Speichern
- Volltext-Suche über Artikel-Inhalte
- Nutzer-Authentifizierung (aktuell single-user)
- iOS-App (separates Projekt: LiquidRead.xcodeproj)

---

## Wichtige Design-Entscheidungen
- **BYOK für Lifetime**: Der Lifetime-Deal enthält explizit KEINE KI-Credits – nur App-Zugang
- **Premium Deluxe**: Enthält 50 KI-Credits/Monat (kein eigener API-Key nötig)
- **Stripe/Apple IAP**: Zahlungsabwicklung läuft über App Store Connect (iOS) bzw. Stripe (Web)
- **Sprache**: Die gesamte UI ist auf Deutsch
- **Gamification-Stil**: Professionell, für Erwachsene – kein kindlicher Look
