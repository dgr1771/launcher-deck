# Send hotkey, wait, then screenshot -- all in one process (no focus steal between steps)
param(
    [string]$Keys = "ctrl+j",
    [string]$OutFile = "C:\Users\67842\launcher-eval\shots\deck-panel.png",
    [int]$WaitMs = 2000,
    [int]$MaxWidth = 1500
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class HK {
    [DllImport("user32.dll")] public static extern uint keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[HK]::SetProcessDPIAware() | Out-Null

$KEYEVENTF_KEYUP = 0x2
$map = @{ ctrl = 0x11; alt = 0x12; shift = 0x10; win = 0x5B }
$parts = $Keys.ToLower() -split "\+"
$vks = @()
foreach ($p in $parts) {
    $vk = 0
    if ($map.ContainsKey($p)) { $vk = $map[$p] }
    elseif ($p.Length -eq 1) { $vk = [int][char]$p.ToUpper() }
    if ($vk -gt 0) { $vks += [byte]$vk }
}
for ($i = 0; $i -lt $vks.Count; $i++) { [HK]::keybd_event($vks[$i], 0, 0, [UIntPtr]::Zero) | Out-Null; Start-Sleep -Milliseconds 25 }
for ($i = $vks.Count - 1; $i -ge 0; $i--) { [HK]::keybd_event($vks[$i], 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero) | Out-Null; Start-Sleep -Milliseconds 25 }
Write-Host ("sent: " + $Keys)

Start-Sleep -Milliseconds $WaitMs

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$g.Dispose()

if ($MaxWidth -gt 0 -and $bmp.Width -gt $MaxWidth) {
    $h = [int]($bmp.Height * $MaxWidth / $bmp.Width)
    $small = New-Object System.Drawing.Bitmap $MaxWidth, $h
    $sg = [System.Drawing.Graphics]::FromImage($small)
    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sg.DrawImage($bmp, 0, 0, $MaxWidth, $h)
    $sg.Dispose()
    $bmp.Dispose()
    $bmp = $small
}
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("saved: " + $OutFile)
