// CDP dump raw card transforms for debugging
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
  const expr = `(() => {
    const out = [];
    document.querySelectorAll('.pcard').forEach(c => {
      out.push({
        id: c.dataset.id,
        name: (c.querySelector('.pname') || {}).textContent || '',
        t: c.style.transform,
        o: c.style.opacity,
        z: c.style.zIndex,
      });
    });
    return out.slice(0, 20);
  })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
