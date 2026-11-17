'use strict';

/* Toda funcionalidade do tests/CHECKLIST.md tem teste de navegador (issue #7, documentation/REFACTOR.md seção 4).
   Lê as tabelas cuja última coluna é "Testes de navegador": nenhuma linha pode ficar com "—" ou vazia, e cada
   linha cita pelo menos um arquivo tests/e2e/*.spec.js que existe. Todo arquivo de teste de navegador aparece
   em alguma linha. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CHECKLIST = fs.readFileSync(path.join(__dirname, 'CHECKLIST.md'), 'utf8');
const E2E_DIR = path.join(__dirname, 'e2e');
const SPECS = fs.readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.js'));

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Linhas das tabelas com a coluna "Testes de navegador": [{ feature, browser, line }]. */
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

test('o CHECKLIST tem as tabelas de funcionalidades com a coluna de testes de navegador', () => {
  assert.ok(ROWS.length >= 100, 'achou ' + ROWS.length + ' linhas');
});

test('toda linha do CHECKLIST tem teste de navegador', () => {
  const missing = ROWS.filter((r) => !r.browser || /^[—–-]+$/.test(r.browser));
  assert.deepEqual(missing.map((r) => 'linha ' + r.line + ': ' + r.feature), [],
    'funcionalidade sem teste de navegador no tests/CHECKLIST.md');
});

test('cada linha cita um arquivo de teste de navegador que existe', () => {
  const wrong = ROWS.filter((r) => {
    const cited = r.browser.match(/[\w-]+\.spec\.js/g) || [];
    return !cited.length || cited.some((f) => !SPECS.includes(f));
  });
  assert.deepEqual(wrong.map((r) => 'linha ' + r.line + ': ' + r.browser), []);
});

test('todo arquivo de teste de navegador aparece no CHECKLIST', () => {
  const cited = new Set(ROWS.flatMap((r) => r.browser.match(/[\w-]+\.spec\.js/g) || []));
  assert.deepEqual(SPECS.filter((f) => !cited.has(f)), []);
});

test('a leitura da tabela acha linhas sem teste (o teste acima não passa à toa)', () => {
  const sample = '| Funcionalidade | Testes de navegador |\n|---|---|\n| A | `a.spec.js` |\n| B | — |\n\n| X | Y |\n|---|---|\n| C | — |\n';
  assert.deepEqual(browserRows(sample).map((r) => [r.feature, r.browser]), [['A', '`a.spec.js`'], ['B', '—']]);
});
