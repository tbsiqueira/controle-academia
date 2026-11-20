param()

# Static checks for Meu Treino (no Node/npm needed).
# Usage: powershell -ExecutionPolicy Bypass -File .\check.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$script:fail = 0

function Ok($msg) { Write-Host "  ok    $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red; $script:fail++ }

function Read-Text($relative) {
  return [System.IO.File]::ReadAllText((Join-Path $root $relative), [System.Text.Encoding]::UTF8)
}

# Fingerprint of the sample data content: compares the MEANING of the file, not the
# bytes. So it doesn't matter whether the JSON was serialized by Windows PowerShell 5.1
# or by PowerShell 7 (different formatting/escapes).
function Get-FixtureFingerprint([string]$path) {
  $doc = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  $inv = [System.Globalization.CultureInfo]::InvariantCulture
  $lines = New-Object System.Collections.Generic.List[string]

  $lines.Add('app|' + $doc.app + '|' + $doc.version + '|' + $doc.sample)

  foreach ($s in $doc.data.sheets) {
    $lines.Add('sheet|' + $s.id + '|' + $s.name + '|' + $s.active)
    foreach ($i in $s.exercises) {
      $reps = @($i.reps) | ForEach-Object { if ($null -eq $_) { 'null' } else { ([double]$_).ToString($inv) } }
      $lines.Add('item|' + $i.exerciseId + '|' + $i.name + '|' + $i.sets + '|' + ($reps -join ',') + '|' + $i.note)
    }
  }

  foreach ($w in $doc.data.workouts) {
    $lines.Add('workout|' + $w.id + '|' + $w.dayOffset + '|' + $w.sheetId + '|' + $w.sheetName + '|' + $w.cardioMinutes + '|' + $w.notes)
    foreach ($wu in $w.warmups) {
      $lines.Add('warm|' + $wu.exerciseId + '|' + $wu.exerciseName + '|' +
        ([double]$wu.reps).ToString($inv) + '|' + ([double]$wu.load).ToString($inv) + '|' + ([double]$wu.rir).ToString($inv))
    }
    foreach ($st in $w.sets) {
      $lines.Add('set|' + $st.exerciseId + '|' + $st.exerciseName + '|' + $st.number + '|' +
        ([double]$st.reps).ToString($inv) + '|' + ([double]$st.load).ToString($inv) + '|' + ([double]$st.rir).ToString($inv) + '|' +
        $st.note + '|' + $st.exerciseNote)
    }
  }

  foreach ($e in $doc.data.exercises) {
    $lines.Add('ex|' + $e.id + '|' + $e.name + '|' + $e.group + '|' + $e.source + '|' + $e.correction + '|' + $e.active)
  }

  foreach ($n in $doc.data.colinha) {
    $lines.Add('note|' + $n.id + '|' + $n.title + '|' + $n.content + '|' + $n.order)
  }

  $lines.Add('settings|' + $doc.data.settings.weekAnchor + '|' + $doc.data.settings.weeklyWorkoutTarget + '|' + $doc.data.settings.weeklyCardioTarget)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  return [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
}

Write-Host "Meu Treino - static checks" -ForegroundColor Cyan

# 1) Valid JSON files
foreach ($file in @('manifest.webmanifest', 'data/exercises.json')) {
  try {
    $null = (Read-Text $file) | ConvertFrom-Json
    Ok "$file is valid JSON"
  } catch {
    Bad "$file is invalid: $($_.Exception.Message)"
  }
}

# 2) Catalog: count and unique ids
$catalog = (Read-Text 'data/exercises.json') | ConvertFrom-Json
$ids = @($catalog.exercises | ForEach-Object { $_.id })
$unique = @($ids | Sort-Object -Unique)
if ($catalog.exercises.Count -eq $unique.Count) {
  Ok "catalog has $($unique.Count) exercises and unique ids"
} else {
  Bad "catalog has duplicate ids ($($catalog.exercises.Count) items, $($unique.Count) ids)"
}
if ([int]$catalog.meta.nextId -gt [int]($ids | Measure-Object -Maximum).Maximum) {
  Ok "meta.nextId ($($catalog.meta.nextId)) is still after the highest id"
} else {
  Bad "meta.nextId ($($catalog.meta.nextId)) is not greater than the highest id"
}

# 3) index.html <-> js/app.js: every getElementById must exist (or be created dynamically)
$html = Read-Text 'index.html'
$js = Read-Text 'js/app.js'
$dynamicIds = @('btnConfirmWeek', 'eraseAck', 'eraseConfirmBtn', 'reminderBackup', 'reminderDismiss', 'dataCopy', 'dataExport', 'dataStatus',
                'btnResumeDraft', 'btnDiscardDraft', 'btnRepeatLast', 'btnShowAllWorkouts', 'btnShowLessWorkouts', 'workoutFilter')

$htmlIds = @([regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$usedIds = @([regex]::Matches($js, "getElementById\('([^']+)'\)") | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$missingIds = @($usedIds | Where-Object { $htmlIds -notcontains $_ -and $dynamicIds -notcontains $_ })
if (-not $missingIds) {
  Ok "every id used in the JS exists in the HTML"
} else {
  Bad "ids with no element in the HTML: $($missingIds -join ', ')"
}

# 4) inline handlers (onclick) must exist as a function
$functions = @([regex]::Matches($js, 'function\s+([A-Za-z0-9_]+)\s*\(') | ForEach-Object { $_.Groups[1].Value })
$inlineHandlers = @([regex]::Matches($js, 'onclick="([A-Za-z0-9_]+)\(') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$missingFns = @($inlineHandlers | Where-Object { $functions -notcontains $_ })
if (-not $missingFns) {
  Ok "every onclick handler exists ($($inlineHandlers.Count) checked)"
} else {
  Bad "handlers with no function: $($missingFns -join ', ')"
}

# 5) assets referenced in the HTML
$refs = @([regex]::Matches($html, '(?:src|href)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -notmatch '^#' -and $_ -notmatch '^[a-z]+:' })
$missingFiles = @($refs | Where-Object { -not (Test-Path (Join-Path $root ($_ -replace '\?.*$', ''))) })
if (-not $missingFiles) {
  Ok "every asset referenced by the HTML exists"
} else {
  Bad "missing assets: $($missingFiles -join ', ')"
}

# 6) service worker assets
$sw = Read-Text 'sw.js'
$swAssets = @([regex]::Matches($sw, "'\./([^']+)'") | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne '' })
$missingSw = @($swAssets | Where-Object { -not (Test-Path (Join-Path $root ($_ -replace '\?.*$', ''))) })
if (-not $missingSw) {
  Ok "every service worker asset exists ($($swAssets.Count))"
} else {
  Bad "missing service worker assets: $($missingSw -join ', ')"
}

# 7) consistent version between the HTML and the service worker
$htmlVersion = ([regex]::Match($html, 'id="appVersion">v(\d+)<')).Groups[1].Value
$swVersion = ([regex]::Match($sw, "meu-treino-v(\d+)")).Groups[1].Value
$queryVersions = @([regex]::Matches($html, '\?v=(\d+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
if ($htmlVersion -and $htmlVersion -eq $swVersion -and $queryVersions.Count -eq 1 -and $queryVersions[0] -eq $htmlVersion) {
  Ok "consistent version: v$htmlVersion"
} else {
  Bad "inconsistent version: footer=v$htmlVersion, sw=v$swVersion, ?v=($($queryVersions -join ','))"
}

# 8) logic core + tests
if ($js -match "js/core\.js" -and $html -match "js/core\.js\?v=") {
  Ok "js/core.js is linked in index.html"
} else {
  Bad "js/core.js is not referenced in index.html"
}
if ($swAssets -contains "js/core.js?v=$htmlVersion") {
  Ok "js/core.js is in the service worker cache"
} else {
  Bad "js/core.js?v=$htmlVersion is missing from the service worker ASSETS list"
}
if (Test-Path (Join-Path $root 'tests/core.test.js')) {
  $testSource = Read-Text 'tests/core.test.js'
  if ($testSource -match "require\('\.\./js/core\.js'\)") {
    Ok "tests cover js/core.js"
  } else {
    Bad "tests/core.test.js does not import js/core.js"
  }
} else {
  Bad "tests/core.test.js not found"
}

# 9) form fields at 16px on phones (stops iOS from zooming when the field gets focus)
$css = Read-Text 'css/styles.css'
if (($css -match 'font-size:\s*16px') -and ($css -match 'max-width:\s*767\.98px')) {
  Ok "inputs at 16px on phones (no zoom on focus)"
} else {
  Bad "missing the 16px rule for inputs on phones (iOS zooms when the field gets focus)"
}

# 10) script syntax (only when Node is installed; in CI this is required)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  $syntaxErrors = @()
  foreach ($script in @('js/core.js', 'js/app.js', 'js/db.js', 'sw.js')) {
    & node --check $script 2>$null
    if ($LASTEXITCODE -ne 0) { $syntaxErrors += $script }
  }
  if (-not $syntaxErrors) {
    Ok "script syntax validated with node --check"
  } else {
    Bad "syntax error in: $($syntaxErrors -join ', ')"
  }
} else {
  Write-Host "  --    node not installed: syntax not checked locally (CI checks it)" -ForegroundColor DarkGray
}

# 11) sample data (same fixture the tests use)
$samplePath = Join-Path $root 'data/sample-data.json'
if (Test-Path $samplePath) {
  try {
    $sample = (Read-Text 'data/sample-data.json') | ConvertFrom-Json
  } catch {
    $sample = $null
    Bad "data/sample-data.json is invalid: $($_.Exception.Message)"
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
      Ok "sample data: 3 sheets (5+ from the catalog and 2 custom each) and 12 workouts"
    } else {
      Bad "sample data is not in the expected shape (3 sheets / 12 workouts / 5+2 per sheet)"
    }

    if ($swAssets -contains 'data/sample-data.json') {
      Bad "data/sample-data.json must not be precached (it is loaded on demand)"
    } else {
      Ok "sample data is out of the precache (loaded on demand)"
    }
  }
} else {
  Bad "data/sample-data.json not found"
}

# 12) committed tools: the sample fixture is in sync with the generator
$generator = Join-Path $root 'tools/build-sample-data.ps1'
if (Test-Path $generator) {
  $tmpSample = Join-Path ([System.IO.Path]::GetTempPath()) ('mt-sample-check-' + [guid]::NewGuid().ToString('N') + '.json')
  try {
    & $generator -OutputPath $tmpSample 6>$null | Out-Null
    $fpCommitted = Get-FixtureFingerprint (Join-Path $root 'data/sample-data.json')
    $fpGenerated = Get-FixtureFingerprint $tmpSample
    if ($fpCommitted -eq $fpGenerated) {
      Ok "sample data is in sync with tools/build-sample-data.ps1 (content)"
    } else {
      Bad "data/sample-data.json differs from the generator - run: tools/build-sample-data.ps1"
    }
  } catch {
    Bad "failed to run the generator: $($_.Exception.Message)"
  } finally {
    if (Test-Path $tmpSample) { Remove-Item $tmpSample -Force }
  }
} else {
  Bad "tools/build-sample-data.ps1 not found"
}

# 13) enforced coverage gate + feature checklist
if (Test-Path (Join-Path $root 'tools/coverage-gate.js')) {
  $gateSource = Read-Text 'tools/coverage-gate.js'
  $workflowTests = Read-Text '.github/workflows/tests.yml'

  if ($workflowTests -match 'tools/coverage-gate\.js') {
    Ok "coverage gate wired into CI (tools/coverage-gate.js)"
  } else {
    Bad "the tests workflow does not run tools/coverage-gate.js"
  }

  if ($gateSource -match 'js/core\.js' -and $gateSource -match 'COVERAGE_ENFORCE') {
    Ok "coverage gate requires 100% of js/core.js"
  } else {
    Bad "tools/coverage-gate.js does not require 100% of js/core.js"
  }
} else {
  Bad "tools/coverage-gate.js not found"
}

if (Test-Path (Join-Path $root 'tests/CHECKLIST.md')) {
  $checklist = Read-Text 'tests/CHECKLIST.md'
  if ($checklist -match 'Feature' -and $checklist -match 'core\.js') {
    Ok "feature x tests checklist is present"
  } else {
    Bad "tests/CHECKLIST.md has no feature table"
  }
} else {
  Bad "tests/CHECKLIST.md not found"
}

# 14) every function called in js/app.js must exist (avoids a runtime ReferenceError,
#     which Node's --check syntax check does NOT catch)
$appSource = Read-Text 'js/app.js'
$coreSource = Read-Text 'js/core.js'
$dbSource = Read-Text 'js/db.js'

# strip strings and comments: only real calls and definitions are left
$limpo = $appSource
$limpo = [regex]::Replace($limpo, "'([^'\\\n]|\\.)*'", "''")
$limpo = [regex]::Replace($limpo, '"([^"\\\n]|\\.)*"', '""')
$limpo = [regex]::Replace($limpo, '/\*[\s\S]*?\*/', ' ')
$limpo = [regex]::Replace($limpo, '(?m)//.*$', ' ')

$chamadas = @([regex]::Matches($limpo, '(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(') |
  ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)

$definidasApp = @([regex]::Matches($limpo, '(?:function|async function)\s+([A-Za-z_$][\w$]*)\s*\(') |
  ForEach-Object { $_.Groups[1].Value })
$definidasApp += @([regex]::Matches($limpo, '(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=') |
  ForEach-Object { $_.Groups[1].Value })
# parameter names are callable too (callbacks such as resolve/reject)
$definidasApp += @([regex]::Matches($limpo, 'function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)') |
  ForEach-Object { $_.Groups[1].Value -split ',' } |
  ForEach-Object { $_.Trim() -replace '=.*$', '' } |
  Where-Object { $_ -match '^[A-Za-z_$][\w$]*$' })

$definidasCore = @([regex]::Matches($coreSource, '(?:function|async function)\s+([A-Za-z_$][\w$]*)\s*\(') |
  ForEach-Object { $_.Groups[1].Value })
$coreKeys = @()
$coreReturn = $coreSource.LastIndexOf("  return {")
if ($coreReturn -ge 0) {
  $coreKeys = @([regex]::Matches($coreSource.Substring($coreReturn), '(?m)^\s{4}([A-Za-z_$][\w$]*):') |
    ForEach-Object { $_.Groups[1].Value })
}

$definidasDb = @([regex]::Matches($dbSource, '(?:function|async function)\s+([A-Za-z_$][\w$]*)\s*\(') |
  ForEach-Object { $_.Groups[1].Value })

$nativas = @(
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'await', 'do',
  'else', 'case', 'delete', 'in', 'instanceof', 'void', 'yield', 'try', 'finally', 'throw', 'class',
  'super', 'this', 'with', 'debugger',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'String', 'Number', 'Boolean', 'Array', 'Object',
  'JSON', 'Date', 'Math', 'RegExp', 'Promise', 'Error', 'Map', 'Set', 'Symbol', 'BigInt', 'File',
  'Blob', 'URL', 'URLSearchParams', 'FormData', 'Image', 'TextEncoder', 'TextDecoder',
  'alert', 'confirm', 'prompt', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'fetch', 'btoa', 'atob', 'encodeURIComponent', 'decodeURIComponent', 'requestAnimationFrame',
  'structuredClone', 'queueMicrotask'
)

$faltando = @($chamadas | Where-Object {
  $nativas -notcontains $_ -and
  $definidasApp -notcontains $_ -and
  $definidasCore -notcontains $_ -and
  $coreKeys -notcontains $_ -and
  $definidasDb -notcontains $_
})

if (-not $faltando) {
  Ok "every function called in app.js exists ($($chamadas.Count) names checked)"
} else {
  Bad "functions called in app.js with no definition (ReferenceError): $($faltando -join ', ')"
}

# 15) the publish gate must include the browser tests (issue #88): deploy.yml calls the whole Testes
#     workflow (tests.yml), which runs the unit, static and browser tests before anything is published.
if ((Test-Path (Join-Path $root '.github/workflows/deploy.yml')) -and
    ((Read-Text '.github/workflows/deploy.yml') -match '(?m)^\s+uses:\s*\./\.github/workflows/tests\.yml\s*$')) {
  Ok "publishing runs the whole Testes workflow first (unit, static and browser tests)"
} else {
  Bad "deploy.yml does not call .github/workflows/tests.yml: a publish would skip the browser tests"
}

Write-Host ""
if ($script:fail -eq 0) {
  Write-Host "All good." -ForegroundColor Green
  exit 0
}

Write-Host "$($script:fail) check(s) failed." -ForegroundColor Red
exit 1
