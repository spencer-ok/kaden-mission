# Kaden's Mission — Homecoming Project

## Overview

Kaden has been serving a 2-year LDS mission and comes home **June 4th, 2026**. This project is a digital (and possibly print) keepsake/tribute to celebrate his service and welcome him home.

**Timeline:** ~30 days until homecoming.

## Source Materials

- [ ] Emails (weekly letters home)
- [ ] Messenger conversations
- [ ] Photos
- [ ] List of companions he served with
- [ ] (Other materials as discovered — journal entries, maps, transfer history, etc.)

## Project Ideas

### Digital Options

1. **Interactive Timeline/Website** — A scrollable timeline of his mission: photos, quotes from emails, companion names, areas served. Could be hosted as a simple site family can revisit anytime.

2. **Video/Slideshow Montage** — Compiled photos set to music with text overlays of memorable quotes or milestones. Shareable link for family and friends.

3. **Digital Memory Book (PDF/eBook)** — Designed pages combining photos, email excerpts, and companion info. Can be viewed digitally AND sent to print.

4. **Interactive Map** — If you have area/transfer info, an animated map showing where he served over time with photos pinned to locations.

### Print Options

5. **Printed Photo Book** — Services like Shutterfly, Mixbook, or Blurb. Lay out photos chronologically with captions from emails.

6. **Poster/Infographic** — A single large print summarizing the mission: stats, companions, areas, favorite quotes, photo collage.

7. **Framed Companion List** — A designed print listing every companion with dates and areas.

### Hybrid (Digital-first, Print-ready)

8. **Mission Newsletter Compilation** — Reformatted emails as a "newspaper" or magazine-style booklet.

9. **"By the Numbers" Summary Page** — Total emails sent, companions served with, areas, months, baptisms, etc. Works as a web page or a printed piece.

## Key Decisions

- **Primary audience:** Kaden himself — a keepsake to remember what he learned and the impact he had, to anchor him as he transitions home.
- **Surprise:** Yes
- **Tone:** Meaningful/sentimental — reinforcing spiritual growth and impact on others
- **Volume:** Thousands of photos, lots of emails
- **Transfer/area info:** Available (to be provided)
- **Time investment:** Dad can spend significant time curating; Kiro handles heavy lifting (code, layout, automation)

## About Kaden

- Artist
- Loves everything Japan — art, anime, Japanese aesthetic
- (Design direction: consider Japanese-inspired visual style — clean lines, ink/brush motifs, wabi-sabi aesthetic, maybe manga-panel layouts for photo sections)

## Tools & Resources Available

- **Dad:** Software developer, experienced with Kiro/AI-assisted builds
- **Design tools:** Gimp, Movavi (video), Audacity (audio)
- **Printing:** Canon color laser, 8.5x11
- **Hosting:** AWS free tier (S3 static site, CloudFront, Route53 if needed)
- **AI Image Gen:** Gemini Pro — can generate custom art, textures, infographics with prompts
- **Dev stack:** Eleventy (11ty) + Nunjucks + S3 deploy (same as sacred-symmetry-ai site)
- **Reference project:** C:\apps\sacred-symmetry-ai (working S3 static site with Eleventy, image processing, deploy scripts)

## Recommended Direction

### Primary: Interactive Mission Website (Japanese-inspired design)
A beautiful, scrollable single-page (or multi-page) site with:
- Japanese/anime-inspired visual design (brush strokes, clean typography, subtle textures)
- Chronological timeline of his mission
- Photos organized by transfer/area
- Quotes pulled from emails & messenger
- Companion list with dates/areas
- Interactive map of areas served
- "By the Numbers" summary section
- Hosted on AWS (S3 + CloudFront) — shareable private link

### Secondary: Print Companion Piece
- Key pages from the site designed as printable 8.5x11 sheets
- Could be a small booklet or framed pieces
- Printed on the Canon laser at home

## Next Steps

