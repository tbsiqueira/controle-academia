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

# 8) núcleo de lógica + testes
if ($js -match "js/core\.js" -and $html -match "js/core\.js\?v=") {
  Ok "js/core.js ligado no index.html"
} else {
  Bad "js/core.js nao esta referenciado no index.html"
}
if ($swAssets -contains "js/core.js?v=$htmlVersion") {
  Ok "js/core.js no cache do service worker"
} else {
  Bad "js/core.js?v=$htmlVersion ausente da lista ASSETS do service worker"
}
if (Test-Path (Join-Path $root 'tests/core.test.js')) {
  $testSource = Read-Text 'tests/core.test.js'
  if ($testSource -match "require\('\.\./js/core\.js'\)") {
    Ok "testes cobrindo js/core.js"
  } else {
    Bad "tests/core.test.js nao importa js/core.js"
  }
} else {
  Bad "tests/core.test.js nao encontrado"
}

# 9) campos de formulário com 16px no celular (evita o zoom automático do iOS)
$css = Read-Text 'css/styles.css'
if (($css -match 'font-size:\s*16px') -and ($css -match 'max-width:\s*767\.98px')) {
  Ok "inputs com 16px no celular (sem zoom ao focar)"
} else {
  Bad "falta a regra de 16px nos inputs para celular (o iOS da zoom ao focar o campo)"
}

# 10) sintaxe dos scripts (só quando o Node está instalado; no CI isso é obrigatório)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  $syntaxErrors = @()
  foreach ($script in @('js/core.js', 'js/app.js', 'js/db.js', 'sw.js')) {
    & node --check $script 2>$null
    if ($LASTEXITCODE -ne 0) { $syntaxErrors += $script }
  }
  if (-not $syntaxErrors) {
    Ok "sintaxe dos scripts validada com node --check"
  } else {
    Bad "erro de sintaxe em: $($syntaxErrors -join ', ')"
  }
} else {
  Write-Host "  --    node nao instalado: sintaxe nao verificada localmente (o CI verifica)" -ForegroundColor DarkGray
}

# 11) dados de exemplo (mesma fixture usada pelos testes)
$samplePath = Join-Path $root 'data/sample-data.json'
if (Test-Path $samplePath) {
  try {
    $sample = (Read-Text 'data/sample-data.json') | ConvertFrom-Json
  } catch {
    $sample = $null
    Bad "data/sample-data.json invalido: $($_.Exception.Message)"
  }

  if ($sample) {
    $shapeOk = ($sample.sample -eq $true) -and (@($sample.data.sheets).Count -eq 3) -and (@($sample.data.workouts).Count -eq 12)
    $perSheetOk = $true
    foreach ($sheet in $sample.data.sheets) {
      $cat = @($sheet.exercises | Where-Object { -not $_.exerciseId }).Count
      $custom = @($sheet.exercises | Where-Object { $_.exerciseId }).Count
      $workouts = @($sample.data.workouts | Where-Object { $_.sheetId -eq $sheet.id }).Count
      if ($cat -lt 5 -or $custom -ne 2 -or $workouts -ne 4) { $perSheetOk = $false }
    }

    if ($shapeOk -and $perSheetOk) {
      Ok "dados de exemplo: 3 fichas (5+ catalogo e 2 custom cada) e 12 treinos"
    } else {
      Bad "dados de exemplo fora do formato esperado (3 fichas / 12 treinos / 5+2 por ficha)"
    }

    if ($swAssets -contains 'data/sample-data.json') {
      Bad "data/sample-data.json nao deve entrar no precache (e carregado sob demanda)"
    } else {
      Ok "dados de exemplo fora do precache (carregados sob demanda)"
    }
  }
} else {
  Bad "data/sample-data.json nao encontrado"
}

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "Tudo certo." -ForegroundColor Green
  exit 0
}

Write-Host "$($script:fail) verificacao(oes) falharam." -ForegroundColor Red
exit 1
