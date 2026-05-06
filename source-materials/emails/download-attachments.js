const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const OUTPUT_DIR = path.join(__dirname, 'downloaded');
const QUERY = 'killianfamily@gmail.com "Elder Killian" -{"Oklahoma" mackay.killian@myldsmail.net}';

async function authorize() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  return oAuth2Client;
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function findAttachments(payload, list = []) {
  if (payload.body && payload.body.attachmentId && payload.filename) {
    list.push({ filename: payload.filename, attachmentId: payload.body.attachmentId, mimeType: payload.mimeType });
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      findAttachments(part, list);
    }
  }
  return list;
}

async function main() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log(`Searching: ${QUERY}\n`);

  let messages = [];
  let pageToken = null;
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: QUERY, maxResults: 100, pageToken });
    if (res.data.messages) messages.push(...res.data.messages);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Total: ${messages.length} emails. Checking for attachments...\n`);

  let totalAttachments = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: messages[i].id, format: 'full' });
    const headers = msg.data.payload.headers;
    const subject = getHeader(headers, 'Subject') || '(no subject)';
    const date = getHeader(headers, 'Date');
    const dateStr = new Date(date).toISOString().slice(0, 10);
    const safeSubject = subject.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40).trim().replace(/\s+/g, '-');

    const attachments = findAttachments(msg.data.payload);
    if (attachments.length === 0) continue;

    const emailDir = path.join(OUTPUT_DIR, 'attachments', `${dateStr}_${safeSubject}`);
    if (!fs.existsSync(emailDir)) fs.mkdirSync(emailDir, { recursive: true });

    for (const att of attachments) {
      const res = await gmail.users.messages.attachments.get({
        userId: 'me', messageId: messages[i].id, id: att.attachmentId
      });
      const data = Buffer.from(res.data.data, 'base64url');
      const filepath = path.join(emailDir, att.filename);
      fs.writeFileSync(filepath, data);
      totalAttachments++;
      console.log(`[${i + 1}/${messages.length}] ${att.filename} (${(data.length / 1024).toFixed(0)} KB)`);
    }
  }

  console.log(`\nDone! ${totalAttachments} attachments saved to: ${path.join(OUTPUT_DIR, 'attachments')}`);
}

main().catch(console.error);
