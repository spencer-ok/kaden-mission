const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const IMAGES_DIR = path.join(__dirname, 'src', 'assets', 'images');
const EMAILS_DIR = path.join(IMAGES_DIR, 'emails');
const ART_DIR = path.join(IMAGES_DIR, 'art');
const PHOTOS_DIR = path.join(IMAGES_DIR, 'photos');
const VIDEOS_DIR = path.join(IMAGES_DIR, 'videos');
const SOURCE_PHOTOS = path.join(__dirname, '..', 'source-materials', 'photos');
const SOURCE_VIDEOS = path.join(__dirname, '..', 'source-materials', 'videos');
const INVENTORY_PATH = path.join(__dirname, 'src', '_data', 'imageInventory.json');

[PHOTOS_DIR, VIDEOS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Load existing inventory to preserve manual edits
let existing = {};
if (fs.existsSync(INVENTORY_PATH)) {
  JSON.parse(fs.readFileSync(INVENTORY_PATH)).forEach(img => {
    existing[img.filename] = img;
  });
}

// Load art.json to seed art flags
const artFiles = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'src', '_data', 'art.json')))
    .map(a => a.filename)
);

// Track hashes for deduplication
const seenHashes = new Set();

function hashFile(filepath) {
  return crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex');
}

function processImage(filepath, outDir) {
  const ext = path.extname(filepath);
  const base = path.basename(filepath, ext);
  const thumbName = `${base}-thumb.jpg`;
  const modalName = `${base}-modal.jpg`;
  const thumbPath = path.join(outDir, thumbName);
  const modalPath = path.join(outDir, modalName);

  if (!fs.existsSync(thumbPath)) {
    execSync(`convert "${filepath}" -resize 400x -quality 80 "${thumbPath}"`);
  }
  if (!fs.existsSync(modalPath)) {
    execSync(`convert "${filepath}" -resize 1200x -quality 80 "${modalPath}"`);
  }
  return { thumb: thumbName, modal: modalName };
}

function extractVideoThumb(videoPath, outDir) {
  const base = path.basename(videoPath, path.extname(videoPath));
  const thumbName = `${base}-thumb.jpg`;
  const modalName = `${base}-modal.jpg`;
  const framePath = path.join(outDir, `${base}.jpg`);
  const thumbPath = path.join(outDir, thumbName);
  const modalPath = path.join(outDir, modalName);

  if (!fs.existsSync(framePath)) {
    execSync(`ffmpeg -y -i "${videoPath}" -ss 00:00:01 -frames:v 1 -q:v 2 "${framePath}" 2>/dev/null`);
  }
  if (!fs.existsSync(thumbPath)) {
    execSync(`convert "${framePath}" -resize 400x -quality 80 "${thumbPath}"`);
  }
  if (!fs.existsSync(modalPath)) {
    execSync(`convert "${framePath}" -resize 1200x -quality 80 "${modalPath}"`);
  }
  return { filename: `${base}.jpg`, thumb: thumbName, modal: modalName };
}

function parseDate(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/) || filename.match(/(\d{8})/);
  if (match) {
    const d = match[1];
    return d.includes('-') ? d : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  }
  return '';
}

const inventory = [];

// --- Process email images ---
if (fs.existsSync(EMAILS_DIR)) {
  const files = fs.readdirSync(EMAILS_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes('-thumb') && !f.includes('-modal'));
  console.log(`Processing ${files.length} email images...`);
  files.forEach(f => {
    const filepath = path.join(EMAILS_DIR, f);
    const hash = hashFile(filepath);
    seenHashes.add(hash);
    const { thumb, modal } = processImage(filepath, EMAILS_DIR);
    const prev = existing[f] || {};
    inventory.push({
      filename: f, thumb, modal,
      source: 'emails',
      date: prev.date || parseDate(f),
      tags: prev.tags || [],
      caption: prev.caption || '',
      art: prev.art || false,
      featured: prev.featured || false,
      ...prev.scores && { scores: prev.scores },
      ...prev.rawDescription && { rawDescription: prev.rawDescription },
      ...prev.visible === false && { visible: false }
    });
  });
}

