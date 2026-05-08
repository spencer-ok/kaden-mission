const fs = require('fs');
const path = require('path');

const SCORED_PATH = path.join(__dirname, 'src', '_data', 'messengerScored.json');
const MESSAGES_PATH = path.join(__dirname, 'src', '_data', 'messengerMessages.json');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'messengerHighlights.json');

const scored = JSON.parse(fs.readFileSync(SCORED_PATH, 'utf8'));
const chatData = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8'));

function fixEncoding(str) {
  if (!str) return '';
  try { return Buffer.from(str, 'latin1').toString('utf8'); } catch (e) { return str; }
}

// Find all dates that have at least one important Kaden message
const importantDates = new Set(
  Object.values(scored)
    .filter(v => v.score >= 7 && v.text && v.text.trim().length > 20)
    .map(v => v.date)
);

// Also include dates with audio messages
for (const chat of chatData) {
  for (const msg of chat.messages) {
    if (msg.audio) importantDates.add(msg.date);
  }
}

console.log(`${importantDates.size} important days found`);

// Merge all chats into one timeline
const allMessages = [];
for (const chat of chatData) {
  for (const msg of chat.messages) {
    if (!importantDates.has(msg.date)) continue;
    if (!msg.text && !msg.photos && !msg.audio) continue;
    // Skip system/call messages
    const text = fixEncoding(msg.text || '');
    if (/joined the video call|started a video chat|missed .* call|left the group|added .* to the group|changed the group/i.test(text)) continue;
    if (/^https?:\/\/\S+$/i.test(text.trim())) continue;
    allMessages.push({ ...msg, sender: fixEncoding(msg.sender), text });
  }
}

// Sort chronologically
allMessages.sort((a, b) => a.timestamp - b.timestamp);

// Build highlights
const highlights = [];
let lastDate = null;

for (const msg of allMessages) {
  if (!msg.text && !msg.photos && !msg.audio) continue;

  if (msg.date !== lastDate) {
    if (lastDate) highlights.push({ type: 'gap' });
    highlights.push({ type: 'date', date: msg.date });
    lastDate = msg.date;
  }

  const isKaden = msg.sender === 'Kaden Killian';
  const entry = {
    type: 'message',
    sender: isKaden ? 'Kaden' : msg.sender.split(' ')[0],
    text: msg.text || '',
    isKaden
  };
  if (msg.photos) {
    entry.photos = msg.photos.map(p => p.replace(/\.\w+$/, '-thumb.jpg'));
  }
  if (msg.audio) {
    entry.audio = msg.audio;
  }
  highlights.push(entry);
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(highlights, null, 2));
const msgCount = highlights.filter(h => h.type === 'message').length;
const dayCount = highlights.filter(h => h.type === 'date').length;
console.log(`${msgCount} messages across ${dayCount} days → ${highlights.length} total entries`);
