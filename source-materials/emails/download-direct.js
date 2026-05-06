const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const OUTPUT_DIR = path.join(__dirname, 'downloaded-direct');
const QUERY = 'from:kaden.killian@missionary.org';

async function authorize() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  return oAuth2Client;
}

function decodeBody(body) {
  if (!body || !body.data) return '';
  return Buffer.from(body.data, 'base64url').toString('utf-8');
}

function extractText(payload) {
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) return decodeBody(payload.body);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) return decodeBody(part.body);
    }
    for (const part of payload.parts) {
      const result = extractText(part);
      if (result) return result;
    }
  }
  return '';
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function findAttachments(payload, list = []) {
  if (payload.body && payload.body.attachmentId && payload.filename) {
    list.push({ filename: payload.filename, attachmentId: payload.body.attachmentId });
  }
  if (payload.parts) {
    for (const part of payload.parts) findAttachments(part, list);
  }
  return list;
}

async function main() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Searching: ${QUERY}\n`);

  let messages = [];
  let pageToken = null;
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: QUERY, maxResults: 100, pageToken });
    if (res.data.messages) messages.push(...res.data.messages);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Total: ${messages.length} emails. Downloading...\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: messages[i].id, format: 'full' });
    const headers = msg.data.payload.headers;
    const subject = getHeader(headers, 'Subject') || '(no subject)';
    const date = getHeader(headers, 'Date');
    const from = getHeader(headers, 'From');
    const text = extractText(msg.data.payload);

    const dateStr = new Date(date).toISOString().slice(0, 10);
    const safeSubject = subject.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50).trim().replace(/\s+/g, '-');
    const filename = `${dateStr}_${safeSubject}`;

    // Skip if already exists
    if (fs.existsSync(path.join(OUTPUT_DIR, `${filename}.txt`))) {
      console.log(`[${i + 1}/${messages.length}] SKIP ${dateStr} — ${subject}`);
      continue;
    }

    const output = `Subject: ${subject}\nDate: ${date}\nFrom: ${from}\n\n${text || '(no plain text body)'}`;
    fs.writeFileSync(path.join(OUTPUT_DIR, `${filename}.txt`), output);

    // Download attachments
    const attachments = findAttachments(msg.data.payload);
    if (attachments.length) {
      const attDir = path.join(OUTPUT_DIR, 'attachments', filename);
      if (!fs.existsSync(attDir)) fs.mkdirSync(attDir, { recursive: true });
      for (const att of attachments) {
        const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId: messages[i].id, id: att.attachmentId });
        fs.writeFileSync(path.join(attDir, att.filename), Buffer.from(res.data.data, 'base64url'));
      }
    }

    console.log(`[${i + 1}/${messages.length}] ${dateStr} — ${subject} (${attachments.length} attachments)`);
  }

  console.log(`\nDone! Saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
