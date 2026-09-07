# E5 vote video cards: vertical 1080x1920
Add-Type -AssemblyName System.Drawing
$W = 1080; $H = 1920
$outDir = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards-v"
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

# Title card
$b = New-BaseCard
Add-Text $b ([char]0x2726) 70 $gold 260 $true
Add-Text $b "3 themes" 96 $white 480 $true
Add-Text $b "which one?" 48 $gray 880 $false
Add-Text $b "vote in comments" 40 $gold 1060 $true
Save-Png $b "v-title-e5.png"

# Ending card
$b2 = New-BaseCard
Add-Text $b2 ([char]0x2726) 70 $gold 260 $true
Add-Text $b2 "vote 1 / 2 / 3" 84 $white 480 $true
Add-Text $b2 "top voted = default theme" 38 $gray 860 $false
Add-Text $b2 "follow for dev logs" 34 $gold 1040 $true
Save-Png $b2 "v-ending-e5.png"

# Vote subtitles (vertical bars 1080x220)
function New-Sub {
    param([string]$name, [string]$text)
    $bmp = New-Object System.Drawing.Bitmap($W, 220)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $bar = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 10, 12, 18))
    $g.FillRectangle($bar, 60, 0, $W - 120, 220)
    $f = New-Object System.Drawing.Font("Microsoft YaHei UI", 52, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $w2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 248, 252))
    $rect = New-Object System.Drawing.RectangleF(0, 0, $W, 220)
    $g.DrawString($text, $f, $w2, $rect, $sf)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "sub $name"
}

New-Sub "v-vote-1.png" "1  蓝白玻璃 · 清爽"
New-Sub "v-vote-2.png" "2  少女心 · 樱粉"
New-Sub "v-vote-3.png" "3  豆沙绿 · 护眼"
