# Rosa Road Studio

AI-powered advertising content automation platform built for Rosa Road Advertising Agency.

## Features

### Content Creation
- **AI Content Generation** — Gemini Nano Banana 2 for multi-format image generation + Claude/Gemini for captions
- **Multi-format output** — 1:1, 4:5, 9:16, 16:9, 3:2, 4:1, 8:1 aspect ratios
- **Multiple variants** — Generate 2-5 creative variants per brief
- **Reference images** — Upload images to guide AI generation
- **Brand CI enforcement** — Every generation follows the client's brand identity

### Client Management
- **Multi-client workspaces** — Isolated data per client
- **Brand CI storage** — Colors, fonts, voice, tone, do/don't words, target audience, key messages
- **Information hub** — Upload briefs, PDFs, docs as AI context
- **Asset management** — Logos, reference images, generated content

### Research & Intelligence
- **Keyword research** — AI-powered keyword analysis with volume, difficulty, intent, trend
- **Hashtag research** — Platform-specific hashtag suggestions with reach estimates
- **Text suggestions** — Real-time AI caption/headline/CTA autocomplete

### Publishing & Scheduling
- **Visual calendar** — Monthly grid with drag-drop
- **Multi-platform** — Instagram, Facebook, LinkedIn, X, TikTok, Pinterest, YouTube, Threads
- **Auto-publishing** — Background scheduler publishes at scheduled times
- **Approval workflows** — Draft → Review → Approved → Scheduled → Published

### Analytics & Reporting
- **Cross-platform analytics** — Impressions, reach, engagement, clicks, conversions, followers
- **Per-platform breakdown** — Compare performance across channels
- **PDF reports** — White-label branded performance reports
- **CSV export** — Raw data export for custom analysis
- **API integration** — Meta Graph API, LinkedIn, X (with dry-run fallback)

### Team & Roles
- **Admin** — Full access, manage clients and users
- **Editor** — Create and edit content
- **Client** — View and approve only

## Quick Start

```bash
chmod +x run.sh
./run.sh
```

Open http://localhost:8000 and log in:
- **Admin:** admin@rosaroad.agency / rosaroad123
- **Editor:** editor@rosaroad.agency / rosaroad123

## API Keys (Optional)

The platform works fully without API keys (uses smart fallbacks). To enable real AI generation:

1. Copy `.env.example` to `.env`
2. Add your keys:
   - `GEMINI_API_KEY` — Google Gemini for Nano Banana 2 image generation
   - `ANTHROPIC_API_KEY` — Claude for brand-aware text generation
   - `META_PAGE_ACCESS_TOKEN` — Instagram/Facebook auto-publishing
   - `LINKEDIN_ACCESS_TOKEN` — LinkedIn publishing
   - `X_ACCESS_TOKEN` — X/Twitter publishing

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Frontend:** Vanilla JS SPA, CSS custom properties
- **AI:** Google Gemini (Nano Banana 2), Anthropic Claude
- **Scheduler:** APScheduler (async)
- **Reports:** ReportLab (PDF), native CSV

## API Documentation

When running, visit http://localhost:8000/docs for the full OpenAPI spec.
