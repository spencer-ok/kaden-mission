const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const OUTPUT_DIR = path.join(__dirname, 'downloaded');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const QUERY = 'killianfamily@gmail.com "Elder Killian" -{"Oklahoma" mackay.killian@myldsmail.net}';

async function authorize() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...');

  const code = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const query = url.parse(req.url, true).query;
      if (query.code) {
        res.end('Authorization successful! You can close this tab.');
        server.close();
        resolve(query.code);
      }
    });
    server.listen(3000);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('Token saved.\n');
  return oAuth2Client;
}

function decodeBody(body) {
  if (!body || !body.data) return '';
  return Buffer.from(body.data, 'base64url').toString('utf-8');
}

function extractText(payload) {
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decodeBody(payload.body);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBody(part.body);
      }
    }
    for (const part of payload.parts) {
      const result = extractText(part);
      if (result) return result;
    }
  }
  return '';
}

function extractHtml(payload) {
  if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
    return decodeBody(payload.body);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return decodeBody(part.body);
      }
    }
    for (const part of payload.parts) {
      const result = extractHtml(part);
      if (result) return result;
    }
  }
  return '';
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

async function main() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Searching: ${QUERY}\n`);

  let messages = [];
  let pageToken = null;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: QUERY,
      maxResults: 100,
      pageToken
    });
    if (res.data.messages) messages.push(...res.data.messages);
    pageToken = res.data.nextPageToken;
    console.log(`Found ${messages.length} messages so far...`);
  } while (pageToken);

  console.log(`\nTotal: ${messages.length} emails. Downloading...\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: messages[i].id, format: 'full' });
    const headers = msg.data.payload.headers;
    const subject = getHeader(headers, 'Subject') || '(no subject)';
    const date = getHeader(headers, 'Date');
    const from = getHeader(headers, 'From');

    const text = extractText(msg.data.payload);
    const html = extractHtml(msg.data.payload);

    // Create a safe filename from date and subject
    const dateStr = new Date(date).toISOString().slice(0, 10);
    const safeSubject = subject.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50).trim();
    const filename = `${dateStr}_${safeSubject}`.replace(/\s+/g, '-');

    const output = `Subject: ${subject}\nDate: ${date}\nFrom: ${from}\n\n${text || '(no plain text body)'}`;
    fs.writeFileSync(path.join(OUTPUT_DIR, `${filename}.txt`), output);

    if (html) {
      fs.writeFileSync(path.join(OUTPUT_DIR, `${filename}.html`), html);
    }

    console.log(`[${i + 1}/${messages.length}] ${dateStr} — ${subject}`);
  }

  console.log(`\nDone! Emails saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
