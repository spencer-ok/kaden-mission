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
Runs at http://localhost:8181 (8080 is taken by other project)

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

### Download New Emails
```bash
cd C:\apps\kaden-mission\source-materials\emails
npm run download
```
Uses saved token — no re-auth needed. Downloads all matching emails (skips duplicates by filename).

### Rebuild Email Data (after new emails downloaded)
```bash
cd C:\apps\kaden-mission\site
node build-emails.js
```
Regenerates `src/_data/emails.json` with formatted text and linked images.

### Summarize Emails (run from Windows — needs LM Studio running)
```bash
cd C:\apps\kaden-mission\site
node summarize-all.js
```
Generates 1-sentence summaries via LM Studio (llava-phi-3-mini). Saves to `src/_data/emailSummaries.json`.

### Classify Images (run from Windows — needs LM Studio running)
```bash
cd C:\apps\kaden-mission\source-materials
node classify-images.js
```
Classifies images as: art, photo-people, photo-scenery, photo-food, screenshot, document, other. Saves to `image-classifications.json`.

### Add Art to Gallery
1. Drop images into `site/src/assets/images/art/`
2. Edit `site/src/_data/art.json` — each entry:
```json
{
  "filename": "art-01.jpg",
  "title": "Optional title",
  "description": "Optional description",
  "date": "2024-08-04"
}
```

### Add/Edit Quotes
Edit `site/src/_data/quotes.json` — each entry:
```json
{
  "text": "The quote text",
  "date": "2025-01-20",
  "source": "Email subject line",
  "transfer": 3,
  "category": "testimony|growth|art|service|life"
}
```

### Gemini Pro Art Prompts
Saved in `prompts/` folder. Generate images, drop into `site/src/assets/images/`.

### Data Files (all in `site/src/_data/`)
- `site.json` — basic mission info
- `transfers.json` — transfer history (timeline backbone)
- `companions.json` — companion list
- `quotes.json` — curated quotes
- `art.json` — art gallery entries
- `emails.json` — all emails (generated by build-emails.js)
- `emailSummaries.json` — AI summaries (generated by summarize-all.js)

### Folder Structure
```
kaden-mission/
├── source-materials/
│   ├── emails/           ← download scripts + raw emails
│   ├── messenger/        ← Facebook export (pending)
│   ├── photos/           ← bulk photos
│   ├── companions/       ← CSV with transfer data
│   └── image-classifications.json
├── site/
│   ├── src/
│   │   ├── _data/        ← JSON data files
│   │   ├── _includes/    ← base.njk layout
│   │   ├── assets/       ← CSS, images, fonts
│   │   └── index.njk     ← main page template
│   ├── build-emails.js   ← email processor
│   ├── summarize-all.js  ← AI summarizer (needs LM Studio)
│   ├── .eleventy.js      ← Eleventy config
│   └── package.json
├── print/
│   ├── 8x10-frameable/   ← 300 DPI for framing
│   └── 8.5x11-booklet/   ← letter size for Canon
└── prompts/              ← Gemini Pro image prompts
```
