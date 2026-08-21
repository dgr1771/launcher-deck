// CDP verify: drag-drop custom categorization + Joker card style
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
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + JSON.stringify(r.exceptionDetails.exception || {}));
    return r.result.value;
  }

  // 1) cards draggable + droppable chips
  const dnd = await ev(`(() => ({
    draggable: document.querySelector('#grid .tcard').getAttribute('draggable'),
    droppableChips: document.querySelectorAll('.chip[data-droppable]').length,
  }))()`);
  console.log('dnd:', JSON.stringify(dnd));

  // 2) custom categorize 千问 (misc) -> dev, verify + badge + persisted
  const name = '千问';
  const custom = await ev(`(() => {
    setCustomCat(${JSON.stringify(name)}, 'dev');
    renderTarot(false);
    const a = DATA.find(x => x.name === ${JSON.stringify(name)});
    const card = document.querySelector('.tcard[data-name=' + JSON.stringify(JSON.stringify(name)).slice(1, -1) + ']');
    return {
      cat: catOf(a).id,
      badge: card ? !!card.querySelector('.custombadge') : false,
      suit: card ? card.querySelector('.face.back').dataset.suit : '',
      stored: localStorage.getItem('ld_custom_cat'),
    };
  })()`);
  console.log('custom-cat:', JSON.stringify(custom));

  // 3) reset to auto
  const reset = await ev(`(() => {
    setCustomCat(${JSON.stringify(name)}, null);
    renderTarot(false);
    const a = DATA.find(x => x.name === ${JSON.stringify(name)});
    return { cat: catOf(a).id, stored: localStorage.getItem('ld_custom_cat') };
  })()`);
  console.log('reset:', JSON.stringify(reset));

  // 4) switch to game, check Joker card style (white bg + gold border + big K corner)
  await ev(`document.getElementById('btnMode').click()`);
  await new Promise(r => setTimeout(r, 5000));
  const joker = await ev(`(() => {
    const j = document.querySelector('.pcard.joker');
    const cs = getComputedStyle(j);
    const r = j.querySelector('.corner .r');
    return {
      bg: cs.backgroundImage.slice(0, 60),
      border: cs.borderTopColor + ' ' + cs.borderTopWidth,
      cornerText: r.textContent,
      cornerFont: getComputedStyle(r).fontSize,
      label: j.querySelector('.pname').textContent,
    };
  })()`);
  console.log('joker:', JSON.stringify(joker));

  // back to tarot
  await ev(`document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
