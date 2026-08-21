// CDP verify reading popup: dispatch mouseenter on a card, wait for hover-intent, check popup
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

  // hover a middle card (dispatch real mouseenter on the card element)
  const hovered = await ev(`(() => {
    const card = document.querySelectorAll('#grid .tcard')[6];
    const name = card.dataset.name;
    card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    return name;
  })()`);
  console.log('hovered:', hovered);

  await new Promise(r => setTimeout(r, 900));   // hover intent 450ms + open transition

  const state = await ev(`(() => {
    const el = document.getElementById('reading');
    if (!el || el.style.display === 'none') return { shown: false };
    const cs = getComputedStyle(el);
    return {
      shown: true,
      open: el.classList.contains('open'),
      opacity: cs.opacity,
      width: el.offsetWidth,
      divFontSize: getComputedStyle(el.querySelector('.reading__div')).fontSize,
      divText: el.querySelector('.reading__div').textContent,
      name: el.querySelector('.reading__name').textContent,
      pos: el.style.left + ',' + el.style.top,
    };
  })()`);
  console.log('reading:', JSON.stringify(state, null, 1));

  // screenshot with popup open
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\67842\\launcher-eval\\shots\\reading-popup.png', Buffer.from(shot.data, 'base64'));
  console.log('shot saved');

  // cleanup: mouseleave
  await ev(`(() => {
    const card = document.querySelectorAll('#grid .tcard')[6];
    card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    return 'left';
  })()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
