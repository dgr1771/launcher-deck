// 失败分级验证：强制刷新 → 检查分级标注 → 打开升级中心 → 分区/按钮断言 → 截图
const http = require('http'), fs = require('fs');
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
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
    if (r && r.exceptionDetails) { console.error('EVAL-EXC:', JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 300)); process.exit(2); }
    return r.result ? r.result.value : undefined;
  }

  // 1) 强制刷新升级清单（winget 全量扫描，最多 3 分钟）
  console.log('[1] refreshUpdates(true) ...');
  await ev('refreshUpdates(true)', true);
  const listInfo = await ev(`UPD.list.map(u => ({ id: u.id, grade: u.grade || '', reason: u.reason || '', hint: u.hint || '' }))`);
  console.log('[2] 清单分级：');
  for (const u of listInfo) console.log(`    ${u.grade ? '★' + u.grade : (u.hint ? '~net' : ' ok')}  ${u.id}  ${u.reason || u.hint || ''}`);

  // 2) 打开升级中心 → 分区断言
  const center = await ev(`(() => {
    showUpgradeCenter();
    const m = document.getElementById('updCenter');
    return {
      title: m.querySelector('.catmodal__title').textContent.trim(),
      actRows: m.querySelectorAll('.updcenter__row:not(.updcenter__row--remind)').length,
      remindRows: m.querySelectorAll('.updcenter__row--remind').length,
      adminBtns: m.querySelectorAll('[data-admin]').length,
      skipBtns: m.querySelectorAll('[data-skipr]').length,
      selN: document.getElementById('updSelN') ? document.getElementById('updSelN').textContent : '(无一键区)',
      remindNames: [...m.querySelectorAll('.updcenter__row--remind .updcenter__name')].map(e => e.textContent),
      remindWhy: [...m.querySelectorAll('.updcenter__row--remind .updcenter__why')].map(e => e.textContent),
      sepText: (m.querySelector('.updcenter__sep') || {}).textContent || ''
    };
  })()`);
  console.log('[3] 升级中心：', JSON.stringify(center, null, 1));

  // 3) 卡片徽标双色断言（需窗口已渲染卡片）
  const badges = await ev(`({ red: document.querySelectorAll('.updbadge:not(.updbadge--remind)').length, blue: document.querySelectorAll('.updbadge--remind').length })`);
  console.log('[4] 卡片徽标：红(可一键)', badges.red, '/ 蓝(仅提醒)', badges.blue);

  // 4) 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shots/updgrade-center.png', Buffer.from(shot.data, 'base64'));
  console.log('[5] 截图 shots/updgrade-center.png', shot.data.length, 'bytes');
  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