// --- Process art images ---
if (fs.existsSync(ART_DIR)) {
  const files = fs.readdirSync(ART_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes('-thumb') && !f.includes('-modal'));
  console.log(`Processing ${files.length} art images...`);
  files.forEach(f => {
    const filepath = path.join(ART_DIR, f);
    const hash = hashFile(filepath);
    seenHashes.add(hash);
    const { thumb, modal } = processImage(filepath, ART_DIR);
    const prev = existing[f] || {};
    inventory.push({
      filename: f, thumb, modal,
      source: 'art',
      date: prev.date || '',
      tags: prev.tags || ['art'],
      caption: prev.caption || '',
      art: prev.art !== undefined ? prev.art : artFiles.has(f),
      featured: prev.featured || false,
      ...prev.scores && { scores: prev.scores },
      ...prev.rawDescription && { rawDescription: prev.rawDescription },
      ...prev.visible === false && { visible: false }
    });
  });
}

// --- Ingest + deduplicate source photos ---
if (fs.existsSync(SOURCE_PHOTOS)) {
  const files = fs.readdirSync(SOURCE_PHOTOS).filter(f => /\.(jpg|jpeg|png|webp|heic)$/i.test(f));
  console.log(`Ingesting ${files.length} source photos (deduplicating)...`);
  let added = 0, skipped = 0;
  files.forEach(f => {
    const src = path.join(SOURCE_PHOTOS, f);
    const hash = hashFile(src);
    if (seenHashes.has(hash)) { skipped++; return; }
    seenHashes.add(hash);

    // Copy to site photos dir
    const dest = path.join(PHOTOS_DIR, f);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);

    const { thumb, modal } = processImage(dest, PHOTOS_DIR);
    const prev = existing[f] || {};
    inventory.push({
      filename: f, thumb, modal,
      source: 'photos',
      date: prev.date || parseDate(f),
      tags: prev.tags || [],
      caption: prev.caption || '',
      art: prev.art || false,
      featured: prev.featured || false,
      ...prev.scores && { scores: prev.scores },
      ...prev.rawDescription && { rawDescription: prev.rawDescription },
      ...prev.visible === false && { visible: false }
    });
    added++;
  });
  console.log(`  Photos: ${added} added, ${skipped} duplicates skipped`);
}

// --- Ingest videos (extract thumbnail) ---
if (fs.existsSync(SOURCE_VIDEOS)) {
  const files = fs.readdirSync(SOURCE_VIDEOS).filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f));
  console.log(`Extracting thumbnails from ${files.length} videos...`);
  files.forEach(f => {
    const src = path.join(SOURCE_VIDEOS, f);
    try {
      const { filename, thumb, modal } = extractVideoThumb(src, VIDEOS_DIR);
      const prev = existing[filename] || {};
      inventory.push({
        filename, thumb, modal,
        source: 'videos',
        date: prev.date || parseDate(f),
        tags: prev.tags || ['activity'],
        caption: prev.caption || '',
        art: false,
        featured: prev.featured || false,
        video: f,
        ...prev.scores && { scores: prev.scores },
        ...prev.rawDescription && { rawDescription: prev.rawDescription },
        ...prev.visible === false && { visible: false }
      });
    } catch (e) {
      console.log(`  ERROR extracting thumb: ${f} - ${e.message}`);
    }
  });
}

fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
const sources = {};
inventory.forEach(i => { sources[i.source] = (sources[i.source] || 0) + 1; });
console.log(`\nInventory: ${inventory.length} total`);
Object.entries(sources).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log(`  art: ${inventory.filter(i => i.art).length}, featured: ${inventory.filter(i => i.featured).length}`);
console.log(`Saved → ${INVENTORY_PATH}`);
