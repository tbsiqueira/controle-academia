/* Testes da camada IndexedDB (js/db.js) com um IndexedDB falso, sem dependências.
   Regressão: importar um backup apagava os dados ANTES de gravar os novos, em transações
   separadas — uma gravação que falhasse deixava o banco vazio. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(relative) {
  return fs.readFileSync(path.join(import.meta.dirname, '..', relative), 'utf8');
}

let loads = 0;

// Importa o db.js com um IndexedDB falso (global, como no navegador) que anota tudo em `log`.
async function loadDb() {
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

  globalThis.indexedDB = {
    open: function () {
      const request = { result: db };
      setTimeout(function () { request.onsuccess(); }, 0);
      return request;
    }
  };
  // ?n= da a cada teste uma copia nova do modulo (o db.js guarda a conexao aberta).
  const { dbReplaceAll } = await import('../js/db.js?n=' + (++loads));
  return { dbReplaceAll: dbReplaceAll, log: log };
}

test('dbReplaceAll apaga e grava tudo em UMA transacao', async () => {
  const { dbReplaceAll, log } = await loadDb();

  await dbReplaceAll({
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    sheets: [{ id: 's1' }],
    settings: [{ id: 'app' }]
  });

  const transactions = log.filter((e) => e.op === 'transaction');
  assert.equal(transactions.length, 1, 'uma transacao so');
  assert.equal(transactions[0].mode, 'readwrite');
  assert.deepEqual(transactions[0].stores.slice().sort(), ['colinha', 'exercises', 'settings', 'sheets', 'workouts']);

  // todo store e limpo (inclusive os que nao receberam nada) e o clear vem antes do put
  ['workouts', 'exercises', 'sheets', 'settings', 'colinha'].forEach((store) => {
    const ops = log.filter((e) => e.store === store).map((e) => e.op);
    assert.equal(ops[0], 'clear', store + ' e limpo primeiro');
    assert.equal(ops.filter((op) => op === 'clear').length, 1);
  });

  assert.deepEqual(log.filter((e) => e.op === 'put').map((e) => e.value.id), ['w1', 'w2', 's1', 'app']);
  assert.equal(log[log.length - 1].op, 'complete', 'so resolve depois de a transacao completar');
});

test('dbReplaceAll aborta a transacao quando um registro e invalido (dados antigos ficam)', async () => {
  const { dbReplaceAll, log } = await loadDb();

  await assert.rejects(
    dbReplaceAll({ workouts: [{ id: 'w1' }, { invalid: true }], sheets: [{ id: 's1' }] }),
    /DataError/
  );

  assert.equal(log.filter((e) => e.op === 'abort').length, 1, 'abort() desfaz os clear() ja pedidos');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(log.filter((e) => e.op === 'complete').length, 0, 'nada e gravado');
});

test('restoreAll (app.js) usa dbReplaceAll e nao limpa os stores antes', () => {
  const app = read('js/app.js');
  const body = app.slice(app.indexOf('async function restoreAll'), app.indexOf('async function loadSampleData'));
  assert.match(body, /dbReplaceAll\(/);
  assert.doesNotMatch(body, /dbClear\(/);
});
