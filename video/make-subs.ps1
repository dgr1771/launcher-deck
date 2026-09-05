# Generate CJK subtitle bars 1920x160 (UTF-8 BOM required for PS5.1)
Add-Type -AssemblyName System.Drawing
$W = 1920
$outDir = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Sub {
    param([string]$name, [string]$text)
    $bmp = New-Object System.Drawing.Bitmap($W, 160)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $bar = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 10, 12, 18))
    $g.FillRectangle($bar, 0, 0, $W, 160)
    $f = New-Object System.Drawing.Font("Microsoft YaHei UI", 42, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 248, 252))
    $rect = New-Object System.Drawing.RectangleF(0, 0, $W, 160)
    $g.DrawString($text, $f, $white, $rect, $sf)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "sub $name"
}

New-Sub "sub-flip.png"   "鼠标扫过 · 牌自动翻面"
New-Sub "sub-hover.png"  "悬停看详情 · 单击直接启动"
New-Sub "sub-suit.png"   "花色分类 · 强迫症狂喜"
New-Sub "sub-theme.png"  "四套主题 · 一键换装"
New-Sub "sub-deal.png"   "还藏了一局空当接龙"
New-Sub "sub-read.png"   "每张牌 · 都有一段牌意"
New-Sub "sub-ctrl.png"   "Ctrl+J 随时唤起 · 随时收起"
