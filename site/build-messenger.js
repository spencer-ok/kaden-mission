const fs = require('fs');
const path = require('path');

const MESSENGER_DIR = path.join(__dirname, '..', 'source-materials', 'messenger');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'messengerMessages.json');

const chats = fs.readdirSync(MESSENGER_DIR).filter(f => fs.statSync(path.join(MESSENGER_DIR, f)).isDirectory());

const chatData = [];

for (const chat of chats) {
  const msgFile = path.join(MESSENGER_DIR, chat, 'message_1.json');
  if (!fs.existsSync(msgFile)) continue;

  const data = JSON.parse(fs.readFileSync(msgFile, 'utf8'));
  const participants = data.participants.map(p => p.name);
  const chatName = participants.includes('Kyle Killian') ? 'family' : 'parents';

  const messages = [];
  for (const msg of data.messages) {
    // Skip system messages
    if (!msg.content && !msg.photos && !msg.videos && !msg.audio_files) continue;
    if (msg.content && /^(You created|.+ changed the|.+ set the|.+ named the|.+ to the group)/.test(msg.content)) continue;

    const entry = {
      sender: msg.sender_name,
      date: new Date(msg.timestamp_ms).toISOString().slice(0, 10),
      timestamp: msg.timestamp_ms,
      text: msg.content || ''
    };

    if (msg.photos) {
      entry.photos = msg.photos.map(p => path.basename(p.uri));
    }
    if (msg.videos) {
      entry.videos = msg.videos.map(v => path.basename(v.uri));
    }
    if (msg.audio_files) {
      entry.audio = msg.audio_files.map(a => path.basename(a.uri));
    }
    if (msg.reactions) {
      entry.reactions = msg.reactions.map(r => ({ emoji: r.reaction, from: r.actor }));
    }

    messages.push(entry);
  }

  // Reverse so chronological (Facebook exports newest-first)
  messages.reverse();

  chatData.push({
    id: chat,
    name: chatName,
    participants,
    messages
  });
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chatData, null, 2));

// Stats
let totalMsgs = 0;
let totalPhotos = 0;
chatData.forEach(c => {
  totalMsgs += c.messages.length;
  totalPhotos += c.messages.filter(m => m.photos).length;
  console.log(`${c.name} (${c.id.slice(0,20)}...): ${c.messages.length} msgs, ${c.messages.filter(m=>m.photos).length} with photos`);
});
console.log(`\nTotal: ${totalMsgs} messages, ${totalPhotos} with photos`);
