const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOGETHER_API_KEY = 'tgp_v1_dOfKZaITI3gdD5m06Llk8ASPzUWhEyd2TG0J_uYXw2k';
const INPUT_PATH = path.join(__dirname, 'src', '_data', 'messengerMessages.json');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'messengerScored.json');

const chatData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));

// Load existing scores to resume
let scored = {};
if (fs.existsSync(OUTPUT_PATH)) {
  scored = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
}

// Collect all Kaden messages worth scoring (>20 chars)
const toScore = [];
for (const chat of chatData) {
  for (let i = 0; i < chat.messages.length; i++) {
    const msg = chat.messages[i];
    if (msg.sender !== 'Kaden Killian') continue;
    if (msg.text.length < 20 && !msg.photos) continue;

    const key = `${msg.timestamp}`;
    if (scored[key]) continue;

    // Get surrounding context (2 msgs before, 1 after)
    const context = chat.messages.slice(Math.max(0, i - 2), i + 2)
      .map(m => `${m.sender}: ${m.text || '[photo]'}`.slice(0, 200))
      .join('\n');

    toScore.push({ key, msg, context, chat: chat.name });
  }
}

console.log(`${Object.keys(scored).length} already scored, ${toScore.length} to score`);

async function scoreBatch(batch) {
  const prompt = `You are scoring messages from a missionary (Kaden) to his family for a homecoming keepsake website. Score each message 1-10 for "keepsake-worthiness" — how meaningful, heartfelt, funny, or milestone-worthy it is for a memory book.

Score HIGH (7-10): Spiritual insights, expressions of love/gratitude, personal growth, funny memorable moments, milestones, vulnerability
Score LOW (1-3): Logistics, short replies, requests for stuff, links, generic greetings

Return ONLY a JSON array of scores in order, like [7, 2, 9, 3, ...]

Messages:
${batch.map((b, i) => `[${i}] (${b.msg.date}) ${b.msg.text.slice(0, 300)}${b.msg.photos ? ' [+photo]' : ''}`).join('\n\n')}`;

  const body = JSON.stringify({
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0
  });

  const result = execSync(`curl -s -X POST "https://api.together.xyz/v1/chat/completions" \
    -H "Authorization: Bearer ${TOGETHER_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '${body.replace(/'/g, "'\\''")}'`, { maxBuffer: 1024 * 1024 });

  const data = JSON.parse(result.toString());
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/\[[\d,\s]+\]/);
  if (!match) throw new Error('No array found: ' + content.slice(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  const BATCH_SIZE = 20;
  for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
    const batch = toScore.slice(i, i + BATCH_SIZE);
    try {
      const scores = await scoreBatch(batch);
      batch.forEach((b, j) => {
        scored[b.key] = {
          score: scores[j] || 0,
          date: b.msg.date,
          text: b.msg.text,
          chat: b.chat,
          hasPhoto: !!b.msg.photos,
          photos: b.msg.photos || undefined,
          reactions: b.msg.reactions || undefined
        };
      });
      console.log(`  Scored ${Math.min(i + BATCH_SIZE, toScore.length)}/${toScore.length}...`);
    } catch (e) {
      console.log(`  ERROR batch at ${i}: ${e.message}`);
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(scored, null, 2));
  }

  const important = Object.values(scored).filter(s => s.score >= 7);
  console.log(`\nDone! ${Object.keys(scored).length} scored, ${important.length} marked important (>=7)`);
}

main();
