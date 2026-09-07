# 全部片头/片尾卡（中文）——平铺数据，无嵌套哈希
Add-Type -AssemblyName System.Drawing
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 244, 252))
$gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 215, 130))
$star = [string][char]0x2726

function New-Card {
    param([string]$dir, [string]$name, [int]$W, [int]$H, [string]$l1, [int]$s1, [string]$l2, [int]$s2, [string]$l3, [int]$s3)
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::FromArgb(255, 17, 19, 27))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 88, 101, 242), 6)
    $g.DrawLine($pen, [int]($W * 0.27), [int]($H * 0.60), [int]($W * 0.73), [int]($H * 0.60))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $f0 = New-Object System.Drawing.Font("DejaVu Sans", 40, [System.Drawing.FontStyle]::Bold)
    $g.DrawString($star, $f0, $gold, (New-Object System.Drawing.RectangleF(0, [int]($H * 0.08), $W, 120)), $sf)
    $f1 = New-Object System.Drawing.Font("Microsoft YaHei", $s1, [System.Drawing.FontStyle]::Bold)
    $g.DrawString($l1, $f1, $white, (New-Object System.Drawing.RectangleF(0, [int]($H * 0.24), $W, [int]($H * 0.2))), $sf)
    $f2 = New-Object System.Drawing.Font("Microsoft YaHei", $s2)
    $g.DrawString($l2, $f2, $gray, (New-Object System.Drawing.RectangleF(0, [int]($H * 0.62), $W, [int]($H * 0.12))), $sf)
    $f3 = New-Object System.Drawing.Font("Microsoft YaHei", $s3, [System.Drawing.FontStyle]::Bold)
    $g.DrawString($l3, $f3, $gold, (New-Object System.Drawing.RectangleF(0, [int]($H * 0.76), $W, [int]($H * 0.12))), $sf)
    $g.Dispose()
    $bmp.Save((Join-Path $dir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "saved $name"
}

$H1 = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards"
$V = "C:\Users\67842\ZCodeProject\launcher-deck\video\cards-v"
New-Item -ItemType Directory -Force -Path $H1, $V | Out-Null

New-Card $H1 "title.png"  1920 1080 "把 51 个软件" 64 "变成一副塔罗牌" 34 "零输入 · 翻牌即达" 28
New-Card $H1 "ending.png" 1920 1080 "免费开源" 60 "GitHub 搜索 launcher-deck" 30 "开发者：隔壁村布布" 26
New-Card $V  "v-title-ai.png"  1080 1920 "我用 AI 写软件" 64 "30 天 · 3 个桌面应用" 34 "全过程记录" 28
New-Card $V  "v-ending-ai.png" 1080 1920 "一个人 = 一个团队" 52 "GitHub 搜索 launcher-deck" 30 "开发者：隔壁村布布" 26
New-Card $V  "v-title-e5.png"  1080 1920 "三套配色" 68 "你们选哪个？" 36 "评论区扣 1 / 2 / 3" 28
New-Card $V  "v-ending-e5.png" 1080 1920 "得票最高" 58 "当默认主题 · 结果下期公布" 30 "关注不迷路" 26
New-Card $V  "v-title.png"  1080 1920 "51 个软件" 68 "变成一副塔罗牌" 34 "零输入 · 翻牌即达" 28
New-Card $V  "v-ending.png" 1080 1920 "免费开源" 58 "GitHub 搜索 launcher-deck" 30 "开发者：隔壁村布布" 26
