// dump page state after the failing regression round
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
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
    mode,
    hasGame: !!game,
    dealNo: game && game.dealNo,
    moveCount: game && game.moveCount,
    suppressClick,
    modals: [...document.querySelectorAll('.catmodal-pop,.ctxmenu')].map(e => e.id || e.className.slice(0, 20)),
    themeModal: !!document.getElementById('themeModal'),
    vis: document.visibilityState,
    gameBtns: document.getElementById('gameBtns').style.display,
  }))()` });
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
