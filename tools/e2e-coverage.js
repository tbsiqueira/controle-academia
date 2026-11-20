// js/app.js coverage by the browser tests (issue #7, documentation/REFACTOR.md section 4).
//
// Each browser test writes, into tests/e2e/coverage/, the js/app.js lines that ran (automatic fixture
// in tests/e2e/helpers.js, Chromium's JS coverage). This script joins everything and measures.
//
// Usage (after `npm run test:e2e`):
//   node tools/e2e-coverage.js                         shows the coverage and the functions no test runs
//   node tools/e2e-coverage.js --update                writes the number into tests/e2e/coverage-baseline.json
//   node tools/e2e-coverage.js --baseline <file>       ratchet: fails when below the number in that file
//
// In CI, `--baseline` receives the file from main (coverage can't drop compared to main) and the script also
// fails when coverage rose and the PR's tests/e2e/coverage-baseline.json was not updated with `--update`.
// With GITHUB_STEP_SUMMARY set, it writes the job summary.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'js/app.js';
const RAW_DIR = path.join(ROOT, 'tests', 'e2e', 'coverage');
const BASELINE = path.join(ROOT, 'tests', 'e2e', 'coverage-baseline.json');

/**
 * Lines that count in the coverage: the ones with code. Blank lines and comment-only lines are left out.
 * Returns [{ line (1-based), offset (position of the first code character) }].
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
 * Code lines that ran, from V8's block coverage (`page.coverage.stopJSCoverage()`).
 * A line's counter is the one of the innermost block containing its first code character.
 */
function coveredLines(entry) {
  const lines = codeLines(entry.source);
  const counts = new Array(lines.length).fill(null);
  const ranges = [];
  entry.functions.forEach(function (fn) {
    fn.ranges.forEach(function (r) { ranges.push(r); });
  });
  // Largest to smallest: the innermost block paints last.
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

/** Chromium coverage entries that are the test server's js/app.js (with or without ?v=N). */
function isAppScript(url) {
  try {
    return new URL(url).pathname === '/' + FILE;
  } catch {
    return false;
  }
}

/** Joins the files written by the tests and measures the line coverage of js/app.js. */
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

/** Top-level functions of app.js with lines no test runs, from the most missing to the least. */
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
  if (typeof data[FILE] !== 'number') throw new Error(file + ' has no number for ' + FILE);
  return data[FILE];
}

function main(argv) {
  const result = measure();
  if (!result.runs) {
    console.error('No coverage in tests/e2e/coverage/. Run `npm run test:e2e` first.');
    return 1;
  }

  const missing = uncoveredFunctions(result);
  console.log(FILE + ': ' + result.hit + '/' + result.total + ' lines (' + result.pct + '%) in ' + result.runs + ' browser tests.');
  if (argv.includes('--verbose')) {
    missing.forEach(function (f) { console.log('  ' + f.name + ' (line ' + f.line + '): ' + f.missing + '/' + f.total + ' lines with no test'); });
  }

  const summary = [
    '### Coverage of `' + FILE + '` by the browser tests',
    '',
    '| Lines covered | Total | Coverage |',
    '|---:|---:|---:|',
    '| ' + result.hit + ' | ' + result.total + ' | **' + result.pct + '%** |',
    ''
  ];
  let failed = false;

  if (argv.includes('--update')) {
    fs.writeFileSync(BASELINE, JSON.stringify({ [FILE]: result.pct }, null, 2) + '\n');
    console.log('Written to tests/e2e/coverage-baseline.json: ' + result.pct + '%.');
  }

  const baseIdx = argv.indexOf('--baseline');
  if (baseIdx !== -1) {
    const mainPct = readBaseline(argv[baseIdx + 1]);
    const ownPct = readBaseline(BASELINE);
    summary.push('Ratchet: main **' + mainPct + '%** · this code **' + result.pct + '%**.', '');
    if (result.pct < mainPct) {
      failed = true;
      const msg = 'the browser-test coverage of ' + FILE + ' dropped from ' + mainPct + '% (main) to ' + result.pct +
        '%. Cover what you added with browser tests (node tools/e2e-coverage.js --verbose lists what is missing).';
      console.log('::error::' + msg);
      summary.push('❌ ' + msg, '');
    } else if (result.pct > ownPct) {
      failed = true;
      const msg = 'coverage rose to ' + result.pct + '%, but tests/e2e/coverage-baseline.json says ' + ownPct +
        '%. Run `npm run test:e2e` and `node tools/e2e-coverage.js --update` and commit the file (the ratchet only goes up).';
      console.log('::error::' + msg);
      summary.push('❌ ' + msg, '');
    } else {
      summary.push('✅ Did not drop compared to main.', '');
    }
  }

  if (missing.length) {
    summary.push('<details><summary>Functions with lines no browser test runs (' + missing.length + ')</summary>', '',
      '| Function | Line | Without a test |', '|---|---:|---:|');
    missing.forEach(function (f) { summary.push('| `' + f.name + '` | ' + f.line + ' | ' + f.missing + '/' + f.total + ' |'); });
    summary.push('', '</details>', '');
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  return failed ? 1 : 0;
}

module.exports = { codeLines, coveredLines, isAppScript, measure, floor1, FILE, RAW_DIR };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
