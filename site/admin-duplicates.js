const http = require('http');
const fs = require('fs');
const path = require('path');

const INVENTORY_PATH = path.join(__dirname, 'src/_data/imageInventory.json');
const PORT = 8283;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Duplicate Admin</title>
<style>
  body { font-family: sans-serif; background: #1a1a2e; color: #fff; padding: 1rem; padding-bottom: 5rem; }
  h1 { margin-bottom: 0.5rem; }
  .controls { margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .controls select, .controls input { padding: 0.4rem; border-radius: 4px; border: 1px solid #555; background: #2a2a4e; color: #fff; }
  .controls input { width: 200px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem; }
  .item { position: relative; cursor: pointer; border: 3px solid transparent; border-radius: 6px; overflow: hidden; transition: all 0.2s; }
  .item.hidden { opacity: 0.3; border-color: #f44336; }
  .item img { width: 100%; height: 120px; object-fit: cover; display: block; }
  .item .label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); font-size: 0.55rem; padding: 2px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item .date-label { position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.7); font-size: 0.55rem; padding: 2px 4px; }
  .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #2a2a4e; padding: 1rem; display: flex; gap: 1rem; align-items: center; border-top: 2px solid #4caf50; }
  .save-bar button { padding: 0.6rem 1.5rem; font-size: 1rem; border: none; border-radius: 4px; cursor: pointer; }
  #saveBtn { background: #4caf50; color: #fff; }
  #status { color: #aaa; }
  .stats { color: #aaa; font-size: 0.85rem; }
</style></head><body>
<h1>Duplicate / Visibility Admin</h1>
<div class="controls">
  <select id="filter">
    <option value="all">All</option>
    <option value="visible">Visible only</option>
    <option value="hidden">Hidden only</option>
    <option value="photos">Photos source</option>
    <option value="emails">Emails source</option>
    <option value="videos">Videos source</option>
  </select>
  <select id="sort">
    <option value="date">Sort by date</option>
    <option value="filename">Sort by filename</option>
  </select>
  <input type="text" id="search" placeholder="Search...">
  <input type="date" id="dateFrom" placeholder="From">
  <input type="date" id="dateTo" placeholder="To">
  <span class="stats">Total: <span id="totalCount">0</span> | Visible: <span id="visibleCount">0</span> | Hidden: <span id="hiddenCount">0</span></span>
</div>
<div class="grid" id="grid"></div>
<div class="save-bar">
  <button id="saveBtn" onclick="save()">Save</button>
  <span id="status"></span>
</div>
<script>
let inventory = [];

async function load() {
  inventory = await (await fetch('/api/inventory')).json();
  render();
}

function render() {
  const filter = document.getElementById('filter').value;
  const sort = document.getElementById('sort').value;
  const search = document.getElementById('search').value.toLowerCase();
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  let items = inventory.map((item, i) => ({...item, _i: i}));

  // filter
  if (filter === 'visible') items = items.filter(x => x.visible !== false);
  else if (filter === 'hidden') items = items.filter(x => x.visible === false);
  else if (filter === 'photos') items = items.filter(x => x.source === 'photos');
  else if (filter === 'emails') items = items.filter(x => x.source === 'emails');
  else if (filter === 'videos') items = items.filter(x => x.source === 'videos');

  if (search) items = items.filter(x => (x.rawDescription||'').toLowerCase().includes(search) || x.filename.toLowerCase().includes(search));
  if (dateFrom) items = items.filter(x => x.date >= dateFrom);
  if (dateTo) items = items.filter(x => x.date <= dateTo);

  // sort
  if (sort === 'date') items.sort((a,b) => (a.date||'').localeCompare(b.date||'') || a.filename.localeCompare(b.filename));
  else items.sort((a,b) => a.filename.localeCompare(b.filename));

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item' + (item.visible === false ? ' hidden' : '');
    div.innerHTML = '<img src="/thumb/' + item.source + '/' + item.thumb + '">'
      + '<div class="date-label">' + (item.date || '?') + '</div>'
      + '<div class="label">' + item.filename + '</div>';
    div.onclick = () => {
      inventory[item._i].visible = inventory[item._i].visible === false ? true : false;
      render();
    };
    grid.appendChild(div);
  });

  document.getElementById('totalCount').textContent = inventory.length;
  document.getElementById('visibleCount').textContent = inventory.filter(x => x.visible !== false).length;
  document.getElementById('hiddenCount').textContent = inventory.filter(x => x.visible === false).length;
}

async function save() {
  document.getElementById('status').textContent = 'Saving...';
  const res = await fetch('/api/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(inventory) });
  document.getElementById('status').textContent = res.ok ? 'Saved!' : 'Error!';
}

document.getElementById('filter').onchange = render;
document.getElementById('sort').onchange = render;
document.getElementById('search').oninput = render;
document.getElementById('dateFrom').onchange = render;
document.getElementById('dateTo').onchange = render;
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

server.listen(PORT, () => console.log(`Duplicate admin: http://localhost:${PORT}`));
