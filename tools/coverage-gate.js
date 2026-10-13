'use strict';

/**
 * Mede a cobertura de js/core.js rodando os testes.
 *
 * - Usa o coverage nativo do Node (--experimental-test-coverage) para os percentuais.
 * - Usa o relatório do V8 (NODE_V8_COVERAGE) para achar os TRECHOS sem teste e
 *   publicá-los como "annotations" do GitHub Actions (dá para ler na API, sem abrir o log).
 * - Com COVERAGE_ENFORCE=1, falha se js/core.js não estiver em 100% (linhas e ramos).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ALVO = 'js/core.js';
const enforcar = process.env.COVERAGE_ENFORCE === '1';
const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cobertura-'));

const rodar = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', 'tests/'], {
  encoding: 'utf8',
  env: Object.assign({}, process.env, { NODE_V8_COVERAGE: temporario })
});

const saida = String(rodar.stdout || '') + String(rodar.stderr || '');
process.stdout.write(saida);

if (rodar.status !== 0) {
  console.error('\n[cobertura] os testes falharam: corrija antes de medir a cobertura.');
  process.exit(rodar.status || 1);
}

/* ---------- percentuais (tabela do Node) ---------- */

function tabelaDeCobertura(texto) {
  const linhas = [];

  texto.split('\n').forEach(function (linha) {
    if (linha.indexOf('|') === -1) return;
    const limpa = linha.replace(/[^\x20-\x7E|]/g, '').trim();
    const partes = limpa.split('|').map(function (p) { return p.trim(); });
    if (partes.length < 5 || partes[0].indexOf('.js') === -1) return;

    linhas.push({
      arquivo: partes[0],
      linhas: parseFloat(partes[1]),
      ramos: parseFloat(partes[2]),
      funcoes: parseFloat(partes[3])
    });
  });

  return linhas;
}

const alvo = tabelaDeCobertura(saida).filter(function (l) { return l.arquivo.indexOf('core.js') !== -1; });

if (!alvo.length) {
  console.error('\n[cobertura] nao encontrei a linha de ' + ALVO + ' no relatorio do Node.');
  console.error('Cole o relatorio acima para ajustar tools/coverage-gate.js.');
  process.exit(2);
}

const medidas = alvo[0];

/* ---------- trechos sem teste (ranges do V8) ---------- */

const fonte = fs.readFileSync(path.join(process.cwd(), ALVO), 'utf8');

function linhaDe(offset) {
  return fonte.slice(0, offset).split('\n').length;
}

function trechosSemTeste() {
  const achados = [];

  fs.readdirSync(temporario).forEach(function (nome) {
    if (nome.indexOf('.json') === -1) return;

    let bruto;
    try {
      bruto = JSON.parse(fs.readFileSync(path.join(temporario, nome), 'utf8'));
    } catch (e) {
      return;
    }

    (bruto.result || []).forEach(function (arquivo) {
      if (!arquivo.url || arquivo.url.indexOf('/' + ALVO) === -1) return;

      (arquivo.functions || []).forEach(function (fn) {
        (fn.ranges || []).forEach(function (faixa) {
          if (faixa.count > 0) return;
          if (faixa.endOffset <= faixa.startOffset) return;

          achados.push({
            inicio: linhaDe(faixa.startOffset),
            fim: linhaDe(faixa.endOffset),
            trecho: fonte.slice(faixa.startOffset, faixa.startOffset + 80).split('\n')[0].trim()
          });
        });
      });
    });
  });

  // junta faixas sobrepostas (o V8 devolve ranges aninhados)
  achados.sort(function (a, b) { return a.inicio - b.inicio || a.fim - b.fim; });

  const juntas = [];
  achados.forEach(function (a) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && a.inicio <= ultima.fim) {
      ultima.fim = Math.max(ultima.fim, a.fim);
      if (ultima.trecho.length < 70 && a.trecho) ultima.trecho = (ultima.trecho + ' / ' + a.trecho).slice(0, 90);
      return;
    }
    juntas.push({ inicio: a.inicio, fim: a.fim, trecho: a.trecho });
  });

  return juntas;
}

const semTeste = trechosSemTeste();
const completo = medidas.linhas === 100 && medidas.ramos === 100;

console.log('\n[cobertura] ' + ALVO + ': linhas ' + medidas.linhas + '% | ramos ' + medidas.ramos +
  '% | funcoes ' + medidas.funcoes + '%');
console.log('[cobertura] trechos sem teste: ' + semTeste.length);

semTeste.forEach(function (t) {
  console.log('[cobertura]   linhas ' + t.inicio + '-' + t.fim + ': ' + t.trecho);
});

// Annotations: aparecem no resumo do check, sem precisar abrir o log.
semTeste.slice(0, 10).forEach(function (t) {
  const fim = t.fim > t.inicio ? ('-' + t.fim) : '';
  console.log('::warning file=' + ALVO + ',line=' + t.inicio +
    ',endLine=' + t.fim + '::sem teste (' + t.inicio + fim + '): ' + t.trecho);
});

if (completo) {
  console.log('[cobertura] ' + ALVO + ' com 100% de linhas e ramos.');
  process.exit(0);
}

const resumo = '[cobertura] ' + ALVO + ' abaixo de 100%: linhas ' + medidas.linhas + '%, ramos ' +
  medidas.ramos + '%, ' + semTeste.length + ' trecho(s) sem teste' +
  (enforcar ? '' : ' (informativo)');

if (enforcar) {
  console.log('::error file=' + ALVO + '::' + resumo);
  console.error('\n' + resumo);
  process.exit(1);
}

console.log('::warning file=' + ALVO + '::' + resumo);
console.log('\n' + resumo);
process.exit(0);
