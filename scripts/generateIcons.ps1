Add-Type -AssemblyName System.Drawing

function Generate-PwaIcon {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$CanvasSize,
        [double]$BufferPercent = 0.19, # 19% safe zone buffer (within 18%-20% specification)
        [System.Drawing.Color]$BgColor
    )

    $src = [System.Drawing.Bitmap]::FromFile($SourcePath)

    # Dynamically scale crop rectangle to source dimensions (baseline: 1008x1067 with 980 emblem)
    $scale = [Math]::Min($src.Width / 1008.0, $src.Height / 1067.0)
    $srcCropSize = [Math]::Max(1, [Math]::Min([int][Math]::Round(980 * $scale), [Math]::Min($src.Width, $src.Height)))
    $srcCropX = [int][Math]::Max(0, [Math]::Round(($src.Width - $srcCropSize) / 2.0))
    $srcCropY = [int][Math]::Max(0, [Math]::Round(($src.Height - $srcCropSize) / 2.0))

    $dest = New-Object System.Drawing.Bitmap($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # 1. Fill background canvas with matching tone
    $brush = New-Object System.Drawing.SolidBrush($BgColor)
    $g.FillRectangle($brush, 0, 0, $CanvasSize, $CanvasSize)
    $brush.Dispose()

    # 2. Compute safe-zone buffer positioning
    $bufferPx = [int][Math]::Round($CanvasSize * $BufferPercent)
    $emblemSize = $CanvasSize - (2 * $bufferPx)
    $destX = $bufferPx
    $destY = $bufferPx

    # 3. Draw emblem scaled into centered safe-zone
    $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $emblemSize, $emblemSize)
    $srcRect = New-Object System.Drawing.Rectangle($srcCropX, $srcCropY, $srcCropSize, $srcCropSize)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    # 4. Clean any stray background artifacts beyond badge radius
    $cx = $CanvasSize / 2.0
    $cy = $CanvasSize / 2.0
    $clearRadius = ($emblemSize / 2.0) + 1.5

    for ($y = 0; $y -lt $CanvasSize; $y++) {
        for ($x = 0; $x -lt $CanvasSize; $x++) {
            $dist = [Math]::Sqrt([Math]::Pow($x - $cx, 2) + [Math]::Pow($y - $cy, 2))
            if ($dist -gt $clearRadius) {
                $dest.SetPixel($x, $y, $BgColor)
            }
        }
    }

    $dest.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()

    Write-Host "Generated $DestPath (${CanvasSize}x${CanvasSize}) - Buffer: ${bufferPx}px ($([Math]::Round($BufferPercent * 100, 1))%), Emblem: ${emblemSize}px"
}

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'logo-src.png'
$blackBg = [System.Drawing.Color]::FromArgb(255, 0, 0, 0)

$icon192 = Join-Path $root 'icon-192.png'
$icon512 = Join-Path $root 'icon-512.png'
$maskable192 = Join-Path $root 'icon-maskable-192.png'
$maskable512 = Join-Path $root 'icon-maskable-512.png'
$appleIcon = Join-Path $root 'apple-touch-icon.png'

# Reprocess standard launcher icons with safe-zone buffer
Generate-PwaIcon -SourcePath $source -DestPath $icon192 -CanvasSize 192 -BufferPercent 0.19 -BgColor $blackBg
Generate-PwaIcon -SourcePath $source -DestPath $icon512 -CanvasSize 512 -BufferPercent 0.19 -BgColor $blackBg

# Generate dedicated maskable icons with safe-zone buffer
Generate-PwaIcon -SourcePath $source -DestPath $maskable192 -CanvasSize 192 -BufferPercent 0.19 -BgColor $blackBg
Generate-PwaIcon -SourcePath $source -DestPath $maskable512 -CanvasSize 512 -BufferPercent 0.19 -BgColor $blackBg

# Generate Apple touch icon
Generate-PwaIcon -SourcePath $source -DestPath $appleIcon -CanvasSize 192 -BufferPercent 0.19 -BgColor $blackBg

# Synchronize generated icon assets into public/ and dist/
$targetDirs = @(
    (Join-Path $root 'public'),
    (Join-Path $root 'dist')
)

$generatedFiles = @(
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-192.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png'
)

foreach ($dir in $targetDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    foreach ($file in $generatedFiles) {
        $srcFile = Join-Path $root $file
        $destFile = Join-Path $dir $file
        Copy-Item $srcFile $destFile -Force
    }
    Write-Host "Synchronized $(@($generatedFiles).Count) icons into $(Split-Path $dir -Leaf)/"
}

Write-Host "All safe-zone icons generated and synchronized successfully."