1. ~~Decide on format direction~~ ✓
2. ~~Set up folder structure for source materials~~ ✓
3. ~~Dad provides: transfer history, companion list, emails, photos~~ ✓ (emails done, transfers done)
4. ~~Build site scaffold with Japanese-inspired design~~ ✓
5. ~~Create tooling to process/organize the source materials~~ ✓
6. Assemble content into the site (ongoing)
7. Print companion pieces
8. Facebook Messenger export (pending)
9. Google Photos / Drive export
10. Final polish and deploy to S3

---

## How-To Guide

### Dev Server
```bash
cd C:\apps\kaden-mission\site
npm run dev
```
Runs at http://localhost:8181

### Build Site
```bash
cd C:\apps\kaden-mission\site
npm run build
```
Output goes to `site/_site/`

### Deploy to S3
```bash
cd C:\apps\kaden-mission\site
npm run deploy
```
(Requires S3 bucket `kaden-mission-web` to be created first)

---

### Adding New Emails

1. Download new emails:
```bash
cd C:\apps\kaden-mission\source-materials\emails
npm run download
```

2. Rebuild email data (links images, deduplicates):
```bash
cd C:\apps\kaden-mission\site
node build-emails.js
```

3. Process any new images (generates thumbs + modals):
```bash
# Run from WSL (uses ImageMagick `convert`)
cd /mnt/c/apps/kaden-mission/site
node process-images.js
```

4. Delete originals from site assets (keep only thumb/modal):
```bash
cd /mnt/c/apps/kaden-mission/site/src/assets/images/emails
ls | grep -v "\-thumb\.\|\-modal\." | xargs rm -f
```

5. If emails have audio attachments, copy `.m4a` files to `site/src/assets/audio/` with date prefix (e.g., `2025-10-20_recording-88.m4a`), then manually add `"audio": "filename.m4a"` to the email entry in `emails.json`.

6. Transcribe new audio (from WSL):
```bash
cd /mnt/c/apps/kaden-mission/site/src/assets/audio
curl -s -X POST "https://api.together.xyz/v1/audio/transcriptions" \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -F "file=@FILENAME.m4a" \
  -F "model=openai/whisper-large-v3" \
  -F "response_format=verbose_json"
```
Save result to `src/_data/audioTranscripts.json`.

---

### Adding New Photos

1. Drop photos into `source-materials/photos/`

2. Run image processor (from WSL):
```bash
cd /mnt/c/apps/kaden-mission/site
node process-images.js
```
This deduplicates by MD5, generates 400px thumbs + 1200px modals, and adds entries to `imageInventory.json`.

3. Delete originals from site assets:
```bash
cd /mnt/c/apps/kaden-mission/site/src/assets/images/photos
ls | grep -v "\-thumb\.\|\-modal\." | xargs rm -f
```

4. Classify new images (from Windows, needs LM Studio + moondream2):
```bash
cd C:\apps\kaden-mission\site
node classify-inventory.js
```
Generates `rawDescription`, `scores`, and `tags` for each image. Saves every 10 images.

5. Generate captions for newly classified images:
```bash
cd C:\apps\kaden-mission\site
node generate-captions.js
```
Uses Together.ai to create short captions from rawDescriptions.

---

### Adding New Videos

1. Drop videos into `source-materials/videos/`

2. Compress to 720p (from WSL):
```bash
cd /mnt/c/apps/kaden-mission/site
node compress-videos.js
```

3. Transcribe (from WSL):
```bash
cd /mnt/c/apps/kaden-mission/site
node transcribe-videos.js
```

4. Run `process-images.js` to generate video thumbnails.

5. Delete frame originals:
```bash
cd /mnt/c/apps/kaden-mission/site/src/assets/images/videos
ls | grep -v "\-thumb\.\|\-modal\." | xargs rm -f
```

---

### Adding Messenger Conversations

1. Export from Facebook → drop into `source-materials/messenger/`

2. Build message data:
```bash
cd C:\apps\kaden-mission\site
node build-messenger.js
```

3. Score messages for importance:
```bash
node score-messenger.js
```

4. Build highlights (full days with important messages):
```bash
node build-messenger-highlights.js
```

