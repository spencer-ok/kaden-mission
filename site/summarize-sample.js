const fs = require('fs');
const path = require('path');

const EMAILS_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'downloaded');
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';

const sampleFiles = [
  '2024-07-22_The-MTC-is.txt',
  '2024-08-11_I-built-a-cardboard-AC.txt',
  '2024-09-16_Im-in.txt'
];

async function summarize(text) {
  const res = await fetch(LM_STUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "llava-phi-3-mini",
      messages: [
        {
          role: "system",
          content: "Summarize missionary emails in 1 sentence. Be concise — capture the main event or theme only."
        },
        {
          role: "user",
          content: `Summarize this email in 1 short sentence:\n\n${text}`
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!res.ok) return `Error: ${res.status}`;
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function main() {
  for (const file of sampleFiles) {
    const content = fs.readFileSync(path.join(EMAILS_DIR, file), 'utf-8');
    const lines = content.split('\n');
    const subject = lines[0].replace('Subject: ', '');
    const body = lines.slice(4).join('\n').trim();

    console.log(`\n--- ${subject} ---`);
    const summary = await summarize(body);
    console.log(summary);
  }
}

main().catch(console.error);
