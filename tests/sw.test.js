'use strict';

/* Tests for the service worker (sw.js) with a fake cache and network, no dependencies.
   Regression: everything was "network first"; with a weak signal (gym) the app waited for the network
   to give up before using the cache. Versioned files (?v=N) now come straight from the cache. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function response(body) {
  return { status: 200, body: body, clone: function () { return this; } };
}

// Boots sw.js in a fake scope. `cached` = { key: response }; `online` turns the network on/off.
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

  // Fires a fetch; returns the response, or undefined if the worker did not intercept it.
  world.request = async function (url, extra) {
    let answer;
    listeners.fetch({
      request: Object.assign({ method: 'GET', url: url, mode: 'no-cors' }, extra),
      respondWith: function (promise) { answer = promise; }
    });
    const result = await answer;
    await new Promise((resolve) => setTimeout(resolve, 0));   // lets putInCache finish
    return result;
  };
  return world;
}

const SITE = 'https://usuario.github.io';
const APP_JS = SITE + '/js/app.js?v=59';

test('production: a versioned file comes from the cache without touching the network', async () => {
  const sw = loadWorker(SITE, { [APP_JS]: response('cache') });
  const res = await sw.request(APP_JS);
  assert.equal(res.body, 'cache');
  assert.deepEqual(sw.fetched, [], 'does not wait for the network (weak wifi does not block opening)');
});

test('production: a versioned file outside the cache comes from the network and is stored by the full URL', async () => {
  const sw = loadWorker(SITE, {});
  const res = await sw.request(APP_JS);
  assert.equal(res.body, 'rede:' + APP_JS);
  assert.equal(sw.store.get(APP_JS).body, 'rede:' + APP_JS);

  // new version = new URL: does not reuse the old one cache
  const novo = SITE + '/js/app.js?v=60';
  assert.equal((await sw.request(novo)).body, 'rede:' + novo);
  assert.equal(sw.store.get(APP_JS).body, 'rede:' + APP_JS);
});

test('index.html and the catalog stay network first, with cache when offline', async () => {
  const index = SITE + '/index.html';
  const sw = loadWorker(SITE, { [index]: response('cache-velho') });

  assert.equal((await sw.request(index)).body, 'rede:' + index, 'online: always the newest version');
  assert.equal(sw.store.get(index).body, 'rede:' + index, 'and updates the cache');

  sw.online = false;
  assert.equal((await sw.request(index)).body, 'rede:' + index, 'offline: last stored version');
  assert.equal((await sw.request(SITE + '/data/exercises.json')).body, 'network-error', 'no cache: network error');
});

test('offline: navigating to an unknown route falls back to the cached index.html', async () => {
  const sw = loadWorker(SITE, { [SITE + '/index.html']: response('index') });
  sw.online = false;
  assert.equal((await sw.request(SITE + '/qualquer', { mode: 'navigate' })).body, 'index');
});

test('localhost: a versioned file stays network first (an edit without a version change shows up)', async () => {
  for (const host of ['http://localhost:8080', 'http://127.0.0.1:8080']) {
    const url = host + '/js/app.js?v=59';
    const sw = loadWorker(host, { [url]: response('cache') });
    assert.equal((await sw.request(url)).body, 'rede:' + url, host);

    sw.online = false;
    assert.equal((await sw.request(url)).body, 'rede:' + url, 'offline uses what stayed in the cache');
  }
});

test('does not intercept POST, other origins or sw.js itself', async () => {
  const sw = loadWorker(SITE, {});
  assert.equal(await sw.request(SITE + '/x', { method: 'POST' }), undefined);
  assert.equal(await sw.request('https://outro.site/js/app.js?v=59'), undefined);
  assert.equal(await sw.request(SITE + '/sw.js'), undefined);
  assert.deepEqual(sw.fetched, []);
});
