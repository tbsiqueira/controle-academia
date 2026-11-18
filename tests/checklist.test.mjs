/* Toda funcionalidade do tests/CHECKLIST.md tem teste de navegador (issue #7, documentation/REFACTOR.md seção 4).
   Lê as tabelas cuja última coluna é "Testes de navegador": nenhuma linha pode ficar com "—" ou vazia, e cada
   linha cita pelo menos um arquivo .spec.js de tests/e2e/ ou de uma subpasta que existe (arquivo de subpasta pelo caminho a partir de
   tests/e2e/, ex.: `temporarios/fichas.spec.js`). Todo arquivo de teste de navegador aparece em alguma linha. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CHECKLIST = fs.readFileSync(path.join(import.meta.dirname, 'CHECKLIST.md'), 'utf8');
const E2E_DIR = path.join(import.meta.dirname, 'e2e');
/** Arquivos de teste de navegador, com o caminho a partir de tests/e2e/ (subpastas incluídas). */
const SPECS = fs.readdirSync(E2E_DIR, { recursive: true })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => f.endsWith('.spec.js'));
/** Arquivo citado numa linha do CHECKLIST: `treinar.spec.js` ou `temporarios/fichas.spec.js`. */
const CITED_SPEC = /[\w./-]+\.spec\.js/g;

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
    const cited = r.browser.match(CITED_SPEC) || [];
    return !cited.length || cited.some((f) => !SPECS.includes(f));
  });
  assert.deepEqual(wrong.map((r) => 'linha ' + r.line + ': ' + r.browser), []);
});

test('todo arquivo de teste de navegador aparece no CHECKLIST', () => {
  const cited = new Set(ROWS.flatMap((r) => r.browser.match(CITED_SPEC) || []));
  assert.deepEqual(SPECS.filter((f) => !cited.has(f)), []);
});

test('a leitura da tabela acha linhas sem teste (o teste acima não passa à toa)', () => {
  const sample = '| Funcionalidade | Testes de navegador |\n|---|---|\n| A | `a.spec.js` |\n| B | — |\n\n| X | Y |\n|---|---|\n| C | — |\n';
  assert.deepEqual(browserRows(sample).map((r) => [r.feature, r.browser]), [['A', '`a.spec.js`'], ['B', '—']]);
});
