param(
  [string]$OutputPath = '',
  [string]$ContentPath = ''
)

# Builds data/sample-data.json (the app's sample data).
#
# This script is ASCII-only on purpose: the Portuguese content (names and text) lives in
# tools/sample-data-content.json, always read as UTF-8. That way it runs the same on
# Windows PowerShell 5.1 and PowerShell 7 (Linux/CI), with no risk of broken accents.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1
#   powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1 -OutputPath "$env:TEMP\check.json"

$ErrorActionPreference = 'Stop'

# Deterministic output: same culture on any machine or PowerShell version.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $OutputPath) { $OutputPath = Join-Path $root 'data/sample-data.json' }
if (-not $ContentPath) { $ContentPath = Join-Path $PSScriptRoot 'sample-data-content.json' }

$catalog = [System.IO.File]::ReadAllText((Join-Path $root 'data/exercises.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$content = [System.IO.File]::ReadAllText($ContentPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$byId = @{}
foreach ($e in $catalog.exercises) { $byId[[int]$e.id] = $e }

$customs = @{}
foreach ($c in $content.customExercises) { $customs[$c.id] = $c }

# ---- exercises created by the user (library) ----
$exercises = @()
foreach ($c in $content.customExercises) {
  $exercises += [pscustomobject]@{
    id = $c.id; name = $c.name; group = $c.group; source = 'custom'
    correction = $c.correction; active = $true
    createdAt = '2026-09-01T10:00:00.000Z'; updatedAt = '2026-09-01T10:00:00.000Z'
  }
}

$sheets = @()
$workouts = @()
$sheetIndex = 0

foreach ($plan in $content.plan) {
  $sheetIndex++
  $items = @()

  foreach ($cid in $plan.catalogIds) {
    if (-not $byId.ContainsKey([int]$cid)) { throw ('id not found in the catalog: ' + $cid) }
    $item = $byId[[int]$cid]
    $items += [pscustomobject]@{ exerciseId = $null; name = $item.name; sets = 3; reps = @(12, 10, 8); note = '' }
  }

  foreach ($customId in $plan.customIds) {
    if (-not $customs.ContainsKey($customId)) { throw ('custom exercise not found: ' + $customId) }
    $c = $customs[$customId]
    $items += [pscustomobject]@{ exerciseId = $c.id; name = $c.name; sets = 3; reps = @(12, 10, 10); note = $c.correction }
  }

  $sheets += [pscustomobject]@{
    id = $plan.id; name = $plan.name; active = $true; exercises = $items
    createdAt = '2026-09-01T10:00:00.000Z'; updatedAt = '2026-09-01T10:00:00.000Z'
  }

  $sessions = @($plan.dayOffsets).Count

  for ($s = 0; $s -lt $sessions; $s++) {
    $progress = $s * 2.5
    $warmups = @()
    $sets = @()

    for ($i = 0; $i -lt $items.Count; $i++) {
      $item = $items[$i]
      $base = 20 + ($i * 10) + ($sheetIndex * 5)

      # warm-up on the first three exercises (half the working load)
      if ($i -lt 3) {
        $warmups += [pscustomobject]@{
          exerciseId = $item.exerciseId; exerciseName = $item.name
          reps = 15; load = [math]::Round(($base + $progress) / 2, 1); rir = 3
        }
      }

      for ($k = 0; $k -lt $item.sets; $k++) {
        $reps = $item.reps[$k]
        # last session of the sheet: fewer reps, more load (shows progress in the charts)
        if ($s -eq ($sessions - 1) -and $k -eq 2) { $reps = $reps - 1 }
        $load = $base + $progress + ($k * 2.5)

        $note = ''
        if ($k -eq 2 -and $s -eq 1) { $note = 'caiu a forca' }
        if ($k -eq 0 -and $s -eq 3) { $note = 'boa execucao' }

        $sets += [pscustomobject]@{
          exerciseId = $item.exerciseId; exerciseName = $item.name
          number = $k + 1; reps = $reps; load = $load
          rir = (@(3, 2, 1)[$k]); note = $note
          exerciseNote = $(if ($k -eq 0) { $item.note } else { '' })
        }
      }
    }

    $workouts += [pscustomobject]@{
      id = ($plan.id + '-w' + ($s + 1))
      dayOffset = [int]$plan.dayOffsets[$s]
      sheetId = $plan.id; sheetName = $plan.name
      cardioMinutes = [int]$plan.cardioMinutes[$s]; notes = [string]$plan.notes[$s]
      warmups = $warmups; sets = $sets
      createdAt = '2026-09-01T10:00:00.000Z'; updatedAt = '2026-09-01T10:00:00.000Z'
    }
  }
}

$colinha = @()
foreach ($n in $content.colinha) {
  $colinha += [pscustomobject]@{ id = $n.id; title = $n.title; content = $n.content; order = [int]$n.order }
}

$doc = [pscustomobject]@{
  app = 'meu-treino'
  version = 2
  sample = $true
  exportedAt = '2026-09-01T10:00:00.000Z'
  data = [pscustomobject]@{
    workouts = $workouts; sheets = $sheets; exercises = $exercises
    settings = [pscustomobject]@{
      id = 'app'; weekAnchor = '2026-09-01'
      weeklyWorkoutTarget = [int]$content.settings.weeklyWorkoutTarget
      weeklyCardioTarget = [int]$content.settings.weeklyCardioTarget
      tonnageVisible = $false
    }
    colinha = $colinha
  }
}

$json = $doc | ConvertTo-Json -Depth 10 -Compress

# ASCII-only JSON (\uXXXX for accents): that way Windows PowerShell 5.1 and PowerShell 7
# produce exactly the same bytes, and check.ps1 can compare them by hash.
function ConvertTo-AsciiJson([string]$text) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $text.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -gt 126 -or $code -lt 32 -or $ch -eq '<' -or $ch -eq '>' -or $ch -eq '&' -or $ch -eq "'") {
      [void]$sb.Append('\u' + $code.ToString('x4'))
    } else {
      [void]$sb.Append($ch)
    }
  }
  return $sb.ToString()
}

$json = ConvertTo-AsciiJson $json
[System.IO.File]::WriteAllText($OutputPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$check = [System.IO.File]::ReadAllText($OutputPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if (@($check.data.sheets).Count -ne 3 -or @($check.data.workouts).Count -ne 12) {
  throw 'generated fixture has an unexpected shape'
}

Write-Host ('sample data written: ' + $OutputPath)
Write-Host ('  ' + @($check.data.sheets).Count + ' sheets | ' + @($check.data.workouts).Count + ' workouts | ' +
  @($check.data.exercises).Count + ' custom exercises | ' + @($check.data.colinha).Count + ' colinhas')
