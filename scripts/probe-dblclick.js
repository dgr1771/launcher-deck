// verify double-click auto-foundation for Aces
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

  await ev(`document.getElementById('btnMode').click()`);
  await new Promise(r => setTimeout(r, 5500));

  // 1) put an Ace into a free cell, then double-click it -> should fly to foundation
  let r = await ev(`(() => {
    for (let ci = 0; ci < 8; ci++) {
      const col = game.cols[ci];
      const ai = col.findIndex(c => c.rank === 1);
      if (ai < 0) continue;
      const removed = col.splice(ai + 1);        // uncover the ace
      const ace = col[ai];
      // park removed cards in free cells / back onto column (simplified board surgery for test)
      removed.forEach(c => { const k = game.cells.findIndex(x => !x); if (k >= 0) game.cells[k] = c; else col.push(c); });
      const cellIdx = game.cells.findIndex(c => !c);
      if (cellIdx < 0) return { note: 'no free cell for surgery' };
      game.cells[cellIdx] = ace;
      col.splice(ai, 1);
      positionGame(false);
      const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === ace.id);
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const si = SUITS.indexOf(ace.suit);
      return { ace: ace.suit.ch + 'A', foundNow: game.found[si], moves: game.moveCount };
    }
    return { note: 'no ace on board (impossible in freecell)' };
  })()`);
  console.log('dblclick-A:', JSON.stringify(r));

  // 2) double-click an un-collectable top card -> rejected (no move)
  r = await ev(`(() => {
    for (let ci = 0; ci < 8; ci++) {
      const col = game.cols[ci];
      if (!col.length) continue;
      const top = col[col.length - 1];
      const si = SUITS.indexOf(top.suit);
      if (top.rank === game.found[si] + 1) continue;
      const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
      const before = game.moveCount;
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return { card: top.suit.ch + RANK_TXT[top.rank], rejected: game.moveCount === before };
    }
    return { note: 'all tops collectable (unlikely)' };
  })()`);
  console.log('dblclick-unready:', JSON.stringify(r));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
