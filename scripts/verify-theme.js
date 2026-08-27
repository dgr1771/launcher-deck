// verify theme system: glass (dark undercoat) / custom color / reset via computed styles
// 图片背板/牌背上传已砍除（用户决策 2026-08-22）——不再有图片断言
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
  const pages = await getJson(`http://127.0.0.1:${process.argv[2] || '9222'}/json`);
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
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  }
  const panelState = `(() => { const cs = getComputedStyle(document.getElementById('panel')); return { img: cs.backgroundImage.slice(0, 130), color: cs.backgroundColor, size: cs.backgroundSize, blur: cs.backdropFilter.slice(0, 30) }; })()`;

  // 1) modal opens（纯预设双主题：无上传按钮、无取色器——均砍除后不应存在）
  let r = await ev(`(() => { document.getElementById('btnTheme').click(); const m = document.getElementById('themeModal'); return { shown: !!m, presets: m ? m.querySelectorAll('.preset').length : 0, uploadBtns: m ? m.querySelectorAll('.upbtn').length : -1, colorPickers: m ? m.querySelectorAll('input[type=color]').length : -1 }; })()`);
  console.log('modal:', JSON.stringify(r));
  const modalOk = r.shown && r.presets === 2 && r.uploadBtns === 0 && r.colorPickers === 0;
  await ev(`document.getElementById('themeModal') && document.getElementById('themeModal').remove()`);

  // 2) glass theme：蓝白渐变 + 深色底漆（浅色桌面可读性的关键）+ 强模糊
  await ev(`setTheme({ preset: 'glass' }); applyTheme();`);
  r = await ev(panelState);
  console.log('glass:', JSON.stringify(r));
  const glassOk = r.img.includes('59, 130, 246') && r.img.includes('241, 245, 249') &&
    r.color.includes('8, 15, 26') && r.blur.includes('18');

  // 3) custom 已砍除：preset=custom 应被当 felt 兜底（不再有自定义分支）
  await ev(`setTheme({ preset: 'custom' }); applyTheme();`);
  r = await ev(panelState);
  console.log('custom-fallback-felt:', JSON.stringify(r));
  const colorOk = r.img.includes('radial-gradient');

  // 4) reset
  await ev(`setTheme({ preset: 'felt' }); applyTheme();`);
  r = await ev(panelState);
  const feltOk = r.img.includes('radial-gradient');
  console.log('reset:', feltOk, JSON.stringify(r));

  // 5) 恢复玻璃（用户当前主题）
  await ev(`setTheme({ preset: 'glass' }); applyTheme();`);

  const allOk = modalOk && glassOk && colorOk && feltOk;  // colorOk 现为 custom→felt 兜底断言
  console.log(allOk ? 'THEME ALL OK' : 'THEME FAIL');
  ws.close();
  process.exit(allOk ? 0 : 1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
