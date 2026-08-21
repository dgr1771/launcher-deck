// construct scenarios for cell-click failure feedback
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
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await new Promise((r) => ws.onopen = r);
  function send(method, params) {
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await ev(`if (mode !== 'game') document.getElementById('btnMode').click()`);
  await sleep(6800);

  // occupied cell feedback (surgery: park a card into cell 0)
  let r = await ev(`(() => {
    const col = game.cols.find(c => c.length);
    const card = col.pop();
    game.cells[0] = card;
    const col2 = game.cols.find(c => c.length);
    game.selected = { zone: 'col', i: game.cols.indexOf(col2), idx: col2.length - 1 };
    const before = game.moveCount;
    tryMoveTo({ zone: 'cell', i: 0 });
    return { toast: document.getElementById('toast').textContent, noMove: game.moveCount === before };
  })()`);
  console.log('occupied-feedback:', JSON.stringify(r));

  // multi-card sequence onto a free cell feedback (surgery: make top2 a legal run)
  r = await ev(`(() => {
    const col = game.cols.find(c => c.length >= 2 && canStack(c[c.length - 1], c[c.length - 2]));
    if (!col) return { note: 'no natural sequence; surgery' };
    game.selected = { zone: 'col', i: game.cols.indexOf(col), idx: col.length - 2 };
    const before = game.moveCount;
    const k = game.cells.findIndex(x => !x);
    tryMoveTo({ zone: 'cell', i: k >= 0 ? k : 0 });
    return { toast: document.getElementById('toast').textContent, noMove: game.moveCount === before };
  })()`);
  if (r.note) {
    r = await ev(`(() => {
      // surgery: swap a column's second card so top2 form a legal run
      const col = game.cols.find(c => c.length >= 2);
      const need = { rank: col[col.length - 1].rank + 1, red: !col[col.length - 1].suit.red };
      const donorCol = game.cols.find(c2 => c2 !== col && c2.some(x => x.rank === need.rank && x.suit.red === need.red));
      if (!donorCol) return { note: 'no donor card found' };
      const di = donorCol.findIndex(x => x.rank === need.rank && x.suit.red === need.red);
      const donor = donorCol.splice(di, 1)[0];
      col.splice(col.length - 1, 0, donor);
      game.selected = { zone: 'col', i: game.cols.indexOf(col), idx: col.length - 2 };
      const before = game.moveCount;
      const k = game.cells.findIndex(x => !x);
      tryMoveTo({ zone: 'cell', i: k >= 0 ? k : 1 });
      return { toast: document.getElementById('toast').textContent, noMove: game.moveCount === before };
    })()`);
  }
  console.log('multi-feedback:', JSON.stringify(r));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
