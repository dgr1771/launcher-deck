# AI trend video cards: vertical 1080x1920
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

# Title: AI trend hook
$b = New-BaseCard
Add-Text $b "ME + AI" 96 $white 440 $true
Add-Text $b "3 desktop apps in 30 days" 42 $gray 840 $false
Add-Text $b [char]0x2726 70 $gold 240 $true
Add-Text $b "full process recorded" 38 $gold 1040 $true
Save-Png $b "v-title-ai.png"

# Ending
$b2 = New-BaseCard
Add-Text $b2 "one person" 60 $white 500 $true
Add-Text $b2 "= one team" 60 $gold 640 $true
Add-Text $b2 "GitHub: launcher-deck" 36 $gray 900 $false
Add-Text $b2 "follow for AI dev logs" 34 $gold 1060 $true
Save-Png $b2 "v-ending-ai.png"

# AI narrative subtitle bars (vertical 1080x220)
function New-Sub {
    param([string]$name, [string]$text)
    $bmp = New-Object System.Drawing.Bitmap($W, 220)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $bar = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 10, 12, 18))
    $g.FillRectangle($bar, 60, 0, $W - 120, 220)
    $f = New-Object System.Drawing.Font("Microsoft YaHei UI", 50, [System.Drawing.FontStyle]::Bold)
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

New-Sub "v-ai-1.png" "我把 AI 当编程搭档"
New-Sub "v-ai-2.png" "30 天写了 3 个桌面软件"
New-Sub "v-ai-3.png" "这个塔罗启动器 · AI 一起写的"
New-Sub "v-ai-4.png" "AI 逐帧复刻了洗牌动画"
New-Sub "v-ai-5.png" "它还揪出一个系统级隐藏 bug"
New-Sub "v-ai-6.png" "一个人 · 就是一个团队"
