'use strict';

/* Tests for the IndexedDB layer (js/db.js) with a fake IndexedDB, no dependencies.
   Regression: importing a backup erased the data BEFORE writing the new data, in separate
   transactions — a write that failed left the database empty. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

// Loads db.js in a browser scope with a fake IndexedDB that records everything in `log`.
function loadDb() {
  const log = [];
  let txCount = 0;

  const db = {
    transaction: function (names, mode) {
      const tx = { id: ++txCount, aborted: false };
      log.push({ op: 'transaction', tx: tx.id, stores: [].concat(names), mode: mode });
      tx.objectStore = function (name) {
        return {
          clear: function () { log.push({ op: 'clear', tx: tx.id, store: name }); },
          put: function (value) {
            if (value && value.invalid) throw new Error('DataError');
            log.push({ op: 'put', tx: tx.id, store: name, value: value });
          }
        };
      };
      tx.abort = function () {
        tx.aborted = true;
        log.push({ op: 'abort', tx: tx.id });
        tx.error = null;
        if (tx.onabort) tx.onabort();
      };
      setTimeout(function () {
        if (!tx.aborted) {
          log.push({ op: 'complete', tx: tx.id });
          tx.oncomplete();
        }
      }, 0);
      return tx;
    }
  };

  const scope = {
    indexedDB: {
      open: function () {
        const request = { result: db };
        setTimeout(function () { request.onsuccess(); }, 0);
        return request;
      }
    }
  };
  vm.createContext(scope);
  new vm.Script(read('js/db.js'), { filename: 'js/db.js' }).runInContext(scope);
  return { dbReplaceAll: scope.dbReplaceAll, log: log };
}

test('dbReplaceAll erases and writes everything in ONE transaction', async () => {
  const { dbReplaceAll, log } = loadDb();

  await dbReplaceAll({
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    sheets: [{ id: 's1' }],
    settings: [{ id: 'app' }]
  });

  const transactions = log.filter((e) => e.op === 'transaction');
  assert.equal(transactions.length, 1, 'a single transaction');
  assert.equal(transactions[0].mode, 'readwrite');
  assert.deepEqual(transactions[0].stores.slice().sort(), ['colinha', 'exercises', 'settings', 'sheets', 'workouts']);

  // every store is cleared (including those that received nothing) and the clear comes before the put
  ['workouts', 'exercises', 'sheets', 'settings', 'colinha'].forEach((store) => {
    const ops = log.filter((e) => e.store === store).map((e) => e.op);
    assert.equal(ops[0], 'clear', store + ' is cleared first');
    assert.equal(ops.filter((op) => op === 'clear').length, 1);
  });

  assert.deepEqual(log.filter((e) => e.op === 'put').map((e) => e.value.id), ['w1', 'w2', 's1', 'app']);
  assert.equal(log[log.length - 1].op, 'complete', 'it only resolves after the transaction completes');
});

test('dbReplaceAll aborts the transaction when a record is invalid (old data stays)', async () => {
  const { dbReplaceAll, log } = loadDb();

  await assert.rejects(
    dbReplaceAll({ workouts: [{ id: 'w1' }, { invalid: true }], sheets: [{ id: 's1' }] }),
    /DataError/
  );

  assert.equal(log.filter((e) => e.op === 'abort').length, 1, 'abort() undoes the clear() calls already requested');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(log.filter((e) => e.op === 'complete').length, 0, 'nothing is written');
});

test('restoreAll (app.js) uses dbReplaceAll and does not clear the stores beforehand', () => {
  const app = read('js/app.js');
  const body = app.slice(app.indexOf('async function restoreAll'), app.indexOf('async function loadSampleData'));
  assert.match(body, /dbReplaceAll\(/);
  assert.doesNotMatch(body, /dbClear\(/);
});
