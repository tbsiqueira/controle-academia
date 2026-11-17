// Ajudantes compartilhados pelos testes de navegador.
// Cada teste roda num contexto novo do navegador: IndexedDB, caches e service worker começam vazios.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');

/** Abas da barra inferior, pelo texto que a pessoa vê. */
const TABS = {
  'Início': { hash: '#/dashboard', view: 'view-dashboard' },
  'Treinar': { hash: '#/workout', view: 'view-workout' },
  'Fichas': { hash: '#/exercises', view: 'view-exercises' },
  'Calendário': { hash: '#/calendar', view: 'view-calendar' },
  'Mais': { hash: '#/more', view: 'view-more' }
};

/**
 * `test` com o fixture automático `appErrors`: junta todo erro do console e toda exceção não tratada da página e
 * reprova o teste no fim se houver algum. Um teste que espera um erro de propósito pode esvaziar a lista.
 * Também responde "sim" a todo confirm(), para os botões com confirmação funcionarem.
 */
const test = base.test.extend({
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
    ? path.join(__dirname, 'fixtures', backup)
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
  test, expect: base.expect, TABS, freshApp, waitForApp, withSampleData, withBackup, readFixture, storedDraft, goTo
};
