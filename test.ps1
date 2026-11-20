param()

# Runs the unit tests (Node, no dependencies).
# Usage: powershell -ExecutionPolicy Bypass -File .\test.ps1
#
# The tests also run on GitHub Actions (workflow "Tests") on every push to main.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js not found on this machine." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "The tests run on GitHub Actions (workflow 'Tests') on every push to main."
  Write-Host "To run them locally, install Node (https://nodejs.org) and run:"
  Write-Host "  node --test tests/"
  Write-Host ""
  Write-Host "Without Node, use the static checks:  .\check.ps1"
  exit 0
}

Push-Location $root
try {
  Write-Host "Running the tests with $($node.Source)" -ForegroundColor Cyan
  & node --test tests/
  $code = $LASTEXITCODE
  if ($code -eq 0) {
    Write-Host ""
    Write-Host "Tests OK." -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Tests failed (exit code $code)." -ForegroundColor Red
  }
  exit $code
} finally {
  Pop-Location
}
