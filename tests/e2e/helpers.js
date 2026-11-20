// Helpers shared by the browser tests.
// Every test runs in a fresh browser context: IndexedDB, caches and service worker start empty.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { coveredLines, isAppScript, FILE: COVERED_FILE, RAW_DIR: COVERAGE_DIR } = require('../../tools/e2e-coverage');

/** Bottom-bar tabs, by the text the person sees. */
const TABS = {
  'Início': { hash: '#/dashboard', view: 'view-dashboard' },
  'Treinar': { hash: '#/workout', view: 'view-workout' },
  'Fichas': { hash: '#/exercises', view: 'view-exercises' },
  'Calendário': { hash: '#/calendar', view: 'view-calendar' },
  'Mais': { hash: '#/more', view: 'view-more' }
};

/** Mark of a test where the app itself reloads the page (`location.reload`), so coverage counts it. */
const RECARGA_DO_APP = { type: 'recarga-do-app', description: 'the app reloads the page; coverage takes the snapshot before it' };

/**
 * `test` with two automatic fixtures.
 *
 * `appCoverage`: measures which lines of js/app.js ran in the test (Chromium JS coverage) and writes them to
 * tests/e2e/coverage/; `node tools/e2e-coverage.js` joins everything afterwards (the CI ratchet).
 *
 * `appErrors`: collects every console error and every unhandled exception on the page and
 * fails the test at the end if there is any. A test that expects an error on purpose can empty the list.
 * It also answers "yes" to every confirm(), so the buttons with a confirmation work.
 */
const test = base.test.extend({
  appCoverage: [async ({ page }, use, testInfo) => {
    // V8 profile through the Chromium protocol. Reloading the page discards the previous page's counters,
    // so page.reload/page.goto take a snapshot beforehand. Reloads made by the app itself ("Atualizar app"):
    // the test declares `{ annotation: RECARGA_DO_APP }` and a breakpoint on each `location.reload(` in app.js
    // pauses the page, takes the snapshot and continues. Only in those tests: with the debugger on, reloading
    // offline from the service worker cache takes the page down. (Holding navigation through Fetch to snapshot
    // freezes the profile.)
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const source = fs.readFileSync(path.join(__dirname, '..', '..', COVERED_FILE), 'utf8');
    const lines = new Set();
    const snapshot = async () => {
      const { result } = await cdp.send('Profiler.takePreciseCoverage').catch(() => ({ result: [] }));
      result.filter((e) => isAppScript(e.url))
        .forEach((e) => coveredLines({ source, functions: e.functions }).forEach((l) => lines.add(l)));
    };
    const appReloads = source.split('\n')
      .map((text, i) => (/\blocation\.reload\(/.test(text) ? i : -1)).filter((i) => i >= 0);
    const appReloadsHere = testInfo.annotations.some((a) => a.type === RECARGA_DO_APP.type);
    if (appReloadsHere && appReloads.length) {
      await cdp.send('Debugger.enable');
      for (const lineNumber of appReloads) {
        await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: '/' + COVERED_FILE.replace(/[./]/g, '\\$&') + '(\\?|$)', lineNumber });
      }
      cdp.on('Debugger.paused', async () => {
        await snapshot();
        await cdp.send('Debugger.resume').catch(() => {});
      });
    }
    for (const method of ['reload', 'goto']) {
      const original = page[method].bind(page);
      page[method] = async (...args) => { await snapshot(); return original(...args); };
    }
    await use();
    await snapshot();
    const name = testInfo.testId + '-' + testInfo.retry + '.json';
    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
    fs.writeFileSync(path.join(COVERAGE_DIR, name),
      JSON.stringify({ file: COVERED_FILE, title: testInfo.titlePath.join(' › '), lines: [...lines] }));
  }, { auto: true }],
  appErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('console: ' + msg.text());
    });
    page.on('pageerror', (err) => errors.push('exception: ' + err.message));
    await page.addInitScript(() => { window.confirm = () => true; });
    await use(errors);
    base.expect(errors, 'console errors or page exceptions').toEqual([]);
  }, { auto: true }]
});

/** Opens the app with an empty database and waits for Início to finish mounting. */
async function freshApp(page) {
  await page.goto('./');
  await waitForApp(page);
}

/** Waits for the app to finish starting (the week card only appears after the database loads). */
async function waitForApp(page) {
  await base.expect(page.locator('#weekProgress .week-card')).toBeVisible();
}

/** Opens the app and loads the sample data (3 sheets, 12 workouts dated relative to today) from the Mais screen. */
async function withSampleData(page) {
  await freshApp(page);
  await goTo(page, 'Mais');
  await page.locator('#btnLoadSample').click();
  await base.expect(page.locator('#sampleStatus')).toContainText('Dados de exemplo carregados');
  await goTo(page, 'Início');
}

/**
 * Opens the app and imports a backup through the Mais → Importar screen, the way a person would.
 * It sets up an exact starting point (sheets, earlier workouts with known loads).
 * `backup` is the name of a file in `tests/e2e/fixtures/` or the content itself (an object), for variations
 * made in the test from `readFixture`.
 */
async function withBackup(page, backup) {
  await freshApp(page);
  await goTo(page, 'Mais');
  const file = typeof backup === 'string'
    ? path.resolve(__dirname, 'fixtures', backup)
    : { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  await page.locator('#importFile').setInputFiles(file);
  await base.expect(page.locator('#appToastBody')).toContainText('Backup importado');
  await base.expect(page.locator('#view-dashboard')).toBeVisible();
}

/** Content of a backup from `tests/e2e/fixtures/` (a fresh copy per call, may be changed). */
function readFixture(fixtureName) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', fixtureName), 'utf8'));
}

/** Draft saved on the device (the app's IndexedDB, `settings` store, `workoutDraft` id), or null. */
function storedDraft(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('meu-treino');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const get = db.transaction('settings').objectStore('settings').get('workoutDraft');
      get.onsuccess = () => { db.close(); resolve(get.result || null); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}

/** Every record of one store of the app's IndexedDB (workouts, sheets, exercises, colinha, settings). */
function storedRecords(page, store) {
  return page.evaluate((storeName) => new Promise((resolve, reject) => {
    const open = indexedDB.open('meu-treino');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const all = db.transaction(storeName).objectStore(storeName).getAll();
      all.onsuccess = () => { db.close(); resolve(all.result); };
      all.onerror = () => { db.close(); reject(all.error); };
    };
  }), store);
}

/**
 * From now on, answers `answer` to every confirm() on the page (the tests' default is "yes") and keeps the questions.
 * Returns a function that reads the questions asked so far.
 */
async function answerConfirm(page, answer) {
  await page.evaluate((reply) => {
    window.__confirms = [];
    window.confirm = (message) => { window.__confirms.push(message); return reply; };
  }, answer);
  return () => page.evaluate(() => window.__confirms);
}

/** Taps a tab on the bottom bar, the way a person would, and checks that the right screen opened. */
async function goTo(page, tabName) {
  const tab = TABS[tabName];
  if (!tab) throw new Error('unknown tab: ' + tabName);
  const link = page.locator(`.bottom-nav a[href="${tab.hash}"]`);
  await base.expect(link).toContainText(tabName);
  await link.click();
  await base.expect(page.locator('#' + tab.view)).toBeVisible();
}

module.exports = {
  test, expect: base.expect, TABS, freshApp, waitForApp, withSampleData, withBackup, readFixture, storedDraft, storedRecords,
  goTo, answerConfirm, RECARGA_DO_APP
};
