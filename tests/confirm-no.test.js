'use strict';

/* Every confirmation question has a browser test for the "No" answer (documentation/REFACTOR.md section 4).
   For each confirm('…') in js/app.js, some test in tests/e2e/ (subfolders included) answers "No" (answerConfirm(page, false) or
   answerNextConfirmNo) and checks the question text. The start of the text is enough: up to the first line break. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const E2E_DIR = path.join(__dirname, 'e2e');

/** Fixed start of each question: the first quoted text of confirm(), up to the first \n, without a trailing ":". */
function confirmPrefixes(source) {
  const prefixes = [];
  const re = /confirm\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(source))) prefixes.push(m[1].split('\\n')[0].replace(/[:\s]+$/, ''));
  return prefixes;
}

/** Body of each browser test that answers "No" to a confirm(). */
function noAnswerTests() {
  const bodies = [];
  for (const file of fs.readdirSync(E2E_DIR, { recursive: true }).filter((f) => f.endsWith('.spec.js'))) {
    const chunks = fs.readFileSync(path.join(E2E_DIR, file), 'utf8').split(/\n\s*test\(/).slice(1);
    for (const chunk of chunks) {
      if (/answerConfirm\(page, false\)|answerNextConfirmNo\(page\)/.test(chunk)) bodies.push({ file, chunk });
    }
  }
  return bodies;
}

const PREFIXES = confirmPrefixes(APP);
const NO_TESTS = noAnswerTests();

test('finds the confirmation questions in app.js', () => {
  assert.ok(PREFIXES.length >= 16, 'found ' + PREFIXES.length);
  assert.equal(PREFIXES.length, (APP.match(/\bconfirm\(/g) || []).length, 'every confirm() starts with fixed text');
});

test('each confirmation question has a test for the "No" answer', () => {
  const counts = {};
  PREFIXES.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });
  const missing = Object.keys(counts).filter((prefix) => {
    const tests = NO_TESTS.filter((t) => t.chunk.includes(prefix));
    return tests.length < counts[prefix];
  });
  assert.deepEqual(missing, [], 'question without a "No" test (or with fewer tests than identical questions)');
});
