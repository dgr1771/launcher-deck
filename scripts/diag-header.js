// dump panel children rects + grid internals to find what eats vertical space
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
    return Promise.race([
      new Promise((resolve) => {
        const mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
      new Promise((r) => setTimeout(() => r({ timeout: true }), 8000)),
    ]);
  }
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const panel = document.getElementById('panel');
    const cs = getComputedStyle(panel);
    const kids = [...panel.children].map(e => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return { tag: e.tagName, id: e.id || '', cls: (e.className || '').toString().slice(0, 24),
        y: Math.round(r.top), h: Math.round(r.height), mb: s.marginBottom, mt: s.marginTop };
    });
    const grid = document.getElementById('grid');
    const card = grid.querySelector('.tcard');
    const ccs = card ? getComputedStyle(card) : null;
    return {
      panelPad: { t: cs.paddingTop, b: cs.paddingBottom },
      kids,
      gridScroll: { sw: grid.scrollWidth, cw: grid.clientWidth, sh: grid.scrollHeight, ch: grid.clientHeight, top: grid.scrollTop },
      cardSize: ccs ? { w: ccs.width, h: ccs.height } : null,
      hint: (document.querySelector('.empty-hint') || {}).offsetHeight,
    };
  })()` });
  if (r.timeout) { console.error('TIMEOUT'); process.exit(1); }
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
