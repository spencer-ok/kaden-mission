const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EML_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'wife-download');
const EMAILS_JSON = path.join(__dirname, 'src', '_data', 'emails.json');

// Load current emails
const existing = JSON.parse(fs.readFileSync(EMAILS_JSON, 'utf8'));
const existingByDate = {};
existing.forEach(e => {
  if (!existingByDate[e.date]) existingByDate[e.date] = [];
  existingByDate[e.date].push(e);
});

// Helper: extract plain text body from .eml
function extractBody(raw) {
  // Split headers from body
  const headerEnd = raw.search(/\r?\n\r?\n/);
  if (headerEnd < 0) return '';
  const body = raw.slice(headerEnd).trim();

  // Try to find plain text part in multipart
  const boundaryMatch = raw.match(/boundary="?([^"\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split('--' + boundary);
    for (const part of parts) {
      if (part.match(/Content-Type:\s*text\/plain/i)) {
        const partBody = part.split(/\r?\n\r?\n/).slice(1).join('\n');
        // Handle quoted-printable
        if (part.match(/Content-Transfer-Encoding:\s*quoted-printable/i)) {
          return partBody.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        // Handle base64
        if (part.match(/Content-Transfer-Encoding:\s*base64/i)) {
          return Buffer.from(partBody.replace(/\s/g, ''), 'base64').toString('utf8');
        }
        return partBody;
      }
    }
  }

  // Single part - just return body
  return body;
}

// Helper: strip HTML tags
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

// Helper: detect if our existing version is a forward
function isForwarded(email) {
  const subj = email.subject.toLowerCase();
  const body = email.body.toLowerCase();
  return subj.startsWith('fw:') || subj.startsWith('fwd:') || subj.includes('fw-') ||
    body.includes('---------- forwarded message') || body.includes('-------- original message');
}

// Helper: count paragraph breaks as quality signal
function qualityScore(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20).length;
  const chars = text.replace(/\s+/g, '').length;
  return { paragraphs, chars };
}

// Parse .eml files
const emlFiles = fs.readdirSync(EML_DIR).filter(f => f.endsWith('.eml'));
console.log(`Found ${emlFiles.length} .eml files to audit\n`);

const results = { new: [], better: [], duplicate: [] };

for (const file of emlFiles) {
  const raw = fs.readFileSync(path.join(EML_DIR, file), 'utf8');

  // Extract subject
  const subjMatch = raw.match(/^Subject:\s*(.+)$/m);
  const subject = subjMatch ? subjMatch[1].replace(/\r/g, '').trim() : file;

  // Extract date
  const dateMatch = raw.match(/^Date:\s*(.+)$/m);
  let date = '';
  if (dateMatch) {
    try { date = new Date(dateMatch[1]).toISOString().slice(0, 10); } catch (e) {}
  }

  const newBody = extractBody(raw);
  const newQuality = qualityScore(newBody);

  // Find matching existing email
  const sameDateEmails = existingByDate[date] || [];
  const cleanSubj = subject.toLowerCase().replace(/^(fw:|fwd:|re:)\s*/i, '').replace(/[^a-z0-9]/g, '');
  const match = sameDateEmails.find(e => {
    const existClean = e.subject.toLowerCase().replace(/^(fw:|fwd:|re:)\s*/i, '').replace(/[^a-z0-9]/g, '');
    return existClean.includes(cleanSubj.slice(0, 15)) || cleanSubj.includes(existClean.slice(0, 15));
  });

  if (!match) {
    results.new.push({ file, date, subject, chars: newQuality.chars, paragraphs: newQuality.paragraphs });
    continue;
  }

  const existBody = stripHtml(match.body);
  const existQuality = qualityScore(existBody);
  const existIsForward = isForwarded(match);

  // Determine if new version is better
  let reason = null;
  if (existIsForward) {
    reason = 'existing is a forward';
  } else if (existQuality.chars < 100 && newQuality.chars > 200) {
    reason = `existing is tiny (${existQuality.chars}ch vs ${newQuality.chars}ch)`;
  } else if (newQuality.paragraphs > existQuality.paragraphs * 1.5 && newQuality.chars > existQuality.chars) {
    reason = `better formatting (${newQuality.paragraphs} paragraphs vs ${existQuality.paragraphs})`;
  } else if (newQuality.chars > existQuality.chars * 1.3) {
    reason = `more content (${newQuality.chars}ch vs ${existQuality.chars}ch)`;
  }

  if (reason) {
    results.better.push({ file, date, subject, reason, existing: match.subject });
  } else {
    results.duplicate.push({ file, date, subject });
  }
}

// Report
console.log(`=== NEW (${results.new.length}) — not in current set ===`);
results.new.sort((a, b) => a.date.localeCompare(b.date));
results.new.forEach(r => console.log(`  ${r.date} | ${r.subject} | ${r.chars}ch ${r.paragraphs}¶ | ${r.file}`));

console.log(`\n=== BETTER (${results.better.length}) — should replace existing ===`);
results.better.sort((a, b) => a.date.localeCompare(b.date));
results.better.forEach(r => console.log(`  ${r.date} | ${r.subject} | ${r.reason} | replaces: "${r.existing}"`));

console.log(`\n=== DUPLICATE (${results.duplicate.length}) — already have, skip ===`);
results.duplicate.forEach(r => console.log(`  ${r.date} | ${r.subject}`));

console.log(`\n--- Summary ---`);
console.log(`  New:     ${results.new.length} (add these)`);
console.log(`  Better:  ${results.better.length} (replace existing)`);
console.log(`  Skip:    ${results.duplicate.length}`);
