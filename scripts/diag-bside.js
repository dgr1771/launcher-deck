// 复现 BSide 直拉：spawn 后观察进程存活与窗口
const { spawn, execSync } = require('child_process');
const path = require('path');
const exe = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\BSide Olivia Lin Test\\0.0.9.627\\NutWaveleter.exe';
const c = spawn(exe, [], { detached: true, stdio: 'ignore', cwd: path.dirname(exe) });
c.on('error', e => console.log('spawn error:', e.message));
console.log('spawned pid:', c.pid);
setTimeout(() => {
  try {
    const out = execSync('powershell -NoProfile -Command "Get-Process NutWaveleter,steam -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,MainWindowTitle | Format-Table -AutoSize | Out-String"').toString();
    console.log('processes after 4s:', out.trim() || '(GONE - spawned then exited)');
  } catch (e) { console.log('check fail', e.message); }
  process.exit(0);
}, 4000);
