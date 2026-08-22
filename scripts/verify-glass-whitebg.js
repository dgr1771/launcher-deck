// glass readability worst-case: white backdrop behind panel, capture window pixels, sample exact DOM rects
const http = require('http');
const fs = require('fs');
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
      new Promise((r) => setTimeout(() => r({ timeout: true }), 10000)),
    ]);
  }
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    return r.timeout ? { timeout: true } : (r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value);
  }

  const rects = await ev(`(() => {
    const panel = document.getElementById('panel').getBoundingClientRect();
    const title = document.querySelector('#titlebar h1').getBoundingClientRect();
    const card = document.querySelector('#grid .tcard .face.back').getBoundingClientRect();
    const cardName = document.querySelector('#grid .tcard') ? document.querySelector('#grid .tcard').getBoundingClientRect() : null;
    return { w: innerWidth, h: innerHeight, panel: { x: panel.x, y: panel.y, w: panel.width, h: panel.height },
      title: { x: title.x, y: title.y, w: title.width, h: title.height },
      card: { x: card.x, y: card.y, w: card.width, h: card.height } };
  })()`);
  console.log('rects:', JSON.stringify(rects));
  if (rects.err || rects.timeout) process.exit(1);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.timeout) { console.error('capture timeout'); process.exit(1); }
  fs.writeFileSync('shots/glass-window-white.png', Buffer.from(shot.data, 'base64'));
  console.log('saved shots/glass-window-white.png');
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
