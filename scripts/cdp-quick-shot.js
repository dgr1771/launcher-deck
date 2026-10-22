const http = require('http'), fs = require('fs');
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d=''; res.on('data', c => d+=c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}
async function main() {
  const pages = await getJson('http://127.0.0.1:9222/json');
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === 1 && m.result && m.result.data) {
      fs.writeFileSync('shots/upd-dots.png', Buffer.from(m.result.data, 'base64'));
      console.log('written', m.result.data.length);
      process.exit(0);
    }
  });
  setTimeout(() => { console.error('timeout'); process.exit(1); }, 15000);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
