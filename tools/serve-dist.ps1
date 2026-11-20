param(
  [int]$Port = 8081
)

# Serves dist/ (the output of tools/package-cloudflare.ps1) so the packaged site can be tested
# exactly as the UAT deploy ships it. Same static server as serve.ps1, with dist/ as the root.
# Usage: powershell -ExecutionPolicy Bypass -File .\tools\serve-dist.ps1

$root = Join-Path (Split-Path $PSScriptRoot -Parent) "dist"

if (-not (Test-Path (Join-Path $root "index.html"))) {
    throw "dist/index.html not found. Run tools/package-cloudflare.ps1 first."
}

$mime = @{
    '.html'        = 'text/html; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
    '.webmanifest' = 'application/manifest+json'
    '.png'         = 'image/png'
    '.woff'        = 'font/woff'
    '.woff2'       = 'font/woff2'
    '.svg'         = 'image/svg+xml'
    '.ico'         = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Serving dist/ on http://localhost:$Port/ (Ctrl+C to stop)"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }

    $path = $ctx.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }

    $file = Join-Path $root ($path -replace '/', '\')

    if ((Test-Path $file -PathType Leaf) -and ((Split-Path $file -Parent) -like "$root*")) {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.StatusCode = 200
        $ctx.Response.ContentType = $type
        $ctx.Response.Headers.Add('Cache-Control', 'no-store')
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }

    $ctx.Response.Close()
}
