// verify theme system: glass / custom color / image backdrops via computed styles
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
    return r.exceptionDetails ? { err: r.exceptionDetails.text } : r.result.value;
  }
  const panelState = `(() => { const cs = getComputedStyle(document.getElementById('panel')); return { img: cs.backgroundImage.slice(0, 130), color: cs.backgroundColor, size: cs.backgroundSize, blur: cs.backdropFilter.slice(0, 30) }; })()`;
  const backState = `(() => { const cs = getComputedStyle(document.querySelector('#grid .tcard .face.back')); return { img: cs.backgroundImage.slice(0, 60), size: cs.backgroundSize }; })()`;

  // 1) modal opens
  let r = await ev(`(() => { document.getElementById('btnTheme').click(); const m = document.getElementById('themeModal'); return { shown: !!m, presets: m ? m.querySelectorAll('.preset').length : 0 }; })()`);
  console.log('modal:', JSON.stringify(r));
  await ev(`document.getElementById('themeModal') && document.getElementById('themeModal').remove()`);

  // 2) glass theme
  await ev(`setTheme({ preset: 'glass' }); applyTheme();`);
  r = await ev(panelState);
  console.log('glass:', JSON.stringify(r));
  const glassOk = r.img.includes('10, 186, 181') && r.img.includes('255, 123, 172') && r.blur.includes('18');

  // 3) custom color
  await ev(`setTheme({ preset: 'custom', panelColor: '#301040' }); applyTheme();`);
  r = await ev(panelState);
  console.log('custom-color:', JSON.stringify(r));
  const colorOk = r.color.includes('48, 16, 64');

  // 4) custom image backdrop (tiny generated data URL) + fit contain
  await ev(`setTheme({ preset: 'custom', panelImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDT/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA=', panelFit: 'contain', panelMask: 0.3 }); applyTheme();`);
  r = await ev(panelState);
  console.log('image-backdrop:', JSON.stringify(r));
  const imgOk = r.img.includes('data:image') && r.size.includes('contain') && r.color.includes('rgba(5, 8, 14');

  // 5) card back image + fit
  await ev(`setTheme({ preset: 'custom', cardImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDT/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA=', cardFit: 'cover' }); applyTheme();`);
  r = await ev(backState);
  console.log('card-back:', JSON.stringify(r));
  const cardOk = r.img.includes('data:image');

  // 6) reset
  await ev(`setTheme({ preset: 'felt' }); applyTheme();`);
  r = await ev(panelState);
  const feltOk = r.img.includes('radial-gradient');
  console.log('reset:', feltOk, JSON.stringify(r));

  const allOk = glassOk && colorOk && imgOk && cardOk && feltOk;
  console.log(allOk ? 'THEME ALL OK' : 'THEME FAIL');
  ws.close();
  process.exit(allOk ? 0 : 1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
