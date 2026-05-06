const fs = require('fs');
const path = require('path');

const EMAILS_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'best');
const ATTACHMENTS_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'downloaded', 'attachments');
const ATTACHMENTS_DIR2 = path.join(__dirname, '..', 'source-materials', 'emails', 'downloaded-direct', 'attachments');
const SUMMARIES_PATH = path.join(__dirname, 'src', '_data', 'emailSummaries.json');
const IMAGES_OUT = path.join(__dirname, 'src', 'assets', 'images', 'emails');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'emails.json');

if (!fs.existsSync(IMAGES_OUT)) fs.mkdirSync(IMAGES_OUT, { recursive: true });

// Load summaries if available
let summaries = {};
if (fs.existsSync(SUMMARIES_PATH)) {
  summaries = JSON.parse(fs.readFileSync(SUMMARIES_PATH));
}

// Get all txt files, sorted by date
const files = fs.readdirSync(EMAILS_DIR)
  .filter(f => f.endsWith('.txt'))
  .sort();

// Skip admin/duplicate emails
const skipPatterns = ['Confirmation-of-OnSite', 'Devotional-Invitation', 'Mailing-Address', 'Meet-the-trainers', 'Travel-Itinerary', 'Release-Letter'];
const isSkip = f => skipPatterns.some(p => f.includes(p)) || f.startsWith('2024-03-');

// Deduplicate: prefer non-FW version
const emailMap = new Map();
for (const file of files) {
  if (isSkip(file)) continue;
  const dateStr = file.slice(0, 10);
  const isFwd = file.includes('FW-') || file.includes('Fwd-');
  const key = dateStr + '_' + file.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace('FW-', '').replace('Fwd-', '');
  
  if (!emailMap.has(key) || !isFwd) {
    emailMap.set(key, file);
  }
}

// Find attachments for an email by matching folder name
function findAttachments(file) {
  const baseName = file.replace('.txt', '');
  const allDirs = [];
  
  [ATTACHMENTS_DIR, ATTACHMENTS_DIR2].forEach(attDir => {
    if (!fs.existsSync(attDir)) return;
    const dirs = fs.readdirSync(attDir);
    const matchDir = dirs.find(d => baseName.startsWith(d.slice(0, 25)) || d.startsWith(baseName.slice(0, 25)));
    if (matchDir) {
      const dirPath = path.join(attDir, matchDir);
      if (fs.statSync(dirPath).isDirectory()) allDirs.push(dirPath);
    }
  });

  const images = [];
  allDirs.forEach(dirPath => {
    fs.readdirSync(dirPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .forEach(f => {
        const src = path.join(dirPath, f);
        const safeName = `${path.basename(dirPath).slice(0, 20)}_${f}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dest = path.join(IMAGES_OUT, safeName);
        if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        images.push(safeName);
      });
  });
  return images;
}

// Process emails
const emails = [];
for (const [key, file] of emailMap) {
  const content = fs.readFileSync(path.join(EMAILS_DIR, file), 'utf-8');
  const lines = content.split('\n');

  const subject = (lines[0] || '').replace('Subject: ', '').trim();
  const dateRaw = (lines[1] || '').replace('Date: ', '').trim();
  
  // Get body (skip headers)
  let bodyStart = 4;
  let bodyText = lines.slice(bodyStart).join('\n').trim();
  
  // Strip forwarding headers
  bodyText = bodyText.replace(/^Sent from my.*?\n/i, '');
  bodyText = bodyText.replace(/-------- Original message --------.*?\n/i, '');
  bodyText = bodyText.replace(/^From:.*?\nTo:.*?\nSubject:.*?\n/im, '');
  bodyText = bodyText.replace(/^From:.*?Date:.*?To:.*?Subject:.*?\s/im, '');

  // Parse date
  let dateStr = '';
  try {
    const d = new Date(dateRaw);
    dateStr = d.toISOString().slice(0, 10);
  } catch (e) {
    dateStr = file.slice(0, 10);
  }

  // Convert to HTML with proper paragraphs
  const htmlBody = bodyText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
    .join('\n');

  // Find images
  const images = findAttachments(file);

  // Find summary
  const summaryKey = Object.keys(summaries).find(k => k.startsWith(dateStr + '_'));
  const summary = summaryKey ? summaries[summaryKey] : '';

  emails.push({ date: dateStr, subject, body: htmlBody, images, summary });
}

emails.sort((a, b) => a.date.localeCompare(b.date));

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emails, null, 2));

const withImages = emails.filter(e => e.images.length > 0).length;
console.log(`Generated ${emails.length} emails (${withImages} with images) → ${OUTPUT_PATH}`);
