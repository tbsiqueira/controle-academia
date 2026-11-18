/* core.js e db.js como ES modules (issue #8) e a ponte temporaria js/bridge.js.
   O app.js ainda e script classico: a ponte publica no window o que core.js e db.js exportam,
   e o index.html garante que ela roda antes do app.js. A ponte sai na issue #9. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as core from '../js/core.js';
import * as db from '../js/db.js';

function read(relative) {
  return fs.readFileSync(path.join(import.meta.dirname, '..', relative), 'utf8');
}

test('core.js e db.js sao modulos: so export, sem wrapper UMD e sem publicar globais', () => {
  ['js/core.js', 'js/db.js'].forEach((file) => {
    const source = read(file);
    assert.match(source, /^export \{[\s\S]*\};\s*$/m, file + ' termina com a lista de export');
    assert.doesNotMatch(source, /module\.exports|typeof module|Object\.assign\(root/, file + ' sem wrapper UMD');
    assert.doesNotMatch(source, /\b(window|self|globalThis)\s*[.[]/, file + ' nao mexe no escopo global');
  });
  assert.equal(JSON.parse(read('js/package.json')).type, 'module', 'o Node le js/*.js como modulo');
});

test('core.js e db.js exportam funcoes, sem nomes repetidos entre os dois', () => {
  [core, db].forEach((mod) => {
    Object.keys(mod).forEach((name) => assert.equal(typeof mod[name], 'function', name));
  });
  const repeated = Object.keys(core).filter((name) => name in db);
  assert.deepEqual(repeated, [], 'a ponte junta os dois no window: um nome repetido seria sobrescrito');
  ['weekWindow', 'exerciseLabel', 'backupStatus', 'normalizeBackup'].forEach((name) => {
    assert.equal(typeof core[name], 'function', name);
  });
  ['dbAll', 'dbGet', 'dbPut', 'dbDelete', 'dbReplaceAll', 'dbClear'].forEach((name) => {
    assert.equal(typeof db[name], 'function', name);
  });
});

test('a ponte importa core.js e db.js na versao do app e publica os dois no window', () => {
  const bridge = read('js/bridge.js');
  const version = read('index.html').match(/id="appVersion">v(\d+)</)[1];
  assert.match(bridge, new RegExp("import \\* as core from '\\./core\\.js\\?v=" + version + "';"));
  assert.match(bridge, new RegExp("import \\* as db from '\\./db\\.js\\?v=" + version + "';"));
  assert.match(bridge, /Object\.assign\(window, core, db\);/);
});

test('index.html carrega a ponte como modulo antes do app.js (defer), e nao carrega core/db direto', () => {
  const html = read('index.html');
  const bridgeTag = html.indexOf('<script type="module" src="js/bridge.js?v=');
  const appTag = html.indexOf('<script defer src="js/app.js?v=');
  assert.ok(bridgeTag > 0, 'ponte como type="module"');
  assert.ok(appTag > bridgeTag, 'app.js com defer, depois da ponte (modulos e defer rodam na ordem do documento)');
  assert.doesNotMatch(html, /src="js\/(core|db)\.js/, 'core.js e db.js so entram pela ponte');
});
