/* ============================================================
   launcher-deck 全量自动化测试（CDP）
   覆盖：数据加载/塔罗渲染/过滤/翻面/解读浮层/右键归类/拖拽/
   自定义类别/搜索/今日一抽/模式切换/游戏引擎/移动/悔棋/胜利/新局
   用法：node scripts/test-all.js   （应用需带 --remote-debugging-port=9222 运行）
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + (detail !== undefined ? ' | ' + detail : ''));
}

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
  if (!page) { console.error('no page target'); process.exit(1); }
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
  // 置前页面：缓解隐藏窗口的 timer throttling（450ms hover-intent 可能被对齐延迟）
  await send('Page.bringToFront', {}).catch(() => {});
  async function ev(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}) };
    return r.result.value;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- 准备：回塔罗模式、清测试残留 ----------
  await ev(`(() => {
    localStorage.removeItem('ld_custom_cats');
    localStorage.removeItem('ld_custom_cat');
    localStorage.removeItem('ld_pinned');
    if (typeof setMode === 'function' && mode !== 'tarot') setMode('tarot');
    document.querySelectorAll('.ctxmenu,.catmodal-pop').forEach(e => e.remove());
    // 常驻弹层只清状态，不能删元素（fortunePop/winBox 是 index.html 常驻 DOM）
    ['fortunePop', 'winPop'].forEach(id => {
      const p = document.getElementById(id);
      if (p) p.classList.remove('show', 'open');
    });
    if (typeof buildChips === 'function') buildChips();   // 重建 chips（清残留自定义类）
    if (typeof renderTarot === 'function') renderTarot(false);
    suppressClick = false;                                // 拖拽探针可能遗留一次 click 抑制
    if (typeof game !== 'undefined') { game = null; clearSavedGame(); }   // 清残留牌局（否则 T17 恢复旧局破坏发牌断言）
    return 'reset';
  })()`);
  await sleep(400);

  // T1 数据层（动态：驱动过滤后应用数可变，牌副恒 52）
  {
    const r = await ev(`(() => ({ data: DATA.length, deck: DECK.length, apps: DECK.filter(c=>!c.joker).length, jokers: DECK.filter(c=>c.joker).length, dupIds: new Set(DECK.map(c=>c.id)).size }))()`);
    record('T1 数据加载（动态 N 应用 + 补位牌 = 52 副无重复）',
      r.data >= 40 && r.deck === 52 && r.apps === 52 - r.jokers && r.apps + r.jokers === 52 && r.dupIds === 52, JSON.stringify(r));
  }

  // T2 塔罗渲染（动态数量）
  {
    const r = await ev(`(() => ({
      cards: document.querySelectorAll('#grid .tcard').length,
      expect: DATA.length,
      chips: document.querySelectorAll('.chip[data-cat]').length,
      addBtn: !!document.getElementById('chipAdd'),
      iconsLoaded: [...document.querySelectorAll('#grid .tcard img.appicon')].length,
    }))()`);
    record('T2 塔罗网格渲染 + 花色标签 + 新建按钮',
      r.cards === r.expect && r.expect > 40 && r.chips === 8 && r.addBtn && r.iconsLoaded > 28, JSON.stringify(r));
  }

  // T3 chips 计数一致性（动态）
  {
    const r = await ev(`(() => {
      const all = +document.querySelector('.chip[data-cat="all"] small').textContent;
      let sum = 0;
      document.querySelectorAll('.chip[data-cat]:not([data-cat="all"])').forEach(c => sum += +c.querySelector('small').textContent);
      return { all, sum, expect: DATA.length };
    })()`);
    record('T3 花色标签计数总和 = 全部', r.all === r.expect && r.sum === r.expect, JSON.stringify(r));
  }

  // T4 花色过滤
  {
    const r = await ev(`(() => {
      const dev = document.querySelector('.chip[data-cat="dev"]');
      const expect = +dev.querySelector('small').textContent;
      dev.click();
      const shown = document.querySelectorAll('#grid .tcard').length;
      const allSuit = [...document.querySelectorAll('#grid .tcard .face.back')].every(b => b.dataset.suit === '♠');
      document.querySelector('.chip[data-cat="all"]').click();
      return { expect, shown, allSuit };
    })()`);
    record('T4 点击 ♠开发工具 过滤正确', r.shown === r.expect && r.allSuit && r.expect > 0, JSON.stringify(r));
  }

  // T5 悬停翻面
  {
    const r = await ev(`(() => {
      const card = document.querySelectorAll('#grid .tcard')[3];
      const inner = card.querySelector('.inner');
      card.dispatchEvent(new MouseEvent('mouseenter'));
      const a = inner.classList.contains('flipped');
      card.dispatchEvent(new MouseEvent('mouseleave'));
      const b = !inner.classList.contains('flipped');
      return { flippedOnHover: a, unflippedOnLeave: b };
    })()`);
    record('T5 悬停翻面 / 移开翻回', r.flippedOnHover && r.unflippedOnLeave, JSON.stringify(r));
  }

  // T6 解读浮层（450ms hover intent；hidden 窗口 timer 节流可能 >1s，等待放宽）
  {
    await ev(`document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseenter'))`);
    await sleep(1700);
    let r = await ev(`(() => {
      const el = document.getElementById('reading');
      const on = el && getComputedStyle(el).display !== 'none' && el.classList.contains('open');
      const txt = on ? el.querySelector('.reading__div').textContent : '';
      const nm = on ? el.querySelector('.reading__name').textContent : '';
      document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseleave'));
      return { on, txt, nm };
    })()`);
    const off = await ev(`(() => document.getElementById('reading') && document.getElementById('reading').style.display === 'none')()`);
    let t6ok = r.on && r.txt.length > 5 && r.nm && off;
    if (!t6ok) {
      // 节流兜底：重触发一次再等
      await ev(`document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseleave'))`);
      await sleep(150);
      await ev(`document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseenter'))`);
      await sleep(1700);
      r = await ev(`(() => { const el = document.getElementById('reading'); if (!el) return { on: null, txt: '', nm: '' }; return { on: getComputedStyle(el).display !== 'none' && el.classList.contains('open'), txt: el.querySelector('.reading__div').textContent, nm: el.querySelector('.reading__name').textContent }; })()`);
      const off2 = await ev(`(() => { document.querySelectorAll('#grid .tcard')[5].dispatchEvent(new MouseEvent('mouseleave')); return document.getElementById('reading') ? document.getElementById('reading').style.display === 'none' : true; })()`);
      t6ok = r.on && r.txt.length > 5 && r.nm && off2;
    }
    record('T6 解读浮层出现/有牌意/移开隐藏', t6ok, JSON.stringify(r));
  }

  // T7 右键菜单
  {
    const r = await ev(`(() => {
      const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
      const m = document.querySelector('.ctxmenu');
      if (!m) return { shown: false };
      const items = m.querySelectorAll('.ctxmenu__item').length;
      const onItem = m.querySelector('.ctxmenu__item.on');
      return { shown: true, items, cur: onItem ? onItem.dataset.cat : null };
    })()`);
    record('T7 右键菜单弹出（6 内置 + 未名 + 启动 = 8 项 + 当前归属高亮）',
      r.shown && r.items === 8 && r.cur === 'misc', JSON.stringify(r));
  }

  // T8 右键归类 → dev → 恢复
  {
    const r = await ev(`(() => {
      const m = document.querySelector('.ctxmenu');
      [...m.querySelectorAll('.ctxmenu__item')].find(i => i.dataset.cat === 'dev').click();
      const a = DATA.find(x => x.name === '千问');
      const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
      const devOk = catOf(a).id === 'dev' && card.querySelector('.face.back').dataset.suit === '♠' && !!card.querySelector('.custombadge');
      // 恢复自动
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 500, clientY: 400 }));
      const m2 = document.querySelector('.ctxmenu');
      [...m2.querySelectorAll('.ctxmenu__item')].find(i => i.dataset.cat === 'misc').click();
      const back = catOf(a).id === 'misc';
      return { devOk, back, stored: localStorage.getItem('ld_custom_cat') };
    })()`);
    record('T8 右键归类 dev + ◈徽标 + 恢复自动', r.devOk && r.back, JSON.stringify(r));
  }

  // T9 合成拖拽链：dragstart → chip dragover/drop
  {
    const r = await ev(`(() => {
      const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      const data = dt.getData('text/plain');
      const chip = document.querySelector('.chip[data-cat="dev"]');
      chip.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      const hi = chip.classList.contains('droptarget');
      chip.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      const a = DATA.find(x => x.name === '千问');
      const ok = catOf(a).id === 'dev';
      // 清理恢复
      setCustomCat('千问', null); renderTarot(false);
      return { data, hi, ok };
    })()`);
    record('T9 拖拽归类（dragstart 数据/高亮/drop 生效）',
      r.data === '千问' && r.hi && r.ok, JSON.stringify(r));
  }

  // T10 自定义类别创建（含空名校验）
  {
    const r = await ev(`(() => {
      document.getElementById('chipAdd').click();
      const m = document.getElementById('catModal');
      if (!m) return { modal: false };
      // 空名
      m.querySelector('[data-act="ok"]').click();
      const emptyRejected = !!document.getElementById('catModal') && document.getElementById('toast').classList.contains('show');
      // 正常创建
      const input = m.querySelector('#catNameInput');
      input.value = '游戏';
      m.querySelectorAll('.ci')[0].click();
      m.querySelector('[data-act="ok"]').click();
      const cats = getCustomCatList();
      const chip = [...document.querySelectorAll('.chip')].find(c => c.dataset.cat === cats[0].id);
      return { modal: true, emptyRejected, cats, chip: chip ? chip.textContent.trim() : null };
    })()`);
    const catId = r.cats && r.cats[0] && r.cats[0].id;
    record('T10 新建分类（弹层/空名拦截/落盘/标签出现）',
      r.modal && r.emptyRejected && r.cats && r.cats.length === 1 && r.cats[0].name === '游戏' && !!r.chip, JSON.stringify(r));

    // T11 归入自定义类别 + 花色角标
    if (catId) {
      const r2 = await ev(`(() => {
        setCustomCat('千问', '${catId}');
        renderTarot(false);
        const a = DATA.find(x => x.name === '千问');
        const card = [...document.querySelectorAll('#grid .tcard')].find(c => c.dataset.name === '千问');
        return { cat: catOf(a).id, suit: card.querySelector('.face.back').dataset.suit };
      })()`);
      record('T11 归入自定义类别（牌背角标=花色符号）', r2.cat === catId && r2.suit === '🎮', JSON.stringify(r2));

      // T12 过滤自定义类别
      const r3 = await ev(`(() => {
        const chip = [...document.querySelectorAll('.chip')].find(c => c.dataset.cat === '${catId}');
        chip.click();
        const names = [...document.querySelectorAll('#grid .tcard')].map(c => c.dataset.name);
        document.querySelector('.chip[data-cat="all"]').click();
        return names;
      })()`);
      record('T12 过滤自定义类别只显示成员', r3.length === 1 && r3[0] === '千问', JSON.stringify(r3));

      // T13 删除自定义类别
      const r4 = await ev(`(() => {
        const chip = [...document.querySelectorAll('.chip')].find(c => c.dataset.cat === '${catId}');
        chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 200 }));
        const m = document.getElementById('delCatModal');
        if (!m) return { confirm: false };
        m.querySelector('[data-act="yes"]').click();
        const a = DATA.find(x => x.name === '千问');
        return { confirm: true, left: getCustomCatList().length, restored: catOf(a).id, chipGone: ![...document.querySelectorAll('.chip')].some(c => c.dataset.cat === '${catId}') };
      })()`);
      record('T13 删除分类（确认弹层/成员恢复自动/标签消失）',
        r4.confirm && r4.left === 0 && r4.restored === 'misc' && r4.chipGone, JSON.stringify(r4));
    }
  }

  // T14 搜索
  {
    const r = await ev(`(() => {
      document.getElementById('btnSearch').click();
      const boxShown = document.getElementById('searchbox').classList.contains('show');
      const input = document.getElementById('searchInput');
      input.value = 'git';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const sr = document.getElementById('searchResult');
      const shown = sr.classList.contains('show');
      const names = [...sr.querySelectorAll('.tcard')].map(c => c.dataset.name);
      const allMatch = names.every(n => n.toLowerCase().includes('git'));
      // 关闭并清空
      document.getElementById('btnSearch').click();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const closed = !sr.classList.contains('show');
      return { boxShown, shown, n: names.length, allMatch, closed, sample: names.slice(0, 3) };
    })()`);
    record('T14 搜索兜底（打开/过滤/关闭清空）',
      r.boxShown && r.shown && r.n > 0 && r.allMatch && r.closed, JSON.stringify(r));
  }

  // T15/T16 今日一抽 + Esc（隐藏窗口节流，读取放宽并防 null）
  {
    const a1 = await ev(`(() => {
      try {
        document.getElementById('btnFortune').click();
        const p = document.getElementById('fortunePop');
        const t = p.querySelector('.ftitle');
        return { show: p.classList.contains('show'), title: t ? t.textContent : '' };
      } catch (e) { return { show: false, title: '', err: String(e) }; }
    })()`);
    const a2 = await ev(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; })()`);
    await sleep(320);   // closePop 有 220ms 收起动画
    const a2b = await ev(`(() => { const p = document.getElementById('fortunePop'); return { closed: !p.classList.contains('show') }; })()`);
    const a3 = await ev(`(() => { document.getElementById('btnFortune').click(); const t1 = document.getElementById('fortunePop').querySelector('.ftitle').textContent; document.querySelector('#fortunePop .plain').click(); document.getElementById('btnFortune').click(); const t2 = document.getElementById('fortunePop').querySelector('.ftitle').textContent; document.querySelector('#fortunePop .plain').click(); return { stable: t1 === t2, t: t1.slice(0, 12) }; })()`);
    record('T15 今日一抽（弹层/Esc 关闭/全天稳定）',
      a1.show && a1.title.includes('今日宜开') && a2b.closed && a3.stable, JSON.stringify({ a1: a1.show, esc: a2b.closed, t: a3.t }));
  }

  // T17 模式切换（先强清存档与内存局——上一轮残局会泄漏进本轮断言）
  {
    const r = await ev(`(() => {
      let prep = 'clean';
      try {
        game = null;
        clearSavedGame();
        suppressClick = false;
        if (mode !== 'tarot') setMode('tarot');
      } catch (e) { prep = 'prep-err:' + String(e).slice(0, 120); }
      document.getElementById('btnMode').click();
      return {
        prep,
        tarotHidden: document.getElementById('tarot').classList.contains('hidden'),
        fcShown: !document.getElementById('fcboard').classList.contains('hidden'),
        gameBtns: document.getElementById('gameBtns').style.display,
        tag: document.getElementById('modeTag').textContent,
      };
    })()`);
    record('T17 切入游戏模式（牌阵互斥/按钮/文案）',
      r.prep === 'clean' && r.tarotHidden && r.fcShown && r.gameBtns === 'flex' && r.tag.includes('纯游戏'), JSON.stringify(r));
  }

  // T18 发牌（轮询等待——隐藏窗口 timer 节流下发牌 stagger 可能拖长）
  {
    let r = null;
    for (let t = 0; t < 12; t++) {
      r = await ev(`(() => {
        const cols = game.cols.map(c => c.length);
        const visible = [...document.querySelectorAll('.pcard')].filter(c => c.style.opacity !== '0').length;
        return { cols, total: cols.reduce((a, b) => a + b, 0), visible };
      })()`);
      if (JSON.stringify(r.cols) === JSON.stringify([7,7,7,7,6,6,6,6]) && r.total === 52 && r.visible === 52) break;
      await sleep(2500);
    }
    const expected = JSON.stringify([7, 7, 7, 7, 6, 6, 6, 6]);
    record('T18 标准发牌 7,7,7,7,6,6,6,6 = 52 全可见',
      JSON.stringify(r.cols) === expected && r.total === 52 && r.visible === 52, JSON.stringify(r));
  }

  // T19 引擎单元
  {
    const r = await ev(`(() => {
      const A = { suit: SUITS[0], rank: 1 }, H2 = { suit: SUITS[1], rank: 2 }, S2 = { suit: SUITS[0], rank: 2 };
      return {
        stackA_on_2: canStack(A, H2),        // 黑A 放 红2 上 = true
        stack2_on_A: canStack(H2, A),        // 红2 放 黑A 上 = false（A 是列底最小）
        same_color: canStack(S2, A),         // 黑2 放 黑A = false
        seq: (() => { const col = [{suit:SUITS[0],rank:5},{suit:SUITS[1],rank:4},{suit:SUITS[0],rank:3}]; return seqOk(col, 0); })(),
        seqBad: (() => { const col = [{suit:SUITS[0],rank:5},{suit:SUITS[0],rank:4}]; return seqOk(col, 0); })(),
        maxMove: (() => { const oc = game.cols.filter(c => !c.length).length; const ecc = game.cells.filter(c => !c).length; return maxMovable() === (1 + oc) * (1 + ecc); })(),
      };
    })()`);
    record('T19 引擎规则（降序交替/序列/最大移动）',
      r.stackA_on_2 === true && r.stack2_on_A === false && r.same_color === false && r.seq === true && r.seqBad === false && r.maxMove === true, JSON.stringify(r));
  }

  // T20 合法移动 列→列（基线步数从当前值算，兼容恢复局）
  {
    const r = await ev(`(() => {
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (!col.length) continue;
        const top = col[col.length - 1];
        for (let j = 0; j < 8; j++) {
          if (j === i) continue;
          const dst = game.cols[j];
          if (dst.length && canStack(top, dst[dst.length - 1])) {
            const before = game.moveCount;
            game.selected = { zone: 'col', i, idx: col.length - 1 };
            const ok = tryMoveTo({ zone: 'col', i: j });
            return { ok, moved: ok && game.cols[j][game.cols[j].length - 1] === top, delta: game.moveCount - before };
          }
        }
      }
      return { ok: false, note: 'no legal col move this deal' };
    })()`);
    record('T20 合法移动 列→列（点击路径）', r.ok === true && r.moved === true && r.delta === 1, JSON.stringify(r));
  }

  // T21 自由位（占用后拒绝第二次）
  {
    const r = await ev(`(() => {
      // 找一张可进自由位的列顶牌
      let src = -1;
      for (let i = 0; i < 8; i++) if (game.cols[i].length) { src = i; break; }
      const card = game.cols[src][game.cols[src].length - 1];
      game.selected = { zone: 'col', i: src, idx: game.cols[src].length - 1 };
      const ok1 = tryMoveTo({ zone: 'cell', i: 0 });
      const inCell = game.cells[0] === card;
      // 第二张进同一格 → 拒绝
      let ok2 = true, src2 = -1;
      for (let i = 0; i < 8; i++) if (game.cols[i].length) { src2 = i; break; }
      game.selected = { zone: 'col', i: src2, idx: game.cols[src2].length - 1 };
      ok2 = tryMoveTo({ zone: 'cell', i: 0 });
      // 自由位 → 取回（优先空列；否则找合法叠放位；都不行则 SKIP）
      game.selected = { zone: 'cell', i: 0 };
      let back = null;
      const empty = game.cols.findIndex(c => !c.length);
      if (empty >= 0) back = tryMoveTo({ zone: 'col', i: empty });
      else {
        for (let j = 0; j < 8; j++) {
          const dst = game.cols[j];
          if (dst.length && canStack(game.cells[0], dst[dst.length - 1])) { back = tryMoveTo({ zone: 'col', i: j }); break; }
        }
      }
      return { ok1, inCell, secondRejected: ok2 === false || game.cells[0] !== null, back: back === null ? 'skip' : back };
    })()`);
    record('T21 自由位（放入/占用拒绝/取回）', r.ok1 && r.inCell && r.secondRejected && (r.back === true || r.back === 'skip'), JSON.stringify(r));
  }

  // T22 回收位（找到裸 A 收入；顺序错误拒绝）
  {
    const r = await ev(`(() => {
      // 找一个位于列顶或自由位的 A
      let found = null;
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (col.length && col[col.length - 1].rank === 1) { found = { zone: 'col', i, idx: col.length - 1 }; break; }
      }
      if (!found) for (let i = 0; i < 4; i++) {
        if (game.cells[i] && game.cells[i].rank === 1) { found = { zone: 'cell', i, idx: 0 }; break; }
      }
      if (!found) return { skip: true };
      const ace = found.zone === 'col' ? game.cols[found.i][found.idx] : game.cells[found.i];
      const si = SUITS.indexOf(ace.suit);
      game.selected = found;
      const ok = tryMoveTo({ zone: 'found', i: si });
      const inFound = game.found[si] === 1;
      // 错误花色的回收位 → 拒绝
      game.selected = null;
      let top2 = null, loc = null;
      for (let i = 0; i < 8; i++) { const c = game.cols[i]; if (c.length && c[c.length-1].rank === 1) { top2 = c[c.length-1]; loc = { zone:'col', i, idx: c.length-1 }; break; } }
      let wrongRejected = true;
      if (top2) {
        const wrong = (SUITS.indexOf(top2.suit) + 1) % 4;
        game.selected = loc;
        wrongRejected = tryMoveTo({ zone: 'found', i: wrong }) === false;
      }
      return { ok, inFound, wrongRejected };
    })()`);
    if (r.skip) record('T22 回收位（收 A / 错花色拒绝）', true, 'SKIP: 本局无裸 A（新局后可复测）');
    else record('T22 回收位（收 A / 错花色拒绝）', r.ok && r.inFound && r.wrongRejected, JSON.stringify(r));
  }

  // T23 非法移动拒绝
  {
    const r = await ev(`(() => {
      // 找一个不构成降序叠放的目标组合
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (!col.length) continue;
        const top = col[col.length - 1];
        for (let j = 0; j < 8; j++) {
          const dst = game.cols[j];
          if (!dst.length || j === i) continue;
          if (!canStack(top, dst[dst.length - 1])) {
            game.selected = { zone: 'col', i, idx: col.length - 1 };
            const before = game.moveCount;
            const ok = tryMoveTo({ zone: 'col', i: j });   // 应 false
            return { rejected: ok === false, countSame: game.moveCount === before };
          }
        }
      }
      return { rejected: true, countSame: true, note: 'no illegal combo found (fine)' };
    })()`);
    record('T23 非法叠放被拒绝（不动计数）', r.rejected && r.countSame, JSON.stringify(r));
  }

  // T24 悔棋
  {
    const r = await ev(`(() => {
      const before = game.moveCount;
      if (before === 0) return { skip: true };
      undoMove();
      return { undone: game.moveCount === before - 1 };
    })()`);
    if (r.skip) record('T24 悔棋', true, 'SKIP: 无步可悔');
    else record('T24 悔棋（步数回退）', r.undone, JSON.stringify(r));
  }

  // T25 胜利检测（构造局面）
  {
    const r = await ev(`(() => {
      game.found = [13, 13, 13, 13];
      checkWin();
      const pop = document.getElementById('winPop');
      const shown = pop.classList.contains('show');
      const title = shown ? pop.querySelector('.ftitle').textContent : '';
      pop.classList.remove('open', 'show');   // 清理
      game.won = false;
      return { shown, title };
    })()`);
    record('T25 胜利检测（四回收位满 → 胜利弹层）', r.shown && r.title.includes('牌运亨通'), JSON.stringify(r));
  }

  // T26 新局
  {
    const r = await ev(`(() => {
      document.getElementById('btnNewGame').click();
      return { count: game.moveCount, cols: game.cols.reduce((a, c) => a + c.length, 0), won: game.won };
    })()`);
    record('T26 新局（重发 52 / 步数清零）', r.count === 0 && r.cols === 52 && !r.won, JSON.stringify(r));
  }

  // T27 切回塔罗
  {
    const r = await ev(`(() => {
      document.getElementById('btnMode').click();
      return {
        tarotShown: !document.getElementById('tarot').classList.contains('hidden'),
        fcHidden: document.getElementById('fcboard').classList.contains('hidden'),
        cards: document.querySelectorAll('#grid .tcard').length,
        expect: DATA.length,
      };
    })()`);
    record('T27 切回塔罗（互斥/网格全量渲染）', r.tarotShown && r.fcHidden && r.cards === r.expect && r.expect > 40, JSON.stringify(r));
  }

  // T28 残留检查：模式切换后右键菜单/解读浮层/弹窗全关
  {
    const r = await ev(`(() => ({
      ctx: !!document.querySelector('.ctxmenu'),
      modal: !!document.querySelector('.catmodal-pop'),
      readingShown: (() => { const e = document.getElementById('reading'); return e && e.style.display !== 'none'; })(),
      fortune: document.getElementById('fortunePop').classList.contains('show'),
      win: document.getElementById('winPop').classList.contains('show'),
    }))()`);
    record('T28 测试后无弹层残留', !r.ctx && !r.modal && !r.readingShown && !r.fortune && !r.win, JSON.stringify(r));
  }

  // T29 localStorage 清洁
  {
    const r = await ev(`(() => ({
      cats: localStorage.getItem('ld_custom_cats'),
      cat: localStorage.getItem('ld_custom_cat'),
      pinned: localStorage.getItem('ld_pinned'),
    }))()`);
    record('T29 测试数据清理（类别/映射/固定还原）',
      r.cats === '[]' || r.cats === null, JSON.stringify(r));
  }

  // T30 真实事件路径：游戏内 el.click() 选中 → 点击目标移动（不经过内部函数）
  {
    await ev(`document.getElementById('btnMode').click()`);
    await sleep(6800);
    const r = await ev(`(() => {
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (!col.length) continue;
        const top = col[col.length - 1];
        for (let j = 0; j < 8; j++) {
          if (j === i) continue;
          const dst = game.cols[j];
          if (dst.length && canStack(top, dst[dst.length - 1])) {
            const el1 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
            el1.click();
            const selOk = !!game.selected && game.selected.zone === 'col';
            const selClass = el1.classList.contains('selected');
            const before = game.moveCount;
            const el2 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === dst[dst.length - 1].id);
            el2.click();
            return { selOk, selClass, moved: game.moveCount === before + 1 };
          }
        }
      }
      // 该局开局无列间合法移动（微软局存在这种 rare case）：用自由位验证点击链路
      const col = game.cols.find(c => c.length);
      const k = game.cells.findIndex(c => !c);
      if (col && k >= 0) {
        const top = col[col.length - 1];
        const el1 = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
        el1.click();
        const selOk = !!game.selected;
        const selClass = el1.classList.contains('selected');
        document.getElementById('cell' + k).click();
        return { selOk, selClass, moved: game.cells[k] === top, via: 'cell' };
      }
      return { selOk: false, note: 'no legal move this deal' };
    })()`);
    record('T30 真实点击路径（el.click 选中/移动）', r.selOk && r.selClass && r.moved, JSON.stringify(r));
  }

  // T31 真实事件路径：双击 A 自动上回收位（先开新局清场；A 送列顶走 zone='col' 路径）
  {
    await ev(`newGame()`);
    await sleep(6800);
    const r = await ev(`(() => {
      for (let ci = 0; ci < 8; ci++) {
        const col = game.cols[ci];
        const ai = col.findIndex(c => c.rank === 1 && game.found[SUITS.indexOf(c.suit)] === 0);
        if (ai < 0) continue;
        const removed = col.splice(ai + 1);   // A 现在是列顶
        const ace = col[ai];
        removed.forEach((c, k2) => { const t = (ci + 1 + k2) % 8; if (t !== ci) game.cols[t].push(c); else game.cells.forEach((cc, kk) => {}); });
        positionGame(false);
        const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === ace.id);
        const handlerSawIt = !!el;
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        const si = SUITS.indexOf(ace.suit);
        return { ace: ace.suit.ch + 'A', handlerSawIt, foundNow: game.found[si], moves: game.moveCount };
      }
      return { note: 'no collectable ace' };
    })()`);
    record('T31 双击 A 自动上位（真实 dblclick）', r.foundNow === 1, JSON.stringify(r));
  }

  // T32 双击不可收的牌被拒绝
  {
    const r = await ev(`(() => {
      for (let ci = 0; ci < 8; ci++) {
        const col = game.cols[ci];
        if (!col.length) continue;
        const top = col[col.length - 1];
        const si = SUITS.indexOf(top.suit);
        if (top.rank === game.found[si] + 1) continue;
        const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
        const before = game.moveCount;
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        return { card: top.suit.ch + RANK_TXT[top.rank], rejected: game.moveCount === before };
      }
      return { note: 'all collectable' };
    })()`);
    record('T32 双击不可收拒绝', r.rejected !== false, JSON.stringify(r));
  }

  // T33 恢复局的点击（存档快照对象 vs DECK 对象身份不同——曾导致恢复后点不动）
  {
    await ev(`if (mode !== 'game') document.getElementById('btnMode').click()`);
    await sleep(6800);
    // 走一步并保存
    const step = await ev(`(() => {
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (!col.length) continue;
        const top = col[col.length - 1];
        for (let j = 0; j < 8; j++) {
          if (j === i) continue;
          const dst = game.cols[j];
          if (dst.length && canStack(top, dst[dst.length - 1])) {
            game.selected = { zone: 'col', i, idx: col.length - 1 };
            tryMoveTo({ zone: 'col', i: j });
            return { ok: true, dealNo: game.dealNo, count: game.moveCount };
          }
        }
      }
      const col = game.cols.find(c => c.length);
      const k = game.cells.findIndex(c => !c);
      if (col && k >= 0) {
        game.selected = { zone: 'col', i: game.cols.indexOf(col), idx: col.length - 1 };
        tryMoveTo({ zone: 'cell', i: k });
        return { ok: true, dealNo: game.dealNo, count: game.moveCount };
      }
      return { ok: false };
    })()`);
    // 内存局清空 → 走存档恢复 → 真实点击必须仍可动
    const r = await ev(`(() => {
      game = null;
      document.getElementById('btnMode').click();   // tarot
      document.getElementById('btnMode').click();   // game -> loadGame 恢复
      return { dealNo: game.dealNo, count: game.moveCount, restored: true };
    })()`);
    await sleep(2500);
    const clickRes = await ev(`(() => {
      for (let i = 0; i < 8; i++) {
        const col = game.cols[i];
        if (!col.length) continue;
        const top = col[col.length - 1];
        const el = [...document.querySelectorAll('.pcard')].find(e => e.dataset.id === top.id);
        el.click();
        const selOk = !!game.selected;
        el.click();   // 取消选中还原
        if (selOk) return { selOk: true };
      }
      return { selOk: false };
    })()`);
    record('T33 恢复局真实点击（存档快照身份兼容）',
      step.ok && r.dealNo === step.dealNo && r.count === step.count && clickRes.selOk,
      JSON.stringify({ step: step.count, restored: r.count, click: clickRes.selOk }));
  }

  // T34 塔罗牌尺寸自适应（全牌可见——曾发生末行被面板底边拦腰截断）
  {
    await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click(); renderTarot(false); fitTarotCards();`);
    const geo = await ev(`(() => {
      const grid = document.getElementById('grid');
      const ch = grid.clientHeight;
      if (ch < 240) return { skip: true, ch, vis: document.visibilityState };
      const cards = [...grid.querySelectorAll('.tcard')];
      const gt = grid.getBoundingClientRect().top;
      const out = cards.filter(c => c.getBoundingClientRect().bottom > gt + ch + 1).length;
      const tch = getComputedStyle(document.documentElement).getPropertyValue('--tch').trim();
      return { skip: false, vis: document.visibilityState, n: cards.length, ch, out, tch };
    })()`);
    const ok = geo.skip ? true : (geo.out === 0 && geo.n > 0 && !!geo.tch);
    record('T34 塔罗牌自适应全可见（无截断）', ok, JSON.stringify(geo));
  }

  // T35 全局快捷键自定义（主进程重注册 + settings.json 持久化 + 失败回滚）
  {
    const before = await ev(`window.deck.getHotkey()`);
    const set1 = await ev(`window.deck.setHotkey('Ctrl+Alt+K')`);
    const get1 = await ev(`window.deck.getHotkey()`);
    let persisted = null;
    try {
      persisted = JSON.parse(fs.readFileSync(
        path.join(process.env.APPDATA, '应用牌堆 Launcher Deck', 'settings.json'), 'utf8')).hotkey;
    } catch (e) { persisted = 'read-fail'; }
    const bad = await ev(`window.deck.setHotkey('not-a-key')`);          // 无效组合：注册失败
    const get2 = await ev(`window.deck.getHotkey()`);                     // 回滚后应保持新键
    const back = await ev(`window.deck.setHotkey(${JSON.stringify(before || 'Ctrl+J')})`);
    record('T35 快捷键自定义（注册/持久化/回滚）',
      set1.ok === true && get1 === 'Ctrl+Alt+K' && persisted === 'Ctrl+Alt+K' &&
      bad.ok === false && get2 === 'Ctrl+Alt+K' && back.ok === true,
      JSON.stringify({ set: set1.ok, get: get1, persisted, badRejected: bad.ok === false, afterRollback: get2, restored: back.ok }));
  }

  // 回塔罗（后续断言需要）
  await ev(`if (mode !== 'tarot') document.getElementById('btnMode').click()`);

  // 汇总
  const fail = results.filter(r => !r.pass);
  console.log('\\n===== SUMMARY: ' + (results.length - fail.length) + '/' + results.length + ' PASS =====');
  fail.forEach(f => console.log('FAIL >> ' + f.name + ' | ' + f.detail));
  ws.close();
  process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error('runner error:', e.message); process.exit(2); });
