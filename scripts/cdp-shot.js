// CDP Page.captureScreenshot for both modes (window-occlusion immune)
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
  const mode = process.argv[2] || 'tarot';          // tarot | game
  const outFile = process.argv[3];
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

  // ensure the desired mode
  await send('Runtime.evaluate', {
    expression: `(() => { if (mode !== '${mode}') document.getElementById('btnMode').click(); return mode; })()`,
    returnByValue: true,
  });
  // let shuffle+deal animations finish (hidden-window timers throttle)
  await new Promise(r => setTimeout(r, mode === 'game' ? 5500 : 2500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
  console.log('saved:', outFile, fs.statSync(outFile).size, 'bytes');
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
