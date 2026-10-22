// 升级检测功能验证：IPC 解析 → 匹配 → 红点 → 右键菜单 → 弹窗
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
  async function ev(expression, awaitPromise) {
    const r = await send('Runtime.evaluate', { returnByValue: true, awaitPromise: !!awaitPromise, expression });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.exception && r.exceptionDetails.exception.description || 'exc' };
    return r.result.value;
  }
  // 1) 主进程 winget 解析（force 真跑一次）
  const t0 = Date.now();
  const r1 = await ev(`window.deck.checkUpdates(true)`, true);
  console.log('1 check-updates:', r1.ok, '| count:', (r1.list || []).length, '|', ((Date.now() - t0) / 1000).toFixed(1) + 's', r1.ok ? '' : r1.err);
  if (!r1.ok) process.exit(1);
  console.log('  样例:', r1.list.slice(0, 3).map(u => `${u.name}(${u.id}) ${u.version}→${u.available}`).join(' | '));
  // 2) 渲染层匹配 + 红点
  const r2 = await ev(`(() => {
    const matched = DATA.map(a => ({ app: a.name, upd: (matchUpdate(a) || {}).name || null }));
    const hits = matched.filter(x => x.upd);
    const dots = document.querySelectorAll('.updbadge').length;
    return { hits, dots };
  })()`);
  console.log('2 匹配命中:', JSON.stringify(r2.hits));
  console.log('  红点数:', r2.dots);
  // 3) 弹窗（对第一个命中的卡模拟右键菜单 → upgrade）
  const r3 = await ev(`(() => {
    const a = DATA.find(x => matchUpdate(x));
    if (!a) return { fail: 'no match' };
    showUpgradeModal(a, matchUpdate(a));
    const m = document.getElementById('updModal');
    return { open: !!m && m.classList.contains('open'),
             text: m ? m.innerText.slice(0, 150) : '' };
  })()`);
  console.log('3 弹窗:', r3.open, '|', (r3.text || '').replace(/\n/g, ' / ').slice(0, 120));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('shots/upd-modal.png', Buffer.from(shot.data, 'base64'));
  console.log('shot: shots/upd-modal.png');
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
