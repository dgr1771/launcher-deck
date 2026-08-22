# Generate assets/icon.ico (256x256 PNG-in-ICO) from assets/tray.png
# ASCII only: PowerShell 5.1 reads BOM-less files as GBK, Chinese comments corrupt parsing
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\assets\tray.png"
$outPath = Join-Path $PSScriptRoot "..\assets\icon.ico"

$img = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))

# draw onto 256x256 RGBA canvas
$bmp = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()
$img.Dispose()

# export canvas as PNG bytes
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$bmp.Dispose()
$ms.Dispose()

# ICO container: ICONDIR(6) + ICONDIRENTRY(16) + PNG payload
$fs = [System.IO.File]::Create((Join-Path (Resolve-Path "$PSScriptRoot\..") "assets\icon.ico"))
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([uint16]0)              # reserved
$bw.Write([uint16]1)              # type: icon
$bw.Write([uint16]1)              # count
$bw.Write([byte]0)                # width 256 -> 0
$bw.Write([byte]0)                # height 256 -> 0
$bw.Write([byte]0)                # palette
$bw.Write([byte]0)                # reserved
$bw.Write([uint16]1)              # color planes
$bw.Write([uint16]32)             # bits per pixel
$bw.Write([uint32]$png.Length)    # payload size
$bw.Write([uint32](6 + 16))       # payload offset
$bw.Write($png)
$bw.Flush(); $bw.Close(); $fs.Dispose()

Write-Host ("icon written: " + $outPath + " (" + $png.Length + " png bytes)")
