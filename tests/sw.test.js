'use strict';

/* Testes do service worker (sw.js) com cache e rede falsos, sem dependências.
   Regressão: tudo era "rede primeiro"; com sinal fraco (academia) o app esperava a rede
   desistir antes de usar o cache. Arquivos versionados (?v=N) agora saem direto do cache. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function response(body) {
  return { status: 200, body: body, clone: function () { return this; } };
}

// Sobe o sw.js num escopo falso. `cached` = { chave: resposta }; `online` liga/desliga a rede.
function loadWorker(origin, cached) {
  const listeners = {};
  const store = new Map(Object.entries(cached || {}));
  const world = { online: true, fetched: [], store: store };

  const scope = {
    URL: URL,
    Response: { error: function () { return { status: 0, body: 'network-error' }; } },
    caches: {
      match: function (key) { return Promise.resolve(store.get(key.replace(/^\.\//, origin + '/'))); },
      open: function () {
        return Promise.resolve({ put: function (key, value) { store.set(key, value); }, addAll: function () {} });
      },
      keys: function () { return Promise.resolve([]); }
    },
    fetch: function (request) {
      world.fetched.push(request.url);
      return world.online ? Promise.resolve(response('rede:' + request.url)) : Promise.reject(new Error('offline'));
    },
    location: new URL(origin + '/sw.js'),
    addEventListener: function (type, fn) { listeners[type] = fn; }
  };
  scope.self = scope;
  vm.createContext(scope);
  new vm.Script(SOURCE, { filename: 'sw.js' }).runInContext(scope);

  // Dispara um fetch; devolve a resposta, ou undefined se o worker nao interceptou.
  world.request = async function (url, extra) {
    let answer;
    listeners.fetch({
      request: Object.assign({ method: 'GET', url: url, mode: 'no-cors' }, extra),
      respondWith: function (promise) { answer = promise; }
    });
    const result = await answer;
    await new Promise((resolve) => setTimeout(resolve, 0));   // deixa o putInCache terminar
    return result;
  };
  return world;
}

const SITE = 'https://usuario.github.io';
const APP_JS = SITE + '/js/app.js?v=59';

test('producao: arquivo versionado sai do cache sem tocar na rede', async () => {
  const sw = loadWorker(SITE, { [APP_JS]: response('cache') });
  const res = await sw.request(APP_JS);
  assert.equal(res.body, 'cache');
  assert.deepEqual(sw.fetched, [], 'nao espera a rede (wifi fraco nao trava a abertura)');
});

test('producao: arquivo versionado fora do cache vem da rede e fica guardado pela URL completa', async () => {
  const sw = loadWorker(SITE, {});
  const res = await sw.request(APP_JS);
  assert.equal(res.body, 'rede:' + APP_JS);
  assert.equal(sw.store.get(APP_JS).body, 'rede:' + APP_JS);

  // versao nova = URL nova: nao reaproveita o cache da antiga
  const novo = SITE + '/js/app.js?v=60';
  assert.equal((await sw.request(novo)).body, 'rede:' + novo);
  assert.equal(sw.store.get(APP_JS).body, 'rede:' + APP_JS);
});

test('index.html e catalogo continuam rede primeiro, com cache quando esta offline', async () => {
  const index = SITE + '/index.html';
  const sw = loadWorker(SITE, { [index]: response('cache-velho') });

  assert.equal((await sw.request(index)).body, 'rede:' + index, 'online: sempre a versao mais nova');
  assert.equal(sw.store.get(index).body, 'rede:' + index, 'e atualiza o cache');

  sw.online = false;
  assert.equal((await sw.request(index)).body, 'rede:' + index, 'offline: ultima versao guardada');
  assert.equal((await sw.request(SITE + '/data/exercises.json')).body, 'network-error', 'sem cache: erro de rede');
});

test('offline: navegacao para uma rota desconhecida cai no index.html do cache', async () => {
  const sw = loadWorker(SITE, { [SITE + '/index.html']: response('index') });
  sw.online = false;
  assert.equal((await sw.request(SITE + '/qualquer', { mode: 'navigate' })).body, 'index');
});

test('localhost: arquivo versionado continua rede primeiro (edicao sem trocar a versao aparece)', async () => {
  for (const host of ['http://localhost:8080', 'http://127.0.0.1:8080']) {
    const url = host + '/js/app.js?v=59';
    const sw = loadWorker(host, { [url]: response('cache') });
    assert.equal((await sw.request(url)).body, 'rede:' + url, host);

    sw.online = false;
    assert.equal((await sw.request(url)).body, 'rede:' + url, 'offline usa o que ficou no cache');
  }
});

test('nao intercepta POST, outras origens nem o proprio sw.js', async () => {
  const sw = loadWorker(SITE, {});
  assert.equal(await sw.request(SITE + '/x', { method: 'POST' }), undefined);
  assert.equal(await sw.request('https://outro.site/js/app.js?v=59'), undefined);
  assert.equal(await sw.request(SITE + '/sw.js'), undefined);
  assert.deepEqual(sw.fetched, []);
});
