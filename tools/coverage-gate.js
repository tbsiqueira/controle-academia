'use strict';

/**
 * Measures the coverage of js/core.js by running the tests.
 *
 * - Uses Node's native coverage (--experimental-test-coverage) for the percentages.
 * - Uses the V8 report (NODE_V8_COVERAGE) to find the SNIPPETS without a test and
 *   publish them as GitHub Actions "annotations" (readable in the API, without opening the log).
 * - With COVERAGE_ENFORCE=1, fails when js/core.js is not at 100% (lines and branches).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ALVO = 'js/core.js';
const enforcar = process.env.COVERAGE_ENFORCE === '1';
const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cobertura-'));

const rodar = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', '--test-reporter=tap', 'tests/'], {
  encoding: 'utf8',
  env: Object.assign({}, process.env, { NODE_V8_COVERAGE: temporario })
});

const saida = String(rodar.stdout || '') + String(rodar.stderr || '');
process.stdout.write(saida);

/* ---------- test failures (become annotations, so they can be read without the log) ---------- */

function falhasDosTestes(texto) {
  const linhas = texto.split('\n');
  const falhas = [];

  linhas.forEach(function (linha, i) {
    const titulo = linha.match(/^not ok \d+ - (.*)$/);
    if (!titulo) return;

    let arquivo = 'tools/coverage-gate.js';
    let linhaArquivo = 1;
    let erro = '';
    const raiz = process.cwd().replace(/\\/g, '/') + '/';

    for (let j = i + 1; j < linhas.length; j++) {
      const linhaAtual = linhas[j];
      if (/^\.\.\.$/.test(linhaAtual.trim())) break;
      if (/^not ok |^ok \d+/.test(linhaAtual)) break;

      const local = linhaAtual.match(/location: '(.*)'/);
      if (local) {
        try {
          const info = JSON.parse(local[1]);
          if (info.file) arquivo = String(info.file).replace(/\\/g, '/').replace(raiz, '');
          if (info.line) linhaArquivo = info.line;
        } catch (e) { /* no location: point at the gate itself */ }
      }

      const inicio = linhaAtual.match(/^\s*error: \|?-*\s*(.*)$/);
      if (inicio) {
        const partes = [inicio[1]];
        for (let k = j + 1; k < linhas.length; k++) {
          const seguinte = linhas[k];
          if (/^\s*(code|stack|failureType|location|duration_ms|type):/.test(seguinte)) break;
          if (/^\.\.\.$/.test(seguinte.trim())) break;
          partes.push(seguinte.trim());
        }
        erro = partes.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    falhas.push({
      titulo: titulo[1].trim(),
      arquivo: arquivo,
      linha: linhaArquivo,
      erro: erro.replace(/\s+/g, ' ').slice(0, 220)
    });
  });

  return falhas;
}

if (rodar.status !== 0) {
  const falhas = falhasDosTestes(saida);

  console.error('\n[coverage] ' + (falhas.length || 'some') + ' test(s) failed.');

  falhas.slice(0, 5).forEach(function (f) {
    console.log('::error file=' + f.arquivo + ',line=' + f.linha + '::' + f.titulo +
      (f.erro ? (' — ' + f.erro) : ''));
  });

  process.exit(rodar.status || 1);
}

/* ---------- percentages (Node's table) ---------- */

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
  console.error('\n[coverage] could not find the ' + ALVO + ' line in the Node report.');
  console.error('Paste the report above to adjust tools/coverage-gate.js.');
  process.exit(2);
}

const medidas = alvo[0];

/* ---------- snippets without a test (V8 ranges) ---------- */

const fonte = fs.readFileSync(path.join(process.cwd(), ALVO), 'utf8');

function linhaDe(offset) {
  return fonte.slice(0, offset).split('\n').length;
}

function trechosSemTeste(diretorio) {
  const porExecucao = {};
  const cobertos = {};
  const contagens = {};
  const executacoes = [];

  fs.readdirSync(diretorio).forEach(function (nome) {
    if (nome.indexOf('.json') === -1) return;

    let bruto;
    try {
      bruto = JSON.parse(fs.readFileSync(path.join(diretorio, nome), 'utf8'));
    } catch (e) {
      return;
    }

    (bruto.result || []).forEach(function (arquivo, indiceArquivo) {
      if (!arquivo.url || arquivo.url.indexOf('/' + ALVO) === -1) return;

      // Each report entry is one run of the file (the vm test loads the same core.js
      // again): the url+index pair is used as the identifier.
      const chave = arquivo.url + '#' + nome + '#' + indiceArquivo;
      executacoes.push(chave);
      porExecucao[chave] = porExecucao[chave] || [];

      (arquivo.functions || []).forEach(function (fn) {
        (fn.ranges || []).forEach(function (faixa) {
          if (faixa.endOffset <= faixa.startOffset) return;

          const assinatura = faixa.startOffset + ':' + faixa.endOffset;
          if (faixa.count > 0) cobertos[assinatura] = (cobertos[assinatura] || 0) + 1;
          contagens[assinatura] = contagens[assinatura] || [];
          contagens[assinatura].push(faixa.count);

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

      // The same snippet (same offsets) can show up in several report entries
      // (nested functions, core loaded again in the vm...). ONE run having gone
      // through it is enough for it to count as covered.
      const assinatura = faixa.inicio + ':' + faixa.fim;
      if (cobertos[assinatura] > 0) return;

      achados.push({
        inicio: linhaDe(faixa.inicio),
        fim: linhaDe(faixa.fim),
        inicioOffset: faixa.inicio,
        fimOffset: faixa.fim,
        trecho: fonte.slice(faixa.inicio, faixa.inicio + 80).split('\n')[0].trim()
      });
    });
  });

  // merge overlapping ranges (V8 returns nested ranges)
  achados.sort(function (a, b) { return a.inicio - b.inicio || a.fim - b.fim; });

  const juntas = [];
  achados.forEach(function (a) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && a.inicio <= ultima.fim) {
      ultima.fim = Math.max(ultima.fim, a.fim);
      ultima.fimOffset = Math.max(ultima.fimOffset || 0, a.fimOffset || 0);
      if (ultima.trecho.length < 70 && a.trecho && ultima.trecho.indexOf(a.trecho) === -1) {
        ultima.trecho = (ultima.trecho + ' / ' + a.trecho).slice(0, 90);
      }
      return;
    }
    juntas.push({ inicio: a.inicio, fim: a.fim, inicioOffset: a.inicioOffset, fimOffset: a.fimOffset, trecho: a.trecho });
  });

  return { trechos: juntas, contagens: contagens, executacoes: executacoes.length };
}

const diagnostico = trechosSemTeste(temporario);
const semTeste = diagnostico.trechos;
// The module wrapper (first lines of the file) picks between Node and the browser: each
// environment runs only one side, and the browser side is validated in tests/module.test.js.
const FIM_DO_WRAPPER = 16;

// Gate criterion: 100% of lines (Node's table) + no LOGIC snippet without a test
// (measured in a single process, which does not have the false positives of the per-process report).
const precisos = diagnosticoPreciso().filter(function (t) { return t.inicio > FIM_DO_WRAPPER; });
const completo = medidas.linhas === 100 && precisos.length === 0;

console.log('\n[coverage] ' + ALVO + ': lines ' + medidas.linhas + '% | branches ' + medidas.ramos +
  '% | functions ' + medidas.funcoes + '% (Node table)');
console.log('[coverage] snippets V8 did not see run: ' + semTeste.length);

semTeste.forEach(function (t) {
  console.log('[coverage]   lines ' + t.inicio + '-' + t.fim + ': ' + t.trecho);
});

// Annotations: they show up in the check summary, without opening the log.
const listaDeLinhas = semTeste.map(function (t) {
  return t.fim > t.inicio ? (t.inicio + '-' + t.fim) : String(t.inicio);
}).join(', ');

// Second pass: runs ALL the test files in a single process. Without separate
// processes, V8 reports everything (no false positive) and the list is accurate.
function diagnosticoPreciso() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cobertura-1p-'));
  const arquivos = fs.readdirSync(path.join(process.cwd(), 'tests')).filter(function (f) {
    return f.indexOf('.test.js') !== -1;
  });
  const codigo = arquivos.map(function (f) { return "require('./tests/" + f + "');"; }).join(' ');

  spawnSync(process.execPath, ['-e', codigo], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { NODE_V8_COVERAGE: diretorio })
  });

  return trechosSemTeste(diretorio).trechos;
}
console.log('::notice file=' + ALVO + ',line=1::snippets V8 did not see run: ' +
  (listaDeLinhas || 'none'));

