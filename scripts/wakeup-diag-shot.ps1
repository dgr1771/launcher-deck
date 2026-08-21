# Show panel via Ctrl+J, measure DOM geometry, then screen-capture -- one process, no focus loss between steps
param(
    [string]$OutFile = "C:\Users\67842\ZCodeProject\launcher-deck\shots\layout-report.png"
)
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WD {
    [DllImport("user32.dll")] public static extern uint keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[WD]::SetProcessDPIAware() | Out-Null
$KEYEVENTF_KEYUP = 0x2

# 1) Ctrl+J (panel currently hidden -> this shows it)
[WD]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero) | Out-Null
Start-Sleep -Milliseconds 40
[WD]::keybd_event(0x4A, 0, 0, [UIntPtr]::Zero) | Out-Null
Start-Sleep -Milliseconds 40
[WD]::keybd_event(0x4A, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero) | Out-Null
[WD]::keybd_event(0x11, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero) | Out-Null
Write-Host "hotkey sent"
Start-Sleep -Milliseconds 900

# 2) DOM geometry (node console app does not steal focus)
Set-Location "C:\Users\67842\ZCodeProject\launcher-deck"
node scripts\diag-layout.js
Start-Sleep -Milliseconds 300

# 3) screen capture
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$dir = Split-Path $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host ("saved: " + $OutFile)
