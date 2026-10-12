param()

# Roda os testes de unidade (Node, sem dependencias).
# Uso: powershell -ExecutionPolicy Bypass -File .\test.ps1
#
# Os testes também rodam automaticamente no GitHub Actions (workflow "Testes").

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js nao encontrado nesta maquina." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Os testes rodam no GitHub Actions (workflow 'Testes') a cada push na main."
  Write-Host "Para rodar localmente, instale o Node (https://nodejs.org) e execute:"
  Write-Host "  node --test tests/"
  Write-Host ""
  Write-Host "Sem Node, use as verificacoes estaticas:  .\check.ps1"
  exit 0
}

Push-Location $root
try {
  Write-Host "Rodando testes com $($node.Source)" -ForegroundColor Cyan
  & node --test tests/
  $code = $LASTEXITCODE
  if ($code -eq 0) {
    Write-Host ""
    Write-Host "Testes OK." -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Testes falharam (codigo $code)." -ForegroundColor Red
  }
  exit $code
} finally {
  Pop-Location
}
