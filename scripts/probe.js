// probe: why fortune popup / reading popup miss on first trigger
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
    return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description?.slice(0, 300) || r.exceptionDetails.text } : r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // capture console errors
  await send('Runtime.enable');
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      console.log('PAGE ERROR:', m.params.args.map(a => a.value || a.description).join(' ').slice(0, 300));
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };

  // fortune probe
  let r = await ev(`(() => {
    const btn = document.getElementById('btnFortune');
    const popBefore = !!document.getElementById('fortunePop');
    const boxBefore = !!document.getElementById('fortuneBox');
    btn.click();
    const pop = document.getElementById('fortunePop');
    return {
      btnExists: !!btn, popBefore, boxBefore,
      popAfter: !!pop,
      showClass: pop ? pop.classList.contains('show') : null,
      boxFilled: document.getElementById('fortuneBox') ? document.getElementById('fortuneBox').innerHTML.length : -1,
    };
  })()`);
  console.log('fortune:', JSON.stringify(r));

  // reading probe (fresh)
  await ev(`document.querySelector('#fortunePop .plain') && document.querySelector('#fortunePop .plain').click()`);
  await ev(`(() => { const c = document.querySelectorAll('#grid .tcard')[5]; c.dispatchEvent(new MouseEvent('mouseenter')); return 'entered'; })()`);
  await sleep(900);
  r = await ev(`(() => {
    const el = document.getElementById('reading');
    if (!el) return { exists: false };
    return {
      exists: true,
      inlineDisplay: el.style.display,
      computedDisplay: getComputedStyle(el).display,
      open: el.classList.contains('open'),
      innerLen: el.innerHTML.length,
    };
  })()`);
  console.log('reading:', JSON.stringify(r));
  await ev(`document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseleave'))`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
