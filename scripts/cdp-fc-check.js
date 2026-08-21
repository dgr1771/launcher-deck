// CDP check for FreeCell board state (launcher mode / game mode)
const http = require('http');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const pages = await getJson('http://127.0.0.1:9222/json');
  const page = pages.find(p => p.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  function send(method, params) {
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => ws.onopen = r);

  const expr = `(() => {
    const cards = document.querySelectorAll('.pcard');
    const visible = [...cards].filter(c => c.style.opacity !== '0');
    const cols = {};
    let topRow = 0;
    visible.forEach(c => {
      const m = /translate\\(([\\d.]+)px, ?([\\d.]+)px/.exec(c.style.transform || '');
      if (!m) return;
      const x = Math.round(+m[1]);
      const y = +m[2];
      if (y < 100) { topRow++; return; }
      cols[x] = (cols[x] || 0) + 1;
    });
    const jokers = [...cards].filter(c => c.classList.contains('joker')).length;
    const corners = [...cards].slice(0, 3).map(c => (c.querySelector('.corner .r') || {}).textContent);
    return {
      totalCards: cards.length,
      visible: visible.length,
      jokers,
      topRowCards: topRow,
      columnCount: Object.keys(cols).length,
      perColumn: Object.keys(cols).sort((a, b) => a - b).map(k => cols[k]),
      firstCorners: corners,
      slots: document.querySelectorAll('.slot').length,
      subtitle: document.getElementById('subtitle').textContent,
      modeTag: document.getElementById('modeTag').textContent,
    };
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result.value, null, 2));
  ws.close();
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
