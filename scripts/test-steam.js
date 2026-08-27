// 验证 main.js 的 Steam 识别逻辑（与实现同步拷贝，避免 bash 内联转义坑）
const fs = require('fs');
const path = require('path');
function steamAppIdFor(exe) {
  try {
    const m = String(exe).match(/steamapps[\\/]common[\\/]([^\\/]+)/i);
    if (!m) return null;
    const idx = String(exe).toLowerCase().indexOf('steamapps');
    const steamapps = exe.slice(0, idx + 'steamapps'.length);
    const installDir = m[1].toLowerCase();
    for (const f of fs.readdirSync(steamapps)) {
      if (!f.startsWith('appmanifest_') || !f.endsWith('.acf')) continue;
      try {
        const txt = fs.readFileSync(path.join(steamapps, f), 'utf8');
        const dirM = txt.match(/"installdir"\s*"([^"]+)"/);
        if (!dirM || dirM[1].toLowerCase() !== installDir) continue;
        const idM = txt.match(/"appid"\s*"(\d+)"/);
        if (idM) return idM[1];
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}
const bside = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\BSide Olivia Lin Test\\0.0.9.627\\NutWaveleter.exe';
console.log('BSide appid:', steamAppIdFor(bside));
console.log('non-steam:', steamAppIdFor('C:\\Program Files\\SomeApp\\app.exe'));
console.log('steam-lib-2nd-drive:', steamAppIdFor('D:\\SteamLibrary\\steamapps\\common\\SomeGame\\game.exe') === null ? '(无该库,预期null)' : '?');
