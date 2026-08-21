# check weixin input method entry in the latest scan
$raw = Get-Content "$env:TEMP\ld-scan-test.json" -Raw -Encoding UTF8
$j = $raw | ConvertFrom-Json
$nm = [string][char]0x5FAE + [char]0x4FE1 + [char]0x8F93 + [char]0x5165 + [char]0x6CD5   # weixin input method
$a = $j.apps | Where-Object { $_.name -eq $nm }
Write-Host ("entry: " + $a.exe)
# what exes exist in its install dir
$dir = Split-Path $a.exe
Get-ChildItem $dir -Filter *.exe | ForEach-Object { Write-Host ("  dir-exe: " + $_.Name + " (" + [math]::Round($_.Length/1KB) + "KB)") }
