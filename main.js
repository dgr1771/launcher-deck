/* ============================================================
   Launcher Deck 应用牌堆 — 主进程
   托盘常驻 + Ctrl+J 全局热键唤起牌阵面板；
   扫描本机应用（PowerShell 管线，异步）、记录启动频率、
   exe / UWP 双通道启动。

   常驻健壮性（来自看板项目的教训）：
   - console 全部重定向到 userData/main.log（EPIPE 防护）
   - uncaughtException/unhandledRejection 只记日志不退出
   - PowerShell 一律 -File 调脚本，不走 stdin 传参（中文乱码）
   - exec 全部异步，不阻塞主进程
   ============================================================ */
'use strict';

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// ---------- 日志（EPIPE 防护：常驻进程 console 断开即崩） ----------
const userDataDir = app.getPath('userData');
if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
const LOG_PATH = path.join(userDataDir, 'main.log');
let logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
logStream.on('error', () => {});   // 日志盘故障不许拖垮主进程
function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
  try { logStream.write(line); } catch (e) {}
}
process.stdout.write = logStream.write.bind(logStream);
process.stderr.write = logStream.write.bind(logStream);
process.on('uncaughtException', (e) => { log('uncaughtException:', e && e.stack || e); });
process.on('unhandledRejection', (e) => { log('unhandledRejection:', e && e.stack || e); });

// ---------- 路径 ----------
const APPS_JSON = path.join(userDataDir, 'apps.json');
const USAGE_JSON = path.join(userDataDir, 'usage.json');
const SETTINGS_JSON = path.join(userDataDir, 'settings.json');
const SCAN_PS1 = path.join(__dirname, 'scripts', 'scan.ps1');
const TRAY_PNG = path.join(__dirname, 'assets', 'tray.png');

const SCAN_TTL_MS = 24 * 60 * 60 * 1000;   // 扫描缓存一天

// ---------- 应用数据 ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// ---------- 设置（全局快捷键——主进程持久化，要在窗口创建前就绪） ----------
const DEFAULT_HOTKEY = 'Ctrl+J';
let hotkey = DEFAULT_HOTKEY;
{
  const s = readJson(SETTINGS_JSON, {});
  if (s.hotkey && typeof s.hotkey === 'string') hotkey = s.hotkey;
}
function saveSettings() {
  try { fs.writeFileSync(SETTINGS_JSON, JSON.stringify({ hotkey }, null, 2)); } catch (e) { log('settings write fail', e); }
}
function registerHotkey(acc) {
  if (!acc || typeof acc !== 'string' || !/^[A-Za-z0-9+]{3,40}$/.test(acc) || !/\+[A-Za-z0-9]$/.test(acc)) {
    return { ok: false, err: '无效的快捷键' };
  }
  const parts = acc.split('+');
  if (parts[parts.length - 1] === 'F4') {
    return { ok: false, err: '别用 F4（系统关闭窗口组合）' };
  }
  const prev = hotkey;
  if (prev) globalShortcut.unregister(prev);
  let ok = false;
  try { ok = globalShortcut.register(acc, togglePanel); } catch (e) { ok = false; log('hotkey register throw:', acc, e && e.message); }
  if (ok) {
    hotkey = acc;
    saveSettings();
    if (tray) buildTrayMenu();
    log('hotkey changed:', acc);
    return { ok: true, hotkey: acc };
  }
  // 新组合被其他程序占用：回滚旧组合，面板功能不受影响
  if (prev && prev !== acc) { try { globalShortcut.register(prev, togglePanel); } catch (e) {} }
  log('hotkey register FAILED:', acc);
  return { ok: false, err: '这组快捷键被其他程序占用，请换一组' };
}

function getAppsInternal() {
  const data = readJson(APPS_JSON, { apps: [] });
  const usage = readJson(USAGE_JSON, {});
  return (data.apps || []).map(a => {
    const u = usage[a.name] || {};
    return { ...a, count: u.count || 0, last: u.last || 0 };
  }).sort((x, y) => {
    // 常用优先：启动次数 desc → 最近使用 desc → 名称
    if (y.count !== x.count) return y.count - x.count;
    if (y.last !== x.last) return y.last - x.last;
    return (x.name || '').localeCompare(y.name || '', 'zh');
  });
}

async function scanIfNeeded(force) {
  try {
    const st = fs.statSync(APPS_JSON);
    if (!force && Date.now() - st.mtimeMs < SCAN_TTL_MS) {
      log('apps.json fresh, skip scan');
      return;
    }
  } catch (e) { /* no cache yet */ }
  await refreshScan();
}

async function refreshScan() {
  log('scanning...');
  const { stdout, stderr } = await execAsync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${SCAN_PS1}" -OutFile "${APPS_JSON}"`,
    { timeout: 5 * 60 * 1000, windowsHide: true }
  );
  if (stdout) log('scan stdout:', stdout.trim());
  if (stderr) log('scan stderr:', stderr.trim());
}

