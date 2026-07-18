# 🎧 MixMate – Auto DJ Studio

**Zwei Songs. Ein Klick. Ein professioneller Mix.**

MixMate ist eine mobile-first Web-App (PWA), mit der jede:r ohne DJ-Kenntnisse
zwei Songs automatisch und beat-synchron mixen kann – z. B. um House-Versionen
von Vintage-Songs zu bauen. Alles läuft **komplett lokal im Browser**
(Web Audio API): keine Uploads, keine Server-Kosten, volle Privatsphäre.

## ✨ Features

- **1-Click Auto-Mix**: Songs laden → „Auto-Mix" drücken → fertig.
- **Automatische Analyse pro Song**: BPM-Erkennung, Tonart-Erkennung
  (inkl. Camelot-Code + Kompatibilitäts-Hinweis), Lautheits-Messung,
  Intro-Erkennung, Waveform-Anzeige.
- **Professioneller Übergang**:
  - Beat-synchrones Tempo-Matching (Deck B wird auf das Ziel-Tempo gebracht)
  - Equal-Power-Crossfade auf dem Beat-Raster
  - **Bass-Swap**: Der Bass wird am „Drop" per EQ von Song A an Song B übergeben –
    wie es echte DJs machen
  - Loudness-Angleich + Master-Kompressor („Glue")
- **Advanced-Modus** mit Parametern:
  - Ziel-BPM (Auto oder manuell 90–140)
  - Übergangslänge (4/8/16/32 Takte)
  - Übergangspunkt in Song A
  - Blendkurve (Equal Power / S-Kurve / Linear)
  - Bass-Swap & Intro-Skip an/aus
  - 🏠 **House-Beat-Layer**: synthetisierte 4-to-the-floor-Kick + Offbeat-Hats
    auf dem Ziel-Grid – für House-Remixe von Vintage-Tracks
- **Presets**: Classic Blend · House Remix (124 BPM) · Schneller Cut
- **Export als WAV** + Vorschau-Player mit Übergangs-Markern
- **PWA**: offline-fähig, auf dem iPhone als App installierbar

## 📱 Auf dem iPhone „installieren"

1. Seite in **Safari** öffnen
2. **Teilen-Symbol** → **„Zum Home-Bildschirm"**
3. MixMate startet dann im Vollbild wie eine native App

> Eine echte App-Store-Version ließe sich später mit [Capacitor](https://capacitorjs.com/)
> aus genau dieser Codebasis bauen – die gesamte Audio-Engine ist wiederverwendbar.

## 🚀 Lokal starten / deployen

Kein Build-Schritt nötig – statische Dateien:

```bash
npx serve .        # oder: python3 -m http.server 8080
```

Deployment: einfach den Ordner zu **GitHub Pages**, **Vercel** oder **Netlify**
pushen. (HTTPS ist für die PWA-Installation erforderlich.)

## 🧠 Wie der Auto-Mix funktioniert

1. **BPM**: Lowpass-Filter (150 Hz) → Peak-Erkennung → Intervall-Histogramm
   mit Oktav-Faltung (85–170 BPM) → Sub-BPM-Verfeinerung.
2. **Tonart**: Chroma-Vektor über Goertzel-Analyse (3 Oktaven) →
   Korrelation mit Krumhansl-Profilen → Tonart + Camelot-Code.
3. **Timeline**: Der Übergangspunkt wird auf das Beat-Raster von Song A
   gesnappt; Song B steigt (optional nach Intro-Skip) exakt auf dem Beat ein.
   Tempo-Differenzen werden per Playback-Rate angeglichen (mit Oktav-Faltung,
   damit z. B. 62-BPM-Songs nicht auf Doppeltempo gezerrt werden).
4. **Rendering**: `OfflineAudioContext` → Crossfade-Kurven, Lowshelf-EQ-Automation
   für den Bass-Swap, optionaler House-Layer (synthetisierte Kick/Hats) →
   Kompressor → 16-bit-WAV.

## ⚖️ Urheberrecht

Das Remixen und insbesondere das **Veröffentlichen** von Remixes fremder Songs
erfordert die Zustimmung der Rechteinhaber (Label/Verlag/Künstler:in).
MixMate zeigt daher beim ersten Start einen verpflichtenden Hinweis:
Nutzer:innen müssen bestätigen, dass sie die nötigen Rechte an ihrem Material
besitzen (eigene Produktionen, lizenzfreie Musik, Creative Commons, gekaufte
Remix-Stems) oder es nur im rechtlich zulässigen privaten Rahmen verwenden.
Da alle Audiodaten das Gerät nie verlassen, findet über MixMate selbst keine
Verbreitung statt.

## 🗂 Projektstruktur

```
index.html            App-Shell & UI
css/style.css         Dark, iPhone-optimiertes Design
js/audio-engine.js    Analyse (BPM/Key/RMS/Intro) + Mix-Renderer + WAV-Export
js/app.js             UI-Logik, Presets, Copyright-Gate, PWA-Registrierung
manifest.webmanifest  PWA-Manifest
sw.js                 Service Worker (Offline-Shell)
icons/                App-Icons
```

## 🧪 Getestet

End-to-End mit Playwright/Chromium: BPM-Erkennung (±0,5 BPM bei Testsignalen),
Tonart-Erkennung, kompletter Auto-Mix-Render (Stereo, nicht-still, korrekte
Länge und Übergangsposition) sowie das House-Preset.
