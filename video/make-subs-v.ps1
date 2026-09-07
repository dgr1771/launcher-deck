# Generate vertical CJK subtitle bars 1080x220 (font 56 bold)
Add-Type -AssemblyName System.Drawing
$W = 1080
$outDir = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards-v"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

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
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 248, 252))
    $rect = New-Object System.Drawing.RectangleF(0, 0, $W, 220)
    $g.DrawString($text, $f, $white, $rect, $sf)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "sub $name"
}

New-Sub "v-sub-flip.png"   "鼠标扫过 · 牌自动翻面"
New-Sub "v-sub-hover.png"  "悬停看详情 · 单击直接启动"
New-Sub "v-sub-suit.png"   "花色分类 · 强迫症狂喜"
New-Sub "v-sub-theme.png"  "四套主题 · 一键换装"
New-Sub "v-sub-deal.png"   "还藏了一局空当接龙"
New-Sub "v-sub-read.png"   "每张牌 · 都有一段牌意"
New-Sub "v-sub-ctrl.png"   "Ctrl+J 随时唤起 · 随时收起"
