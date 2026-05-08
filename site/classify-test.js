const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:1234/v1/chat/completions';
const IMAGES_DIR = path.join(__dirname, 'src', 'assets', 'images');
const INVENTORY_PATH = path.join(__dirname, 'src', '_data', 'imageInventory.json');
const TARGET = '2024-08-04_FW-Weekly_20240728_162328.jpg';

const VALID_TAGS = ['people', 'scenery', 'food', 'art', 'selfie', 'group', 'temple', 'activity', 'document', 'other'];
const PROMPT = `Rate this image for each category on a scale of 0-10. Reply ONLY in this exact format, one per line:
people:0
scenery:0
food:0
art:0
selfie:0
group:0
temple:0
activity:0
document:0

Replace 0 with your score (0-10) for each category.`;

async function classify(imgPath) {
  const base64 = fs.readFileSync(imgPath).toString('base64');
  const mime = 'image/jpeg';
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava',
      messages: [{ role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
      ]}],
      max_tokens: 150,
      temperature: 0
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function main() {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH));
  const targets = [
    '2024-08-04_FW-Weekly_20240728_162328.jpg',
    '2024-08-04_FW-Weekly_20240731_080933.jpg',
    '2024-08-04_FW-Weekly_20240731_155319.jpg',
    '2024-08-04_FW-Weekly_20240731_190015.jpg',
    '2024-08-04_FW-Weekly_20240801_131511.jpg'
  ];

  for (const t of targets) {
    const img = inventory.find(i => i.filename === t);
    const imgPath = path.join(IMAGES_DIR, img.source, img.thumb);
    console.log(`\n--- ${t} ---`);
    const raw = await classify(imgPath);
    
    // Try structured scores first
    const scores = {};
    for (const tag of VALID_TAGS) {
      const match = raw.match(new RegExp(`${tag}\\s*[:=]\\s*(\\d+)`, 'i'));
      if (match) scores[tag] = parseInt(match[1]);
    }
    
    // Fallback: extract from description
    if (Object.keys(scores).length === 0) {
      const lower = raw.toLowerCase();
      if (/\b(man|men|woman|women|person|people|individual|boy|girl)\b/.test(lower)) scores.people = 7;
      if (/\b(two|three|four|five|group|several|crowd)\b.*\b(men|people|person|individual|missionary)\b/.test(lower) || /\b(men|people|individuals)\b.*\b(standing|sitting|gathered)\b/.test(lower)) scores.group = 7;
      if (/\b(selfie|peace sign|looking.*camera|self-portrait)\b/.test(lower)) scores.selfie = 8;
      if (/\b(scenery|landscape|mountain|sky|flag|tree|park|ocean|river|city|building|street|urban)\b/.test(lower)) scores.scenery = 7;
      if (/\b(food|meal|dish|eating|restaurant|cook|plate|rice|sushi)\b/.test(lower)) scores.food = 8;
      if (/\b(art|drawing|sketch|illustration|paint|artwork|doodle|notebook.*illustr)\b/.test(lower)) scores.art = 8;
      if (/\b(temple|shrine|church|chapel)\b/.test(lower)) scores.temple = 8;
      if (/\b(playing|sport|game|running|hiking|biking|activity)\b/.test(lower)) scores.activity = 7;
      if (/\b(document|paper|letter|text|sign|certificate)\b/.test(lower)) scores.document = 7;
    }

    const tags = Object.entries(scores).filter(([,s]) => s >= 4).sort((a,b) => b[1]-a[1]).map(([t]) => t);
    console.log('Description:', raw.slice(0, 80) + '...');
    console.log('Scores:', scores);
    console.log('Tags:', tags.length ? tags : ['other']);
  }
}

main();
