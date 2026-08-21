// verify doubao launch target + MS deal + progress save/restore
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
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // 1) refresh scan via IPC, then check doubao exe + all apps' exe validity
  await ev(`window.deck.refresh()`);
  await sleep(6000);
  let r = await ev(`(() => {
    const all = DATA;
    const doubao = all.find(a => a.name === '豆包');
    const bad = all.filter(a => a.src !== 'appx' && a.exe && !/\\.(exe|lnk)$/i.test(a.exe)).map(a => a.name + ':' + a.exe);
    const noExe = all.filter(a => a.src !== 'appx' && !a.exe).map(a => a.name);
    return {
      doubaoExe: doubao ? doubao.exe : '(not found)',
      doubaoValid: doubao ? /\\.(exe|lnk)$/i.test(doubao.exe || '') : false,
      badExtCount: bad.length, bad: bad.slice(0, 5),
      noExeCount: noExe.length, noExe: noExe.slice(0, 8),
    };
  })()`);
  console.log('scan:', JSON.stringify(r, null, 1));

  // 2) MS deal determinism: same dealNo twice -> identical columns
  r = await ev(`(() => {
    const a = msShuffle(1234), b = msShuffle(1234);
    const same = JSON.stringify(a) === JSON.stringify(b);
    // 发牌分布
    const cols = Array.from({ length: 8 }, () => 0);
    a.forEach((_, i) => cols[i % 8]++);
    return { deterministic: same, dist: cols, dealNo1234First: a[0] };
  })()`);
  console.log('ms-deal:', JSON.stringify(r));

  // 3) progress save/restore: enter game, make a move, switch out/in -> same state
  r = await ev(`(() => { if (mode !== 'game') document.getElementById('btnMode').click(); return mode; })()`);
  await sleep(6800);
  const moveRes = await ev(`(() => {
    for (let i = 0; i < 8; i++) {
      const col = game.cols[i];
      if (!col.length) continue;
      const top = col[col.length - 1];
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        const dst = game.cols[j];
        if (dst.length && canStack(top, dst[dst.length - 1])) {
          game.selected = { zone: 'col', i, idx: col.length - 1 };
          tryMoveTo({ zone: 'col', i: j });
          return { moved: true, dealNo: game.dealNo, count: game.moveCount };
        }
      }
    }
    return { moved: false };
  })()`);
  console.log('move:', JSON.stringify(moveRes));
  // 切出再切进
  await ev(`document.getElementById('btnMode').click()`);   // -> tarot
  await sleep(300);
  r = await ev(`(() => { document.getElementById('btnMode').click(); return { dealNo: game.dealNo, count: game.moveCount }; })()`);
  await sleep(1000);
  const kept = r.dealNo === moveRes.dealNo && r.count === moveRes.count;
  console.log('switch-keep:', kept, JSON.stringify(r));

  // 4) restart-level restore: clear in-memory game, re-enter -> restored from localStorage
  r = await ev(`(() => {
    game = null;
    document.getElementById('btnMode').click();   // tarot
    document.getElementById('btnMode').click();   // game (restore path)
    return { dealNo: game.dealNo, count: game.moveCount };
  })()`);
  await sleep(1200);
  const restored = r.dealNo === moveRes.dealNo && r.count === moveRes.count;
  console.log('cold-restore:', restored, JSON.stringify(r));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
