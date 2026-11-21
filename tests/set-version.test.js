'use strict';

/* Tests for tools/set-version.js: app.json is the single source of the app version. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseVersion, stampText, verifyStamped, stampAll } = require('../tools/set-version.js');

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
  for (const bad of ['"85"', '0', '-1', '1.5', 'null', '1e21']) {
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

test('the read-back guard throws when a spot does not carry the version', () => {
  const html = read(REPO, 'index.html');
  const version = parseVersion(read(REPO, 'app.json'));
  assert.doesNotThrow(() => verifyStamped('index.html', html, version));
  assert.throws(() => verifyStamped('index.html', html, version + 1), /index\.html: .* not stamped/);
});

test('the ?v= spots only match quoted .css/.js asset URLs, not other text', () => {
  const noise = '<!-- old: css/styles.css?v=12 -->\n';
  const stamped = stampText('index.html', noise + read(REPO, 'index.html'), 9999);
  assert.ok(stamped.startsWith(noise));   // the comment (not followed by a quote) is left alone
  assert.equal(stamped.match(/\?v=9999/g).length, 7);
});

test('CLI --print: prints the version of a file or stdin, exits 1 when invalid', () => {
  const dir = tempRepo(9999);
  const ok = spawnSync(process.execPath, [SCRIPT, '--print', path.join(dir, 'app.json')], { encoding: 'utf8' });
  assert.deepEqual([ok.status, ok.stdout.trim()], [0, '9999']);
  const piped = spawnSync(process.execPath, [SCRIPT, '--print', '-'], { input: '{"version": 7}', encoding: 'utf8' });
  assert.deepEqual([piped.status, piped.stdout.trim()], [0, '7']);
  const bad = spawnSync(process.execPath, [SCRIPT, '--print', '-'], { input: '{"version": "7"}', encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.match(bad.stderr, /positive integer/);
});

// --- guards so a release can't silently stop depending on app.json ---

test('CI reads the version through app.json and the script, never by grepping the stamped footer', () => {
  for (const file of ['.github/workflows/deploy.yml', '.github/workflows/tests.yml']) {
    const text = read(REPO, file);
    assert.ok(text.includes('tools/set-version.js --print'), file + ' must read the version with set-version.js --print');
  }
  // The only index.html grep left is the fallback for a base branch that predates app.json (tests.yml).
  assert.equal((read(REPO, '.github/workflows/deploy.yml').match(/appVersion/g) || []).length, 0);
});

test('the bump instructions name app.json and the script (AGENTS.md, workflow.md, the Version job message)', () => {
  for (const file of ['AGENTS.md', 'documentation/agents/workflow.md', '.github/workflows/tests.yml']) {
    const text = read(REPO, file);
    assert.ok(text.includes('app.json') && text.includes('tools/set-version.js'), file + ' must say how to bump');
  }
});

test('check.ps1 compares everything against app.json', () => {
  const check = read(REPO, 'check.ps1');
  assert.ok(check.includes("Read-Text 'app.json'"));
  assert.ok(check.includes('node tools/set-version.js'));   // the failure message tells how to fix drift
});
