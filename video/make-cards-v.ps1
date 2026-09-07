# Generate vertical (1080x1920) cards for Douyin 9:16
Add-Type -AssemblyName System.Drawing
$W = 1080; $H = 1920
$outDir = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards-v"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 244, 252))
$gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 215, 130))

function New-BaseCard {
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 17, 19, 27))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 88, 101, 242), 6)
    $g.DrawLine($pen, 340, 1180, 740, 1180)
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
    $rect = New-Object System.Drawing.RectangleF(0, $y, $W, 300)
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
Add-Text $b ([char]0x2726) 70 $gold 220 $true
Add-Text $b "51 apps" 96 $white 480 $true
Add-Text $b "one tarot deck" 48 $gray 900 $false
Add-Text $b "ZERO TYPING" 44 $gold 1060 $true
Add-Text $b "Ctrl+J" 36 $gray 1560 $true
Save-Png $b "v-title.png"

$b2 = New-BaseCard
Add-Text $b2 ([char]0x2726) 70 $gold 220 $true
Add-Text $b2 "FREE & OPEN SOURCE" 66 $white 500 $true
Add-Text $b2 "GitHub: launcher-deck" 40 $gray 800 $false
Add-Text $b2 "dev: bubu" 38 $gold 1000 $true
Add-Text $b2 "follow for dev logs" 30 $gray 1560 $false
Save-Png $b2 "v-ending.png"
