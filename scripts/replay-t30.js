// replay the T17->T30 sequence with deep dumps at the T30 failure point
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
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 300) };
    return r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // mirror test-all prep + T17
  await ev(`(() => {
    localStorage.removeItem('ld_custom_cats'); localStorage.removeItem('ld_custom_cat'); localStorage.removeItem('ld_pinned');
    game = null; clearSavedGame(); suppressClick = false;
    if (mode !== 'tarot') setMode('tarot');
    document.querySelectorAll('.ctxmenu,.catmodal-pop').forEach(e => e.remove());
    ['fortunePop','winPop'].forEach(id => { const p = document.getElementById(id); if (p) p.classList.remove('show','open'); });
    buildChips(); renderTarot(false);
    return 'prep';
  })()`);
  await ev(`document.getElementById('btnMode').click()`);
  await sleep(6800);

  // deep-dive T30 with instrumentation
  const r = await ev(`(() => {
    const dump = { modeBefore: mode, won: game.won, colsOk: game.cols.reduce((a,c)=>a+c.length,0) };
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (!col.length) continue;
      const top = col[col.length - 1];
      const el1 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
      dump.elFound = !!el1;
      if (!el1) { dump.missingId = top.id; return dump; }
      const locBefore = findCardInGame(el1.dataset.id);
      dump.locBefore = locBefore ? locBefore.zone + ':' + locBefore.i + ':' + locBefore.idx : null;
      el1.click();
      dump.modeAfter = mode;
      dump.selectedAfter = game.selected ? game.selected.zone + ':' + game.selected.i : null;
      dump.selClass = el1.classList.contains('selected');
      if (game.selected) { el1.click(); dump.note = 'selected ok, cancelled'; return dump; }
      // click did not select: check suppress + handler reach
      dump.suppress = suppressClick;
      // try direct onCardClick to isolate
      try { onCardClick(top, 'col', i, col.length - 1); dump.directSelected = game.selected ? 'yes' : 'no'; } catch (e) { dump.directErr = String(e).slice(0, 80); }
      return dump;
    }
    dump.note = 'no cards';
    return dump;
  })()`);
  console.log(JSON.stringify(r, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
