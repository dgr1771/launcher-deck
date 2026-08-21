# Send a global hotkey combination via keybd_event
param(
    [string]$Keys = "ctrl+j",
    [int]$AfterMs = 1200
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Kb2 {
    [DllImport("user32.dll")] public static extern uint keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$KEYEVENTF_KEYUP = 0x2
$map = @{ ctrl = 0x11; alt = 0x12; shift = 0x10; win = 0x5B }

$parts = $Keys.ToLower() -split "\+"
$down = @()
foreach ($p in $parts) {
    $vk = 0
    if ($map.ContainsKey($p)) { $vk = $map[$p] }
    elseif ($p.Length -eq 1) { $vk = [int][char]$p.ToUpper() }
    if ($vk -gt 0) { $down += [byte]$vk }
}
# modifiers first, then last key; release reverse order
for ($i = 0; $i -lt $down.Count; $i++) { [Kb2]::keybd_event($down[$i], 0, 0, [UIntPtr]::Zero) | Out-Null; Start-Sleep -Milliseconds 30 }
for ($i = $down.Count - 1; $i -ge 0; $i--) { [Kb2]::keybd_event($down[$i], 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero) | Out-Null; Start-Sleep -Milliseconds 30 }
Write-Host ("sent: " + $Keys)
Start-Sleep -Milliseconds $AfterMs
