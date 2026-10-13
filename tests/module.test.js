'use strict';

/* Testes do registro do modulo core.js.
   Verificam que, no navegador (sem module.exports), as funcoes viram globais do window. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../js/core.js');

test('core.js se registra no navegador quando nao existe module.exports', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');
  const escopo = { self: {} };                 // simula o navegador (sem module)
  vm.createContext(escopo);
  vm.runInContext(fonte, escopo);

  assert.equal(typeof escopo.self.weekWindow, 'function', 'funcoes viram globais no navegador');
  assert.equal(typeof escopo.self.exerciseLabel, 'function', 'resolvers tambem ficam globais');
  assert.equal(typeof escopo.self.backupStatus, 'function', 'backup tambem fica global');
});
