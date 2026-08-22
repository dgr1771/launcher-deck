# Fullscreen pure-white topmost window: worst-case backdrop for glass readability testing
# ASCII only (PS 5.1 GBK rule)
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.Form
$f.BackColor = [System.Drawing.Color]::White
$f.FormBorderStyle = 'None'
$f.WindowState = 'Maximized'
$f.TopMost = $true
$f.Add_Click({ $f.Close() })
[System.Windows.Forms.Application]::Run($f)
