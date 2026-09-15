Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$Width,
        [int]$Height
    )
    $src = [System.Drawing.Bitmap]::FromFile($SourcePath)
    $dest = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $scale = [Math]::Min($Width / $src.Width, $Height / $src.Height)
    $drawW = [int]($src.Width * $scale)
    $drawH = [int]($src.Height * $scale)
    $posX = [int](($Width - $drawW) / 2)
    $posY = [int](($Height - $drawH) / 2)

    $graphics.DrawImage($src, $posX, $posY, $drawW, $drawH)
    $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $dest.Dispose()
    $src.Dispose()
    Write-Host "Generated $DestPath with dimensions ${Width}x${Height}"
}

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'logo-src.png'

$icon192 = Join-Path $root 'icon-192.png'
$icon512 = Join-Path $root 'icon-512.png'
$appleIcon = Join-Path $root 'apple-touch-icon.png'

Resize-Image -SourcePath $source -DestPath $icon192 -Width 192 -Height 192
Resize-Image -SourcePath $source -DestPath $icon512 -Width 512 -Height 512
Resize-Image -SourcePath $source -DestPath $appleIcon -Width 192 -Height 192

$publicDir = Join-Path $root 'public'
Copy-Item $icon192 (Join-Path $publicDir 'icon-192.png') -Force
Copy-Item $icon512 (Join-Path $publicDir 'icon-512.png') -Force
Copy-Item $appleIcon (Join-Path $publicDir 'apple-touch-icon.png') -Force

Write-Host "All icons generated and copied successfully."
