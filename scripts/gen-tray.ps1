# Generate a 32x32 tray icon: night-card back + gold star (matches deck visual)
param([string]$OutFile = "C:\Users\67842\ZCodeProject\launcher-deck\assets\tray.png")

Add-Type -AssemblyName System.Drawing

$dir = Split-Path $OutFile
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$size = 32
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# rounded card back
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 7
$path.AddArc(1, 1, $r * 2, $r * 2, 180, 90)
$path.AddArc($size - 1 - $r * 2, 1, $r * 2, $r * 2, 270, 90)
$path.AddArc($size - 1 - $r * 2, $size - 1 - $r * 2, $r * 2, $r * 2, 0, 90)
$path.AddArc(1, $size - 1 - $r * 2, $r * 2, $r * 2, 90, 90)
$path.CloseFigure()

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    [System.Drawing.Color]::FromArgb(255, 42, 51, 80),
    [System.Drawing.Color]::FromArgb(255, 23, 29, 51))
$g.FillPath($brush, $path)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 255, 255, 255), 1.4)
$g.DrawPath($pen, $path)

# gold star
$font = New-Object System.Drawing.Font("Segoe UI Symbol", 15, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 220, 140))
$rect = New-Object System.Drawing.RectangleF(0, -1, $size, $size)
$g.DrawString([char]0x2726, $font, $gold, $rect, $fmt)   # U+2726 star

$g.Dispose()
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "saved: $OutFile"
