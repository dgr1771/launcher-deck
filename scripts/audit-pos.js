// audit: compare every card's actual transform vs expected position derived from game state
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
  await sleep(6000);   // wash + deal

  // do a few real interactions: select+move col->col, then col->cell
  await ev(`(() => {
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (!col.length) continue;
      const top = col[col.length - 1];
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const dst = game.cols[j];
        if (dst.length && canStack(top, dst[dst.length - 1])) {
          game.selected = { zone: 'col', i, idx: col.length - 1 };
          tryMoveTo({ zone: 'col', i: j });
          return 'moved col->col';
        }
      }
    }
    return 'no col move';
  })()`);
  await ev(`(() => {
    for (let i = 0; i < 8; i++) {
      if (!game.cols[i].length) continue;
      const k = game.cells.findIndex(c => !c);
      if (k < 0) return 'no free cell';
      game.selected = { zone: 'col', i, idx: game.cols[i].length - 1 };
      tryMoveTo({ zone: 'cell', i: k });
      return 'moved col->cell';
    }
  })()`);
  await sleep(800);

  // audit positions
  const audit = await ev(`(() => {
    const CW = 92, TOP_Y = 6, COL_Y = 148, STACK = 30;
    const bad = [];
    const check = (card, ex, ey, tag) => {
      const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === card.id);
      if (!el) { bad.push({ card: card.id, tag, err: 'no element' }); return; }
      const m = /translate\\(([\\d.]+)px, ?([\\d.]+)px/.exec(el.style.transform || '');
      if (!m) { bad.push({ card: card.id, tag, err: 'no transform', t: el.style.transform }); return; }
      const ax = +m[1], ay = +m[2];
      if (Math.abs(ax - ex) > 2 || Math.abs(ay - ey) > 2) {
        bad.push({ card: card.id, tag, actual: [ax, ay], expect: [ex, ey] });
      }
    };
    // expected x for column i (mirror colX)
    const boardWNow = Math.max(document.getElementById('fcboard').clientWidth || 1240, 900);
    const colX = (i) => 24 + i * ((1240 - 48 - CW * 8) / 7 + CW);   // colX uses module boardW; try both below
    game.cols.forEach((col, ci) => {
      col.forEach((card, ri) => check(card, colX(ci), COL_Y + ri * STACK, 'col' + ci + '#' + ri));
    });
    game.cells.forEach((card, i) => { if (card) check(card, colX(i), TOP_Y, 'cell' + i); });
    game.found.forEach((rank, si) => {
      if (rank > 0) {
        const card = DECK.find(c => c.suit === SUITS[si] && c.rank === rank);
        if (card) check(card, colX(si + 4), TOP_Y, 'found' + si);
      }
    });
    return { badCount: bad.length, sample: bad.slice(0, 8), boardWNow, moduleBoardW: boardW };
  })()`);
  console.log(JSON.stringify(audit, null, 1));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
