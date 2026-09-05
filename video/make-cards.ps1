Add-Type -AssemblyName System.Drawing
$W = 1920; $H = 1080
$outDir = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 244, 252))
$gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 215, 130))

function New-BaseCard {
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 17, 19, 27))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 88, 101, 242), 6)
    $g.DrawLine($pen, 760, 640, 1160, 640)
    $g.Dispose()
    return $bmp
}

function Add-Text {
    param([System.Drawing.Bitmap]$bmp, [string]$text, [int]$size, [System.Drawing.SolidBrush]$brush, [int]$y, [bool]$bold)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $style = [System.Drawing.FontStyle]::Regular
    if ($bold) { $style = [System.Drawing.FontStyle]::Bold }
    $f = New-Object System.Drawing.Font("Microsoft YaHei", $size, $style)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, $y, $W, 220)
    $g.DrawString($text, $f, $brush, $rect, $sf)
    $g.Dispose()
}

function Save-Png {
    param([System.Drawing.Bitmap]$bmp, [string]$name)
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "saved $name"
}

$b = New-BaseCard
Add-Text $b ([char]0x2726) 60 $gold 120 $true
Add-Text $b "51 apps" 80 $white 320 $true
Add-Text $b "to one tarot deck" 40 $gray 660 $false
Add-Text $b "ZERO TYPING" 34 $gold 800 $true
Save-Png $b "title.png"

$b2 = New-BaseCard
Add-Text $b2 ([char]0x2726) 60 $gold 120 $true
Add-Text $b2 "FREE & OPEN SOURCE" 66 $white 340 $true
Add-Text $b2 "GitHub: launcher-deck" 36 $gray 620 $false
Add-Text $b2 "dev: bubu" 30 $gold 800 $true
Save-Png $b2 "ending.png"
