# Crop a region from a PNG
param(
    [string]$InFile,
    [string]$OutFile,
    [int]$X, [int]$Y, [int]$W, [int]$H
)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile($InFile)
$rect = New-Object System.Drawing.Rectangle $X, $Y, $W, $H
$dst = $src.Clone($rect, $src.PixelFormat)
$src.Dispose()
$dst.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Write-Host ("cropped: " + $OutFile)
