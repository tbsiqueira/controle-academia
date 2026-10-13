'use strict';

/**
 * Mede a cobertura de js/core.js rodando os testes com o coverage nativo do Node.
 *
 * - Imprime o relatório completo do Node.
 * - Publica as lacunas como "annotations" do GitHub Actions (dá para ver na aba
 *   Actions e pela API, mesmo sem acesso ao log).
 * - Com COVERAGE_ENFORCE=1, falha se js/core.js não estiver em 100%.
 */

const { spawnSync } = require('node:child_process');

const ALVO = 'js/core.js';
const enforcar = process.env.COVERAGE_ENFORCE === '1';

const rodar = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', 'tests/'], {
  encoding: 'utf8',
  cwd: process.cwd()
});

const saida = String(rodar.stdout || '') + String(rodar.stderr || '');
process.stdout.write(saida);

// A tabela de cobertura vem com os símbolos "ℹ" na frente; limpamos para poder ler as colunas.
function linhasDaTabela(texto) {
  const linhas = [];

  texto.split('\n').forEach(function (linha) {
    if (linha.indexOf('|') === -1) return;
    const limpa = linha.replace(/[^\x20-\x7E|]/g, '').trim();
    const partes = limpa.split('|').map(function (p) { return p.trim(); });
    if (partes.length < 5) return;
    if (partes[0].indexOf('.js') === -1) return;

    linhas.push({
      arquivo: partes[0],
      linhas: parseFloat(partes[1]),
      ramos: parseFloat(partes[2]),
      funcoes: parseFloat(partes[3]),
      descobertas: partes.slice(4).join('|').trim()
    });
  });

  return linhas;
}

function faixas(texto) {
  return (texto || '').split(/[,\s]+/).filter(function (t) { return t.length > 0; });
}

const tabela = linhasDaTabela(saida);
const alvo = tabela.filter(function (l) { return l.arquivo.indexOf('core.js') !== -1; });

if (rodar.status !== 0) {
  console.error('\n[cobertura] os testes falharam: corrija antes de medir a cobertura.');
  process.exit(rodar.status || 1);
}

if (!alvo.length) {
  console.error('\n[cobertura] nao encontrei a linha de ' + ALVO + ' no relatorio do Node.');
  console.error('Cole o relatorio acima para ajustar tools/coverage-gate.js.');
  process.exit(2);
}

const medidas = alvo[0];
const descobertas = faixas(medidas.descobertas);
const completo = medidas.linhas === 100 && medidas.ramos === 100;

console.log('\n[cobertura] ' + ALVO + ': linhas ' + medidas.linhas + '% | ramos ' + medidas.ramos +
  '% | funcoes ' + medidas.funcoes + '%');
console.log('[cobertura] trechos sem teste: ' + (descobertas.length ? descobertas.join(' ') : 'nenhum'));

// Annotations (aparecem no resumo do check, mesmo sem abrir o log).
if (descobertas.length) {
  descobertas.slice(0, 10).forEach(function (faixa) {
    const inicio = String(faixa).split('-')[0] || '1';
    console.log('::warning file=' + ALVO + ',line=' + inicio + '::sem cobertura de teste (' + faixa + ')');
  });
}

if (completo) {
  console.log('[cobertura] ' + ALVO + ' com 100% de linhas e ramos.');
  process.exit(0);
}

const resumo = '[cobertura] ' + ALVO + ' abaixo de 100%: linhas ' + medidas.linhas +
  '%, ramos ' + medidas.ramos + '%. Sem teste: ' + descobertas.join(' ') +
  (enforcar ? '' : ' (informativo: rode com COVERAGE_ENFORCE=1 para bloquear)');

if (enforcar) {
  console.log('::error file=' + ALVO + '::' + resumo);
  console.error('\n' + resumo);
  process.exit(1);
}

console.log('::warning file=' + ALVO + '::' + resumo);
console.log('\n' + resumo);
process.exit(0);
