const fs = require('fs');
const path = require('path');

const INVENTORY_PATH = path.join(__dirname, 'src', '_data', 'imageInventory.json');
const IMAGES_DIR = path.join(__dirname, 'src', 'assets', 'images');
const API_URL = 'http://localhost:1234/v1/chat/completions';

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH));

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

const VALID_TAGS = ['people', 'scenery', 'food', 'art', 'selfie', 'group', 'temple', 'activity', 'document', 'other'];

async function classify(imgPath) {
  const base64 = fs.readFileSync(imgPath).toString('base64');
  const ext = path.extname(imgPath).slice(1);
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
        ]
      }],
      max_tokens: 150,
      temperature: 0
    })
  });

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content || '');
  // Parse scores from response - look for "category:N" patterns
  const scores = {};
  for (const tag of VALID_TAGS) {
    const match = raw.match(new RegExp(`${tag}\\s*[:=]\\s*(\\d+)`, 'i'));
    if (match) scores[tag] = parseInt(match[1]);
  }

  // Fallback: extract from description keywords
  if (Object.keys(scores).length === 0) {
    const lower = raw.toLowerCase();
    if (/\b(man|men|woman|women|person|people|individual|boy|girl)\b/.test(lower)) scores.people = 7;
    if (/\b(two|three|four|five|group|several|crowd)\b.*\b(men|people|person|individual)\b/.test(lower) || /\b(men|people|individuals)\b.*\b(standing|sitting|gathered)\b/.test(lower)) scores.group = 7;
    if (/\b(selfie|peace sign|looking.*camera|self-portrait)\b/.test(lower)) scores.selfie = 8;
    if (/\b(scenery|landscape|mountain|sky|flags?|tree|park|ocean|river|city|building|street|urban|outdoor|nature|garden|sunset|sunrise)\b/.test(lower)) scores.scenery = 7;
    if (/\b(food|meal|dish|eating|restaurant|cook|plate|rice|sushi)\b/.test(lower)) scores.food = 8;
    if (/\b(art|drawing|sketch|illustration|paint|artwork|doodle)\b/.test(lower)) scores.art = 8;
    if (/\b(temple|shrine|church|chapel)\b/.test(lower)) scores.temple = 8;
    if (/\b(playing|sport|game|running|hiking|biking|activity)\b/.test(lower)) scores.activity = 7;
    if (/\b(document|paper|letter|certificate|form|receipt)\b/.test(lower) && !/peace sign/.test(lower)) scores.document = 7;
  }

  const tags = Object.entries(scores)
    .filter(([, score]) => score >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  return { tags: tags.length ? tags : ['other'], scores, raw };
}

async function main() {
  const untagged = inventory.filter(img => {
    if (!img.tags.length || img.tags[0] === '') return true;
    // Re-classify invalid tags from previous bad run
    if (!['people','scenery','food','art','selfie','group','temple','activity','document','other'].includes(img.tags[0])) return true;
    // Re-run if missing scores
    if (!img.scores) return true;
    // Re-run if missing rawDescription
    if (!img.rawDescription) return true;
    return false;
  });
  console.log(`Classifying ${untagged.length} untagged images using thumbnails...`);

  let done = 0;
  for (const img of untagged) {
    const thumbPath = path.join(IMAGES_DIR, img.source, img.thumb);
    if (!fs.existsSync(thumbPath)) {
      console.log(`  SKIP (no thumb): ${img.filename}`);
      continue;
    }
    try {
      const { tags, scores, raw } = await classify(thumbPath);
      img.tags = tags;
      img.scores = scores;
      img.rawDescription = raw;
      done++;
      if (done % 10 === 0) {
        console.log(`  ${done}/${untagged.length} classified...`);
        fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
      }
    } catch (e) {
      console.log(`  ERROR: ${img.filename} - ${e.message}`);
      img.tags = ['other'];
    }
  }

  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
  console.log(`Done! Classified ${done} images. Saved to ${INVENTORY_PATH}`);
}

main();
