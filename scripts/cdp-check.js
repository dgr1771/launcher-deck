// CDP DOM check for launcher-deck layered table (Node >= 21 native WebSocket)
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
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => ws.onopen = r);

  const expr = `(() => {
    const lg = [...document.querySelectorAll('.card--lg')];
    const frontHead = document.querySelector('.front-head');
    const suitRows = [...document.querySelectorAll('.suit-row')].map(r => ({
      head: (r.querySelector('.suit-head') || {}).textContent || '',
      cards: r.querySelectorAll('.card').length,
    }));
    const pile = document.querySelector('.plabel');
    const firstLg = lg[0];
    const firstMd = document.querySelector('.suit-row .card');
    return {
      lgCount: lg.length,
      lgFirstWidth: firstLg ? firstLg.offsetWidth : 0,
      mdFirstWidth: firstMd ? firstMd.offsetWidth : 0,
      frontHeadText: frontHead ? frontHead.textContent : '(none)',
      frontNames: lg.map(c => c.dataset.name),
      badges: lg.map(c => ({
        name: c.dataset.name,
        use: (c.querySelector('.usebadge') || {}).textContent || '',
        pin: !!c.querySelector('.pinbadge'),
        isNew: !!c.querySelector('.newbadge'),
      })),
      suitRows,
      pileText: pile ? pile.textContent : '(none)',
      pileExpandedExists: !!document.getElementById('pileExpanded'),
      chipCount: document.querySelectorAll('.chip').length,
      subtitle: (document.getElementById('subtitle') || {}).textContent || '',
    };
  })()`;

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result.value, null, 2));
  ws.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
