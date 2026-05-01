"""AI service — text + image generation.

Integrates:
  * Google Gemini (Nano Banana 2) — image generation, multi-format & reference-image aware
  * Google Gemini text model — caption/copy/keywords/hashtags
  * Anthropic Claude — caption/copy/research fallback & long-form

When no API keys are configured the service falls back to high-quality
deterministic stubs so the end-to-end workflow still works end-to-end
for demos and offline development.

All functions return structured dicts that the routers can persist directly.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import random
import re
import textwrap
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from ..config import settings
from ..models import BrandCI, Platform

log = logging.getLogger("rosaroad.ai")

# ---- Aspect ratio → pixel sizes (Nano Banana 2 supports up to 4K) ----
ASPECT_SIZES = {
    "1:1": (1080, 1080),      # Instagram feed square
    "4:5": (1080, 1350),      # Instagram portrait
    "9:16": (1080, 1920),     # Story / Reel / TikTok
    "16:9": (1920, 1080),     # YouTube / LinkedIn banner
    "3:2": (1500, 1000),
    "2:3": (1000, 1500),
    "4:1": (2048, 512),       # Ultra-wide banner (Nano Banana 2)
    "8:1": (2048, 256),       # LinkedIn cover ultra-wide
    "1:4": (512, 2048),
}

DEFAULT_RATIO = "1:1"


# ------------------------ Brand context helpers ------------------------

def brand_prompt_fragment(brand: BrandCI | None) -> str:
    if brand is None:
        return ""
    lines: list[str] = []
    if brand.voice:
        lines.append(f"Brand voice: {brand.voice}")
    if brand.tone:
        lines.append(f"Tone: {brand.tone}")
    if brand.tagline:
        lines.append(f"Tagline: {brand.tagline}")
    if brand.target_audience:
        lines.append(f"Target audience: {brand.target_audience}")
    if brand.key_messages:
        lines.append(f"Key messages: {brand.key_messages}")
    if brand.do_words:
        lines.append(f"DO use these words: {brand.do_words}")
    if brand.dont_words:
        lines.append(f"DO NOT use: {brand.dont_words}")
    if brand.guidelines:
        lines.append(f"Guidelines: {brand.guidelines}")
    if brand.primary_color:
        lines.append(
            f"Brand colors: primary {brand.primary_color}, secondary {brand.secondary_color}, accent {brand.accent_color}"
        )
    if brand.font_heading:
        lines.append(f"Typography: headings in {brand.font_heading}, body in {brand.font_body}")
    return "\n".join(lines)


def build_system_prompt(brand: BrandCI | None, platform: Platform) -> str:
    brand_text = brand_prompt_fragment(brand)
    return textwrap.dedent(
        f"""
        You are a senior social-media creative director at Rosa Road
        Advertising Agency. You produce platform-native, on-brand, conversion-
        focused social posts. Always follow the brand CI below precisely.

        Current platform: {platform.value}

        {brand_text}

        Rules:
        - Respect the do/don't word lists strictly.
        - Match the voice & tone exactly.
        - Use platform-native copy length and style.
        - Prefer active verbs and concrete hooks.
        - Never invent facts the brief does not support.
        """
    ).strip()


# ------------------------ LLM text generation ------------------------

async def _call_anthropic(system: str, user: str, max_tokens: int = 1024) -> str | None:
    if not settings.has_anthropic():
        return None
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("content", [])
            return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
    except Exception as e:  # noqa: BLE001
        log.warning("Anthropic call failed: %s", e)
        return None


async def _call_gemini_text(system: str, user: str, max_tokens: int = 1024) -> str | None:
    if not settings.has_gemini():
        return None
    try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_text_model}:generateContent?key={settings.gemini_api_key}"
        )
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user", "parts": [{"text": user}]}],
                    "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.85},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            cands = data.get("candidates", [])
            if not cands:
                return None
            parts = cands[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
    except Exception as e:  # noqa: BLE001
        log.warning("Gemini text call failed: %s", e)
        return None


async def call_llm(system: str, user: str, max_tokens: int = 1024) -> str | None:
    """Call whichever LLM is configured. Anthropic preferred for prose."""
    text = await _call_anthropic(system, user, max_tokens)
    if text:
        return text
    return await _call_gemini_text(system, user, max_tokens)


# ------------------------ Structured JSON helper ------------------------

def _extract_json(text: str) -> Any | None:
    if not text:
        return None
    # Try full parse first
    try:
        return json.loads(text)
    except Exception:  # noqa: BLE001
        pass
    # Pull the first {...} or [...] block
    m = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:  # noqa: BLE001
        return None


# ------------------------ Caption / variant generation ------------------------

@dataclass
class VariantDraft:
    label: str
    headline: str
    caption: str
    cta: str
    hashtags: list[str]
    keywords: list[str]


async def generate_caption_variants(
    *,
    brand: BrandCI | None,
    prompt: str,
    extra_context: str,
    platform: Platform,
    document_context: str,
    count: int = 3,
) -> list[VariantDraft]:
    """Generate N caption variants using LLM when available, otherwise fall back."""
    system = build_system_prompt(brand, platform)
    user = textwrap.dedent(
        f"""
        Create exactly {count} distinct social-post variants for the following brief.

        BRIEF:
        {prompt}

        ADDITIONAL CONTEXT:
        {extra_context or "(none)"}

        INFORMATION HUB (brand documents, briefs, research):
        {document_context[:6000] or "(none)"}

        Each variant must have a different creative angle.

        Respond with a JSON array of {count} objects, each with keys:
          "label" (short e.g. "Bold hook"),
          "headline" (max 12 words),
          "caption" (full post copy, platform-native length),
          "cta" (call to action, max 6 words),
          "hashtags" (array of 10-20 relevant hashtags, each starting with #),
          "keywords" (array of 8-12 SEO keywords for this post, no # sign).

        Return ONLY valid JSON — no prose, no code fences.
        """
    ).strip()

    text = await call_llm(system, user, max_tokens=2400)
    parsed = _extract_json(text) if text else None

    if isinstance(parsed, list) and parsed:
        out: list[VariantDraft] = []
        for i, item in enumerate(parsed[:count]):
            if not isinstance(item, dict):
                continue
            out.append(
                VariantDraft(
                    label=str(item.get("label", f"Variant {chr(65 + i)}")),
                    headline=str(item.get("headline", "")),
                    caption=str(item.get("caption", "")),
                    cta=str(item.get("cta", "")),
                    hashtags=[str(h) for h in item.get("hashtags", []) if h][:25],
                    keywords=[str(k) for k in item.get("keywords", []) if k][:15],
                )
            )
        if out:
            return out

    # ---- Fallback ----
    return _stub_variants(brand, prompt, platform, count)


def _stub_variants(
    brand: BrandCI | None, prompt: str, platform: Platform, count: int
) -> list[VariantDraft]:
    angles = [
        ("Bold hook", "Stop scrolling."),
        ("Story-driven", "Here's what nobody tells you."),
        ("Benefit-led", "The smart way to "),
        ("Question hook", "Ever wondered why "),
        ("Social proof", "Thousands already "),
    ]
    brand_name = ""
    tagline = ""
    if brand is not None:
        tagline = brand.tagline or ""
    out: list[VariantDraft] = []
    base_keywords = _keyword_stub(prompt)
    base_hashtags = [f"#{k.replace(' ', '')}" for k in base_keywords[:12]]
    for i in range(count):
        angle_label, opener = angles[i % len(angles)]
        caption = (
            f"{opener}{prompt}. "
            f"{tagline + '. ' if tagline else ''}"
            f"Made for {platform.value.title()} — share, save, or tap the link to learn more."
        )
        out.append(
            VariantDraft(
                label=f"{angle_label}",
                headline=prompt[:80].rstrip(".") + "." if prompt else "A new story",
                caption=caption,
                cta="Learn more" if i % 2 == 0 else "Tap to explore",
                hashtags=base_hashtags + [f"#{platform.value}"],
                keywords=base_keywords,
            )
        )
    return out


def _keyword_stub(prompt: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", prompt.lower())
    stop = {
        "the", "and", "for", "with", "from", "that", "this", "into", "your", "our",
        "are", "was", "but", "not", "you", "all", "can", "has", "have", "will",
    }
    uniq: list[str] = []
    for w in words:
        if w in stop or w in uniq:
            continue
        uniq.append(w)
        if len(uniq) >= 12:
            break
    while len(uniq) < 8:
        uniq.append(random.choice(["brand", "launch", "design", "story", "bold", "modern", "crafted", "premium"]))
    return uniq


# ------------------------ Keyword research ------------------------

async def research_keywords(
    *, topic: str, brand: BrandCI | None, language: str, region: str
) -> list[dict[str, Any]]:
    system = "You are an SEO and social-keyword research analyst."
    brand_hint = brand_prompt_fragment(brand)
    user = textwrap.dedent(
        f"""
        Research the top 20 most effective keywords for the topic: "{topic}".
        Language: {language}. Region: {region or "global"}.

        Brand context (optional, influences which keywords to prioritize):
        {brand_hint or "(none)"}

        For each keyword, estimate monthly search volume, difficulty (0-100),
        search intent (informational/navigational/commercial/transactional),
        and trend (rising/steady/declining).

        Return ONLY a JSON array of objects with keys:
          keyword, volume, difficulty, intent, trend.
        """
    ).strip()

    text = await call_llm(system, user, max_tokens=2000)
    parsed = _extract_json(text) if text else None
    if isinstance(parsed, list) and parsed:
        clean: list[dict[str, Any]] = []
        for k in parsed[:30]:
            if not isinstance(k, dict):
                continue
            clean.append(
                {
                    "keyword": str(k.get("keyword", "")).strip(),
                    "volume": int(k.get("volume", 0) or 0),
                    "difficulty": int(k.get("difficulty", 0) or 0),
                    "intent": str(k.get("intent", "informational")),
                    "trend": str(k.get("trend", "steady")),
                }
            )
        clean = [k for k in clean if k["keyword"]]
        if clean:
            return clean

    # Fallback — deterministic seeded keywords
    random.seed(hashlib.md5(topic.encode()).hexdigest())
    base = _keyword_stub(topic)
    extras = [
        f"{topic} ideas", f"best {topic}", f"{topic} trends", f"{topic} tips",
        f"how to {topic}", f"{topic} for agencies", f"{topic} 2026", f"{topic} examples",
    ]
    out = []
    for kw in (base + extras)[:20]:
        out.append(
            {
                "keyword": kw,
                "volume": random.randint(300, 25_000),
                "difficulty": random.randint(15, 80),
                "intent": random.choice(["informational", "commercial", "transactional"]),
                "trend": random.choice(["rising", "steady", "declining"]),
            }
        )
    return out


# ------------------------ Hashtag research ------------------------

async def research_hashtags(
    *, topic: str, platform: Platform, count: int, brand: BrandCI | None
) -> list[dict[str, Any]]:
    system = "You are an expert social media hashtag strategist."
    brand_hint = brand_prompt_fragment(brand)
    user = textwrap.dedent(
        f"""
        Suggest the {count} best hashtags for the topic "{topic}" on {platform.value}.
        Balance high-reach, medium, and niche hashtags.

        Brand context:
        {brand_hint or "(none)"}

        Return ONLY a JSON array of objects with keys:
          tag (starting with #), reach_estimate (integer, approx posts), competition (low/medium/high).
        """
    ).strip()

    text = await call_llm(system, user, max_tokens=1500)
    parsed = _extract_json(text) if text else None
    if isinstance(parsed, list) and parsed:
        clean = []
        for h in parsed[:count]:
            if not isinstance(h, dict):
                continue
            tag = str(h.get("tag", "")).strip()
            if tag and not tag.startswith("#"):
                tag = "#" + tag.replace(" ", "")
            if not tag:
                continue
            clean.append(
                {
                    "tag": tag,
                    "reach_estimate": int(h.get("reach_estimate", 0) or 0),
                    "competition": str(h.get("competition", "medium")),
                }
            )
        if clean:
            return clean

    # Fallback
    random.seed(hashlib.md5((topic + platform.value).encode()).hexdigest())
    base = _keyword_stub(topic)
    tags = [f"#{b.replace(' ', '')}" for b in base]
    tags += [f"#{topic.replace(' ', '')}{suffix}" for suffix in ("", "tips", "ideas", "daily", "life", "love", "2026")]
    tags += [f"#{platform.value}marketing", f"#{platform.value}growth"]
    tags = list(dict.fromkeys(tags))[:count]
    return [
        {
            "tag": t,
            "reach_estimate": random.randint(5_000, 5_000_000),
            "competition": random.choice(["low", "medium", "high"]),
        }
        for t in tags
    ]


# ------------------------ Text suggestions ------------------------

async def suggest_texts(
    *,
    brand: BrandCI | None,
    seed: str,
    kind: str,
    platform: Platform,
    count: int,
) -> list[str]:
    system = build_system_prompt(brand, platform)
    user = textwrap.dedent(
        f"""
        Suggest exactly {count} {kind} options that continue or rewrite the
        following seed. Keep each on a single line. Platform: {platform.value}.

        SEED:
        {seed}

        Return ONLY a JSON array of {count} strings.
        """
    ).strip()
    text = await call_llm(system, user, max_tokens=700)
    parsed = _extract_json(text) if text else None
    if isinstance(parsed, list):
        out = [str(x).strip() for x in parsed if str(x).strip()]
        if out:
            return out[:count]

    # Fallback
    base = seed.strip() or "Your next post"
    return [
        f"{base} — the smarter way.",
        f"{base}. Made for {platform.value.title()}.",
        f"Stop scrolling. {base}.",
        f"Why {base.lower()} matters now.",
        f"{base}: 3 things you didn't know.",
    ][:count]


# ------------------------ Image generation (Nano Banana 2) ------------------------

async def _gemini_image_generate(
    prompt: str,
    *,
    aspect_ratio: str,
    reference_image_paths: list[Path] | None = None,
) -> bytes | None:
    if not settings.has_gemini():
        return None
    try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_image_model}:generateContent?key={settings.gemini_api_key}"
        )
        parts: list[dict[str, Any]] = [{"text": prompt}]
        for ref in reference_image_paths or []:
            try:
                data = ref.read_bytes()
                parts.append(
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": base64.b64encode(data).decode(),
                        }
                    }
                )
            except Exception:  # noqa: BLE001
                pass
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {"aspectRatio": aspect_ratio},
            },
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        cands = data.get("candidates", [])
        if not cands:
            return None
        for part in cands[0].get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
        return None
    except Exception as e:  # noqa: BLE001
        log.warning("Gemini image generation failed: %s", e)
        return None


def _render_stub_image(
    *,
    prompt: str,
    aspect_ratio: str,
    brand: BrandCI | None,
    variant_label: str,
) -> bytes:
    """Render a tasteful placeholder card using Pillow.

    Used when no image model is available. Still produces a real PNG the
    user can inspect, schedule and publish in dry-run mode.
    """
    w, h = ASPECT_SIZES.get(aspect_ratio, ASPECT_SIZES[DEFAULT_RATIO])
    primary = (brand.primary_color if brand else "#E0115F") or "#E0115F"
    secondary = (brand.secondary_color if brand else "#111111") or "#111111"
    accent = (brand.accent_color if brand else "#F5F5F5") or "#F5F5F5"

    def hex_to_rgb(c: str) -> tuple[int, int, int]:
        c = c.lstrip("#")
        if len(c) == 3:
            c = "".join(ch * 2 for ch in c)
        try:
            return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
        except Exception:  # noqa: BLE001
            return (224, 17, 95)

    p_rgb = hex_to_rgb(primary)
    s_rgb = hex_to_rgb(secondary)
    a_rgb = hex_to_rgb(accent)

    img = Image.new("RGB", (w, h), p_rgb)
    draw = ImageDraw.Draw(img)

    # Gradient-ish by stacking translucent rectangles
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(0, h, 6):
        alpha = int(180 * (i / h))
        od.rectangle([(0, i), (w, i + 6)], fill=(s_rgb[0], s_rgb[1], s_rgb[2], alpha))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(2))
    draw = ImageDraw.Draw(img)

    # Accent stripe
    draw.rectangle([(0, h - 18), (w, h)], fill=a_rgb)

    # Text
    try:
        font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", max(32, w // 18))
        font_body = ImageFont.truetype("DejaVuSans.ttf", max(20, w // 40))
        font_small = ImageFont.truetype("DejaVuSans.ttf", max(16, w // 64))
    except Exception:  # noqa: BLE001
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_small = ImageFont.load_default()

    title = (prompt or "Your next campaign").strip()
    title_lines = textwrap.wrap(title, width=max(14, w // 45))[:4]
    y = int(h * 0.2)
    for line in title_lines:
        draw.text((int(w * 0.08), y), line, fill=a_rgb, font=font_title)
        y += int(w * 0.08)

    if brand and brand.tagline:
        draw.text(
            (int(w * 0.08), y + 20),
            brand.tagline[:80],
            fill=a_rgb,
            font=font_body,
        )

    draw.text(
        (int(w * 0.08), h - 80),
        f"{variant_label} · {aspect_ratio}",
        fill=a_rgb,
        font=font_small,
    )
    draw.text(
        (w - 320, h - 80),
        "Rosa Road Studio",
        fill=a_rgb,
        font=font_small,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_image(
    *,
    prompt: str,
    aspect_ratio: str,
    brand: BrandCI | None,
    reference_image_paths: list[Path] | None,
    variant_label: str,
    out_dir: Path,
) -> tuple[Path, str]:
    """Generate (or fall back to render) an image and save it.

    Returns (path, provider).
    """
    brand_text = brand_prompt_fragment(brand)
    full_prompt = (
        f"Create a professional advertising image in {aspect_ratio} format.\n\n"
        f"Concept: {prompt}\n\n"
        f"{brand_text}\n\n"
        "Style: polished, modern, high-contrast, suitable for paid social.\n"
        "Composition: clear focal point, safe margins for text overlay, "
        "strong color hierarchy. No watermark."
    )

    data = await _gemini_image_generate(
        full_prompt,
        aspect_ratio=aspect_ratio,
        reference_image_paths=reference_image_paths,
    )
    provider = "gemini"
    if data is None:
        data = _render_stub_image(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            brand=brand,
            variant_label=variant_label,
        )
        provider = "stub"

    out_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.png"
    path = out_dir / fname
    path.write_bytes(data)
    return path, provider
