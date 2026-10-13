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
  const porExecucao = {};
  const cobertos = {};
  const executacoes = [];

  fs.readdirSync(temporario).forEach(function (nome) {
    if (nome.indexOf('.json') === -1) return;

    let bruto;
    try {
      bruto = JSON.parse(fs.readFileSync(path.join(temporario, nome), 'utf8'));
    } catch (e) {
      return;
    }

    (bruto.result || []).forEach(function (arquivo, indiceArquivo) {
      if (!arquivo.url || arquivo.url.indexOf('/' + ALVO) === -1) return;

      // Cada entrada do relatorio e uma execucao do arquivo (o teste do vm carrega o
      // mesmo core.js de novo): usamos o par url+indice como identificador.
      const chave = arquivo.url + '#' + nome + '#' + indiceArquivo;
      executacoes.push(chave);
      porExecucao[chave] = porExecucao[chave] || [];

      (arquivo.functions || []).forEach(function (fn) {
        (fn.ranges || []).forEach(function (faixa) {
          if (faixa.endOffset <= faixa.startOffset) return;

          const assinatura = faixa.startOffset + ':' + faixa.endOffset;
          if (faixa.count > 0) cobertos[assinatura] = (cobertos[assinatura] || 0) + 1;

          porExecucao[chave].push({
            inicio: faixa.startOffset,
            fim: faixa.endOffset,
            contagem: faixa.count
          });
        });
      });
    });
  });

  const achados = [];

  Object.keys(porExecucao).forEach(function (chave) {
    porExecucao[chave].forEach(function (faixa) {
      if (faixa.contagem > 0) return;

      // O mesmo trecho pode ter rodado em outra execucao do arquivo (ex.: vm do navegador).
      // So conta como coberto se OUTRA execucao cobriu exatamente a mesma faixa.
      const assinatura = faixa.inicio + ':' + faixa.fim;
      const cobertoEmOutraExecucao = executacoes.some(function (outra) {
        return outra !== chave && (porExecucao[outra] || []).some(function (outra1) {
          return outra1.inicio === faixa.inicio && outra1.fim === faixa.fim && outra1.contagem > 0;
        });
      }) && cobertos[assinatura] > 0;
      if (cobertoEmOutraExecucao) return;

      achados.push({
        inicio: linhaDe(faixa.inicio),
        fim: linhaDe(faixa.fim),
        trecho: fonte.slice(faixa.inicio, faixa.inicio + 80).split('\n')[0].trim()
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
      if (ultima.trecho.length < 70 && a.trecho && ultima.trecho.indexOf(a.trecho) === -1) {
        ultima.trecho = (ultima.trecho + ' / ' + a.trecho).slice(0, 90);
      }
      return;
    }
    juntas.push({ inicio: a.inicio, fim: a.fim, trecho: a.trecho });
  });

  return juntas;
}

const semTeste = trechosSemTeste();
const completo = semTeste.length === 0;

console.log('\n[cobertura] ' + ALVO + ' — trechos (statements/ramos do V8): ' +
  (completo ? 'todos cobertos' : semTeste.length + ' sem teste'));
console.log('[cobertura] tabela do Node (referencia): linhas ' + medidas.linhas + '% | ramos ' +
  medidas.ramos + '% | funcoes ' + medidas.funcoes + '%');

semTeste.forEach(function (t) {
  console.log('[cobertura]   linhas ' + t.inicio + '-' + t.fim + ': ' + t.trecho);
});

// Annotations: aparecem no resumo do check, sem precisar abrir o log.
// (limitadas a 5 trechos para que o resumo tambem caiba no limite do GitHub)
semTeste.slice(0, 5).forEach(function (t) {
  const fim = t.fim > t.inicio ? ('-' + t.fim) : '';
  console.log('::warning file=' + ALVO + ',line=' + t.inicio +
    ',endLine=' + t.fim + '::sem teste (' + t.inicio + fim + '): ' + t.trecho);
});

if (completo) {
  console.log('[cobertura] 100% dos trechos de ' + ALVO + ' cobertos pelos testes.');
  process.exit(0);
}

const resumo = '[cobertura] ' + ALVO + ' com ' + semTeste.length + ' trecho(s) sem teste' +
  ' (linhas do Node: ' + medidas.linhas + '%, ramos: ' + medidas.ramos + '%)' +
  (enforcar ? '' : ' (informativo)');

const listaDeLinhas = semTeste.map(function (t) {
  return t.fim > t.inicio ? (t.inicio + '-' + t.fim) : String(t.inicio);
}).join(', ');

console.log('::notice file=' + ALVO + ',line=1::trechos sem teste: ' + listaDeLinhas);

if (enforcar) {
  console.log('::error file=' + ALVO + '::' + resumo);
  console.error('\n' + resumo);
  process.exit(1);
}

console.log('::warning file=' + ALVO + '::' + resumo);
console.log('\n' + resumo);
process.exit(0);
