const fs = require('fs');
const path = require('path');

const EML_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'wife-download');
const BEST_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'best');
const ATTACH_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'downloaded-direct', 'attachments');
const EMAILS_JSON = path.join(__dirname, 'src', '_data', 'emails.json');
const MANIFEST_PATH = path.join(__dirname, 'src', '_data', 'hashManifest.json');

// Load hash manifest to skip duplicate images
let manifestHashes = new Set();
if (fs.existsSync(MANIFEST_PATH)) {
  manifestHashes = new Set(Object.values(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))));
}

// Load current emails for matching
const existing = JSON.parse(fs.readFileSync(EMAILS_JSON, 'utf8'));
const existingByDate = {};
existing.forEach(e => {
  if (!existingByDate[e.date]) existingByDate[e.date] = [];
  existingByDate[e.date].push(e);
});

// Decode MIME encoded subject
function decodeSubject(raw) {
  return raw
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, b64) => Buffer.from(b64, 'base64').toString('utf8'))
    .replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, qp) => qp.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/_/g, ' '))
    .trim();
}

// Extract parts from multipart .eml
function parseEml(raw) {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd).trim();

  // Subject
  const subjMatch = headers.match(/^Subject:\s*(.+(?:\r?\n\s+.*)*)$/m);
  let subject = subjMatch ? subjMatch[1].replace(/\r?\n\s+/g, ' ').trim() : 'unknown';
  subject = decodeSubject(subject);

  // Date
  const dateMatch = headers.match(/^Date:\s*(.+)$/m);
  let date = '';
  if (dateMatch) {
    try { date = new Date(dateMatch[1]).toISOString().slice(0, 10); } catch (e) {}
  }

  // Find boundary
  const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/i) || body.match(/boundary="?([^"\r\n;]+)"?/i);

  let textBody = '';
  const images = [];

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split('--' + boundary);
    for (const part of parts) {
      const partHeaderEnd = part.search(/\r?\n\r?\n/);
      if (partHeaderEnd < 0) continue;
      const partHeaders = part.slice(0, partHeaderEnd);
      let partBody = part.slice(partHeaderEnd + 2).trim();

      // Nested multipart
      const nestedBoundary = partHeaders.match(/boundary="?([^"\r\n;]+)"?/i);
      if (nestedBoundary) {
        const subParts = partBody.split('--' + nestedBoundary[1]);
        for (const sp of subParts) {
          const spHeaderEnd = sp.search(/\r?\n\r?\n/);
          if (spHeaderEnd < 0) continue;
          const spHeaders = sp.slice(0, spHeaderEnd);
          let spBody = sp.slice(spHeaderEnd + 2).trim();

          if (spHeaders.match(/Content-Type:\s*text\/plain/i) && !textBody) {
            if (spHeaders.match(/Content-Transfer-Encoding:\s*quoted-printable/i))
              spBody = spBody.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
            else if (spHeaders.match(/Content-Transfer-Encoding:\s*base64/i))
              spBody = Buffer.from(spBody.replace(/\s/g, ''), 'base64').toString('utf8');
            textBody = spBody;
          }
          if (spHeaders.match(/Content-Type:\s*image\//i)) {
            const fnMatch = spHeaders.match(/name="?([^"\r\n]+)"?/i);
            if (fnMatch && spBody.length > 100) {
              images.push({ filename: fnMatch[1].trim(), data: Buffer.from(spBody.replace(/\s/g, ''), 'base64') });
            }
          }
        }
        continue;
      }

      if (partHeaders.match(/Content-Type:\s*text\/plain/i) && !textBody) {
        if (partHeaders.match(/Content-Transfer-Encoding:\s*quoted-printable/i))
          partBody = partBody.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
        else if (partHeaders.match(/Content-Transfer-Encoding:\s*base64/i))
          partBody = Buffer.from(partBody.replace(/\s/g, ''), 'base64').toString('utf8');
        textBody = partBody;
      }
      if (partHeaders.match(/Content-Type:\s*image\//i)) {
        const fnMatch = partHeaders.match(/name="?([^"\r\n]+)"?/i);
        if (fnMatch && partBody.length > 100) {
          images.push({ filename: fnMatch[1].trim(), data: Buffer.from(partBody.replace(/\s/g, ''), 'base64') });
        }
      }
    }
  } else {
    // Single part
    const ctMatch = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    if (ctMatch && ctMatch[1].toLowerCase() === 'quoted-printable')
      textBody = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    else if (ctMatch && ctMatch[1].toLowerCase() === 'base64')
      textBody = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
    else
      textBody = body;
  }

  return { subject, date, textBody, images };
}

