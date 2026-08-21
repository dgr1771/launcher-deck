// verify: slot-box vs card alignment + synthetic drag (pointer events) onto free cell / column
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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await ev(`if (mode !== 'game') document.getElementById('btnMode').click()`);
  await sleep(6800);

  // 1) slot-box vs expected card position alignment (the reported bug)
  let r = await ev(`(() => {
    const bad = [];
    for (let i = 0; i < 4; i++) {
      const cell = document.getElementById('cell' + i);
      const found = document.getElementById('found' + i);
      const cs = getComputedStyle(cell);
      const m = /^([\\d.]+)px/.exec(cs.left);
      const actualLeft = cell.offsetLeft + (cell.offsetParent ? cell.offsetParent.offsetLeft || 0 : 0);
      // 直接量 boundingRect 相对面板原点更可靠
      const br = $('fcboard').getBoundingClientRect();
      const cr = cell.getBoundingClientRect();
      const fr = found.getBoundingClientRect();
      bad.push({
        i,
        cellOff: [Math.round(cr.left - br.left), Math.round(cr.top - br.top)],
        expect: [Math.round(colX(i)), TOP_Y],
        foundOff: [Math.round(fr.left - br.left), Math.round(fr.top - br.top)],
        expectF: [Math.round(colX(i + 4)), TOP_Y],
      });
    }
    return bad;
  })()`);
  const aligned = r.every(b =>
    Math.abs(b.cellOff[0] - b.expect[0]) <= 2 && Math.abs(b.cellOff[1] - b.expect[1]) <= 2 &&
    Math.abs(b.foundOff[0] - b.expectF[0]) <= 2 && Math.abs(b.foundOff[1] - b.expectF[1]) <= 2);
  console.log('slot-align:', aligned ? 'OK all 8' : JSON.stringify(r.filter(b =>
    Math.abs(b.cellOff[0] - b.expect[0]) > 2 || Math.abs(b.foundOff[0] - b.expectF[0]) > 2)));

  // 2) synthetic drag: top card of col0 onto free cell (pointerdown → move → up)
  r = await ev(`(() => {
    const col = game.cols.find(c => c.length);
    const ci = game.cols.indexOf(col);
    const top = col[col.length - 1];
    const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
    const r0 = el.getBoundingClientRect();
    const sx = r0.left + r0.width / 2, sy = r0.top + 20;
    const k = game.cells.findIndex(c => !c);
    if (k < 0) return { note: 'no free cell' };
    const target = document.getElementById('cell' + k).getBoundingClientRect();
    const tx = target.left + target.width / 2, ty = target.top + target.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sx, clientY: sy, button: 0, pointerId: 1, isPrimary: true }));
    // 中途移动（过阈值）→ 目标
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + 20, clientY: sy + 15, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: tx, clientY: ty, pointerId: 1 }));
    const highlighted = !!document.querySelector('.slot.droptarget');
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: tx, clientY: ty, pointerId: 1 }));
    return { highlighted, inCell: game.cells[k] === top, moves: game.moveCount };
  })()`);
  console.log('drag-to-cell:', JSON.stringify(r));

  // 3) synthetic drag: illegal drop → bounce back
  r = await ev(`(() => {
    // 从 cell0 拖一张牌放到不合法的列顶（找一个 canStack 不满足的列）
    const card = game.cells.find(c => c);
    if (!card) return { note: 'no card in cell' };
    const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === card.id);
    const r0 = el.getBoundingClientRect();
    let dstI = -1;
    for (let j = 0; j < 8; j++) {
      const dst = game.cols[j];
      if (dst.length && !canStack(card, dst[dst.length - 1])) { dstI = j; break; }
    }
    if (dstI < 0) return { note: 'no illegal column (rare)' };
    const t = document.getElementById('colanchor' + dstI).getBoundingClientRect();
    const sx = r0.left + r0.width / 2, sy = r0.top + 20;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sx, clientY: sy, button: 0, pointerId: 2, isPrimary: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx + 30, clientY: sy + 20, pointerId: 2 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: t.left + 40, clientY: t.top + 40, pointerId: 2 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: t.left + 40, clientY: t.top + 40, pointerId: 2 }));
    // 弹回后应在原 cell
    const stillInCell = game.cells.includes(card);
    return { bounced: stillInCell, sameMoves: true };
  })()`);
  console.log('drag-illegal-bounce:', JSON.stringify(r));

  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