// ---------- 启动 ----------
function recordUsage(name) {
  const usage = readJson(USAGE_JSON, {});
  const u = usage[name] || { count: 0, last: 0 };
  u.count += 1;
  u.last = Date.now();
  usage[name] = u;
  try { fs.writeFileSync(USAGE_JSON, JSON.stringify(usage, null, 2)); } catch (e) { log('usage write fail', e); }
}

async function launchApp(appInfo) {
  try {
    recordUsage(appInfo.name);
    if (appInfo.src === 'appx' && appInfo.uwp) {
      // UWP: shell:AppsFolder\<FamilyName>!<AppId>
      await execAsync(`explorer.exe "shell:AppsFolder\\${appInfo.uwp}"`, { windowsHide: true, timeout: 10 * 1000 });
      log('launched uwp:', appInfo.name);
    } else if (appInfo.exe && /\.(exe|lnk)$/i.test(appInfo.exe)) {
      // 只允许可执行目标——图标(.ico/.dll)等误传直接拒绝而不是弹"选择打开方式"
      await execAsync(`start "" "${appInfo.exe}"`, { shell: 'cmd.exe', windowsHide: true, timeout: 10 * 1000 });
      log('launched exe:', appInfo.name, appInfo.exe);
    } else {
      log('no valid launch target:', appInfo.name, appInfo.exe);
      return { ok: false, err: '未能定位启动目标（该程序可能需要从开始菜单打开）' };
    }
    return { ok: true };
  } catch (e) {
    log('launch fail:', appInfo.name, e && e.message);
    return { ok: false, err: e && e.message };
  }
}

// ---------- 窗口 ----------
let panel = null;
let tray = null;
let hideTimer = null;
let suspendHide = false;   // 文件选择等系统对话框期间挂起失焦自动收起（否则对话框连着面板一起被关）

function createPanel() {
  panel = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // 隐藏窗口不节流：牌堆随时唤起秒响应，动画/定时器不被拖慢
    },
  });
  panel.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  panel.on('blur', () => {
    if (suspendHide) return;   // 对话框打开中：不收起
    // 失焦收牌（延迟防瞬时焦点抖动误收）
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (panel && !panel.isDestroyed()) panel.hide(); }, 220);
  });
  panel.on('closed', () => { panel = null; });
}

function togglePanel() {
  if (!panel) return;
  clearTimeout(hideTimer);
  if (panel.isVisible()) {
    panel.hide();
  } else {
    panel.show();
    panel.focus();
    if (panel.webContents) panel.webContents.send('deck:shown');
  }
}

// ---------- 托盘 ----------
function createTray() {
  let img = nativeImage.createFromPath(TRAY_PNG);
  if (img.isEmpty()) {
    // 兜底：1x1 也要有托盘（真图缺失时用纯色圆点）
    img = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR42mNk+M/AwMDAxMDAwMDAAAAMAgF2AxVpAAAAAElFTkSuQmCC',
      'base64'));
  }
  tray = new Tray(img);
  buildTrayMenu();
  tray.on('click', () => togglePanel());
}
function buildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `展开牌堆（${hotkey}）`, click: () => togglePanel() },
    { label: '重新扫描本机应用', click: async () => { await refreshScan(); if (panel) panel.webContents.send('deck:apps-updated'); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`应用牌堆 · ${hotkey} 唤起`);
}

// ---------- IPC ----------
ipcMain.handle('deck:get-apps', () => getAppsInternal());
ipcMain.handle('deck:launch', async (_e, appInfo) => {
  const r = await launchApp(appInfo);
  if (panel && !panel.isDestroyed()) panel.hide();
  return r;
});
ipcMain.handle('deck:refresh', async () => {
  await refreshScan();
  return getAppsInternal();
});
ipcMain.handle('deck:hide', () => { if (panel) panel.hide(); });
ipcMain.handle('deck:suspend-hide', (_e, v) => { suspendHide = !!v; return suspendHide; });
ipcMain.handle('deck:get-hotkey', () => hotkey);
ipcMain.handle('deck:set-hotkey', (_e, acc) => registerHotkey(acc));
ipcMain.handle('deck:open-exe-dir', (_e, exePath) => {
  if (exePath) shell.showItemInFolder(exePath);
});

// ---------- 生命周期 ----------
app.whenReady().then(async () => {
  log('=== launcher-deck start ===');
  createPanel();
  createTray();
  const ok = globalShortcut.register(hotkey, togglePanel);
  log('hotkey', hotkey, 'registered:', ok);
  // 首次数据：有缓存立即用，没有就扫（不阻塞窗口创建）
  await scanIfNeeded(false);
  if (panel && !panel.isDestroyed()) panel.webContents.send('deck:apps-updated');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => {
  // 托盘常驻：关窗不退出
});
