$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Dist = Join-Path $Root "dist"

# Create clean deployment directory
if (Test-Path $Dist) {
    Remove-Item $Dist -Recurse -Force
}

New-Item -ItemType Directory -Path $Dist -Force | Out-Null

# Copy application entry points (FICHA-JSON.md and TREINO-JSON.md are fetched by the app)
$Files = @(
    "index.html",
    "reset.html",
    "sw.js",
    "manifest.webmanifest",
    "FICHA-JSON.md",
    "TREINO-JSON.md"
)

foreach ($File in $Files) {
    $Source = Join-Path $Root $File

    if (-not (Test-Path $Source)) {
        throw "Missing application file: $File"
    }

    Copy-Item $Source $Dist
}

# Copy runtime asset directories
$Directories = @(
    "css",
    "js",
    "vendor",
    "data",
    "icons"
)

foreach ($Directory in $Directories) {
    $Source = Join-Path $Root $Directory

    if (-not (Test-Path $Source -PathType Container)) {
        throw "Missing application directory: $Directory"
    }

    Copy-Item $Source $Dist -Recurse
}

$packaged = @(Get-ChildItem $Dist -Recurse -File)

Write-Host "Application packaged successfully! ($($packaged.Count) files)" -ForegroundColor Green
Write-Host "Deployment directory: $Dist"

$packaged |
    ForEach-Object {
        $_.FullName.Substring($Dist.Length + 1)
    }
