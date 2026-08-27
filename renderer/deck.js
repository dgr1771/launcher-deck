/* ============================================================
   Launcher Deck — 塔罗牌阵（启动）+ 空当接龙（游戏）
   启动模式：塔罗网格，全牌可见无遮挡，悬停翻面、点击启动。
   游戏模式：标准 FreeCell（纯游戏，不可启动应用）。
   52 张 = 48 应用牌（频率→点数，A=最常用）+ 4 张 Joker 金牌(K)。
   开局洗牌动画 → 发牌；序列移动/自由位/回收位/悔棋/胜利。
   ============================================================ */
'use strict';

const APPX_ALLOW = /^(Calculator|Photos|Paint\.?|MSPaint|SnippingTool|ScreenSketch|StickyNotes|WindowsTerminal|Notepad|MediaPlayer|ZuneMusic|ZuneVideo|PhoneExperience|YourPhone|OutlookForWindows)$/i;
function rawApps(all) {
  return (all || []).filter(a => {
    if (a.src !== 'appx') return true;
    return APPX_ALLOW.test((a.name || '').split('.').pop());
  });
}

// ---------- 分类（塔罗花色） ----------
const CATS = [
  { id: 'social',  suit: '♦', icon: '♦', name: '社交通讯',
    kw: ['微信','weixin','wechat','qq','telegram','discord','dingtalk','钉钉','feishu','飞书','lark','skype','mail','邮件','会议','meeting','zoom','teams','message','短信','联系'] },
  { id: 'media',   suit: '♣', icon: '♣', name: '影音创作',
    kw: ['视频','音乐','music','video','player','播放','photo','图片','图像','photoshop','美图','obs','blender','potplayer','vlc','netease','网易云','wallpaper','壁纸','ffmpeg','cam','摄像','录屏','剪辑','剪映','画图','paint','相册','audio','声','电台','直播','steam','game','游戏','米哈游','mihoyo','崩坏','原神','星穹'] },
  { id: 'browser', suit: '♥', icon: '♥', name: '浏览器',
    kw: ['browser','chrome','edge','firefox','opera','brave','vivaldi','浏览器','bing'] },
  { id: 'dev',     suit: '♠', icon: '♠', name: '开发工具',
    kw: ['git','code','coding','node','python','jdk','java','docker','wsl','terminal','终端','vscode','idea','studio','android','sdk','flutter','dart','rust','gcc','conda','jupyter','postman','navicat','dbeaver','typora','notepad++','vim','sublime','xshell','putty','scrcpy','adb','zcode','obsidian','cursor','trae','webstorm','pycharm','rustrover','claude','chatgpt','ollama','copilot','lean','latex','texlive','scoop','winget','hex','api','json','ssh','ftp','server','nginx','mysql','redis','mongodb','postgres','数据库','编译','build','openjdk','ripgrep'] },
  { id: 'tool',    suit: '⭐', icon: '⭐', name: '效率工具',
    kw: ['压缩','zip','rar','7-zip','bandizip','下载','idm','thunder','迅雷','pdf','foxit','sumatra','office','word','excel','powerpoint','wps','notion','everything','listary','powertoys','traffic','fence','截图','snip','计算器','calculator','日历','calendar','weather','天气','ai','gpt','豆包','kimi','deepseek','塔罗','tarot','看板','dashboard','透明','todo','待办','笔记','note','翻译','translat','输入法','ime','键盘','keyboard','vocotype','ocr','clock','时钟','guardian','管家'] },
  { id: 'system',  suit: '⚙', icon: '⚙', name: '系统组件',
    kw: ['driver','runtime','intel','nvidia','amd','realtek','sound','bluetooth','display','chipset','update','卸载','uninstall','visual','directx','opencl','openal','onedrive','xbox','sync','互联','share','host','provider','extension','identity','solitaire','recorder'] },
];
const CAT_MISC = { id: 'misc', suit: '✦', icon: '✦', name: '未名之牌' };

// ---------- 自定义类别（用户可新建花色） ----------
function getCustomCatList() {
  try { return JSON.parse(localStorage.getItem('ld_custom_cats') || '[]'); } catch (e) { return []; }
}
function setCustomCatList(list) {
  try { localStorage.setItem('ld_custom_cats', JSON.stringify(list)); } catch (e) {}
}
function addCustomCat(icon, name) {
  const list = getCustomCatList();
  const id = 'c' + Date.now().toString(36);
  list.push({ id, icon, name });
  setCustomCatList(list);
  return { id, icon, name };
}
function removeCustomCat(id) {
  setCustomCatList(getCustomCatList().filter(c => c.id !== id));
  // 该类别下的程序恢复自动分类
  const m = getCustomCats();
  let touched = false;
  for (const name of Object.keys(m)) {
    if (m[name] === id) { delete m[name]; touched = true; }
  }
  if (touched) try { localStorage.setItem('ld_custom_cat', JSON.stringify(m)); } catch (e) {}
}
/** 全部类别 = 内置 + 自定义 + 未名之牌（永远最后）；自定义类别的花色角标 = 其图标 */
function allCats() {
  return [
    ...CATS,
    ...getCustomCatList().map(c => ({ ...c, suit: c.icon })),
    CAT_MISC,
  ];
}
function catById(id) {
  return allCats().find(c => c.id === id);
}

// ---------- 自定义归类（拖牌到花色标签；localStorage 持久化） ----------
function getCustomCats() {
  try { return JSON.parse(localStorage.getItem('ld_custom_cat') || '{}'); } catch (e) { return {}; }
}
function setCustomCat(name, catId) {
  const m = getCustomCats();
  if (catId === null) delete m[name];
  else m[name] = catId;
  try { localStorage.setItem('ld_custom_cat', JSON.stringify(m)); } catch (e) {}
}
function catOf(a) {
  const custom = getCustomCats()[a.name];
  if (custom) {
    const c = catById(custom);
    if (c) return c;
  }
  const s = ((a.name || '') + ' ' + (a.pub || '') + ' ' + (a.exe || '')).toLowerCase();
  for (const c of CATS) {
    for (const k of c.kw) {
      if (s.includes(k.toLowerCase())) return c;
    }
  }
  return CAT_MISC;
}

// ---------- 牌意 ----------
const DIV = {
  social:  ['信使之牌：今日有远音入宅，宜速回。', '此牌主连结——一根线牵起千里之外。', '交际之牌，宜言事宜叙旧。'],
  media:   ['幻象之牌：声色充盈，宜放松不宜沉溺。', '此牌主沉浸——入梦一程，醒来更清醒。', '灵感之牌，色彩今日偏爱你。'],
  browser: ['通行之牌：千万页卷宗，一触即达。', '此牌主通达——门开着，路是宽的。'],
  dev:     ['契约与建造之牌：代码成塔之日，bug 退散之时。', '此牌主锻造——今日所敲之键，皆为地基。', '匠人之牌，宜重构，宜提交。'],
  tool:    ['器利之牌：工欲善其事，此牌今日偏灵。', '此牌主秩序——杂物归位，诸事顺遂。', '勤勉之牌，小事顺手，大事可期。'],
  system:  ['基石之牌：深埋地底，无声承重。', '此牌主稳固——不动如山，万物赖之。'],
  misc:    ['无名之牌：缘分未到，或未可知。', '此牌悬而未决——留着，自有用处的一天。'],
};
function divination(a, i) {
  const cat = catOf(a);
  let arr = DIV[cat.id];
  if (!arr) {
    // 自定义类别的通用牌意
    const nm = (cat.name || '此牌');
    arr = [
      `${nm}之牌：此位由你亲手开辟，其意由你赋予。`,
      `${nm}之牌：归于此列的，都是你钦点的缘分。`,
      `自定义之位——牌随心走，${nm}由你不由天。`,
    ];
  }
  const s = (a.name || '') + (a.pub || '');
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return arr[(h + (i || 0)) % arr.length];
}

// ---------- 音效 ----------
const Sound = (() => {
  let ctx = null, enabled = true;
  try { enabled = localStorage.getItem('ld_sound') !== '0'; } catch (e) {}
  function ac() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function tone(freq, dur, opts) {
    if (!enabled) return;
    const { type = 'sine', gain = 0.06, delay = 0 } = opts || {};
    try {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  return {
    deal()   { tone(1500 + Math.random() * 600, 0.05, { type: 'triangle', gain: 0.028 }); },
    flip()   { tone(880, 0.07, { type: 'square', gain: 0.02 }); tone(1320, 0.05, { type: 'square', gain: 0.016, delay: 0.045 }); },
    move()   { tone(660, 0.06, { type: 'triangle', gain: 0.03 }); },
    bad()    { tone(220, 0.09, { type: 'sawtooth', gain: 0.02 }); },
    wash(i)  { tone(700 + Math.random() * 500, 0.045, { type: 'triangle', gain: 0.025, delay: i * 0.09 }); },
    land()   { tone(523.25, 0.12); tone(659.25, 0.14, { delay: 0.09 }); tone(783.99, 0.22, { delay: 0.18 }); },
    fortune(){ [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, { gain: 0.05, delay: i * 0.09 })); },
    win()    { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.35, { gain: 0.055, delay: i * 0.12 })); },
    toggle() { enabled = !enabled; try { localStorage.setItem('ld_sound', enabled ? '1' : '0'); } catch (e) {} return enabled; },
    get enabled() { return enabled; },
  };
})();

function burst(x, y, n) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '96,165,250';
  const colors = ['#ffd782', '#ffffff', `rgb(${accent.trim()})`];
  for (let i = 0; i < (n || 14); i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = 36 + Math.random() * 66;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 26;
    try {
      p.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy + 46}px) scale(.15)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.4,1)' })
        .finished.then(() => p.remove()).catch(() => p.remove());
    } catch (e) { p.remove(); }
  }
}

