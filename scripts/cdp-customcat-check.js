// CDP verify custom category creation -> categorize -> filter -> delete -> restore
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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }

  // 1) open modal, fill name, pick icon, create
  const created = await ev(`(() => {
    document.getElementById('chipAdd').click();
    const modal = document.getElementById('catModal');
    if (!modal) return { modal: false };
    modal.querySelector('#catNameInput').value = '游戏';
    modal.querySelectorAll('.ci')[0].click();          // 🎮
    modal.querySelector('[data-act="ok"]').click();
    const cats = getCustomCatList();
    const chip = [...document.querySelectorAll('.chip')].find(c => c.textContent.includes('游戏'));
    return {
      modal: true,
      cats,
      chipShown: !!chip,
      chipText: chip ? chip.textContent.trim() : '',
    };
  })()`);
  console.log('created:', JSON.stringify(created));

  // 2) categorize 千问 into the new cat via right-click menu
  const catId = created.cats[0] && created.cats[0].id;
  const assigned = await ev(`(() => {
    const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 500, clientY: 400 }));
    const m = document.querySelector('.ctxmenu');
    const item = [...m.querySelectorAll('.ctxmenu__item')].find(i => i.dataset.cat === '${catId}');
    const label = item ? item.textContent.trim() : null;
    if (item) item.click();
    const a = DATA.find(x => x.name === '千问');
    const card2 = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
    return {
      menuItem: label,
      cat: catOf(a).id,
      suit: card2.querySelector('.face.back').dataset.suit,
      stored: localStorage.getItem('ld_custom_cat'),
    };
  })()`);
  console.log('assigned:', JSON.stringify(assigned));

  // 3) filter by the new cat chip -> only its members shown
  const filtered = await ev(`(() => {
    const chip = [...document.querySelectorAll('.chip')].find(c => c.dataset.cat === '${catId}');
    chip.click();
    const names = [...document.querySelectorAll('#grid .tcard')].map(c => c.dataset.name);
    document.querySelector('.chip[data-cat="all"]').click();   // restore
    return { shown: names };
  })()`);
  console.log('filtered:', JSON.stringify(filtered));

  // 4) delete the custom cat via contextmenu on chip -> confirm
  const deleted = await ev(`(() => {
    const chip = [...document.querySelectorAll('.chip')].find(c => c.dataset.cat === '${catId}');
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 200 }));
    const m = document.getElementById('delCatModal');
    if (!m) return { confirmShown: false };
    m.querySelector('[data-act="yes"]').click();
    const a = DATA.find(x => x.name === '千问');
    return {
      confirmShown: true,
      catsLeft: getCustomCatList().length,
      catRestored: catOf(a).id,
      chipGone: ![...document.querySelectorAll('.chip')].some(c => c.dataset.cat === '${catId}'),
    };
  })()`);
  console.log('deleted:', JSON.stringify(deleted));

  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
