// 关于弹窗验证：ⓘ 按钮 → 弹窗渲染 → 版本号/署名断言 → 截图
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
  const ev = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const btn = document.getElementById('btnAbout');
    if (!btn) return { fail: 'btnAbout 不存在' };
    btn.click();
    return { clicked: true };
  })()` });
  if (ev.result.value.fail) { console.log('FAIL:', ev.result.value.fail); process.exit(1); }
  await new Promise(r => setTimeout(r, 900));   // 等版本号 IPC 回填 + 弹窗动画
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const m = document.getElementById('aboutModal');
    if (!m) return { fail: '弹窗未出现' };
    const txt = m.innerText;
    return {
      open: m.classList.contains('open'),
      hasName: txt.includes('唤启 Launcher Deck'),
      hasAuthor: txt.includes('隔壁村布布'),
      hasVersion: /版本 \\d+\\.\\d+/.test(txt),
      hasLicense: txt.includes('CC BY-NC'),
      hasRepoBtn: !!m.querySelector('[data-act="repo"]'),
      verText: (txt.match(/版本 [\\d.]+/) || [''])[0],
    };
  })()` });
  console.log(JSON.stringify(r.result.value, null, 1));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shots/about-win.png', Buffer.from(shot.data, 'base64'));
  console.log('shot saved: shots/about-win.png');
  const v = r.result.value;
  ws.close();
  process.exit(v.fail || !v.open || !v.hasName || !v.hasAuthor || !v.hasVersion || !v.hasLicense ? 1 : 0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
