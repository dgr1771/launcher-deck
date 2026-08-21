// CDP verify reading popup with COMPUTED style (catches the inline-vs-CSS trap)
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
    return new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }

  await ev(`document.querySelectorAll('#grid .tcard')[6].dispatchEvent(new MouseEvent('mouseenter'))`);
  await new Promise(r => setTimeout(r, 900));

  const state = await ev(`(() => {
    const el = document.getElementById('reading');
    if (!el) return { exists: false };
    const cs = getComputedStyle(el);
    return {
      exists: true,
      computedDisplay: cs.display,
      opacity: cs.opacity,
      width: el.offsetWidth,
      height: el.offsetHeight,
      divText: (el.querySelector('.reading__div') || {}).textContent || '',
      name: (el.querySelector('.reading__name') || {}).textContent || '',
    };
  })()`);
  console.log(JSON.stringify(state, null, 1));
  if (state.computedDisplay === 'none' || +state.opacity === 0) {
    console.error('FAIL: popup not actually visible');
    process.exit(1);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\67842\\launcher-eval\\shots\\reading-v2.png', Buffer.from(shot.data, 'base64'));
  console.log('shot saved: reading-v2.png');

  await ev(`document.querySelectorAll('#grid .tcard')[6].dispatchEvent(new MouseEvent('mouseleave'))`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
