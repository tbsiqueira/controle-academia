'use strict';

/* Toda pergunta de confirmação tem teste de navegador da resposta "Não" (documentation/REFACTOR.md seção 4).
   Para cada confirm('…') do js/app.js, algum teste de tests/e2e/ responde "Não" (answerConfirm(page, false) ou
   answerNextConfirmNo) e confere o texto da pergunta. Basta o começo do texto: até a primeira quebra de linha. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const E2E_DIR = path.join(__dirname, 'e2e');

/** Começo fixo de cada pergunta: o primeiro texto entre aspas do confirm(), até o primeiro \n, sem ":" no fim. */
function confirmPrefixes(source) {
  const prefixes = [];
  const re = /confirm\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(source))) prefixes.push(m[1].split('\\n')[0].replace(/[:\s]+$/, ''));
  return prefixes;
}

/** Corpo de cada teste de navegador que responde "Não" a um confirm(). */
function noAnswerTests() {
  const bodies = [];
  for (const file of fs.readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.js'))) {
    const chunks = fs.readFileSync(path.join(E2E_DIR, file), 'utf8').split(/\n\s*test\(/).slice(1);
    for (const chunk of chunks) {
      if (/answerConfirm\(page, false\)|answerNextConfirmNo\(page\)/.test(chunk)) bodies.push({ file, chunk });
    }
  }
  return bodies;
}

const PREFIXES = confirmPrefixes(APP);
const NO_TESTS = noAnswerTests();

test('acha as perguntas de confirmação do app.js', () => {
  assert.ok(PREFIXES.length >= 16, 'achou ' + PREFIXES.length);
  assert.equal(PREFIXES.length, (APP.match(/\bconfirm\(/g) || []).length, 'todo confirm() começa com um texto fixo');
});

test('cada pergunta de confirmação tem teste da resposta "Não"', () => {
  const counts = {};
  PREFIXES.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });
  const missing = Object.keys(counts).filter((prefix) => {
    const tests = NO_TESTS.filter((t) => t.chunk.includes(prefix));
    return tests.length < counts[prefix];
  });
  assert.deepEqual(missing, [], 'pergunta sem teste do "Não" (ou com menos testes que perguntas iguais)');
});
