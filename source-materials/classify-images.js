const fs = require('fs');
const path = require('path');

const ATTACHMENTS_DIR = path.join(__dirname, 'emails', 'downloaded', 'attachments');
const OUTPUT_PATH = path.join(__dirname, 'image-classifications.json');
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';

async function classifyImage(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return null;

  const imageData = fs.readFileSync(filepath);
  const base64 = imageData.toString('base64');
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const body = {
    model: "llava-phi-3-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` }
          },
          {
            type: "text",
            text: "Classify this image into exactly ONE category. Reply with ONLY the category name, nothing else.\n\nCategories:\n- art (hand-drawn, digital art, sketches, paintings, illustrations)\n- photo-people (photos of people, selfies, group shots)\n- photo-scenery (landscapes, buildings, nature, cities)\n- photo-food (food, meals, drinks)\n- screenshot (phone screenshots, text messages, app screens)\n- document (PDFs, letters, flyers, printed text)\n- other"
          }
        ]
      }
    ],
    max_tokens: 20,
    temperature: 0
  };

  const res = await fetch(LM_STUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error(`  Error: ${res.status} ${res.statusText}`);
    return 'error';
  }

  const data = await res.json();
  const reply = data.choices[0].message.content.trim().toLowerCase();

  // Normalize the response to one of our categories
  if (reply.includes('art') || reply.includes('draw') || reply.includes('sketch') || reply.includes('illustr')) return 'art';
  if (reply.includes('people') || reply.includes('selfie') || reply.includes('group')) return 'photo-people';
  if (reply.includes('scenery') || reply.includes('landscape') || reply.includes('building') || reply.includes('nature')) return 'photo-scenery';
  if (reply.includes('food') || reply.includes('meal') || reply.includes('drink')) return 'photo-food';
  if (reply.includes('screenshot') || reply.includes('screen')) return 'screenshot';
  if (reply.includes('document') || reply.includes('letter') || reply.includes('flyer')) return 'document';
  return reply.replace(/[^a-z-]/g, '') || 'other';
}

async function getAllImages(dir) {
  let images = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      images.push(...await getAllImages(full));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        images.push(full);
      }
    }
  }
  return images;
}

async function main() {
  const images = await getAllImages(ATTACHMENTS_DIR);
  console.log(`Found ${images.length} images to classify\n`);

  const results = [];

  for (let i = 0; i < images.length; i++) {
    const filepath = images[i];
    const relative = path.relative(ATTACHMENTS_DIR, filepath);
    console.log(`[${i + 1}/${images.length}] ${relative}`);

    const category = await classifyImage(filepath);
    if (category) {
      results.push({ file: relative, category });
      console.log(`  → ${category}`);
    }

    // Save progress every 10 images
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  // Summary
  const counts = {};
  results.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
  console.log('\n--- Summary ---');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  console.log(`\nResults saved to: ${OUTPUT_PATH}`);
}

main().catch(console.error);
