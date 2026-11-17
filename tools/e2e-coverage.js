// Cobertura de js/app.js pelos testes de navegador (issue #7, documentation/REFACTOR.md seção 4).
//
// Cada teste de navegador grava, em tests/e2e/coverage/, as linhas de js/app.js que rodaram (fixture automático
// em tests/e2e/helpers.js, cobertura de JS do Chromium). Este script junta tudo e mede.
//
// Uso (depois de `npm run test:e2e`):
//   node tools/e2e-coverage.js                         mostra a cobertura e as funções que nenhum teste roda
//   node tools/e2e-coverage.js --update                grava o número em tests/e2e/coverage-baseline.json
//   node tools/e2e-coverage.js --baseline <arquivo>    catraca: falha se ficar abaixo do número desse arquivo
//
// No CI, `--baseline` recebe o arquivo da main (a cobertura não pode cair em relação à main) e o script também
// falha se a cobertura subiu e o tests/e2e/coverage-baseline.json do PR não foi atualizado com `--update`.
// Com GITHUB_STEP_SUMMARY definido, escreve o resumo do job.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'js/app.js';
const RAW_DIR = path.join(ROOT, 'tests', 'e2e', 'coverage');
const BASELINE = path.join(ROOT, 'tests', 'e2e', 'coverage-baseline.json');

/**
 * Linhas que contam na cobertura: as que têm código. Linhas em branco e só de comentário ficam de fora.
 * Devolve [{ line (1-based), offset (posição do primeiro caractere de código) }].
 */
function codeLines(source) {
  const lines = [];
  let offset = 0;
  source.split('\n').forEach(function (text, i) {
    const indent = text.length - text.trimStart().length;
    const code = text.trim();
    if (code && !/^(\/\/|\/\*|\*)/.test(code)) lines.push({ line: i + 1, offset: offset + indent });
    offset += text.length + 1;
  });
  return lines;
}

/**
 * Linhas de código que rodaram, a partir da cobertura de blocos do V8 (`page.coverage.stopJSCoverage()`).
 * O contador de uma linha é o do bloco mais interno que contém o primeiro caractere de código dela.
 */
function coveredLines(entry) {
  const lines = codeLines(entry.source);
  const counts = new Array(lines.length).fill(null);
  const ranges = [];
  entry.functions.forEach(function (fn) {
    fn.ranges.forEach(function (r) { ranges.push(r); });
  });
  // Do maior para o menor: o bloco mais interno pinta por último.
  ranges.sort(function (a, b) { return (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset); });
  ranges.forEach(function (r) {
    for (let i = firstAtOrAfter(lines, r.startOffset); i < lines.length && lines[i].offset < r.endOffset; i++) {
      counts[i] = r.count;
    }
  });
  return lines.filter(function (l, i) { return counts[i] > 0; }).map(function (l) { return l.line; });
}

function firstAtOrAfter(lines, offset) {
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].offset < offset) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Entradas da cobertura do Chromium que são o js/app.js do servidor de testes (com ou sem ?v=N). */
function isAppScript(url) {
  try {
    return new URL(url).pathname === '/' + FILE;
  } catch {
    return false;
  }
}

/** Junta os arquivos gravados pelos testes e mede a cobertura de linhas de js/app.js. */
function measure() {
  const source = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
  const all = codeLines(source).map(function (l) { return l.line; });
  const covered = new Set();
  let runs = 0;
  if (fs.existsSync(RAW_DIR)) {
    fs.readdirSync(RAW_DIR).filter(function (f) { return f.endsWith('.json'); }).forEach(function (f) {
      const data = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf8'));
      runs++;
      if (data.file === FILE) data.lines.forEach(function (l) { covered.add(l); });
    });
  }
  const hit = all.filter(function (l) { return covered.has(l); }).length;
  return { source: source, all: all, covered: covered, hit: hit, total: all.length, runs: runs, pct: floor1(100 * hit / all.length) };
}

function floor1(n) {
  return Math.floor(n * 10 + 1e-9) / 10;
}

