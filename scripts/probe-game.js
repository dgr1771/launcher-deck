// probe: real click path in game mode (element .click(), not internal fns)
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
    return r.exceptionDetails ? { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 400) } : r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // 1) current state
  let r = await ev(`(() => ({
    mode, hasGame: !!game,
    cols: game ? game.cols.map(c => c.length) : null,
    visible: [...document.querySelectorAll('.pcard')].filter(c => c.style.opacity !== '0').length,
    fcShown: !document.getElementById('fcboard').classList.contains('hidden'),
    won: game ? game.won : null,
    moveCount: game ? game.moveCount : null,
  }))()`);
  console.log('state:', JSON.stringify(r));

  // 2) real click path: click a top card element, then click a legal target element
  r = await ev(`(() => {
    // find a legal move: top of col i onto top of col j
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (!col.length) continue;
      const top = col[col.length - 1];
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const dst = game.cols[j];
        if (dst.length && canStack(top, dst[dst.length - 1])) {
          const el1 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
          el1.click();                                    // 选中
          const selOk = !!game.selected && game.selected.zone === 'col' && game.selected.i === i;
          const selClass = el1.classList.contains('selected');
          const target = dst[dst.length - 1];
          const el2 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === target.id);
          const before = game.moveCount;
          el2.click();                                    // 移动
          const moved = game.moveCount === before + 1;
          return { selOk, selClass, moved, card: top.app ? top.app.name : 'J' };
        }
      }
    }
    // fallback: click top card then an empty-ish interaction
    const col0 = game.cols.findIndex(c => c.length);
    const top = game.cols[col0][game.cols[col0].length - 1];
    const el1 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
    el1.click();
    const selOk = !!game.selected;
    el1.click();
    return { selOk, moved: false, note: 'no legal col move; selection-only check' };
  })()`);
  console.log('real-click:', JSON.stringify(r));

  // 3) buttons
  r = await ev(`(() => {
    document.getElementById('btnMode').click();
    const inGame = mode === 'game';
    return { toggledToGame: inGame };
  })()`);
  console.log('mode-toggle:', JSON.stringify(r));
  await sleep(5500);
  r = await ev(`(() => ({ cols: game.cols.map(c => c.length), visible: [...document.querySelectorAll('.pcard')].filter(c => c.style.opacity !== '0').length }))()`);
  console.log('after-newgame:', JSON.stringify(r));

  // restore tarot
  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
