# Enumerate visible windows of the installed app (ground truth, no focus dependency)
# ASCII only
param([int]$WaitMs = 1500)
Start-Sleep -Milliseconds $WaitMs
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class WinEnum {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowTextW(IntPtr hWnd, [MarshalAs(UnmanagedType.LPWStr)] StringBuilder sb, int max);
    [DllImport("user32.dll")] public static extern int GetWindowTextLengthW(IntPtr hWnd);
    public static List<string> Results(uint targetPid) {
        var list = new List<string>();
        EnumWindows((h, l) => {
            uint p; GetWindowThreadProcessId(h, out p);
            if (p == targetPid) {
                int len = GetWindowTextLengthW(h);
                var sb = new StringBuilder(len + 2);
                GetWindowTextW(h, sb, len + 2);
                list.Add((IsWindowVisible(h) ? "VISIBLE " : "hidden  ") + "[" + sb.ToString() + "] rect-pid=" + p);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$pids = (Get-Process | Where-Object { $_.Path -like '*Programs\launcher-deck*' }).Id
Write-Host ("app pids: " + ($pids -join ','))
foreach ($p in $pids) {
    $r = [WinEnum]::Results([uint32]$p)
    foreach ($line in $r) { Write-Host ("pid " + $p + " -> " + $line) }
}
