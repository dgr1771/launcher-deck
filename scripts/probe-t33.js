// T33 探针：setMode('game') 无存档时是否建局 + 抓异常 + 恢复局点击取证
const http = require('http');
http.get('http://127.0.0.1:9223/json', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const p = JSON.parse(d).find(p => p.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    let id = 0;
    const pend = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
    ws.onopen = async () => {
      const send = (expression) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } })); });
      const r1 = await send(`(async () => {
        try {
          game = null; clearSavedGame(); suppressClick = false;
          setMode('game');
          await new Promise(r2 => setTimeout(r2, 500));
          return { ok: true, hasGame: !!game, dealNo: game && game.dealNo, mode };
        } catch (e) {
          return { throwInSetMode: String(e).slice(0, 200), stack2: (e && e.stack || '').split('\\n')[1] };
        }
      })()`);
      console.log('A(无档建局):', JSON.stringify(r1.result.value));
      // B: 有档恢复后点击
      const r2 = await send(`(async () => {
        try {
          // 走一步存档
          const col = game.cols.find(c => c.length);
          game.selected = { zone: 'col', i: game.cols.indexOf(col), idx: col.length - 1 };
          const k = game.cells.findIndex(c => !c);
          tryMoveTo({ zone: 'cell', i: k });
          saveGame();
          const savedCount = game.moveCount;
          game = null;
          setMode('tarot');
          setMode('game');
          await new Promise(r3 => setTimeout(r3, 2500));
          // 点击取证
          const col2 = game.cols.find(c => c.length);
          const ci = game.cols.indexOf(col2);
          const top = col2[col2.length - 1];
          const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
          window.__probe = 0;
          const probeL = () => { window.__probe++; };
          document.addEventListener('click', probeL, true);
          if (el) el.click();
          document.removeEventListener('click', probeL, true);
          return { savedCount, restoredCount: game.moveCount, won: game.won,
                   elFound: !!el, elId: el && el.dataset.id, topId: top.id, docProbe: window.__probe,
                   selectedAfter: JSON.stringify(game.selected), suppressClick };
        } catch (e) {
          return { throwInB: String(e).slice(0, 200), stack2: (e && e.stack || '').split('\\n')[1] };
        }
      })()`);
      console.log('B(恢复点击):', JSON.stringify(r2.result.value, null, 1));
      ws.close(); process.exit(0);
    };
  });
});
