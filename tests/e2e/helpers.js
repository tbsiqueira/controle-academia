// Ajudantes compartilhados pelos testes de navegador.
// Cada teste roda num contexto novo do navegador: IndexedDB, caches e service worker começam vazios.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { coveredLines, isAppScript, FILE: COVERED_FILE, RAW_DIR: COVERAGE_DIR } = require('../../tools/e2e-coverage');

/** Abas da barra inferior, pelo texto que a pessoa vê. */
const TABS = {
  'Início': { hash: '#/dashboard', view: 'view-dashboard' },
  'Treinar': { hash: '#/workout', view: 'view-workout' },
  'Fichas': { hash: '#/exercises', view: 'view-exercises' },
  'Calendário': { hash: '#/calendar', view: 'view-calendar' },
  'Mais': { hash: '#/more', view: 'view-more' }
};

/**
 * `test` com dois fixtures automáticos.
 *
 * `appCoverage`: mede quais linhas do js/app.js rodaram no teste (cobertura de JS do Chromium) e grava em
 * tests/e2e/coverage/; `node tools/e2e-coverage.js` junta tudo depois (a catraca do CI).
 *
 * `appErrors`: junta todo erro do console e toda exceção não tratada da página e
 * reprova o teste no fim se houver algum. Um teste que espera um erro de propósito pode esvaziar a lista.
 * Também responde "sim" a todo confirm(), para os botões com confirmação funcionarem.
 */
const test = base.test.extend({
  appCoverage: [async ({ page }, use, testInfo) => {
    // Perfil do V8 pelo protocolo do Chromium. Recarregar a página descarta os contadores da página anterior,
    // então page.reload/page.goto tiram uma foto antes. Recargas feitas pelo próprio app ("Atualizar app") não
    // têm foto: segurar a navegação (Fetch) para fotografar trava o perfil do V8. O teste delas continua valendo.
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
    page.on('pageerror', (err) => errors.push('exceção: ' + err.message));
    await page.addInitScript(() => { window.confirm = () => true; });
    await use(errors);
    base.expect(errors, 'erros no console ou exceções na página').toEqual([]);
  }, { auto: true }]
});

/** Abre o app com o banco vazio e espera o Início terminar de montar. */
async function freshApp(page) {
  await page.goto('./');
  await waitForApp(page);
}

/** Espera o app terminar a inicialização (o card da semana só aparece depois de carregar o banco). */
async function waitForApp(page) {
  await base.expect(page.locator('#weekProgress .week-card')).toBeVisible();
}

/** Abre o app e carrega os dados de exemplo (3 fichas, 12 treinos com datas relativas a hoje) pela tela Mais. */
async function withSampleData(page) {
  await freshApp(page);
  await goTo(page, 'Mais');
  await page.locator('#btnLoadSample').click();
  await base.expect(page.locator('#sampleStatus')).toContainText('Dados de exemplo carregados');
  await goTo(page, 'Início');
}

/**
 * Abre o app e importa um backup pela tela Mais → Importar, como uma pessoa faria.
 * Serve para montar um ponto de partida exato (fichas, treinos anteriores com cargas conhecidas).
 * `backup` é o nome de um arquivo de `tests/e2e/fixtures/` ou o próprio conteúdo (objeto), para variações
 * feitas no teste a partir de `readFixture`.
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

/** Conteúdo de um backup de `tests/e2e/fixtures/` (cópia nova a cada chamada, pode ser alterada). */
function readFixture(fixtureName) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', fixtureName), 'utf8'));
}

/** Rascunho gravado no aparelho (IndexedDB do app, store `settings`, id `workoutDraft`), ou null. */
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

/** Todos os registros de um store do IndexedDB do app (workouts, sheets, exercises, colinha, settings). */
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
 * Daqui em diante, responde `answer` a todo confirm() da página (o padrão dos testes é "sim") e guarda as perguntas.
 * Devolve uma função que lê as perguntas feitas até agora.
 */
async function answerConfirm(page, answer) {
  await page.evaluate((reply) => {
    window.__confirms = [];
    window.confirm = (message) => { window.__confirms.push(message); return reply; };
  }, answer);
  return () => page.evaluate(() => window.__confirms);
}

/** Toca numa aba da barra inferior, como uma pessoa faria, e confere que a tela certa abriu. */
async function goTo(page, tabName) {
  const tab = TABS[tabName];
  if (!tab) throw new Error('aba desconhecida: ' + tabName);
  const link = page.locator(`.bottom-nav a[href="${tab.hash}"]`);
  await base.expect(link).toContainText(tabName);
  await link.click();
  await base.expect(page.locator('#' + tab.view)).toBeVisible();
}

module.exports = {
  test, expect: base.expect, TABS, freshApp, waitForApp, withSampleData, withBackup, readFixture, storedDraft, storedRecords,
  goTo, answerConfirm
};