// ---------- 基础 ----------
const $ = (id) => document.getElementById(id);
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const SUITS = [
  { id: 'S', ch: '♠', red: false, name: '黑桃' },
  { id: 'H', ch: '♥', red: true,  name: '红心' },
  { id: 'D', ch: '♦', red: true,  name: '方块' },
  { id: 'C', ch: '♣', red: false, name: '梅花' },
];
const RANK_TXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let DATA = [];
let DECK = [];
let mode = 'tarot';            // 'tarot' | 'game'

// FreeCell 布局常量
const CW = 92, CH = 128, COLS = 8;
const TOP_Y = 6, COL_Y = 148, STACK = 30;
let boardW = 1240;
function colX(i) { return 24 + i * ((boardW - 48 - CW * COLS) / (COLS - 1) + CW); }

// ---------- 牌构建（频率 → 点数） ----------
function buildDeck() {
  // 局中冻结：游戏界面内不重建（进行中的一局牌面身份不可变；再进游戏会重新发牌）
  if (DECK.length === 52 && mode === 'game' && game && !game.won) return;

  const sorted = DATA.slice().sort((a, b) =>
    (b.count - a.count) || (b.last - a.last) || (a.name || '').localeCompare(b.name || '', 'zh'));
  DECK = [];
  for (let i = 0; i < 48; i++) {
    const suit = SUITS[i % 4];
    const rank = Math.floor(i / 4) + 1;
    if (sorted[i]) {
      DECK.push({ id: 'a' + i, suit, rank, app: sorted[i], joker: false });
    } else {
      // 应用不足 48：空缺点位用「待遇见」补位牌，保证牌副满 52（微软发牌需要完整牌副）
      DECK.push({ id: 'p' + i, suit, rank, app: null, joker: true });
    }
  }
  for (let s = 0; s < 4; s++) {
    DECK.push({ id: 'j' + s, suit: SUITS[s], rank: 13, app: null, joker: true });
  }
  // 重扫会重建牌对象：废弃旧牌 DOM 缓存（旧元素闭包抓着旧对象，会点击失联）
  if (cardEls.size) {
    cardEls.forEach(el => el.remove());
    cardEls.clear();
  }
}

// ============================================================
// 塔罗牌阵（启动模式）
// ============================================================
let filterCat = 'all';
let searchQ = '';

