// verify custom badge renders on the card after custom categorization
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
  const r = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    setCustomCat('千问', 'dev');
    renderTarot(false);
    const card = [...document.querySelectorAll('.tcard')].find(c => c.dataset.name === '千问');
    const ok = card ? {
      found: true,
      badge: !!card.querySelector('.custombadge'),
      suit: card.querySelector('.face.back').dataset.suit,
      cls: card.className,
    } : { found: false, totalCards: document.querySelectorAll('.tcard').length };
    // cleanup: reset to auto
    setCustomCat('千问', null);
    renderTarot(false);
    return ok;
  })()` });
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
