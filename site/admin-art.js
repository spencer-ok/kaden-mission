const http = require('http');
const fs = require('fs');
const path = require('path');

const INVENTORY_PATH = path.join(__dirname, 'src/_data/imageInventory.json');
const PORT = 8282;

function loadInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Art Flag Admin</title>
<style>
  body { font-family: sans-serif; background: #1a1a2e; color: #fff; padding: 1rem; }
  h1 { margin-bottom: 0.5rem; }
  .controls { margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; }
  .controls select, .controls input { padding: 0.4rem; border-radius: 4px; border: 1px solid #555; background: #2a2a4e; color: #fff; }
  .controls input { width: 200px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem; }
  .item { position: relative; cursor: pointer; border: 3px solid transparent; border-radius: 6px; overflow: hidden; transition: border-color 0.2s; }
  .item.art { border-color: #4caf50; box-shadow: 0 0 8px rgba(76,175,80,0.5); }
  .item img { width: 100%; height: 120px; object-fit: cover; display: block; }
  .item .label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); font-size: 0.6rem; padding: 2px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #2a2a4e; padding: 1rem; display: flex; gap: 1rem; align-items: center; border-top: 2px solid #4caf50; }
  .save-bar button { padding: 0.6rem 1.5rem; font-size: 1rem; border: none; border-radius: 4px; cursor: pointer; }
  #saveBtn { background: #4caf50; color: #fff; }
  #saveBtn:hover { background: #45a049; }
  #status { color: #aaa; }
  .count { color: #4caf50; font-weight: bold; }
</style></head><body>
<h1>Art Flag Admin</h1>
<div class="controls">
  <select id="filter">
    <option value="all">All Images</option>
    <option value="art-classified">AI classified as art</option>
    <option value="art-true">Currently art=true</option>
    <option value="photos">Photos source</option>
    <option value="emails">Email source</option>
  </select>
  <input type="text" id="search" placeholder="Search descriptions...">
  <span>Art: <span class="count" id="artCount">0</span></span>
</div>
<div class="grid" id="grid"></div>
<div class="save-bar">
  <button id="saveBtn" onclick="save()">Save</button>
  <span id="status"></span>
</div>
<script>
let inventory = [];
let changed = new Set();

async function load() {
  const res = await fetch('/api/inventory');
  inventory = await res.json();
  render();
}

function render() {
  const filter = document.getElementById('filter').value;
  const search = document.getElementById('search').value.toLowerCase();
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  let count = 0;
  inventory.forEach((item, i) => {
    if (filter === 'art-classified' && !item.tags.includes('art')) return;
    if (filter === 'art-true' && !item.art) return;
    if (filter === 'photos' && item.source !== 'photos') return;
    if (filter === 'emails' && item.source !== 'emails') return;
    if (search && !(item.rawDescription || '').toLowerCase().includes(search) && !item.filename.toLowerCase().includes(search)) return;
    if (item.art) count++;
    const div = document.createElement('div');
    div.className = 'item' + (item.art ? ' art' : '');
    div.innerHTML = '<img src="/thumb/' + item.source + '/' + item.thumb + '"><div class="label">' + (item.caption || item.filename) + '</div>';
    div.onclick = () => { item.art = !item.art; changed.add(i); render(); };
    grid.appendChild(div);
  });
  document.getElementById('artCount').textContent = inventory.filter(x => x.art).length;
}

async function save() {
  document.getElementById('status').textContent = 'Saving...';
  const res = await fetch('/api/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(inventory) });
  if (res.ok) {
    document.getElementById('status').textContent = 'Saved! (' + changed.size + ' changes)';
    changed.clear();
  } else {
    document.getElementById('status').textContent = 'Error saving!';
  }
}

document.getElementById('filter').onchange = render;
document.getElementById('search').oninput = render;
load();
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
  } else if (req.url === '/api/inventory') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(fs.readFileSync(INVENTORY_PATH));
  } else if (req.url === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      fs.writeFileSync(INVENTORY_PATH, JSON.stringify(JSON.parse(body), null, 2));
      res.writeHead(200);
      res.end('ok');
    });
  } else if (req.url.startsWith('/thumb/')) {
    const file = path.join(__dirname, 'src/assets/images', decodeURIComponent(req.url.slice(7)));
    if (fs.existsSync(file)) {
      res.writeHead(200, {'Content-Type': 'image/jpeg'});
      res.end(fs.readFileSync(file));
    } else {
      res.writeHead(404);
      res.end();
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => console.log(`Art admin: http://localhost:${PORT}`));