5. Generate messenger photo thumbnails (from WSL):
```bash
cd /mnt/c/apps/kaden-mission/site
# Thumbnails are auto-generated by build-messenger-highlights process
# Or manually: find source messenger photos and convert to thumbs in src/assets/images/messenger/
```

---

### Add/Edit Quotes
Edit `site/src/_data/quotes.json`:
```json
{
  "text": "The quote text",
  "date": "2025-01-20",
  "source": "Email subject line",
  "transfer": 3,
  "category": "testimony|growth|art|service|life"
}
```

---

### Scripts Reference

| Script | Run From | Purpose |
|--------|----------|---------|
| `build-emails.js` | Windows/WSL | Process emails → `emails.json` |
| `process-images.js` | WSL | Generate thumbs/modals, deduplicate, update `imageInventory.json` |
| `classify-inventory.js` | Windows (LM Studio) | AI classify images via moondream2 |
| `generate-captions.js` | WSL | Generate short captions via Together.ai |
| `compress-videos.js` | WSL | Compress videos to 720p |
| `transcribe-videos.js` | WSL | Transcribe videos via Together.ai Whisper |
| `build-messenger.js` | Windows/WSL | Extract all messenger messages |
| `score-messenger.js` | WSL | Score messages for importance via Together.ai |
| `build-messenger-highlights.js` | Windows/WSL | Build curated message highlights |

---

### Data Files (all in `site/src/_data/`)
- `site.json` — basic mission info
- `transfers.json` — transfer history (timeline backbone)
- `companions.json` — companion list
- `quotes.json` — curated quotes
- `art.json` — art gallery entries
- `emails.json` — all emails (generated by build-emails.js)
- `imageInventory.json` — central image registry with classifications, captions, scores
- `audioTranscripts.json` — transcripts for email audio recordings
- `videoTranscripts.json` — transcripts for all videos
- `messengerMessages.json` — all messenger messages (raw)
- `messengerScored.json` — importance scores for Kaden's messages
- `messengerHighlights.json` — curated highlights for display

### Folder Structure
```
kaden-mission/
├── source-materials/
│   ├── emails/           ← download scripts + raw emails
│   ├── messenger/        ← Facebook Messenger export
│   ├── photos/           ← bulk photos (originals stay here)
│   ├── videos/           ← source videos (originals stay here)
│   ├── audio-tmp/        ← extracted audio for transcription
│   └── companions/       ← CSV with transfer data
├── site/
│   ├── src/
│   │   ├── _data/        ← JSON data files
│   │   ├── _includes/    ← base.njk layout
│   │   ├── assets/
│   │   │   ├── css/      ← style.css
│   │   │   ├── images/   ← thumbs + modals only (no originals!)
│   │   │   │   ├── emails/
│   │   │   │   ├── art/
│   │   │   │   ├── photos/
│   │   │   │   ├── videos/    ← frame thumbs
│   │   │   │   └── messenger/ ← chat photo thumbs
│   │   │   ├── audio/    ← email audio + messenger audio
│   │   │   └── videos/   ← compressed 720p videos
│   │   └── index.njk     ← main page template
│   ├── build-emails.js
│   ├── build-messenger.js
│   ├── build-messenger-highlights.js
│   ├── score-messenger.js
│   ├── classify-inventory.js
│   ├── generate-captions.js
│   ├── process-images.js
│   ├── compress-videos.js
│   ├── transcribe-videos.js
│   ├── .eleventy.js      ← Eleventy config
│   └── package.json
├── print/
│   ├── 8x10-frameable/   ← 300 DPI for framing
│   └── 8.5x11-booklet/   ← letter size for Canon
└── prompts/              ← Gemini Pro image prompts
```

### Important Notes
- **Never store originals in `site/src/assets/`** — only thumbs (400px) and modals (1200px). Originals stay in `source-materials/`.
- **Classification runs on Windows** (needs LM Studio + moondream2 loaded). Everything else runs from WSL.
- **Together.ai API key** is in `C:\apps\ai-assistant\.env` — do not commit.
- **`process-images.js` preserves existing data** — safe to re-run without losing classifications/captions.
- **Build time** is ~50s due to ~7,000 asset files being copied.
