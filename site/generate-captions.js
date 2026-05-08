const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOGETHER_API_KEY = 'tgp_v1_dOfKZaITI3gdD5m06Llk8ASPzUWhEyd2TG0J_uYXw2k';
const INVENTORY_PATH = path.join(__dirname, 'src', '_data', 'imageInventory.json');
const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

const toCaption = inventory.filter(i => i.rawDescription && i.rawDescription.length > 10 && !i.caption);
console.log('Need captions:', toCaption.length);

const BATCH_SIZE = 30;
let done = 0;

for (let i = 0; i < toCaption.length; i += BATCH_SIZE) {
  const batch = toCaption.slice(i, i + BATCH_SIZE);
  const prompt = `Generate a short caption (5-8 words max) for each image description. Captions should be natural, like a photo album label. Return ONLY a JSON array of strings in order.\n\n` +
    batch.map((b, j) => `[${j}] ${b.rawDescription.slice(0, 200).replace(/\n/g, ' ')}`).join('\n');

  const body = JSON.stringify({
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0
  });

  const tmpFile = '/tmp/caption_req.json';
  fs.writeFileSync(tmpFile, body);

  try {
    const result = execSync(`curl -s -X POST "https://api.together.xyz/v1/chat/completions" -H "Authorization: Bearer ${TOGETHER_API_KEY}" -H "Content-Type: application/json" -d @${tmpFile}`, { maxBuffer: 5 * 1024 * 1024 });
    const data = JSON.parse(result.toString());
    const content = data.choices[0].message.content;
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const captions = JSON.parse(match[0]);
      batch.forEach((img, j) => { if (captions[j]) img.caption = captions[j]; });
      done += captions.length;
    }
  } catch (e) {
    console.log('Error at batch', i, e.message.slice(0, 100));
  }

  if ((i + BATCH_SIZE) % 90 === 0 || i + BATCH_SIZE >= toCaption.length) {
    console.log(`  ${done}/${toCaption.length} captioned...`);
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
  }
}

fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
console.log('Done!', done, 'captions generated');
