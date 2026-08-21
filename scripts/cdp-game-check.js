// CDP verify FreeCell game mode: deal layout + one real move + engine rules
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
  function send(method, params) {
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  };
  await new Promise((r) => ws.onopen = r);
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }

  // 1) switch to game mode
  await ev(`document.getElementById('btnMode').click(), 'clicked'`);

  // 2) verify deal after a beat (hidden window throttles timers to ~1Hz, wait them out)
  await new Promise(r => setTimeout(r, 6000));
  const deal = await ev(`(() => {
    const cols = game.cols.map(c => c.length);
    const visible = [...document.querySelectorAll('.pcard')].filter(c => c.style.opacity !== '0').length;
    return { cols, total: cols.reduce((a,b)=>a+b,0), visible, mode, moveBtn: game.moveCount };
  })()`);

  // 3) engine sanity + find a legal move and play it via the real click path
  const moved = await ev(`(() => {
    // engine unit checks
    const sA = { suit: SUITS[0], rank: 1 }, h2 = { suit: SUITS[1], rank: 2 }, s2 = { suit: SUITS[0], rank: 2 };
    const unit = {
      stack_ok: canStack(h2, sA),          // red 2 on black A = true
      stack_bad: canStack(s2, sA),         // black 2 on black A = false
    };
    // find first legal column-to-column move
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (!col.length) continue;
      const top = col[col.length - 1];
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const dst = game.cols[j];
        if (dst.length && canStack(top, dst[dst.length - 1])) {
          game.selected = { zone: 'col', i, idx: col.length - 1 };
          const ok = tryMoveTo({ zone: 'col', i: j });
          return { ...unit, ok, from: i, to: j, card: top.app ? top.app.name : 'JOKER', moveCount: game.moveCount };
        }
      }
    }
    // fallback: move a top card to a free cell
    for (let i = 0; i < 8; i++) {
      if (game.cols[i].length) {
        const ci = game.cells.findIndex(c => !c);
        if (ci >= 0) {
          game.selected = { zone: 'col', i, idx: game.cols[i].length - 1 };
          const ok = tryMoveTo({ zone: 'cell', i: ci });
          return { ...unit, ok, from: i, to: 'cell' + ci, card: 'top', moveCount: game.moveCount };
        }
      }
    }
    return { ...unit, ok: false, note: 'no legal move found (unlikely)' };
  })()`);

  // 4) undo it
  const undone = await ev(`(() => { const before = game.moveCount; undoMove(); return { before, after: game.moveCount }; })()`);

  // 5) back to launcher for delivery state
  await ev(`document.getElementById('btnMode').click(), 'back'`);

  console.log(JSON.stringify({ deal, moved, undone }, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
