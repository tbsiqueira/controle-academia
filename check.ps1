param()

# Verificações estáticas do Meu Treino (sem precisar de Node/npm).
# Uso: powershell -ExecutionPolicy Bypass -File .\check.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$script:fail = 0

function Ok($msg) { Write-Host "  ok    $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FALHA $msg" -ForegroundColor Red; $script:fail++ }

function Read-Text($relative) {
  return [System.IO.File]::ReadAllText((Join-Path $root $relative), [System.Text.Encoding]::UTF8)
}

Write-Host "Meu Treino - verificacoes estaticas" -ForegroundColor Cyan

# 1) JSONs válidos
foreach ($file in @('manifest.webmanifest', 'data/exercises.json')) {
  try {
    $null = (Read-Text $file) | ConvertFrom-Json
    Ok "$file e JSON valido"
  } catch {
    Bad "$file invalido: $($_.Exception.Message)"
  }
}

# 2) Catálogo: quantidade e ids únicos
$catalog = (Read-Text 'data/exercises.json') | ConvertFrom-Json
$ids = @($catalog.exercises | ForEach-Object { $_.id })
$unique = @($ids | Sort-Object -Unique)
if ($catalog.exercises.Count -eq $unique.Count) {
  Ok "catalogo com $($unique.Count) exercicios e ids unicos"
} else {
  Bad "catalogo tem ids duplicados ($($catalog.exercises.Count) itens, $($unique.Count) ids)"
}
if ([int]$catalog.meta.nextId -gt [int]($ids | Measure-Object -Maximum).Maximum) {
  Ok "meta.nextId ($($catalog.meta.nextId)) continua apos o maior id"
} else {
  Bad "meta.nextId ($($catalog.meta.nextId)) nao e maior que o maior id"
}

# 3) index.html <-> js/app.js: todo getElementById precisa existir (ou ser criado dinamicamente)
$html = Read-Text 'index.html'
$js = Read-Text 'js/app.js'
$dynamicIds = @('btnConfirmWeek', 'eraseConfirm', 'eraseAck', 'eraseConfirmBtn', 'eraseExport')

$htmlIds = @([regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$usedIds = @([regex]::Matches($js, "getElementById\('([^']+)'\)") | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$missingIds = @($usedIds | Where-Object { $htmlIds -notcontains $_ -and $dynamicIds -notcontains $_ })
if (-not $missingIds) {
  Ok "todos os ids usados no JS existem no HTML"
} else {
  Bad "ids sem elemento no HTML: $($missingIds -join ', ')"
}

# 4) handlers inline (onclick) precisam existir como função
$functions = @([regex]::Matches($js, 'function\s+([A-Za-z0-9_]+)\s*\(') | ForEach-Object { $_.Groups[1].Value })
$inlineHandlers = @([regex]::Matches($js, 'onclick="([A-Za-z0-9_]+)\(') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$missingFns = @($inlineHandlers | Where-Object { $functions -notcontains $_ })
if (-not $missingFns) {
  Ok "todos os handlers onclick existem ($($inlineHandlers.Count) verificados)"
} else {
  Bad "handlers sem funcao: $($missingFns -join ', ')"
}

# 5) assets referenciados no HTML
$refs = @([regex]::Matches($html, '(?:src|href)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -notmatch '^#' -and $_ -notmatch '^[a-z]+:' })
$missingFiles = @($refs | Where-Object { -not (Test-Path (Join-Path $root ($_ -replace '\?.*$', ''))) })
if (-not $missingFiles) {
  Ok "todos os assets do HTML existem"
} else {
  Bad "assets ausentes: $($missingFiles -join ', ')"
}

# 6) assets do service worker
$sw = Read-Text 'sw.js'
$swAssets = @([regex]::Matches($sw, "'\./([^']+)'") | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne '' })
$missingSw = @($swAssets | Where-Object { -not (Test-Path (Join-Path $root ($_ -replace '\?.*$', ''))) })
if (-not $missingSw) {
  Ok "todos os assets do service worker existem ($($swAssets.Count))"
} else {
  Bad "assets ausentes no service worker: $($missingSw -join ', ')"
}

# 7) versão consistente entre HTML e service worker
$htmlVersion = ([regex]::Match($html, 'id="appVersion">v(\d+)<')).Groups[1].Value
$swVersion = ([regex]::Match($sw, "meu-treino-v(\d+)")).Groups[1].Value
$queryVersions = @([regex]::Matches($html, '\?v=(\d+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
if ($htmlVersion -and $htmlVersion -eq $swVersion -and $queryVersions.Count -eq 1 -and $queryVersions[0] -eq $htmlVersion) {
  Ok "versao consistente: v$htmlVersion"
} else {
  Bad "versao inconsistente: footer=v$htmlVersion, sw=v$swVersion, ?v=($($queryVersions -join ','))"
}

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "Tudo certo." -ForegroundColor Green
  exit 0
}

Write-Host "$($script:fail) verificacao(oes) falharam." -ForegroundColor Red
exit 1
