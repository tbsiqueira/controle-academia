'use strict';

/* Every feature in tests/CHECKLIST.md has a browser test (issue #7, documentation/REFACTOR.md section 4).
   It reads the tables whose last column is "Testes de navegador": no row may be "—" or empty, and each
   row cites at least one .spec.js file in tests/e2e/ or in a subfolder that exists (a subfolder file by its path from
   tests/e2e/, e.g. `temporarios/fichas.spec.js`). Every browser test file appears in some row. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CHECKLIST = fs.readFileSync(path.join(__dirname, 'CHECKLIST.md'), 'utf8');
const E2E_DIR = path.join(__dirname, 'e2e');
/** Browser test files, with the path from tests/e2e/ (subfolders included). */
const SPECS = fs.readdirSync(E2E_DIR, { recursive: true })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => f.endsWith('.spec.js'));
/** File cited in a CHECKLIST row: `treinar.spec.js` or `temporarios/fichas.spec.js`. */
const CITED_SPEC = /[\w./-]+\.spec\.js/g;

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Rows of the tables with the "Testes de navegador" column: [{ feature, browser, line }]. */
function browserRows(markdown) {
  const rows = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].trim().startsWith('|') ? cells(lines[i]) : null;
    if (!header || header[header.length - 1] !== 'Testes de navegador') continue;
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      const row = cells(lines[j]);
      rows.push({ feature: row[0], browser: row[row.length - 1], line: j + 1 });
    }
  }
  return rows;
}

const ROWS = browserRows(CHECKLIST);

test('the CHECKLIST has the feature tables with the browser-tests column', () => {
  assert.ok(ROWS.length >= 100, 'found ' + ROWS.length + ' rows');
});

test('every CHECKLIST row has a browser test', () => {
  const missing = ROWS.filter((r) => !r.browser || /^[—–-]+$/.test(r.browser));
  assert.deepEqual(missing.map((r) => 'line ' + r.line + ': ' + r.feature), [],
    'feature without a browser test in tests/CHECKLIST.md');
});

test('each row cites a browser test file that exists', () => {
  const wrong = ROWS.filter((r) => {
    const cited = r.browser.match(CITED_SPEC) || [];
    return !cited.length || cited.some((f) => !SPECS.includes(f));
  });
  assert.deepEqual(wrong.map((r) => 'line ' + r.line + ': ' + r.browser), []);
});

test('every browser test file appears in the CHECKLIST', () => {
  const cited = new Set(ROWS.flatMap((r) => r.browser.match(CITED_SPEC) || []));
  assert.deepEqual(SPECS.filter((f) => !cited.has(f)), []);
});

test('reading the table finds rows without a test (the test above does not pass for nothing)', () => {
  const sample = '| Funcionalidade | Testes de navegador |\n|---|---|\n| A | `a.spec.js` |\n| B | — |\n\n| X | Y |\n|---|---|\n| C | — |\n';
  assert.deepEqual(browserRows(sample).map((r) => [r.feature, r.browser]), [['A', '`a.spec.js`'], ['B', '—']]);
});
