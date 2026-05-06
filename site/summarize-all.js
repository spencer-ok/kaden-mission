const fs = require('fs');
const path = require('path');

const EMAILS_DIR = path.join(__dirname, '..', 'source-materials', 'emails', 'best');
const OUTPUT_PATH = path.join(__dirname, 'src', '_data', 'emailSummaries.json');
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';

// Load existing emails.json to get the list
const emails = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', '_data', 'emails.json')));

// Get all txt files sorted
const txtFiles = fs.readdirSync(EMAILS_DIR).filter(f => f.endsWith('.txt')).sort();

async function summarize(text) {
  const res = await fetch(LM_STUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "qwen2.5-3b-instruct",
      messages: [
        { role: "system", content: "Summarize in under 15 words. No names. No 'the email' or 'the writer'. Just events. Example format: 'Busy MTC week, loving scripture study, feeling confident about teaching.'" },
        { role: "user", content: "Summarize in under 15 words. No names:\nArrived in Japan after 20 hours of travel. Met trainer. Had first dinner with investigators. Sprained foot playing frisbee." },
        { role: "assistant", content: "Arrived in Japan, met trainer, first dinner with investigators, sprained foot." },
        { role: "user", content: `Summarize in under 15 words. No names:\n${text.slice(0, 2000)}` }
      ],
      max_tokens: 40,
      temperature: 0.3
    })
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function main() {
  const summaries = {};

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    // Find matching txt file
    const match = txtFiles.find(f => f.startsWith(email.date));
    if (!match) { console.log(`[${i+1}/${emails.length}] SKIP ${email.date}`); continue; }

    const content = fs.readFileSync(path.join(EMAILS_DIR, match), 'utf-8');
    const body = content.split('\n').slice(4).join('\n').trim();

    const summary = await summarize(body);
    summaries[email.date + '_' + email.subject] = summary;
    console.log(`[${i+1}/${emails.length}] ${email.subject}`);
    console.log(`  → ${summary}`);

    // Save progress
    if ((i + 1) % 5 === 0) fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summaries, null, 2));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summaries, null, 2));
  console.log(`\nDone! ${Object.keys(summaries).length} summaries saved.`);
}

main().catch(console.error);