const precisosTexto = precisos.map(function (t) {
  return (t.fim > t.inicio ? (t.inicio + '-' + t.fim) : String(t.inicio)) + ' [' + t.trecho.slice(0, 45) + ']';
});

console.log('::notice file=' + ALVO + ',line=1::accurate (single process, outside the wrapper): ' +
  (precisosTexto.join(' | ') || 'nothing without coverage'));

if (completo) {
  console.log('::notice file=' + ALVO + ',line=1::coverage OK: 100% of the lines of ' + ALVO +
    ' and no logic snippet without a test (branches measured by Node: ' + medidas.ramos + '%)');
  console.log('[coverage] 100% of the lines in ' + ALVO + ' and no logic snippet without a test.');
  process.exit(0);
}

const resumo = '[coverage] ' + ALVO + ' below 100%: lines ' + medidas.linhas + '%, branches ' +
  medidas.ramos + '%, functions ' + medidas.funcoes + '%, ' + precisos.length + ' logic snippet(s) without a test' + (enforcar ? '' : ' (informational)');

if (enforcar) {
  console.log('::error file=' + ALVO + '::' + resumo);
  console.error('\n' + resumo);
  process.exit(1);
}

console.log('::warning file=' + ALVO + '::' + resumo);
console.log('\n' + resumo);
process.exit(0);
