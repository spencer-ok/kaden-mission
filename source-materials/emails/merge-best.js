const fs = require('fs');
const path = require('path');

const DIR1 = path.join(__dirname, 'downloaded');
const DIR2 = path.join(__dirname, 'downloaded-direct');
const OUTPUT = path.join(__dirname, 'best');

// Skip these — admin/not his weekly emails
const SKIP = ['Confirmation of On-Site', 'Devotional Invitation', 'Mailing Address', 'Travel Itinerary', 'Meet the trainers', 'Release Letter'];

function parseFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const subject = (lines[0] || '').replace('Subject: ', '').trim();
  const date = (lines[1] || '').replace('Date: ', '').trim();
  const from = (lines[2] || '').replace('From: ', '').trim();
  const body = lines.slice(4).join('\n').trim();
  const isDirect = from.includes('kaden.killian@missionary.org');
  const isFwd = subject.startsWith('FW:') || subject.startsWith('Fwd:');
  const cleanSubject = subject.replace(/^(FW|Fwd|Re): ?/i, '').trim();
  return { subject, cleanSubject, date, from, body, isDirect, isFwd, length: body.length, content };
}

// Load all files
const all = [];
fs.readdirSync(DIR1).filter(f => f.endsWith('.txt')).forEach(f => {
  all.push({ ...parseFile(path.join(DIR1, f)), filename: f, dir: DIR1 });
});
fs.readdirSync(DIR2).filter(f => f.endsWith('.txt')).forEach(f => {
  all.push({ ...parseFile(path.join(DIR2, f)), filename: f, dir: DIR2 });
});

// Skip admin emails
const filtered = all.filter(e => !SKIP.some(s => e.subject.includes(s)));

// Skip pre-mission (before July 2024) and empty subjects from early forwards
const mission = filtered.filter(e => {
  const d = e.filename.slice(0, 10);
  return d >= '2024-07-01';
});

// Group by date + normalized subject
const groups = {};
mission.forEach(e => {
  const dateKey = e.filename.slice(0, 10);
  const normSubject = e.cleanSubject.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
  const key = dateKey + '_' + normSubject;
  if (!groups[key]) groups[key] = [];
  groups[key].push(e);
});

// Pick best from each group
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

const results = [];
Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, emails]) => {
  emails.sort((a, b) => {
    if (a.isDirect !== b.isDirect) return b.isDirect - a.isDirect;
    if (a.isFwd !== b.isFwd) return a.isFwd - b.isFwd;
    return b.length - a.length;
  });
  const best = emails[0];
  
  // Copy to best/ folder
  const destName = best.filename;
  fs.writeFileSync(path.join(OUTPUT, destName), best.content);
  results.push({ filename: destName, subject: best.cleanSubject, direct: best.isDirect });
});

console.log(`\nMerged ${all.length} files → ${results.length} best versions in emails/best/`);
console.log(`  Direct from Kaden: ${results.filter(r => r.direct).length}`);
console.log(`  From family forward: ${results.filter(r => !r.direct).length}`);