// ---------- 工具栏 SVG 线性图标（emoji 跨 Windows 版本渲染不一） ----------
const IC = {
  gamepad: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="11" r=".5"/><circle cx="18" cy="13.5" r=".5"/><path d="M17.3 5H6.7a4.7 4.7 0 0 0-4.65 5.4l.9 5A2.9 2.9 0 0 0 7.8 17L9.5 15h5l1.7 2a2.9 2.9 0 0 0 4.85-1.6l.9-5A4.7 4.7 0 0 0 17.3 5z"/></svg>',
  deck: '<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="3" width="10" height="14" rx="2"/><path d="M15 6.5l3 .8a2 2 0 0 1 1.4 2.4L17.6 19"/></svg>',
  volume: '<svg class="ic" viewBox="0 0 24 24"><path d="M11.5 5.5L7 9H4v6h3l4.5 3.5v-13z"/><path d="M15 9a4.2 4.2 0 0 1 0 6M17.8 6.5a8 8 0 0 1 0 11"/></svg>',
  mute: '<svg class="ic" viewBox="0 0 24 24"><path d="M11.5 5.5L7 9H4v6h3l4.5 3.5v-13z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};

// ---------- 拼音首字母/全拼（中文应用名兜底搜索，PowerToys 式体验） ----------
let PY_OK = false;
try { PY_OK = typeof pinyinPro !== 'undefined'; } catch (e) {}
function buildPinyin() {
  if (!PY_OK) return;
  DATA.forEach(a => {
    try {
      const o = { toneType: 'none', type: 'array', nonZh: 'consecutive' };
      a.pyFull = pinyinPro.pinyin(a.name || '', o).join('').replace(/\s+/g, '').toLowerCase();
      a.pyInit = pinyinPro.pinyin(a.name || '', Object.assign({ pattern: 'first' }, o)).join('').replace(/\s+/g, '').toLowerCase();
    } catch (e) { /* 单个名称转换失败不影响其余 */ }
  });
}

// ---------- 置顶与热度（常用置顶区：手动 pin + 频率×时间衰减自动补位） ----------
const PIN_KEY = 'ld_pinned';
function getPinned() { try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (e) { return []; } }
function isPinned(name) { return getPinned().includes(name); }
function togglePin(name) {
  const cur = getPinned();
  const i = cur.indexOf(name);
  if (i >= 0) cur.splice(i, 1); else cur.push(name);
  try { localStorage.setItem(PIN_KEY, JSON.stringify(cur)); } catch (e) {}
}
// 热度分：次数 × 时间衰减（7 天内 1.0，其后每周 ×0.75，下限 0.1）——近期用得多排更前，冷宫应用自然下沉
function appScore(a) {
  const days = (Date.now() - (a.last || 0)) / 86400000;
  const decay = Math.max(0.1, Math.pow(0.75, Math.max(0, days - 7) / 7));
  return (a.count || 0) * decay;
}

function tcardHTML(a, isTop) {
  const c = catOf(a);
  const custom = !!getCustomCats()[a.name];
  const meta = [a.pub, a.ver && ('v' + a.ver), a.date].filter(Boolean).join(' · ');
  const badge = a.count > 0 ? `<div class="usebadge">★${a.count}</div>` : '';
  const customMark = custom ? `<div class="custombadge" title="自定义归类（拖到其它花色可改，拖到未名之牌恢复自动）">◈</div>` : '';
  const pinned = isPinned(a.name);
  return `
  <div class="tcard${custom ? ' tcard--custom' : ''}${isTop ? ' tcard--top' : ''}${pinned ? ' tcard--pinned' : ''}" draggable="true" data-name="${escapeHTML(a.name)}">
    ${badge}${customMark}${pinned ? '<div class="pinbadge" title="已置顶（右键可取消）">📌</div>' : ''}
    <div class="lift">
      <div class="inner">
        <div class="face back" data-suit="${c.suit}">
          ${a.icon ? `<img class="appicon" src="${a.icon}">` : `<div class="appicon-fallback">${escapeHTML((a.name || '?').charAt(0))}</div>`}
          <div class="backname">${escapeHTML(a.name || '')}</div>
        </div>
        <div class="face front">
          ${a.icon ? `<img class="appicon" src="${a.icon}">` : `<div class="appicon-fallback">${escapeHTML((a.name || '?').charAt(0))}</div>`}
          <div class="fname">${escapeHTML(a.name || '')}</div>
          <div class="fmeta">${escapeHTML(meta || '本机程序')}</div>
          <button class="launch">启 动</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ---------- 解读浮层（悬停半秒出现，牌意大字展示） ----------
let readingEl = null;
let readingTimer = null;

function showReading(a, rect) {
  if (!readingEl) {
    readingEl = document.createElement('div');
    readingEl.id = 'reading';
    readingEl.className = 'reading';
    document.body.appendChild(readingEl);
  }
  const c = catOf(a);
  const meta = [a.pub, a.ver && ('v' + a.ver), a.date].filter(Boolean).join(' · ');
  readingEl.innerHTML = `
    <div class="reading__head">
      ${a.icon ? `<img src="${a.icon}" alt="">` : `<div class="reading__ph">${escapeHTML((a.name || '?').charAt(0))}</div>`}
      <div class="reading__title">
        <div class="reading__name">${escapeHTML(a.name || '')}</div>
        <div class="reading__cat">${c.suit} ${c.name}${a.count > 0 ? ` · 已启用 ★${a.count}` : ''}</div>
      </div>
    </div>
    <div class="reading__div">${escapeHTML(divination(a, 0))}</div>
    ${meta ? `<div class="reading__meta">${escapeHTML(meta)}</div>` : ''}
    <div class="reading__tip">点击牌面 · 启动</div>`;
  readingEl.style.display = 'block';   // 先显示再测量尺寸（CSS 基态 display:none）

  // 定位：牌右侧 12px，越界放左侧；垂直 clamp 在面板内
  const W = readingEl.offsetWidth, H = readingEl.offsetHeight;
  let x = rect.right + 14;
  if (x + W > window.innerWidth - 16) x = rect.left - W - 14;
  if (x < 16) x = Math.max(16, window.innerWidth - W - 16);
  let y = rect.top - 6;
  if (y + H > window.innerHeight - 16) y = window.innerHeight - H - 16;
  if (y < 16) y = 16;
  readingEl.style.left = x + 'px';
  readingEl.style.top = y + 'px';
  readingEl.style.display = 'block';   // 先显示再测量尺寸（CSS 基态 display:none）
  later(() => readingEl.classList.add('open'));
}

function hideReading() {
  clearTimeout(readingTimer);
  readingTimer = null;
  if (readingEl) {
    readingEl.classList.remove('open');
    readingEl.style.display = 'none';
  }
}

// ---------- 右键归类菜单（显式入口） ----------
let ctxMenu = null;

function closeCatMenu() {
  if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}

function showCatMenu(a, x, y) {
  closeCatMenu();
  ctxMenu = document.createElement('div');
  ctxMenu.className = 'ctxmenu';
  const cur = catOf(a).id;
  const custom = !!getCustomCats()[a.name];
  const items = [
    ...allCats().map(c => ({ id: c.id, icon: c.icon, name: c.id === 'misc' ? '未名之牌（恢复自动）' : c.name })),
  ];
  ctxMenu.innerHTML = `
    <div class="ctxmenu__title">「${escapeHTML(a.name)}」归类到</div>
    <div class="ctxmenu__item" data-act="pin">${isPinned(a.name) ? '📌 取消置顶（回牌阵）' : '📌 置顶到常用区'}</div>
    <div class="ctxmenu__sep"></div>
    ${items.map(it => `
      <div class="ctxmenu__item${it.id === cur ? ' on' : ''}" data-cat="${it.id}">
        <span>${it.icon} ${it.name}</span>
        <span class="ctxmenu__mark">${it.id === cur ? (custom ? '◈ 自定义' : '● 自动') : ''}</span>
      </div>`).join('')}
    <div class="ctxmenu__sep"></div>
    <div class="ctxmenu__item" data-act="launch">🚀 立即启动</div>`;
  document.body.appendChild(ctxMenu);

  // 定位（避让边缘）
  const W = ctxMenu.offsetWidth, H = ctxMenu.offsetHeight;
  let mx = x, my = y;
  if (mx + W > window.innerWidth - 12) mx = window.innerWidth - W - 12;
  if (my + H > window.innerHeight - 12) my = window.innerHeight - H - 12;
  ctxMenu.style.left = mx + 'px';
  ctxMenu.style.top = my + 'px';
  const menuEl = ctxMenu;   // 本地捕获：菜单秒关后模块变量会被置 null，rAF 竞态曾刷 Uncaught TypeError
  requestAnimationFrame(() => menuEl.classList.add('open'));

  ctxMenu.addEventListener('click', (e) => {
    const it = e.target.closest('.ctxmenu__item');
    if (!it) return;
    if (it.dataset.act === 'pin') {
      togglePin(a.name);
      Sound.land();
      toast(isPinned(a.name)
        ? `「${escapeHTML(a.name)}」已置顶到常用区`
        : `「${escapeHTML(a.name)}」已取消置顶`);
      closeCatMenu();
      renderTarot(false);
      return;
    }
    if (it.dataset.act === 'launch') {
      closeCatMenu();
      Sound.land();
      doLaunch(a);
      return;
    }
    const targetId = it.dataset.cat;
    const reset = targetId === 'misc';
    setCustomCat(a.name, reset ? null : targetId);
    const c = catById(targetId);
    Sound.land();
    toast(reset
      ? `「${escapeHTML(a.name)}」已恢复自动分类`
      : `「${escapeHTML(a.name)}」已归入 ${c.icon} ${c.name}`);
    closeCatMenu();
    renderTarot(false);
  });
  ctxMenu.addEventListener('contextmenu', (e) => e.preventDefault());
  Sound.flip();
}

// 全局关闭：点别处 / Esc
document.addEventListener('mousedown', (e) => {
  if (ctxMenu && !ctxMenu.contains(e.target)) closeCatMenu();
}, true);
document.addEventListener('click', (e) => {
  if (ctxMenu && !ctxMenu.contains(e.target)) closeCatMenu();
}, true);

// ---------- 新建分类弹层 / 删除确认 ----------
const CAT_ICONS = ['🎮', '🎨', '💰', '🕹️', '🧩', '🎯', '🔮', '🌙', '☀️', '🍀', '🧿', '🀄', '📚', '🎧', '🛒', '🧭'];

function openCatModal() {
  let modal = document.getElementById('catModal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'catModal';
  modal.className = 'catmodal-pop';
  modal.innerHTML = `
    <div class="catmodal">
      <div class="catmodal__title">🎴 新建分类</div>
      <input class="catmodal__input" id="catNameInput" type="text" maxlength="8" placeholder="分类名称（如：游戏）">
      <div class="catmodal__icons" id="catIconPick">
        ${CAT_ICONS.map((ic, i) => `<span class="ci${i === 0 ? ' on' : ''}" data-icon="${ic}">${ic}</span>`).join('')}
      </div>
      <div class="catmodal__hint">新建后可与内置花色一样：拖牌/右键归类、点击筛选</div>
      <div class="catmodal__btns">
        <button class="plain" data-act="cancel">取消</button>
        <button data-act="ok">创 建</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  later(() => modal.classList.add('open'));
  Sound.flip();

  let pickedIcon = CAT_ICONS[0];
  modal.querySelector('#catIconPick').addEventListener('click', (e) => {
    const s = e.target.closest('.ci');
    if (!s) return;
    modal.querySelectorAll('.ci').forEach(x => x.classList.remove('on'));
    s.classList.add('on');
    pickedIcon = s.dataset.icon;
    Sound.flip();
  });
  const input = modal.querySelector('#catNameInput');
  later(() => input.focus());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') modal.querySelector('[data-act="ok"]').click(); });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) { closeCatModal(); return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'cancel') { closeCatModal(); return; }
    const name = input.value.trim();
    if (!name) { input.focus(); toast('请输入分类名称'); return; }
    const dup = allCats().some(c => c.name === name);
    if (dup) { toast('已存在同名分类'); return; }
    addCustomCat(pickedIcon, name);
    closeCatModal();
    Sound.land();
    toast(`新花色诞生：${pickedIcon} ${escapeHTML(name)}`);
    filterCat = 'all';
    buildChips();
    renderTarot(false);
  });
}
function closeCatModal() {
  const m = document.getElementById('catModal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 180); }
}

function confirmDelCat(c) {
  let m = document.getElementById('delCatModal');
  if (m) m.remove();
  m = document.createElement('div');
  m.id = 'delCatModal';
  m.className = 'catmodal-pop';
  m.innerHTML = `
    <div class="catmodal">
      <div class="catmodal__title">${c.icon} 删除「${escapeHTML(c.name)}」？</div>
      <div class="catmodal__hint">该分类下的程序会恢复自动分类，不会丢失。</div>
      <div class="catmodal__btns">
        <button class="plain" data-act="no">取消</button>
        <button data-act="yes">删 除</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  later(() => m.classList.add('open'));
  m.addEventListener('click', (e) => {
    if (e.target === m) { m.remove(); return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'yes') {
      removeCustomCat(c.id);
      if (filterCat === c.id) filterCat = 'all';
      buildChips();
      renderTarot(false);
      Sound.flip();
      toast(`已删除分类「${escapeHTML(c.name)}」，其下程序恢复自动分类`);
    }
    m.remove();
  });
}

// ---------- 主题系统（预设 + 自定义配色/图片背板/牌背，防失真适配） ----------
const THEME_KEY = 'ld_theme';
const DEFAULT_THEME = { preset: 'felt' };
function getTheme() {
  try { return Object.assign({}, DEFAULT_THEME, JSON.parse(localStorage.getItem(THEME_KEY) || '{}')); } catch (e) { return { ...DEFAULT_THEME }; }
}
function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch (e) {
    toast('主题保存失败：图片过大（请换小图）');
  }
}
function applyTheme() {
  const t = getTheme();
  const r = document.documentElement.style;
  // 先清注入，恢复 CSS 默认（felt）
  ['--panel-img', '--panel-bg-color', '--panel-bg-size', '--panel-border', '--panel-blur',
   '--panel-backdrop', '--panel-shadow', '--accent-color',
   '--cardback-img', '--cardback-under', '--cardback-color', '--cardback-size'].forEach(v => r.removeProperty(v));
  // 毛玻璃系预设表：加主题=加一行（深色底漆统一保证浅色壁纸下白字可读）
  const GLASSY = {
    glass: {  // 蓝白玻璃：天蓝→白（Win11 Fluent 取向）
      img: 'linear-gradient(160deg, rgba(59, 130, 246, 0.32) 0%, rgba(241, 245, 249, 0.18) 100%)',
      coat: 'rgba(8, 15, 26, 0.58)', accent: '96, 165, 250',
      back: 'linear-gradient(150deg, rgba(37, 99, 235, 0.52) 0%, rgba(191, 219, 254, 0.24) 100%)',
      backBase: 'rgba(10, 25, 50, 0.78)',
    },
    sakura: {  // 少女心：樱粉→淡紫粉
      img: 'linear-gradient(160deg, rgba(244, 114, 182, 0.32) 0%, rgba(216, 180, 254, 0.20) 100%)',
      coat: 'rgba(22, 10, 20, 0.58)', accent: '244, 114, 182',
      back: 'linear-gradient(150deg, rgba(236, 72, 153, 0.45) 0%, rgba(251, 207, 232, 0.22) 100%)',
      backBase: 'rgba(42, 12, 36, 0.78)',
    },
    sage: {  // 豆沙绿护眼：豆沙绿→米白
      img: 'linear-gradient(160deg, rgba(139, 175, 124, 0.32) 0%, rgba(232, 238, 220, 0.20) 100%)',
      coat: 'rgba(10, 18, 12, 0.55)', accent: '139, 175, 124',
      back: 'linear-gradient(150deg, rgba(106, 144, 80, 0.48) 0%, rgba(215, 230, 196, 0.20) 100%)',
      backBase: 'rgba(16, 34, 22, 0.78)',
    },
  };
  const g = GLASSY[t.preset];
  if (g) {
    r.setProperty('--panel-bg-color', g.coat);
    r.setProperty('--panel-img', g.img);
    r.setProperty('--panel-border', 'rgba(255, 255, 255, 0.5)');
    r.setProperty('--panel-backdrop', 'blur(18px) saturate(160%)');
    r.setProperty('--panel-shadow', 'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 24px 70px rgba(0, 0, 0, 0.45)');
    r.setProperty('--accent-color', g.accent);
    r.setProperty('--cardback-img', 'none');
    r.setProperty('--cardback-under', g.back);
    r.setProperty('--cardback-color', g.backBase);
  }
}

/** 主题弹层：预设 + 自定义配色（图片背板/牌背上传已砍除——用户决策 2026-08-22） */
function openThemeModal() {
  let modal = document.getElementById('themeModal');
  if (modal) modal.remove();
  const t = getTheme();
  modal = document.createElement('div');
  modal.id = 'themeModal';
  modal.className = 'catmodal-pop';
  // 纯预设双主题（自定义配色已按用户决策砍除：配置面最小化）
  modal.innerHTML = `
    <div class="catmodal thememodal">
      <div class="catmodal__title">🎨 外观主题</div>
      <div class="row">
        <label>预设</label>
        <div class="presets">
          <span class="preset${t.preset === 'felt' ? ' on' : ''}" data-preset="felt">🌿 呢绒</span>
          <span class="preset${t.preset === 'glass' ? ' on' : ''}" data-preset="glass">💎 蓝白玻璃</span>
          <span class="preset${t.preset === 'sakura' ? ' on' : ''}" data-preset="sakura">🌸 少女心</span>
          <span class="preset${t.preset === 'sage' ? ' on' : ''}" data-preset="sage">🍵 豆沙绿</span>
        </div>
      </div>
      <div class="catmodal__hint">点选即预览所需主题，「应用」生效</div>
      <div class="catmodal__btns">
        <button class="plain" data-act="reset">恢复默认</button>
        <button data-act="ok">应 用</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  later(() => modal.classList.add('open'));
  Sound.flip();
  modal.querySelectorAll('.preset').forEach(p => p.addEventListener('click', () => {
    modal.querySelectorAll('.preset').forEach(x => x.classList.remove('on'));
    p.classList.add('on');
    // 点选即预览
    setTheme({ preset: p.dataset.preset });
    applyTheme();
  }));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.remove(); return; }
    const btn = e.target.closest('button');
    if (btn && btn.dataset.act === 'reset') {
      setTheme({ ...DEFAULT_THEME });
      applyTheme();
      modal.remove();
      Sound.flip();
      toast('已恢复默认呢绒主题');
      return;
    }
    if (btn && btn.dataset.act === 'ok') {
      const presetEl = modal.querySelector('.preset.on');
      const t2 = getTheme();
      t2.preset = presetEl ? presetEl.dataset.preset : 'felt';
      setTheme(t2);
      applyTheme();
      modal.remove();
      Sound.land();
      toast(t2.preset === 'glass' ? '💎 蓝白玻璃已启用'
          : t2.preset === 'sakura' ? '🌸 少女心已启用'
          : t2.preset === 'sage' ? '🍵 豆沙绿已启用' : '🌿 呢绒已恢复');
      return;
    }
  });
}

