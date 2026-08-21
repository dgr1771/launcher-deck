# audit all launch targets: flag suspicious ones (uninstaller/updater/helper/mismatch)
param([string]$File = "$env:TEMP\ld-scan-test.json")

$raw = Get-Content $File -Raw -Encoding UTF8
$j = $raw | ConvertFrom-Json

$suspectPat = 'unins|uninstall|update[r]?\.exe$|setup|crashpad|helper|elevation|\.tmp'
$rows = @()
foreach ($a in ($j.apps | Where-Object { $_.src -ne 'appx' })) {
  $exe = [string]$a.exe
  $leaf = if ($exe) { Split-Path $exe -Leaf } else { '(none)' }
  $flag = ''
  if (-not $exe) { $flag = 'NO-TARGET' }
  elseif ($leaf -match $suspectPat) { $flag = 'SUSPECT-NAME' }
  elseif ($exe -and -not (Test-Path $exe)) { $flag = 'MISSING-FILE' }
  elseif ($exe -and (Get-Item $exe -ErrorAction SilentlyContinue).Length -lt 100KB) { $flag = 'TINY(<100KB)' }
  $rows += [PSCustomObject]@{ name = $a.name; leaf = $leaf; flag = $flag; dir = if ($exe) { Split-Path $exe } else { '' } }
}
$bad = @($rows | Where-Object { $_.flag })
Write-Host ("total desktop apps: " + $rows.Count + "   flagged: " + $bad.Count)
Write-Host "--- flagged ---"
$bad | ForEach-Object { Write-Host ("[" + $_.flag + "] " + $_.name + " -> " + $_.leaf) }
Write-Host "--- all targets ---"
$rows | ForEach-Object { Write-Host ($_.name + "  =>  " + $_.leaf) }