/** Funções de nível de topo do app.js com linhas que nenhum teste roda, das que mais faltam para as que menos. */
function uncoveredFunctions(result) {
  const lines = result.source.split('\n');
  const starts = [];
  lines.forEach(function (text, i) {
    const m = /^(?:async\s+)?function\s+([\w$]+)/.exec(text);
    if (m) starts.push({ name: m[1], line: i + 1 });
  });
  return starts.map(function (s, i) {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length + 1;
    const inside = result.all.filter(function (l) { return l >= s.line && l < end; });
    const missing = inside.filter(function (l) { return !result.covered.has(l); }).length;
    return { name: s.name, line: s.line, missing: missing, total: inside.length };
  }).filter(function (f) { return f.missing > 0; })
    .sort(function (a, b) { return b.missing - a.missing || a.line - b.line; });
}

function readBaseline(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof data[FILE] !== 'number') throw new Error(file + ' não tem o número de ' + FILE);
  return data[FILE];
}

function main(argv) {
  const result = measure();
  if (!result.runs) {
    console.error('Nenhuma cobertura em tests/e2e/coverage/. Rode `npm run test:e2e` antes.');
    return 1;
  }

  const missing = uncoveredFunctions(result);
  console.log(FILE + ': ' + result.hit + '/' + result.total + ' linhas (' + result.pct + '%) em ' + result.runs + ' testes de navegador.');
  if (argv.includes('--verbose')) {
    missing.forEach(function (f) { console.log('  ' + f.name + ' (linha ' + f.line + '): ' + f.missing + '/' + f.total + ' linhas sem teste'); });
  }

  const summary = [
    '### Cobertura de `' + FILE + '` pelos testes de navegador',
    '',
    '| Linhas cobertas | Total | Cobertura |',
    '|---:|---:|---:|',
    '| ' + result.hit + ' | ' + result.total + ' | **' + result.pct + '%** |',
    ''
  ];
  let failed = false;

  if (argv.includes('--update')) {
    fs.writeFileSync(BASELINE, JSON.stringify({ [FILE]: result.pct }, null, 2) + '\n');
    console.log('Gravado em tests/e2e/coverage-baseline.json: ' + result.pct + '%.');
  }

  const baseIdx = argv.indexOf('--baseline');
  if (baseIdx !== -1) {
    const mainPct = readBaseline(argv[baseIdx + 1]);
    const ownPct = readBaseline(BASELINE);
    summary.push('Catraca: main **' + mainPct + '%** · este código **' + result.pct + '%**.', '');
    if (result.pct < mainPct) {
      failed = true;
      const msg = 'a cobertura de ' + FILE + ' pelos testes de navegador caiu de ' + mainPct + '% (main) para ' + result.pct +
        '%. Cubra o que entrou com testes de navegador (node tools/e2e-coverage.js --verbose lista o que falta).';
      console.log('::error::' + msg);
      summary.push('❌ ' + msg, '');
    } else if (result.pct > ownPct) {
      failed = true;
      const msg = 'a cobertura subiu para ' + result.pct + '%, mas tests/e2e/coverage-baseline.json diz ' + ownPct +
        '%. Rode `npm run test:e2e` e `node tools/e2e-coverage.js --update` e faça commit do arquivo (a catraca só sobe).';
      console.log('::error::' + msg);
      summary.push('❌ ' + msg, '');
    } else {
      summary.push('✅ Não caiu em relação à main.', '');
    }
  }

  if (missing.length) {
    summary.push('<details><summary>Funções com linhas sem teste de navegador (' + missing.length + ')</summary>', '',
      '| Função | Linha | Sem teste |', '|---|---:|---:|');
    missing.forEach(function (f) { summary.push('| `' + f.name + '` | ' + f.line + ' | ' + f.missing + '/' + f.total + ' |'); });
    summary.push('', '</details>', '');
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  return failed ? 1 : 0;
}

module.exports = { codeLines, coveredLines, isAppScript, measure, floor1, FILE, RAW_DIR };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
