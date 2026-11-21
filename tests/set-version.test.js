'use strict';

/* Tests for tools/set-version.js: app.json is the single source of the app version. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseVersion, stampText, stampAll } = require('../tools/set-version.js');

const REPO = path.join(__dirname, '..');

// A temporary copy of the real files, so each test can bump freely.
const tempDirs = [];
test.after(() => { for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true }); });

function tempRepo(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-version-'));
  tempDirs.push(dir);
  for (const file of ['index.html', 'sw.js']) fs.copyFileSync(path.join(REPO, file), path.join(dir, file));
  fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify({ version: version }));
  return dir;
}

function read(dir, file) { return fs.readFileSync(path.join(dir, file), 'utf8'); }

test('the repo files are stamped with app.json (the CI drift guard)', () => {
  const version = parseVersion(read(REPO, 'app.json'));
  assert.match(read(REPO, 'index.html'), new RegExp('id="appVersion">v' + version + '<'));
  assert.ok(read(REPO, 'sw.js').includes("'meu-treino-v" + version + "'"));
  assert.equal(stampText('index.html', read(REPO, 'index.html'), version), read(REPO, 'index.html'));
  assert.equal(stampText('sw.js', read(REPO, 'sw.js'), version), read(REPO, 'sw.js'));
});

test('bumping forward rewrites all 16 spots', () => {
  const dir = tempRepo(9999);
  const result = stampAll(dir);
  assert.deepEqual(result, { version: 9999, changed: ['index.html', 'sw.js'] });
  assert.equal(read(dir, 'index.html').match(/\?v=9999/g).length, 7);
  assert.ok(read(dir, 'index.html').includes('<span id="appVersion">v9999</span>'));
  assert.equal(read(dir, 'sw.js').match(/\?v=9999/g).length, 7);
  assert.ok(read(dir, 'sw.js').includes("CACHE_NAME = 'meu-treino-v9999'"));
});

test('running it again is a no-op', () => {
  const dir = tempRepo(9999);
  stampAll(dir);
  const html = read(dir, 'index.html');
  const sw = read(dir, 'sw.js');
  assert.deepEqual(stampAll(dir), { version: 9999, changed: [] });
  assert.equal(read(dir, 'index.html'), html);
  assert.equal(read(dir, 'sw.js'), sw);
});

test('it only changes the version spots, never other numbers', () => {
  const dir = tempRepo(9999);
  stampAll(dir);
  // Blank out the version spots; whatever is left must be identical to the original file.
  const blank = (text) => text.replace(/\?v=\d+/g, '?v=N').replace(/meu-treino-v\d+/g, 'meu-treino-vN')
    .replace(/(appVersion">v)\d+/g, '$1N');
  for (const file of ['index.html', 'sw.js']) assert.equal(blank(read(dir, file)), blank(read(REPO, file)));
});

test('it refuses a file whose spots changed shape, and writes nothing', () => {
  const dir = tempRepo(9999);
  const original = read(dir, 'index.html');
  const html = original.replace(/css\/styles\.css\?v=\d+/, 'css/styles.css');
  assert.notEqual(html, original);   // the fixture really lost a spot, whatever the current version is
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  assert.throws(() => stampAll(dir), /index\.html: expected 7 \?v=N asset URLs, found 6/);
  assert.equal(read(dir, 'sw.js'), read(REPO, 'sw.js'));   // sw.js untouched: all or nothing
});

test('it refuses a version that is not a positive integer', () => {
  for (const bad of ['"85"', '0', '-1', '1.5', 'null']) {
    assert.throws(() => parseVersion('{"version":' + bad + '}'), /positive integer/);
  }
  assert.throws(() => parseVersion('{}'), /positive integer/);
});

// --- the command line: `node tools/set-version.js [folder]` ---

const SCRIPT = path.join(REPO, 'tools', 'set-version.js');
function runCli(dir) { return spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' }); }

test('CLI: stamps, reports the files, then reports "already stamped"', () => {
  const dir = tempRepo(9999);
  const first = runCli(dir);
  assert.equal(first.status, 0);
  assert.equal(first.stdout.trim(), 'v9999 stamped in index.html, sw.js');
  const second = runCli(dir);
  assert.equal(second.status, 0);
  assert.equal(second.stdout.trim(), 'v9999: already stamped');
});

test('CLI: exits 1 with the reason and writes nothing when a spot is missing', () => {
  const dir = tempRepo(9999);
  fs.writeFileSync(path.join(dir, 'sw.js'), read(dir, 'sw.js').replace(/'meu-treino-v\d+'/, "'meu-treino'"));
  const before = read(dir, 'index.html');
  const result = runCli(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sw\.js: expected 1 CACHE_NAME, found 0/);
  assert.equal(read(dir, 'index.html'), before);
});

test('CLI: exits 1 on an invalid app.json', () => {
  const dir = tempRepo(9999);
  fs.writeFileSync(path.join(dir, 'app.json'), '{ "version": "85" }');
  const result = runCli(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /positive integer/);
});
