param(
  [int]$Port = 8080
)

# Local static server for testing the PWA without Node/Python.
# localhost is a secure context, so the service worker and install work.
# Usage: powershell -ExecutionPolicy Bypass -File .\serve.ps1

$root = $PSScriptRoot

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
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

Write-Host "Meu Treino sendo servido em http://localhost:$Port/ (Ctrl+C para parar)"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }

  $req = $ctx.Request
  $relPath = $req.Url.AbsolutePath.TrimStart('/')
  if ($relPath -eq '') { $relPath = 'index.html' }

  $file = Join-Path $root ($relPath -replace '/', '\')

  if ((Test-Path $file -PathType Leaf) -and ((Split-Path $file -Parent) -like "$root*")) {
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ctx.Response.StatusCode = 200
    $ctx.Response.ContentType = $type
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }

  $ctx.Response.Close()
}
