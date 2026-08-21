// CDP verify context-menu categorization: dispatch contextmenu on a card, click a cat item, verify
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
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }

  // 1) right-click a card -> menu appears with items
  const menu = await ev(`(() => {
    const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
    const m = document.querySelector('.ctxmenu');
    if (!m) return { shown: false };
    return {
      shown: true,
      title: m.querySelector('.ctxmenu__title').textContent,
      items: [...m.querySelectorAll('.ctxmenu__item')].map(i => i.textContent.trim().slice(0, 16)),
    };
  })()`);
  console.log('menu:', JSON.stringify(menu, null, 1));

  // 2) click dev item -> categorized
  const result = await ev(`(() => {
    const m = document.querySelector('.ctxmenu');
    const item = [...m.querySelectorAll('.ctxmenu__item')].find(i => i.dataset.cat === 'dev');
    item.click();
    const a = DATA.find(x => x.name === '千问');
    const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
    return {
      cat: catOf(a).id,
      suit: card.querySelector('.face.back').dataset.suit,
      badge: !!card.querySelector('.custombadge'),
      stored: localStorage.getItem('ld_custom_cat'),
      menuClosed: !document.querySelector('.ctxmenu'),
    };
  })()`);
  console.log('categorized:', JSON.stringify(result, null, 1));

  // 3) screenshot with menu open again (for visual) then reset
  await ev(`(() => {
    const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 360 }));
    return true;
  })()`);
  await new Promise(r => setTimeout(r, 350));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\67842\\launcher-eval\\shots\\ctxmenu.png', Buffer.from(shot.data, 'base64'));
  console.log('shot saved');

  // 4) reset to auto via misc item
  const reset = await ev(`(() => {
    const m = document.querySelector('.ctxmenu');
    [...m.querySelectorAll('.ctxmenu__item')].find(i => i.dataset.cat === 'misc').click();
    const a = DATA.find(x => x.name === '千问');
    return { cat: catOf(a).id, stored: localStorage.getItem('ld_custom_cat') };
  })()`);
  console.log('reset:', JSON.stringify(reset));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
