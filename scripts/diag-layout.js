// measure layout geometry: panel/grid/cards/chips + overflow scan (run while window VISIBLE)
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
    return Promise.race([
      new Promise((resolve) => {
        const mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
      new Promise((r) => setTimeout(() => r({ timeout: true }), 8000)),
    ]);
  }
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const $ = (s) => document.getElementById(s);
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const panel = $('panel');
    const pr = rect(panel);
    const grid = $('grid');
    const cards = [...grid.querySelectorAll('.tcard')];
    // cards per row: count distinct top values
    const tops = new Map();
    cards.forEach(c => { const t = Math.round(c.getBoundingClientRect().top); tops.set(t, (tops.get(t) || 0) + 1); });
    const rows = [...tops.entries()].sort((a, b) => a[0] - b[0]);
    // overflow scan: any card sticking out of panel
    const out = [];
    cards.forEach(c => {
      const r = c.getBoundingClientRect();
      if (r.right > pr.x + pr.w + 2 || r.bottom > pr.y + pr.h + 2 || r.left < pr.x - 2) {
        out.push({ id: c.dataset.id || '?', right: Math.round(r.right - (pr.x + pr.w)), bottom: Math.round(r.bottom - (pr.y + pr.h)) });
      }
    });
    // chips bar
    const chips = [...document.querySelectorAll('.chip')].map(c => ({ txt: c.textContent.trim().slice(0, 8), w: Math.round(c.getBoundingClientRect().width) }));
    const chipsBar = chips[0] && chips[0].txt ? rect(document.querySelector('.chips') || document.body) : null;
    // last row partially visible?
    const lastTop = rows.length ? rows[rows.length - 1][0] : 0;
    const lastBottom = cards.length ? Math.max(...cards.map(c => c.getBoundingClientRect().bottom)) : 0;
    return {
      mode, vis: document.visibilityState,
      inner: { w: innerWidth, h: innerHeight },
      panel: { ...pr, scrollW: panel.scrollWidth, clientW: panel.clientWidth, scrollH: panel.scrollHeight, clientH: panel.clientHeight },
      grid: { rect: rect(grid), n: cards.length, rows: rows.map(e => e[1]), firstCard: cards[0] ? rect(cards[0]) : null, lastCard: cards[cards.length - 1] ? rect(cards[cards.length - 1]) : null, lastRowBottomVsPanel: Math.round(lastBottom - (pr.y + pr.h)) },
      overflowCards: out.slice(0, 6), overflowCount: out.length,
      chipsN: chips.length, chipsSample: chips.slice(0, 10),
      topbar: $('topbar') ? rect($('topbar')) : null,
      footer: $('footer') ? rect($('footer')) : null,
      bodyChildren: [...document.body.children].map(e => e.id || e.className.toString().slice(0, 18)),
    };
  })()` });
  if (r.timeout) { console.error('EVAL TIMEOUT'); process.exit(1); }
  if (r.exceptionDetails) { console.error('EVAL ERROR:', r.exceptionDetails.text, r.exceptionDetails.exception && r.exceptionDetails.exception.description); process.exit(1); }
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