function cleanSubject(s) {
  return s.replace(/^(fw:|fwd:|re:)\s*/i, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

// Process all .eml files
const emlFiles = fs.readdirSync(EML_DIR).filter(f => f.endsWith('.eml'));
let added = 0, replaced = 0, skipped = 0;

for (const file of emlFiles) {
  const raw = fs.readFileSync(path.join(EML_DIR, file), 'utf8');
  const { subject, date, textBody, images } = parseEml(raw);

  if (!date || !textBody.trim()) {
    console.log(`  SKIP (no date/body): ${file}`);
    skipped++;
    continue;
  }

  // Check if this is a duplicate (same date, similar subject, not better)
  const sameDateEmails = existingByDate[date] || [];
  const cleanSubj = subject.toLowerCase().replace(/^(fw:|fwd:|re:)\s*/i, '').replace(/[^a-z0-9]/g, '');
  const match = sameDateEmails.find(e => {
    const ec = e.subject.toLowerCase().replace(/^(fw:|fwd:|re:)\s*/i, '').replace(/[^a-z0-9]/g, '');
    return ec.includes(cleanSubj.slice(0, 15)) || cleanSubj.includes(ec.slice(0, 15));
  });

  const isNew = !match;
  const isBetter = match && (
    match.body.length < 100 ||
    match.subject.toLowerCase().startsWith('fw') ||
    textBody.length > match.body.length * 1.3
  );

  if (!isNew && !isBetter) { skipped++; continue; }

  // Write .txt to best/
  const baseName = `${date}_${cleanSubject(subject)}`;
  const txtPath = path.join(BEST_DIR, `${baseName}.txt`);

  // If replacing, remove old .txt file with different name
  if (isBetter) {
    const oldName = fs.readdirSync(BEST_DIR).find(f => f.startsWith(date));
    if (oldName && oldName !== `${baseName}.txt`) {
      fs.unlinkSync(path.join(BEST_DIR, oldName));
    }
  }

  fs.writeFileSync(txtPath, `Subject: ${subject}\nDate: ${date}\n\n${textBody}`);

  // Save images (skip if hash already known)
  if (images.length) {
    const attachDir = path.join(ATTACH_DIR, baseName);
    if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });
    let imgSaved = 0;
    images.forEach(img => {
      const hash = require('crypto').createHash('md5').update(img.data).digest('hex');
      if (manifestHashes.has(hash)) return;
      fs.writeFileSync(path.join(attachDir, img.filename), img.data);
      imgSaved++;
    });
    if (imgSaved < images.length) {
      console.log(`    (${images.length - imgSaved} duplicate images skipped)`);
    }
  }

  if (isNew) {
    console.log(`  ADD: ${date} | ${subject} | ${textBody.length}ch ${images.length}img`);
    added++;
  } else {
    console.log(`  REPLACE: ${date} | ${subject} | ${textBody.length}ch ${images.length}img`);
    replaced++;
  }
}

console.log(`\n--- Done ---`);
console.log(`  Added: ${added}`);
console.log(`  Replaced: ${replaced}`);
console.log(`  Skipped: ${skipped}`);
console.log(`\nNext steps:`);
console.log(`  1. node build-emails.js`);
console.log(`  2. node process-images.js`);
console.log(`  3. Delete originals from src/assets/images/emails/`);
console.log(`  4. node generate-captions.js`);
