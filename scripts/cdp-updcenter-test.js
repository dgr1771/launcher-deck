// 升级中心验证：打开 → 截图 → 勾选仅 RipGrep → 批量升级（真实）→ 轮询状态
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
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  async function ev(expression, awaitPromise) {
    const r = await send('Runtime.evaluate', { returnByValue: true, awaitPromise: !!awaitPromise, expression });
    return r.result ? r.result.value : undefined;
  }
  // 1) 打开升级中心
  const open = await ev(`(() => { showUpgradeCenter(); const m = document.getElementById('updCenter'); return { rows: m ? m.querySelectorAll('.updcenter__row').length : 0, selN: document.getElementById('updSelN').textContent }; })()`);
  console.log('center rows:', open.rows, '| 默认全选:', open.selN);
  // 2) 只勾 RipGrep
  const sel = await ev(`(() => {
    const boxes = [...document.querySelectorAll('#updList .updcenter__row input')];
    boxes.forEach(b => b.checked = false);
    const row = [...document.querySelectorAll('#updList .updcenter__row')].find(r => r.textContent.includes('RipGrep'));
    if (!row) return { fail: 'no ripgrep row' };
    row.querySelector('input').checked = true;
    row.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
    return { selN: document.getElementById('updSelN').textContent };
  })()`);
  console.log('selected:', JSON.stringify(sel));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shots/upd-center.png', Buffer.from(shot1.data, 'base64'));
  console.log('shot: shots/upd-center.png');
  // 3) 点「一键升级所选」并轮询状态（RipGrep ~2MB，2-3 分钟）
  await ev(`document.getElementById('updGo').click()`);
  console.log('batch started, polling...');
  let result = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const st = await ev(`JSON.stringify((() => {
      const m = document.getElementById('updCenter');
      if (!m) return { closed: true };
      const row = [...m.querySelectorAll('.updcenter__row')].find(r => r.textContent.includes('RipGrep'));
      return { btn: document.getElementById('updGo').textContent,
               st: row ? row.querySelector('.updcenter__st').textContent : '?',
               cls: row ? row.className : '' };
    })())`);
    const s = JSON.parse(st);
    console.log(`  poll${i}:`, s.btn, '|', s.st || '(closed)');
    if (s.closed || /完成/.test(s.btn)) { result = s; break; }
  }
  console.log('FINAL:', JSON.stringify(result));
  // 4) 验证 RipGrep 已从待升清单消失 + 红点刷新
  const after = await ev(`JSON.stringify({
    pending: updPendingList().length,
    ripgrepStill: updPendingList().some(u => /ripgrep/i.test(u.name)),
    dots: document.querySelectorAll('.updbadge').length })`);
  console.log('after:', after);
  ws.close(); process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