// ---------- 全局快捷键自定义（⌨） ----------
function updateHotkeyHint(hk) {
  if (!hk) return;
  const h = $('hint'); if (h) h.textContent = `${hk} 收起 · 悬停看牌面 · 点击启动`;
  const c = $('btnClose'); if (c) c.title = `收起（${hk}）`;
}
// KeyboardEvent → Electron accelerator；返回 null=键不支持，''=缺修饰键
function accFromEvent(e) {
  let key = null;
  const m = e.code.match(/^(?:Key([A-Z])|Digit(\d)|(F(?:1[0-9]|2[0-4]|[2-9])))$/);
  if (m) key = m[1] || m[2] || m[3];
  if (!key || key === 'F4') return null;   // F4 系统保留（Alt+F4 关窗口）
  if (e.metaKey) return 'WIN';   // 哨兵：Win 组合系统保留太多，不收
  const mods = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (!e.ctrlKey && !e.altKey) return '';   // 只有 Shift/裸键会吞打字，不允许
  return mods.concat(key).join('+');
}
async function openHotkeyModal() {
  let modal = document.getElementById('hotkeyModal');
  if (modal) modal.remove();
  const cur = await window.deck.getHotkey().catch(() => 'Ctrl+J');
  modal = document.createElement('div');
  modal.id = 'hotkeyModal';
  modal.className = 'catmodal-pop';
  modal.innerHTML = `
    <div class="catmodal hotkeymodal">
      <div class="catmodal__title">⌨ 全局快捷键</div>
      <div class="hk-cur">当前：<b>${cur}</b></div>
      <div class="hk-box" id="hkCapBox" tabindex="0">点这里，按下新组合键…</div>
      <div class="catmodal__hint">需含 Ctrl / Alt 至少一个修饰键（避免吞掉打字）<br>Esc 取消 · 支持字母 / 数字 / F1-F24</div>
      <div class="catmodal__btns">
        <button class="plain" data-act="reset">恢复默认</button>
        <button data-act="ok" id="hkOk" disabled>应 用</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  later(() => modal.classList.add('open'));
  Sound.flip();
  let captured = null;
  const box = modal.querySelector('#hkCapBox');
  const okBtn = modal.querySelector('#hkOk');
  box.addEventListener('click', () => box.focus());
  box.addEventListener('keydown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { modal.remove(); return; }
    const acc = accFromEvent(e);
    if (acc === 'WIN') { box.textContent = '不支持 Win 组合（系统保留太多），请用 Ctrl / Alt'; return; }
    if (acc === null) { box.textContent = '这个键不支持，换一个（字母 / 数字 / F1-F24）'; return; }
    if (acc === '') { box.textContent = '还需要 Ctrl / Alt 修饰键'; return; }
    captured = acc;
    box.textContent = `将设为：${acc}`;
    okBtn.disabled = false;
  });
  modal.addEventListener('click', async (e) => {
    if (e.target === modal) { modal.remove(); return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'reset') captured = 'Ctrl+J';
    if (!captured) { toast('先在上方框里按下新组合键'); return; }
    const r = await window.deck.setHotkey(captured).catch(() => ({ ok: false, err: '通信失败' }));
    if (r.ok) {
      updateHotkeyHint(r.hotkey);
      modal.remove();
      Sound.land();
      toast(`快捷键已改为 ${r.hotkey}（托盘菜单同步更新）`);
    } else {
      toast(r.err || '设置失败');
      Sound.bad();
    }
  });
}

function renderTarot(deal) {
  let list = DATA.slice();
  if (filterCat !== 'all') list = list.filter(a => catOf(a).id === filterCat);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(a => (((a.name || '') + ' ' + (a.pub || '')).toLowerCase().includes(q)) ||
      (a.pyInit && a.pyInit.includes(q)) || (a.pyFull && a.pyFull.includes(q)));
  }
  // 评分排序：置顶绝对优先 → 热度（次数×时间衰减）→ 名称
  list.forEach(a => { a._score = (isPinned(a.name) ? 1e9 : 0) + appScore(a); });
  list.sort((x, y) => (y._score - x._score) || (x.name || '').localeCompare(y.name || '', 'zh'));

  // 常用置顶区：手动 pin 全上（无视花色过滤——用户意图优先）；热度自动补位只在"全部"视图
  // （过滤小花色时自动补位会把整类吸进顶排、网格清空——浏览类别要的是聚焦视图）
  const TOP_N = 10;
  const topRow = $('topRow');
  let rest = list;
  if (!searchQ) {
    const inList = new Set(list.map(a => a.name));
    const pinsShown = DATA.filter(a => isPinned(a.name));
    const pinsIn = pinsShown.filter(a => inList.has(a.name));
    const pinsOut = pinsShown.filter(a => !inList.has(a.name));
    const auto = (filterCat === 'all')
      ? list.filter(a => !isPinned(a.name)).slice(0, Math.max(0, TOP_N - pinsShown.length))
      : [];
    const topList = [...pinsOut, ...pinsIn, ...auto];
    const topNames = new Set(topList.map(a => a.name));
    rest = list.filter(a => !topNames.has(a.name));
    topRow.style.display = topList.length ? '' : 'none';
    topRow.innerHTML = topList.map(a => tcardHTML(a, true)).join('');
  } else {
    topRow.style.display = 'none';
  }

  const grid = $('grid');
  grid.innerHTML = rest.length
    ? rest.map(a => tcardHTML(a)).join('')
    : (list.length ? '<div class="empty-hint">这一花色的牌都在上方常用区 · 右键取消置顶可回到牌阵</div>'
                   : '<div class="empty-hint">这一花色下没有牌 · 换个花色或清空搜索</div>');

  document.querySelectorAll('#tarot .tcard').forEach((card, i) => {
    const inner = card.querySelector('.inner');
    const a = DATA.find(x => x.name === card.dataset.name);
    card.addEventListener('mouseenter', () => {
      kbClear();
      if (!card.dataset.dragging) inner.classList.add('flipped');
      Sound.flip();
      // 悬停半秒 → 解读浮层（防扫过满屏弹）
      clearTimeout(readingTimer);
      readingTimer = setTimeout(() => {
        if (!card.dataset.dragging) showReading(a, card.getBoundingClientRect());
      }, 450);
    });
    card.addEventListener('mouseleave', () => {
      if (!card.dataset.dragging) inner.classList.remove('flipped');
      hideReading();
    });
    card.addEventListener('click', (e) => {
      if (card.dataset.dragging) return;
      const r = card.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 10);
      Sound.land();
      doLaunch(a);
    });
    // 右键 = 归类菜单（显式入口；拖拽是快捷方式）
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      hideReading();
      showCatMenu(a, e.clientX, e.clientY);
    });
    // 拖拽归类：拖到花色标签上松手即归类
    card.addEventListener('dragstart', (e) => {
      card.dataset.dragging = '1';
      card.classList.add('dragging');
      inner.classList.remove('flipped');
      hideReading();
      e.dataTransfer.setData('text/plain', a.name);
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setDragImage(card, card.offsetWidth / 2, card.offsetHeight / 2); } catch (err) {}
      Sound.flip();
    });
    card.addEventListener('dragend', () => {
      delete card.dataset.dragging;
      card.classList.remove('dragging');
      document.querySelectorAll('.chip.droptarget').forEach(c => c.classList.remove('droptarget'));
    });
    if (deal) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px) scale(.85)';
      setTimeout(() => {
        card.style.transition = 'opacity .3s ease, transform .4s cubic-bezier(.25,.9,.3,1.15)';
        card.style.opacity = '1';
        card.style.transform = '';
        if (i % 5 === 0) Sound.deal();
      }, Math.min(i * 14, 900));
    }
  });
  updateChips();
  kbIdx = -1;   // 网格重建，键盘选牌作废
  const used = DATA.filter(x => x.count > 0).length;
  $('subtitle').innerHTML =
    `本机 <b>${DATA.length}</b> 款程序入阵 · 已启用 <b>${used}</b> 款 · 常用自动浮前 · <b>零输入</b> — 翻牌即达`;
  fitTarotCards();
}

function updateChips() {
  const cnt = {};
  DATA.forEach(a => { const c = catOf(a).id; cnt[c] = (cnt[c] || 0) + 1; });
  document.querySelectorAll('.chip').forEach(ch => {
    const id = ch.dataset.cat;
    const s = ch.querySelector('small');
    if (s) s.textContent = id === 'all' ? DATA.length : (cnt[id] || 0);
  });
}
function buildChips() {
  const all = [{ id: 'all', icon: '🃏', name: '全部' }, ...allCats()];
  $('chips').innerHTML = all.map(c =>
    `<div class="chip${c.id === filterCat ? ' on' : ''}${c.id.startsWith('c') ? ' chip--customcat' : ''}" data-cat="${c.id}" data-droppable="${c.id !== 'all' ? '1' : ''}" title="${c.id.startsWith('c') ? '自定义分类 · 右键可删除' : ''}">${c.icon} ${escapeHTML(c.name)}<small></small></div>`
  ).join('') + `<div class="chip chip--add" id="chipAdd" title="新建自定义分类">＋ 新建分类</div>`;
  document.querySelectorAll('.chip[data-cat]').forEach(ch => {
    ch.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      ch.classList.add('on');
      filterCat = ch.dataset.cat;
      renderTarot(false);
      Sound.flip();
    });
    // 自定义分类：右键删除
    if (ch.dataset.cat && ch.dataset.cat.startsWith('c')) {
      ch.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const c = catById(ch.dataset.cat);
        if (!c) return;
        if (confirmDelCat) confirmDelCat(c);
      });
    }
    // 拖放归类目标（"全部"不可作为目标；"未名之牌"= 恢复自动分类）
    if (ch.dataset.droppable) {
      ch.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        ch.classList.add('droptarget');
      });
      ch.addEventListener('dragleave', () => ch.classList.remove('droptarget'));
      ch.addEventListener('drop', (e) => {
        e.preventDefault();
        ch.classList.remove('droptarget');
        const name = e.dataTransfer.getData('text/plain');
        const a = DATA.find(x => x.name === name);
        if (!a) return;
        const targetId = ch.dataset.cat;
        const reset = targetId === 'misc';
        setCustomCat(name, reset ? null : targetId);
        Sound.land();
        const c = catById(targetId);
        toast(reset
          ? `「${escapeHTML(name)}」已恢复自动分类`
          : `「${escapeHTML(name)}」已归入 ${c.icon} ${escapeHTML(c.name)}`);
        renderTarot(false);
      });
    }
  });
  $('chipAdd').addEventListener('click', openCatModal);
}

// ============================================================
// FreeCell（游戏模式，纯游戏）
// ============================================================
let game = null;
let drag = null;              // 游戏拖拽状态
let suppressClick = false;    // 拖拽松手后吞掉一次 click

/** 按 id 在牌局内定位（局对象可能是存档恢复的快照，不能经 DECK 找——对象身份不同会点击失联） */
function findCardInGame(id) {
  for (let ci = 0; ci < COLS; ci++) {
    const idx = game.cols[ci].findIndex(c => c.id === id);
    if (idx >= 0) return { card: game.cols[ci][idx], zone: 'col', i: ci, idx };
  }
  const k = game.cells.findIndex(c => c && c.id === id);
  if (k >= 0) return { card: game.cells[k], zone: 'cell', i: k, idx: 0 };
  return null;
}
/** 回收位当前顶牌（从着法历史推导——恢复局对象不在 DECK 里） */
function foundTopCard(si) {
  const rank = game.found[si];
  if (!rank) return null;
  for (let k = game.moves.length - 1; k >= 0; k--) {
    const m = game.moves[k];
    if (m.to.zone === 'found' && m.cards[0].suit === SUITS[si] && m.cards[0].rank === rank) return m.cards[0];
  }
  return null;
}

// ---------- 拖拽：目标判定 + 跟手 + 落子/弹回 ----------
function getDropTarget(x, y) {
  const br = $('fcboard').getBoundingClientRect();
  const lx = x - br.left, ly = y - br.top;
  // 自由位 / 回收位格子（4+4）
  for (let i = 0; i < 4; i++) {
    if (lx >= colX(i) && lx <= colX(i) + CW && ly >= TOP_Y && ly <= TOP_Y + CH) return { zone: 'cell', i };
    if (lx >= colX(i + 4) && lx <= colX(i + 4) + CW && ly >= TOP_Y && ly <= TOP_Y + CH) return { zone: 'found', i };
  }
  // 列（按 x 命中，y 在列区）
  if (ly >= COL_Y - 24) {
    for (let ci = 0; ci < COLS; ci++) {
      if (lx >= colX(ci) - 12 && lx <= colX(ci) + CW + 12) return { zone: 'col', i: ci };
    }
  }
  return null;
}
function clearDropHighlights() {
  document.querySelectorAll('.droptarget').forEach(e => e.classList.remove('droptarget'));
}
function highlightTarget(t) {
  clearDropHighlights();
  if (!t) return;
  const el = t.zone === 'cell' ? $('cell' + t.i)
    : t.zone === 'found' ? $('found' + t.i)
    : $('colanchor' + t.i);
  if (el) el.classList.add('droptarget');
}

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;   // 未过阈值仍算点击
  if (!drag.moved) {
    drag.moved = true;
    Sound.flip();
    drag.cards.forEach((c, ri) => {
      const el = cardEl(c);
      el.classList.add('noanim');
      el.style.zIndex = 300 + ri;
    });
    clearSelection();
  }
  // 序列跟手（保持牌间 STACK 偏移）
  const br = $('fcboard').getBoundingClientRect();
  drag.cards.forEach((c, ri) => {
    const el = cardEl(c);
    el.style.transform = `translate(${e.clientX - br.left - drag.grabDX}px, ${e.clientY - br.top - drag.grabDY + ri * STACK}px)`;
  });
  highlightTarget(getDropTarget(e.clientX, e.clientY));
}, { passive: true });

document.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;             // 纯点击：走原生 click 流程
  suppressClick = true;
  clearDropHighlights();
  const target = getDropTarget(e.clientX, e.clientY);
  // 恢复动画类，让落子/弹回都有平滑过渡
  d.cards.forEach(c => cardEl(c).classList.remove('noanim'));
  let done = false;
  if (target) {
    game.selected = d.from;
    done = tryMoveTo(target);       // 成功：doMove 内部 positionGame 平滑落位
  }
  if (!done) {
    positionGame(false);            // 弹回原位（带过渡动画）
    if (target) Sound.bad();
  }
});

document.addEventListener('pointerdown', (e) => {
  // 拖拽中点到别处：直接终止并弹回
  if (drag && drag.moved) {
    const d = drag; drag = null;
    clearDropHighlights();
    d.cards.forEach(c => cardEl(c).classList.remove('noanim'));
    positionGame(false);
    suppressClick = true;
  }
}, true);

// ---------- 微软经典发牌（FreeCell 原版算法） ----------
// 局号 1-32000 为微软验证过的经典局（仅 11982 无解，避开）——每局保证可通关
const MS_UNSOLVABLE = new Set([11982]);
function msShuffle(dealNo) {
  let state = dealNo >>> 0;
  const rand = () => { state = (214013 * state + 2531011) % 2147483648; return (state >> 16) & 32767; };
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 0; i < 51; i++) {
    const j = i + rand() % (52 - i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
// 微软 card index i：花色 = i%4（0♣ 1♦ 2♥ 3♠），点数 = (i>>2)+1；映射到本副牌
function cardFromMsIndex(i) {
  const msSuit = i % 4;
  const rank = Math.floor(i / 4) + 1;
  const suit = [SUITS[3], SUITS[2], SUITS[1], SUITS[0]][msSuit];   // ♣♦♥♠ → SUITS 顺序(S,H,D,C)
  return DECK.find(c => c.suit === suit && c.rank === rank) || DECK[0];
}
function randomDealNo() {
  let n;
  do { n = 1 + Math.floor(Math.random() * 32000); } while (MS_UNSOLVABLE.has(n));
  return n;
}
function updateGameTag() {
  if (game && game.dealNo) {
    $('modeTag').textContent = `· 空当接龙 · 第 ${game.dealNo} 局 · 纯游戏`;
  }
}

function newGame(dealNo) {
  const dn = dealNo && !MS_UNSOLVABLE.has(dealNo) ? dealNo : randomDealNo();
  game = {
    cols: Array.from({ length: COLS }, () => []),
    cells: [null, null, null, null],
    found: [0, 0, 0, 0],
    selected: null,
    moves: [],
    moveCount: 0,
    won: false,
    dealNo: dn,
  };
  msShuffle(dn).forEach((ci, i) => game.cols[i % COLS].push(cardFromMsIndex(ci)));
  clearSelection();
  $('moveCount').textContent = '0 步';
  updateGameTag();
  saveGame();
  washThenDeal();
}

// ---------- 进度保存（快照式：不依赖重扫后的 DECK 排序，重启也能原样恢复） ----------
const cardToSnap = (c) => ({ id: c.id, s: SUITS.indexOf(c.suit), r: c.rank, j: c.joker ? 1 : 0, n: c.app ? c.app.name : null });
const snapToCard = (s) => ({
  id: s.id, suit: SUITS[s.s], rank: s.r, joker: !!s.j,
  app: (s.n && DATA.find(a => a.name === s.n)) || { name: s.n || '?' },
});
function saveGame() {
  if (!game) return;
  try {
    localStorage.setItem('ld_game', JSON.stringify({
      dealNo: game.dealNo,
      cols: game.cols.map(c => c.map(cardToSnap)),
      cells: game.cells.map(c => c ? cardToSnap(c) : null),
      found: game.found,
      moves: game.moves.map(m => ({ from: m.from, to: m.to, cards: m.cards.map(cardToSnap) })),
      moveCount: game.moveCount,
    }));
  } catch (e) {}
}
function clearSavedGame() { try { localStorage.removeItem('ld_game'); } catch (e) {} }
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('ld_game') || 'null');
    if (!s || !s.cols || !s.dealNo) return null;
    return {
      dealNo: s.dealNo,
      cols: s.cols.map(c => c.map(snapToCard)),
      cells: s.cells.map(c => c ? snapToCard(c) : null),
      found: s.found,
      moves: (s.moves || []).map(m => ({ from: m.from, to: m.to, cards: m.cards.map(snapToCard) })),
      moveCount: s.moveCount || 0,
      selected: null,
      won: false,
    };
  } catch (e) { return null; }
}

/** 开局洗牌：52 张聚中央 → 交错抖洗 ~1s → 发牌 */
function washThenDeal() {
  const cx = boardW / 2 - CW / 2;
  DECK.forEach((c, i) => {
    const el = cardEl(c);
    el.style.transition = 'none';
    el.style.transform = `translate(${cx}px, ${TOP_Y}px) scale(.55)`;
    el.style.opacity = '0';
    el.style.zIndex = 1 + (i % 7);
    // 三段抖洗：左甩 → 右甩 → 归中（每张随机 delay，卡牌瀑布感）
    try {
      el.animate([
        { transform: `translate(${cx - 60}px, ${TOP_Y + 8}px) rotate(${-(6 + Math.random() * 8)}deg) scale(.55)`, opacity: 1, offset: 0.32 },
        { transform: `translate(${cx + 60}px, ${TOP_Y + 4}px) rotate(${6 + Math.random() * 8}deg) scale(.55)`, opacity: 1, offset: 0.68 },
        { transform: `translate(${cx}px, ${TOP_Y}px) scale(.55)`, opacity: 1, offset: 1 },
      ], { duration: 900, delay: i * 6, fill: 'backwards', easing: 'ease-in-out' });
    } catch (e) {}
  });
  for (let k = 0; k < 8; k++) Sound.wash(k);
  // 发牌必须等洗牌动画完全结束（最后一张 wash 动画 = 312ms delay + 900ms = 1212ms），
  // 提前发牌会与 WAAPI 动画叠加覆盖 transform，产生牌位跳变
  setTimeout(() => positionGame(true), 1300);
}

const isRed = (c) => c.suit.red;
function canStack(moving, onto) {
  return moving.rank === onto.rank - 1 && isRed(moving) !== isRed(onto);
}
function emptyCells() { return game.cells.filter(c => !c).length; }
function emptyCols() { return game.cols.filter(c => c.length === 0).length; }
function maxMovable() { return (1 + emptyCols()) * (1 + emptyCells()); }
function seqOk(col, idx) {
  for (let i = idx; i < col.length - 1; i++) {
    if (!canStack(col[i + 1], col[i])) return false;
  }
  return true;
}
function grabFromSelection() {
  const sel = game.selected;
  if (!sel) return [];
  if (sel.zone === 'cell') return [game.cells[sel.i]].filter(Boolean);
  return game.cols[sel.i].slice(sel.idx);
}

function tryMoveTo(target) {
  const sel = game.selected;
  if (!sel) return false;
  const seq = grabFromSelection();
  if (!seq.length) return false;
  if (target.zone === 'found') {
    if (seq.length !== 1) return false;
    const c = seq[0];
    const si = SUITS.indexOf(c.suit);
    if (si !== target.i) return false;
    if (c.rank !== game.found[si] + 1) return false;
    doMove({ from: sel, to: target, cards: seq });
    return true;
  }
  if (target.zone === 'cell') {
    if (seq.length !== 1) {
      toast('自由位只能放 1 张 —— 点列顶牌选中单张再移');
      Sound.bad();
      return false;
    }
    if (game.cells[target.i]) {
      toast('该自由位已有牌，换一个空位');
      Sound.bad();
      return false;
    }
    doMove({ from: sel, to: target, cards: seq });
    return true;
  }
  const dst = game.cols[target.i];
  if (dst.length && !canStack(seq[0], dst[dst.length - 1])) return false;
  if (seq.length > maxMovable()) {
    toast(`一次最多移 ${maxMovable()} 张（自由位 ${emptyCells()} + 空列 ${emptyCols()}）`);
    Sound.bad();
    return false;
  }
  if (target.i === sel.i && sel.zone === 'col') return false;
  doMove({ from: sel, to: target, cards: seq });
  return true;
}

function doMove(m) {
  if (m.from.zone === 'col') game.cols[m.from.i].splice(m.from.idx);
  else if (m.from.zone === 'cell') game.cells[m.from.i] = null;
  if (m.to.zone === 'col') game.cols[m.to.i].push(...m.cards);
  else if (m.to.zone === 'cell') game.cells[m.to.i] = m.cards[0];
  else if (m.to.zone === 'found') game.found[SUITS.indexOf(m.cards[0].suit)] = m.cards[0].rank;
  game.moves.push(m);
  game.moveCount++;
  $('moveCount').textContent = game.moveCount + ' 步';
  saveGame();
  clearSelection();
  Sound.move();
  positionGame(false);
  checkWin();
}

function undoMove() {
  const m = game.moves.pop();
  if (!m) { toast('没有可悔的棋了'); return; }
  if (m.to.zone === 'col') game.cols[m.to.i].splice(game.cols[m.to.i].length - m.cards.length);
  else if (m.to.zone === 'cell') game.cells[m.to.i] = null;
  else if (m.to.zone === 'found') game.found[SUITS.indexOf(m.cards[0].suit)] -= 1;
  if (m.from.zone === 'col') game.cols[m.from.i].push(...m.cards);
  else if (m.from.zone === 'cell') game.cells[m.from.i] = m.cards[0];
  game.moveCount = Math.max(0, game.moveCount - 1);
  $('moveCount').textContent = game.moveCount + ' 步';
  saveGame();
  Sound.flip();
  positionGame(false);
}

function clearSelection() {
  if (game) game.selected = null;
  document.querySelectorAll('.pcard.selected').forEach(e => e.classList.remove('selected'));
}

function positionGame(deal) {
  if (deal) {
    // 从洗牌后的中央堆直接散开
    DECK.forEach(c => {
      const el = cardEl(c);
      el.style.transition = 'none';
      el.style.transform = `translate(${boardW / 2 - CW / 2}px, ${TOP_Y}px) scale(.55)`;
      el.style.zIndex = 1;
    });
  }
  later(() => {
    let k = 0;
    game.cols.forEach((col, ci) => {
      col.forEach((card, ri) => {
        const el = cardEl(card);
        el.style.transition = '';
        placeCard(card, colX(ci), COL_Y + ri * STACK, 5 + ri);
        if (deal) setTimeout(() => { el.style.opacity = '1'; if (k++ % 4 === 0) Sound.deal(); }, ri * 30 + ci * 36);
        else el.style.opacity = '1';
      });
    });
    game.cells.forEach((card, i) => {
      if (!card) return;
      const el = cardEl(card);
      el.style.transition = '';
      placeCard(card, colX(i), TOP_Y, 40);
      el.style.opacity = '1';
    });
    game.found.forEach((rank, i) => {
      const el0 = $('found' + i);
      if (rank > 0) {
        const card = foundTopCard(i);   // 局内对象（恢复局的牌不在 DECK 里）
        if (card) {
          const el = cardEl(card);
          el.style.transition = '';
          placeCard(card, colX(i + 4), TOP_Y, 40);
          el.style.opacity = '1';
        }
      }
      el0.querySelector('.lbl').textContent = rank > 0 ? `${SUITS[i].ch} 已收 ${RANK_TXT[rank]}` : `${SUITS[i].name} A→K`;
    });
    // 藏已被压进回收位的牌（按着法历史找局内对象，不经 DECK）
    game.moves.forEach(m => {
      if (m.to.zone !== 'found') return;
      const si = SUITS.indexOf(m.cards[0].suit);
      if (game.found[si] > m.cards[0].rank) {
        const el = cardEl(m.cards[0]);
        el.style.transition = '';
        el.style.opacity = '0';
        placeCard(m.cards[0], colX(si + 4), TOP_Y, 1);
      }
    });
  });
}

function checkWin() {
  if (game.found.every(r => r === 13)) {
    game.won = true;
    Sound.win();
    burst(window.innerWidth / 2, window.innerHeight / 2, 30);
    const winBox = $('winBox');
    if (!winBox) return;   // 弹层 DOM 不在时静默（防御）
    $('winBox').innerHTML = `
      <div class="fph">🏆</div>
      <div class="ftitle">牌运亨通</div>
      <div class="ftext">${game.moveCount} 步清空牌阵——今日宜乘胜追击。</div>
      <div class="fmeta">— 空当接龙 · 应用牌堆 —</div>
      <div class="fbtns"><button class="plain" data-act="new">再来一局</button><button data-act="back">回塔罗牌阵</button></div>`;
    const pop = $('winPop');
    pop.classList.add('show');
    later(() => pop.classList.add('open'));
    pop.querySelector('[data-act="new"]').onclick = () => { closePop(pop); newGame(); };
    pop.querySelector('[data-act="back"]').onclick = () => { closePop(pop); setMode('tarot'); };
    clearSavedGame();   // 通关清档
  }
}

// ---------- 游戏点击（纯游戏：任何点击都不启动应用） ----------
function onCardClick(card, zone, i, idx) {
  if (game.won) return;
  const sel = game.selected;
  if (sel) {
    if (zone === 'col' && idx === game.cols[i].length - 1 || zone === 'cell' || zone === 'found') {
      if (tryMoveTo({ zone, i })) return;
    }
    if (sel.zone === zone && sel.i === i && (zone !== 'col' || sel.idx === idx)) {
      clearSelection(); Sound.flip(); return;
    }
  }
  if (zone === 'col') {
    const col = game.cols[i];
    if (idx < col.length - 1 && !seqOk(col, idx)) { Sound.bad(); return; }
    if (idx === col.length - 1 || seqOk(col, idx)) {
      game.selected = { zone, i, idx };
      document.querySelectorAll('.pcard.selected').forEach(e => e.classList.remove('selected'));
      col.slice(idx).forEach(c => cardEl(c).classList.add('selected'));
      Sound.flip();
    }
  } else if (zone === 'cell' && game.cells[i]) {
    game.selected = { zone, i, idx: 0 };
    document.querySelectorAll('.pcard.selected').forEach(e => e.classList.remove('selected'));
    cardEl(game.cells[i]).classList.add('selected');
    Sound.flip();
  }
}

// ---------- 启动 ----------
async function doLaunch(app) {
  if (!app) return;
  const r = await window.deck.launch({ name: app.name, src: app.src, exe: app.exe, uwp: app.uwp });
  if (!r.ok) toast(`「${app.name}」启动失败：${escapeHTML(r.err || '未知原因')}`);
}

// ---------- 牌 DOM（FreeCell） ----------
const cardEls = new Map();
function cardEl(card) {
  let el = cardEls.get(card.id);
  if (el) return el;
  el = document.createElement('div');
  const red = card.suit.red ? 'red' : 'black';
  const mid = card.joker
    ? `<div class="ph">🃏</div><div class="pname">JOKER</div><div class="jsub">装新应用顶替</div>`
    : (card.app.icon
        ? `<img src="${card.app.icon}" alt=""><div class="pname">${escapeHTML(card.app.name || '')}</div>`
        : `<div class="ph">${escapeHTML((card.app.name || '?').charAt(0))}</div><div class="pname">${escapeHTML(card.app.name || '')}</div>`);
  const ub = (!card.joker && card.app.count > 0) ? `<div class="ub">★${card.app.count}</div>` : '';
  el.className = `pcard ${red} ${card.joker ? 'joker' : ''}`;
  el.dataset.id = card.id;
  el.innerHTML = `
    <div class="corner"><span class="r">${RANK_TXT[card.rank]}</span><span class="s">${card.suit.ch}</span></div>
    ${ub}
    <div class="mid">${mid}</div>
    <div class="corner2"><span class="r">${RANK_TXT[card.rank]}</span><span class="s">${card.suit.ch}</span></div>`;
  $('fcboard').appendChild(el);
  cardEls.set(card.id, el);
  el.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (mode !== 'game' || !game) return;   // 游戏模式纯游戏；启动模式此牌不显示
    const loc = findCardInGame(el.dataset.id);
    if (!loc) return;                        // 已被收进回收位的牌不可点
    onCardClick(loc.card, loc.zone, loc.i, loc.idx);
  });
  // 拖拽移动（FreeCell 标配）：pointer 抓牌 → 序列跟手 → 松手落子/弹回
  el.addEventListener('pointerdown', (e) => {
    if (mode !== 'game' || !game || game.won || e.button !== 0) return;
    const loc = findCardInGame(el.dataset.id);
    if (!loc) return;
    const card = loc.card;
    // 确定可抓序列（列顶或合法序列 / 自由位单张）
    let cards = null, from = null;
    if (loc.zone === 'col') {
      const col = game.cols[loc.i];
      if (loc.idx < col.length - 1 && !seqOk(col, loc.idx)) return;   // 非法序列起点，交给点击
      cards = col.slice(loc.idx);
      from = { zone: 'col', i: loc.i, idx: loc.idx };
    } else {
      cards = [card];
      from = { zone: 'cell', i: loc.i, idx: 0 };
    }
    drag = {
      cards, from,
      startX: e.clientX, startY: e.clientY,
      grabDX: e.clientX - el.getBoundingClientRect().left,
      grabDY: e.clientY - el.getBoundingClientRect().top,
      moved: false,
    };
  });
  el.addEventListener('dblclick', () => {
    if (mode !== 'game' || !game || game.won) return;
    const loc = findCardInGame(el.dataset.id);
    if (!loc) return;
    if (loc.zone === 'col' && loc.idx !== game.cols[loc.i].length - 1) return;   // 被压住的牌不可收
    const si = SUITS.indexOf(loc.card.suit);
    if (loc.card.rank === game.found[si] + 1) {
      game.selected = { zone: loc.zone, i: loc.i, idx: loc.idx };
      tryMoveTo({ zone: 'found', i: si });
    } else {
      Sound.bad();
    }
  });
  return el;
}
function placeCard(card, x, y, z) {
  const el = cardEl(card);
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.zIndex = z;
}

// 顶行槽 & 列锚点
function buildStatic() {
  const cells = $('slotCells'), found = $('slotFound');
  cells.innerHTML = ''; found.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const s = document.createElement('div');
    s.className = 'slot'; s.id = 'cell' + i;
    s.innerHTML = '<span class="big">◇</span><span class="lbl">自由位</span>';
    s.addEventListener('click', () => onCellClick(i));
    cells.appendChild(s);
    const f = document.createElement('div');
    f.className = 'slot slot--gold'; f.id = 'found' + i;
    f.innerHTML = `<span class="big">${SUITS[i].ch}</span><span class="lbl">${SUITS[i].name} A→K</span>`;
    f.style.borderColor = SUITS[i].red ? 'rgba(192,57,43,.5)' : 'rgba(255,255,255,.25)';
    f.addEventListener('click', () => onFoundClick(i));
    found.appendChild(f);
  }
  const cols = $('columns');
  cols.innerHTML = '';
  for (let i = 0; i < COLS; i++) {
    const a = document.createElement('div');
    a.className = 'colanchor'; a.id = 'colanchor' + i;
    a.addEventListener('click', () => onColAnchorClick(i));
    cols.appendChild(a);
  }
  layoutStatic();
}
function layoutStatic() {
  for (let i = 0; i < 4; i++) {
    const s = $('cell' + i), f = $('found' + i);
    s.style.left = colX(i) + 'px'; s.style.top = TOP_Y + 'px';
    s.style.width = CW + 'px'; s.style.height = CH + 'px';
    f.style.left = colX(i + 4) + 'px'; f.style.top = TOP_Y + 'px';
    f.style.width = CW + 'px'; f.style.height = CH + 'px';
  }
  for (let i = 0; i < COLS; i++) {
    const a = $('colanchor' + i);
    a.style.left = colX(i) + 'px'; a.style.top = COL_Y + 'px';
    a.style.width = CW + 'px'; a.style.height = '62%';
  }
}
function onCellClick(i) { if (mode === 'game' && game && !game.won && game.selected) tryMoveTo({ zone: 'cell', i }); }
function onFoundClick(i) { if (mode === 'game' && game && !game.won && game.selected) tryMoveTo({ zone: 'found', i }); }
function onColAnchorClick(i) {
  if (mode === 'game' && game && !game.won && game.selected && game.cols[i].length === 0) tryMoveTo({ zone: 'col', i });
}

// ---------- 模式切换 ----------
function setMode(m) {
  mode = m;
  clearSelection();
  document.querySelectorAll('.pcard.selected').forEach(e => e.classList.remove('selected'));
  $('tarot').classList.toggle('hidden', m !== 'tarot');
  $('fcboard').classList.toggle('hidden', m !== 'game');
  $('gameBtns').style.display = m === 'game' ? 'flex' : 'none';
  $('btnMode').innerHTML = (m === 'game' ? IC.deck : IC.gamepad) +
    '<span>' + (m === 'game' ? '塔罗牌阵' : '游戏模式') + '</span>';
  $('modeTag').textContent = m === 'game' ? '· 空当接龙 · 纯游戏' : '· 塔罗牌阵';
  $('hint').textContent = m === 'game'
    ? '点牌选中 · 再点目标移动 · 红黑交替降序 · 回收位 A→K（游戏模式不启动应用）'
    : 'Ctrl+J 收起 · 右键卡片自定义归类 · 悬停看牌意 · 点击启动（也可拖牌到花色标签归类）';
  if (m === 'game') {
    layoutAll();
    if (!game) {
      // 恢复上一局（切模式/重启都不丢进度）
      const restored = loadGame();
      if (restored) {
        game = restored;
        clearSelection();
        $('moveCount').textContent = game.moveCount + ' 步';
        updateGameTag();
        toast(`继续第 ${game.dealNo} 局 · 已走 ${game.moveCount} 步`);
        positionGame(true);
      } else {
        newGame();
      }
    } else {
      updateGameTag();
      positionGame(false);   // 进行中的局：原样重摆，不重发
    }
  } else {
    renderTarot(true);
  }
}
$('btnMode').addEventListener('click', () => { setMode(mode === 'game' ? 'tarot' : 'game'); Sound.flip(); });
$('btnUndo').addEventListener('click', () => { if (game) undoMove(); });
$('btnNewGame').addEventListener('click', () => newGame());

// ---------- 今日一抽 ----------
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
$('btnFortune').addEventListener('click', () => {
  if (!DATA.length) return;
  const s = todayStr();
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = DATA[h % DATA.length];
  $('fortuneBox').innerHTML = `
    ${a.icon ? `<img src="${a.icon}" alt="">` : `<div class="fph">${escapeHTML((a.name || '?').charAt(0))}</div>`}
    <div class="ftitle">今日宜开 · ${escapeHTML(a.name || '本机程序')}</div>
    <div class="ftext">${escapeHTML(divination(a, 1))}<br>缘分翻出的这一张，今天会替你办好一件事。</div>
    <div class="fmeta">— ${todayStr()} · 每日一抽，全天不变 —</div>
    <div class="fbtns"><button class="golaunch">启 动</button><button class="plain">收下好运</button></div>`;
  const pop = $('fortunePop');
  pop.classList.add('show');
  later(() => pop.classList.add('open'));
  Sound.fortune();
  burst(window.innerWidth / 2, window.innerHeight / 2 - 80, 16);
  pop.querySelector('.golaunch').addEventListener('click', () => { closePop(pop); doLaunch(a); });
  pop.querySelector('.plain').addEventListener('click', () => closePop(pop));
  pop.onclick = (e) => { if (e.target === pop) closePop(pop); };
});
function closePop(pop) {
  pop.classList.remove('open');
  setTimeout(() => pop.classList.remove('show'), 220);
}

// ---------- 搜索 ----------
$('btnSearch').addEventListener('click', () => {
  const box = $('searchbox');
  box.classList.toggle('show');
  if (box.classList.contains('show')) $('searchInput').focus();
  else { $('searchInput').value = ''; renderSearch(''); }
});
function renderSearch(q) {
  const box = $('searchResult');
  q = q.trim();
  if (!q || mode !== 'tarot') { box.classList.remove('show'); box.innerHTML = ''; return; }
  const ql = q.toLowerCase();
  // 名称优先：先只搜名称（避免 "git" 因 Logi"tech" 捞回发行商误匹配）；
  // 名称无结果才兜底搜发行商（结果标注来源）
  let byName = DATA.filter(a => (a.name || '').toLowerCase().includes(ql) ||
    (a.pyInit && a.pyInit.includes(ql)) || (a.pyFull && a.pyFull.includes(ql)));
  let byPub = [];
  if (!byName.length) {
    byPub = DATA.filter(a => (a.pub || '').toLowerCase().includes(ql));
  }
  const list = [...byName, ...byPub].sort((a, b) => (b.count - a.count));
  const nameSet = new Set(byName.map(a => a.name));
  box.classList.add('show');
  box.innerHTML = list.length
    ? list.map(a => `
      <div class="tcard" data-name="${escapeHTML(a.name)}" style="width:102px;height:148px;">
        <div class="lift"><div class="inner">
          <div class="face back" data-suit="${catOf(a).suit}">
            ${a.icon ? `<img class="appicon" src="${a.icon}">` : `<div class="appicon-fallback">${escapeHTML((a.name || '?').charAt(0))}</div>`}
            <div class="backname">${escapeHTML(a.name || '')}</div>
            ${nameSet.has(a.name) ? '' : `<div class="pubmatch">来自发行商</div>`}
          </div>
        </div></div>
      </div>`).join('')
    : '<div style="width:100%;text-align:center;color:rgba(255,255,255,.4);padding:50px 0;">没有匹配的程序</div>';
  box.querySelectorAll('.tcard').forEach(el => {
    const a = DATA.find(x => x.name === el.dataset.name);
    el.addEventListener('mouseenter', () => el.querySelector('.inner').classList.add('flipped'));
    el.addEventListener('mouseleave', () => el.querySelector('.inner').classList.remove('flipped'));
    el.addEventListener('click', () => { if (a) { Sound.land(); doLaunch(a); } });
  });
}
$('searchInput').addEventListener('input', (e) => renderSearch(e.target.value));

// ---------- 其他 ----------
$('btnTheme').addEventListener('click', openThemeModal);
$('btnHotkey').addEventListener('click', openHotkeyModal);
$('btnSound').addEventListener('click', (e) => { e.currentTarget.innerHTML = Sound.toggle() ? IC.volume : IC.mute; });
$('btnClose').addEventListener('click', () => window.deck.hide());

// ---------- 全键盘导航（塔罗模式）：方向键选牌 · Enter 启动 · 鼠标移入即让位 ----------
let kbIdx = -1;
function kbCards() { return [...document.querySelectorAll('#tarot .tcard')]; }   // 含常用置顶区
function kbClear() {
  if (kbIdx < 0) return;
  const el = document.querySelector('.tcard.kb-focus');
  if (el) el.classList.remove('kb-focus');
  kbIdx = -1;
}
function kbPaint() {
  const cards = kbCards();
  if (kbIdx < 0 || !cards.length) return;
  cards.forEach(c => c.classList.remove('kb-focus'));
  if (cards[kbIdx]) {
    cards[kbIdx].classList.add('kb-focus');
    cards[kbIdx].scrollIntoView({ block: 'nearest' });
  }
}
function kbMove(dx, dy) {
  const cards = kbCards();
  if (!cards.length) return;
  if (kbIdx < 0 || !cards[kbIdx]) { kbIdx = 0; kbPaint(); return; }
  // 按 offsetTop 分行（flex wrap 同行 offsetTop 相等）
  const rows = [];
  let lastTop = null;
  cards.forEach(c => { if (c.offsetTop !== lastTop) { rows.push([]); lastTop = c.offsetTop; } rows[rows.length - 1].push(c); });
  let r = 0, col = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const ci = rows[ri].indexOf(cards[kbIdx]);
    if (ci >= 0) { r = ri; col = ci; break; }
  }
  r = Math.max(0, Math.min(rows.length - 1, r + dy));
  col = Math.max(0, Math.min(rows[r].length - 1, col + dx));
  kbIdx = cards.indexOf(rows[r][col]);
  kbPaint();
}

document.addEventListener('keydown', (e) => {
  // 全键盘导航（塔罗模式）：方向键选牌 · Enter 启动；搜索框聚焦/弹层打开时让位
  if (mode === 'tarot' && document.activeElement !== $('searchInput') &&
      !$('searchResult').classList.contains('show') && !document.querySelector('.catmodal-pop.open')) {
    const kk = e.key;
    if (kk === 'ArrowRight' || kk === 'ArrowLeft' || kk === 'ArrowDown' || kk === 'ArrowUp') {
      e.preventDefault();
      hideReading();
      kbMove(kk === 'ArrowRight' ? 1 : kk === 'ArrowLeft' ? -1 : 0, kk === 'ArrowDown' ? 1 : kk === 'ArrowUp' ? -1 : 0);
      return;
    }
    if (kk === 'Enter' && kbIdx >= 0) {
      const el = kbCards()[kbIdx];
      if (el) { e.preventDefault(); el.click(); }
      return;
    }
  }
  if (e.key === 'Escape') {
    // 关闭动画中的模态（已无 open 类但元素未及移除）不拦截 Esc
    const catM = $('catModal');
    if (catM && catM.classList.contains('open')) { closeCatModal(); return; }
    const delM = $('delCatModal');
    if (delM && delM.classList.contains('open')) { delM.remove(); return; }
    if ($('fortunePop').classList.contains('show')) { closePop($('fortunePop')); return; }
    if ($('winPop').classList.contains('show')) { closePop($('winPop')); return; }
    if (mode === 'game' && game && game.selected) { clearSelection(); Sound.flip(); return; }
    window.deck.hide();
    return;
  }
  if (mode === 'game' && e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault(); undoMove();
  }
});

let toastTimer = null;
function toast(html) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

// rAF 会因面板隐藏而暂停；document.visibilityState 在隐藏窗口+CDP 下不可靠，
// 双保险赛跑：rAF 正常时抢先（动画流畅），被冻结时 setTimeout 兜底
function later(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 130);
}

// ---------- 布局自适应 ----------
// 塔罗牌尺寸自适应：全部牌完整可见（产品目标"全牌可见"），放不下时按宽高比逐步缩小
const TC_RATIO = 102 / 148;
function fitTarotCards() {
  const grid = $('grid');
  const n = grid.querySelectorAll('.tcard').length;
  const availW = grid.clientWidth - 12, availH = grid.clientHeight - 22;   // 减 grid 内边距
  if (!n || availW < 320 || availH < 240) return;   // 隐藏窗口测不到，维持默认尺寸
  for (let h = 148; h >= 64; h -= 2) {
    const w = h * TC_RATIO;
    const perRow = Math.floor((availW + 13) / (w + 13));
    if (!perRow) continue;
    const rows = Math.ceil(n / perRow);
    if (rows * h + (rows - 1) * 14 <= availH) {
      document.documentElement.style.setProperty('--tch', h + 'px');
      document.documentElement.style.setProperty('--tcw', Math.round(w) + 'px');
      return;
    }
  }
  // 牌极多时压到最小尺寸仍放不下：用最小值，网格 overflow-y:auto 滚动兜底
  document.documentElement.style.setProperty('--tch', '64px');
  document.documentElement.style.setProperty('--tcw', Math.round(64 * TC_RATIO) + 'px');
}
function layoutAll() {
  boardW = Math.max($('fcboard').clientWidth || 1240, 900);
  layoutStatic();
  if (mode === 'game' && game) positionGame(false);
  fitTarotCards();
}
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layoutAll, 100); });

// ---------- 渲染层错误上报（进 main.log，报障时日志即证据链） ----------
window.addEventListener('error', (e) => {
  try { window.deck.logError(`error: ${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`); } catch (err) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { window.deck.logError('unhandledrejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)).slice(0, 300)); } catch (err) {}
});

// ---------- init ----------
async function loadApps() {
  const all = await window.deck.getApps();
  DATA = rawApps(all);
  buildPinyin();
  buildDeck();
  if (mode === 'tarot') renderTarot(true);
}
(async function init() {
  buildChips();
  buildStatic();
  applyTheme();
  setMode('tarot');
  await loadApps();
  window.deck.onShown(() => { layoutAll(); loadApps(); });
  window.deck.onAppsUpdated(() => loadApps());
  try { updateHotkeyHint(await window.deck.getHotkey()); } catch (e) {}
})();
