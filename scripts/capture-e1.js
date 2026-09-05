// 抖音 E1 成片素材采集：驱动应用动画，逐帧 JPEG 抓取
// 场景：A 翻面扫过 / B 花色过滤 / C 主题轮换 / D 接龙发牌 / E 解读浮层+启动
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'video', 'frames');
const FPS = 12;
const TICK = Math.floor(1000 / FPS);   // ~83ms

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pages = await getJson('http://127.0.0.1:9223/json');
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); let seq = 0;
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, ap) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!ap })).result.value;
  async function shot() {
    seq++;
    const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(OUT, `f${String(seq).padStart(5, '0')}.jpg`), Buffer.from(s.data, 'base64'));
  }
  const bounds = {};
  async function runFor(ms, driver, tag) {
    const t0 = Date.now();
    if (tag) bounds[tag] = seq;
    while (Date.now() - t0 < ms) {
      if (driver) await driver((Date.now() - t0) / ms);
      const t = Date.now();
      await shot();
      const rest = TICK - (Date.now() - t);
      if (rest > 0) await new Promise(r => setTimeout(r, rest));
    }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 预备：塔罗模式 + 蓝白玻璃 + 面板显示
  await ev(`localStorage.setItem('ld_pinned','[]'); setTheme({preset:'glass'}); applyTheme();`);
  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click(); renderTarot(false);`);
  await ev(`window.__showPanel ? window.__showPanel() : document.getElementById('btnClose').blur()`);
  // DECK_STAY 模式下用 CDP 唤起：togglePanel 不可达，直接调 BrowserWindow 不可行——改用键盘事件
  await ev(`document.getElementById('btnClose') && 0`);
  await sleep(400);

  // 场景 A：翻面扫过（鼠标 enter 逐张触发）~7s
  console.log('scene A');
  await ev(`renderTarot(false)`);
  await runFor(7000, async (u) => {
    await ev(`(() => {
      const cards = [...document.querySelectorAll('#tarot .tcard')];
      const idx = Math.min(cards.length - 1, Math.floor(${u} * cards.length * 1.6));
      cards.forEach((c, i) => {
        const inner = c.querySelector('.inner');
        if (i < idx) inner.classList.add('flipped');
        else inner.classList.remove('flipped');
      });
    })()`);
  }, 'A');
  await ev(`[...document.querySelectorAll('#tarot .tcard')].forEach(c => c.querySelector('.inner').classList.add('flipped'))`);
  await runFor(900, null);   // 全翻定格

  // 场景 B：花色过滤 ~3s
  console.log('scene B');
  await ev(`document.querySelectorAll('.chip').forEach(c => { if (c.dataset.cat === 'development') c.click(); })`);
  await runFor(3000, null, 'B');

  // 场景 C：主题轮换 ~7s（glass→sakura→sage 各 2.3s）
  console.log('scene C');
  await ev(`m_filterSuit='all'; setTheme({preset:'glass'}); applyTheme(); renderTarot(false);`);
  await runFor(2300, null, 'C1');
  await ev(`setTheme({preset:'sakura'}); applyTheme();`);
  await runFor(2300, null, 'C2');
  await ev(`setTheme({preset:'sage'}); applyTheme();`);
  await runFor(2300, null, 'C3');
  await ev(`setTheme({preset:'glass'}); applyTheme();`);

  // 场景 D：接龙发牌 ~6.5s（洗 1250 + 错峰发牌）
  console.log('scene D');
  await ev(`clearSavedGame(); if (mode !== 'game') document.getElementById('btnMode').click();`);
  await ev(`newGame(20000 + Math.floor(Math.random() * 10000))`);
  await runFor(6500, null, 'D');

  // 场景 E：切回塔罗 + 解读浮层出现 ~4s
  console.log('scene E');
  await ev(`document.getElementById('btnMode').click()`);
  await ev(`renderTarot(false)`);
  await ev(`(() => { const c = document.querySelector('#tarot .tcard'); const a = DATA.find(x => x.name === c.dataset.name); const r = c.getBoundingClientRect(); showReading(a, r); })()`);
  await runFor(4000, null, 'E');
  await ev(`hideReading()`);

  console.log('total frames:', seq);
  ws.close();
  fs.writeFileSync(path.join(OUT, '..', 'capture-done.json'), JSON.stringify({ seq, fps: FPS, bounds }));
  process.exit(0);
}
main().catch(e => { console.error('CAPTURE FAIL:', e.message); process.exit(1); });
