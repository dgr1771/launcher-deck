# timed scan wrapper
$sw = [Diagnostics.Stopwatch]::StartNew()
& "$PSScriptRoot\scan.ps1" -OutFile "$env:TEMP\ld-scan-test.json"
Write-Host ("elapsed: {0:N1}s" -f $sw.Elapsed.TotalSeconds)
