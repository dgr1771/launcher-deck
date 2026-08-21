// sample real launches: 3 apps from different resolution paths, auto-close after 5s
const http = require('http');
const { exec } = require('child_process');
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // sync fresh scan into userData first
  await new Promise((r, j) => exec('copy /Y "%TEMP%\\ld-scan-test.json" "C:\\Users\\67842\\AppData\\Roaming\\应用牌堆 Launcher Deck\\apps.json"', { shell: 'cmd.exe' }, e => e ? j(e) : r()));

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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  }

  // reload apps in the app, confirm 37 desktop targets & weixin input method fixed
  await ev(`window.deck.refresh().then(() => 'refreshed')`);
  await sleep(8000);
  let r = await ev(`(() => {
    const all = DATA;
    const wx = all.find(a => a.name.indexOf(String.fromCharCode(36755)) >= 0 && a.exe && a.exe.includes('wetype'));
    const bad = all.filter(a => a.src !== 'appx' && a.exe && !/\\.(exe|lnk)$/i.test(a.exe)).length;
    return { total: all.length, wetypeExe: wx ? wx.exe.split('\\\\').pop() : '(not found)', badExt: bad };
  })()`);
  console.log('reload:', JSON.stringify(r));

  // launch 3 samples one by one, verify process alive, then kill
  for (const name of ['7-Zip 26.02 (x64)', '企业微信', '千问']) {
    const res = await ev(`window.deck.launch((() => { const a = DATA.find(x => x.name === ${JSON.stringify(name)}); return { name: a.name, src: a.src, exe: a.exe, uwp: a.uwp }; })())`);
    await sleep(5000);
    const proc = name.includes('7-Zip') ? '7zFM' : name.includes('企业微信') ? 'WXWork' : 'qianwen';
    const list = await new Promise((r2) => exec('tasklist /FI "IMAGENAME eq ' + proc + '.exe"', (e, out) => r2(out || '')));
    const alive = list.includes(proc);
    console.log('launch', name, '->', JSON.stringify(res), 'process:', alive ? 'ALIVE' : 'NOT-FOUND');
    exec('taskkill /IM ' + proc + '.exe /F /T', () => {});
    await sleep(1200);
  }
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
