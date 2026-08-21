# inspect scan result: doubao exe + invalid/missing launch targets
param([string]$File = "$env:TEMP\ld-scan-test.json")

$raw = Get-Content $File -Raw -Encoding UTF8
$j = $raw | ConvertFrom-Json
$d = $j.apps | Where-Object { $_.name -eq '豆包' }
Write-Host ("doubao exe: " + $d.exe)

$bad = @($j.apps | Where-Object { $_.src -ne 'appx' -and $_.exe -and $_.exe -notmatch '\.(exe|lnk)$' })
Write-Host ("bad ext count: " + $bad.Count)
$bad | Select-Object -First 5 | ForEach-Object { Write-Host ("  BAD " + $_.name + " -> " + $_.exe) }

$noexe = @($j.apps | Where-Object { $_.src -ne 'appx' -and -not $_.exe })
Write-Host ("no exe count: " + $noexe.Count)
$noexe | Select-Object -First 8 | ForEach-Object { Write-Host ("  NOEXE " + $_.name) }

# doubao-like entries (Chinese literals break in GBK-read ps1 files - build via char codes)
$nmDou = [string][char]0x8C46 + [char]0x5305   # "doubao" in Chinese
$d2 = $j.apps | Where-Object { $_.name -eq $nmDou }
Write-Host ("doubao entry: " + ($(if ($d2) { $d2.exe } else { '(not in scan result)' })))

# sample a few known apps
foreach ($n in @('微信','腾讯会议','7-Zip 26.02 (x64)','Obsidian','Google Chrome')) {
  $a = $j.apps | Where-Object { $_.name -eq $n } | Select-Object -First 1
  if ($a) { Write-Host ($n + " -> " + ($a.exe -replace '^.*\\','')) }
}
