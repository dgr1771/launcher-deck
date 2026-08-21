// verify: wash/deal no overlap + cell-click feedback + strict position audit (use module colX)
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
  await sleep(6800);   // wash 1300ms + deal stagger

  // 1) strict audit with module colX
  let r = await ev(`(() => {
    const bad = [];
    const check = (card, ex, ey, tag) => {
      const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === card.id);
      if (!el) { bad.push({ card: card.id, tag, err: 'no el' }); return; }
      const m = /translate\\(([\\d.]+)px, ?([\\d.]+)px/.exec(el.style.transform || '');
      if (!m) { bad.push({ card: card.id, tag, err: 'no tf' }); return; }
      if (Math.abs(+m[1] - ex) > 1 || Math.abs(+m[2] - ey) > 1) bad.push({ card: card.id, tag, a: [+m[1], +m[2]], e: [ex, ey] });
    };
    game.cols.forEach((col, ci) => col.forEach((c, ri) => check(c, colX(ci), COL_Y + ri * STACK, 'col' + ci + '#' + ri)));
    game.cells.forEach((c, i) => { if (c) check(c, colX(i), TOP_Y, 'cell' + i); });
    return { bad: bad.length, sample: bad.slice(0, 4) };
  })()`);
  console.log('audit:', JSON.stringify(r));

  // 2) wash/deal overlap check: at 1100ms (old bug window) no card should still be mid-wash affecting final pos
  // (indirect: all visible and settled after 6800ms)
  r = await ev(`(() => ({ visible: [...document.querySelectorAll('.pcard')].filter(c => c.style.opacity !== '0').length }))()`);
  console.log('settled:', JSON.stringify(r));

  // 3) cell feedback: select a 2-card sequence then click an empty cell -> toast appears
  r = await ev(`(() => {
    // find a column whose top2 forms a legal sequence
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (col.length >= 2 && canStack(col[col.length - 1], col[col.length - 2])) {
        const k = game.cells.findIndex(c => !c);
        if (k < 0) return { note: 'no empty cell' };
        game.selected = { zone: 'col', i, idx: col.length - 2 };
        const before = game.moveCount;
        tryMoveTo({ zone: 'cell', i: k });
        return { toastShown: document.getElementById('toast').classList.contains('show'), toastText: document.getElementById('toast').textContent, noMove: game.moveCount === before };
      }
    }
    return { note: 'no sequence found' };
  })()`);
  console.log('cell-feedback:', JSON.stringify(r));

  // 4) occupied cell feedback
  r = await ev(`(() => {
    const occ = game.cells.findIndex(c => c);
    if (occ < 0) return { note: 'no occupied cell' };
    for (let i = 0; i < 8; i++) if (game.cols[i].length) {
      game.selected = { zone: 'col', i, idx: game.cols[i].length - 1 };
      const before = game.moveCount;
      tryMoveTo({ zone: 'cell', i: occ });
      return { toastShown: document.getElementById('toast').classList.contains('show'), noMove: game.moveCount === before };
    }
  })()`);
  console.log('occupied-feedback:', JSON.stringify(r));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
