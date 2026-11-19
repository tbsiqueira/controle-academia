'use strict';

/* Tests for the core.js module registration.
   They check that, in the browser (without module.exports), the functions become window globals. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../js/core.js');

test('core.js registers itself in the browser when module.exports does not exist', () => {
  const arquivo = path.join(__dirname, '..', 'js', 'core.js');
  const fonte = fs.readFileSync(arquivo, 'utf8');
  const escopo = { self: {} };                 // simulates the browser (no module)
  vm.createContext(escopo);
  new vm.Script(fonte, { filename: arquivo }).runInContext(escopo);

  assert.equal(typeof escopo.self.weekWindow, 'function', 'functions become globals in the browser');
  assert.equal(typeof escopo.self.exerciseLabel, 'function', 'resolvers also become globals');
  assert.equal(typeof escopo.self.backupStatus, 'function', 'backup also becomes global');
});
