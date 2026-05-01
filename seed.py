"""Seed the database with demo data for Rosa Road Studio."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from app.database import init_db, SessionLocal
from app.auth import hash_password
from app.models import (
    User, UserRole, Client, BrandCI, PlatformConnection, Platform,
    AnalyticsSnapshot,
)
from app.services.social_service import _simulated_series


def seed():
    init_db()
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).filter_by(email="admin@rosaroad.agency").first():
        print("Database already seeded. Skipping.")
        db.close()
        return

    # Users
    admin = User(
        email="admin@rosaroad.agency",
        full_name="Rosa Admin",
        hashed_password=hash_password("rosaroad123"),
        role=UserRole.ADMIN,
    )
    editor = User(
        email="editor@rosaroad.agency",
        full_name="Maria Editor",
        hashed_password=hash_password("rosaroad123"),
        role=UserRole.EDITOR,
    )
    db.add_all([admin, editor])
    db.flush()

    # Demo clients
    clients_data = [
        {
            "name": "Alpine Luxe Hotels",
            "industry": "Hospitality & Travel",
            "website": "https://alpineluxe.example.com",
            "description": "Boutique mountain resort chain across Switzerland and Austria. Premium positioning targeting affluent travelers seeking authentic alpine experiences.",
            "contact_email": "marketing@alpineluxe.example.com",
            "brand": {
                "primary_color": "#1B4332",
                "secondary_color": "#2D6A4F",
                "accent_color": "#B7E4C7",
                "font_heading": "Playfair Display",
                "font_body": "Lato",
                "voice": "refined, warm, aspirational",
                "tone": "sophisticated yet welcoming, never pretentious",
                "tagline": "Where mountains meet luxury.",
                "target_audience": "Affluent couples 35-55, luxury travelers, experience seekers",
                "key_messages": "Authentic alpine heritage, sustainable luxury, bespoke experiences, award-winning cuisine",
                "do_words": "bespoke, heritage, curated, alpine, summit, tranquility, artisanal",
                "dont_words": "cheap, budget, discount, mass tourism, basic",
            },
        },
        {
            "name": "NovaBrew Coffee",
            "industry": "Food & Beverage",
            "website": "https://novabrew.example.com",
            "description": "Direct-trade specialty coffee brand. Roasted in Berlin, sourced from single-origin farms in Colombia and Ethiopia.",
            "contact_email": "hello@novabrew.example.com",
            "brand": {
                "primary_color": "#6F4E37",
                "secondary_color": "#1A1A2E",
                "accent_color": "#FFF3E0",
                "font_heading": "DM Serif Display",
                "font_body": "Inter",
                "voice": "passionate, knowledgeable, grounded",
                "tone": "casual-expert, like a barista friend who really knows their stuff",
                "tagline": "Every cup tells a story.",
                "target_audience": "Urban professionals 25-40, specialty coffee enthusiasts, sustainability-conscious consumers",
                "key_messages": "Farm to cup transparency, artisan roasting, sustainable sourcing, community",
                "do_words": "single-origin, craft, direct-trade, roast profile, tasting notes, community",
                "dont_words": "instant, generic, mass-produced, artificial",
            },
        },
        {
            "name": "VeloCity E-Bikes",
            "industry": "Sports & Mobility",
            "website": "https://velocity-bikes.example.com",
            "description": "Premium urban e-bike manufacturer. German engineering meets Scandinavian design. Focus on commuter and lifestyle segments.",
            "contact_email": "press@velocity-bikes.example.com",
            "brand": {
                "primary_color": "#0077B6",
                "secondary_color": "#023E8A",
                "accent_color": "#CAF0F8",
                "font_heading": "Space Grotesk",
                "font_body": "Inter",
                "voice": "bold, innovative, empowering",
                "tone": "energetic and confident, technical but accessible",
                "tagline": "Move smarter. Live bigger.",
                "target_audience": "Urban commuters 28-45, eco-conscious professionals, design-minded tech enthusiasts",
                "key_messages": "German engineering, zero emissions, smart connectivity, design-forward, urban freedom",
                "do_words": "smart, connected, engineered, freedom, glide, range, torque",
                "dont_words": "motorized, moped, scooter, lazy, slow",
            },
        },
    ]

    for cd in clients_data:
        brand_data = cd.pop("brand")
        client = Client(**cd)
        db.add(client)
        db.flush()
        ci = BrandCI(client_id=client.id, **brand_data)
        db.add(ci)
        db.flush()

        # Platform connections (demo)
        for plat in [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.LINKEDIN]:
            db.add(PlatformConnection(
                client_id=client.id,
                platform=plat,
                handle=f"@{cd['name'].lower().replace(' ', '')}",
                is_active=True,
            ))

        # Analytics seed — 30 days of simulated data
        since = datetime.utcnow() - timedelta(days=30)
        until = datetime.utcnow()
        for plat in [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.LINKEDIN, Platform.TIKTOK]:
            rows = _simulated_series(client.id, plat, since, until)
            for r in rows:
                db.add(AnalyticsSnapshot(
                    client_id=client.id,
                    platform=plat,
                    date=datetime.strptime(r["date"], "%Y-%m-%d"),
                    followers=r["followers"],
                    impressions=r["impressions"],
                    reach=r["reach"],
                    engagement=r["engagement"],
                    clicks=r["clicks"],
                    profile_visits=r.get("profile_visits", 0),
                    video_views=r.get("video_views", 0),
                    spend=r.get("spend", 0.0),
                    conversions=r.get("conversions", 0),
                    raw=r.get("raw", {}),
                ))

    db.commit()
    db.close()
    print("Database seeded with 2 users and 3 demo clients.")
    print("  Admin:  admin@rosaroad.agency / rosaroad123")
    print("  Editor: editor@rosaroad.agency / rosaroad123")


if __name__ == "__main__":
    seed()
