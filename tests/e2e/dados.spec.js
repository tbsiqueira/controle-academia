// Data, backup and update (issue #6): non-negotiable number 2, old data is never lost.
// Everything through the Mais screen, the way a person would: import the old backups from `tests/fixtures/`, export and
// import again, erase everything, sample data, undo, and the app update (new service worker and the
// "Atualizar app" button) without losing the draft of the workout in progress.
// The backup reminder on Início is in `inicio.spec.js` (Início · backup reminder).
//
// Old backups (clock fixed at 16/09/2026 so the Início list shows every workout):
// - `backup-v1.json` (format 1, before sheets): workout "types" A and B become sheets; 2 workouts (30/08 with
//   Elevação pélvica 27 kg × 12 and 32 kg × 10 "caiu a força"; 25/08 with Puxada frente supinada 45 kg × 10),
//   Elevação pélvica in Biblioteca (Glúteos), colinha "RIR", goals 4 workouts / 90 min.
// - `backup-v2-sheets.json` (format 2): sheet TREINO A with Elevação pélvica (3×12, "pausa de 1s") and Leg press 45
//   (reps 12-10-8); 1 workout on 14/09 (Elevação pélvica 30 kg × 12, 20 min of cardio), goals 3 / 120.
const fs = require('fs');
const path = require('path');
const { test, expect, freshApp, waitForApp, withBackup, storedDraft, storedRecords, goTo, answerConfirm, RECARGA_DO_APP } = require('./helpers');

const OLD_BACKUPS = path.resolve(__dirname, '..', 'fixtures');
const V1 = path.join(OLD_BACKUPS, 'backup-v1.json');
const V2 = path.join(OLD_BACKUPS, 'backup-v2-sheets.json');

/** Imports an old backup with the clock fixed on a day just after it. */
async function importOld(page, file) {
  await page.clock.setFixedTime(new Date('2026-09-16T10:00:00-03:00'));
  await withBackup(page, file);
}

/** Without the share menu, Exportar becomes a download (the computer path). Call it before opening the app. */
async function exportAsDownload(page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
  });
}

/** Taps Mais → Exportar and returns the downloaded file: name and content. */
async function exportBackupFile(page) {
  await goTo(page, 'Mais');
  const download = page.waitForEvent('download');
  await page.locator('#btnExport').click();
  const file = await download;
  const text = fs.readFileSync(await file.path(), 'utf8');
  await expect(page.locator('#backupAction')).toHaveText('Arquivo gerado: ' + file.suggestedFilename());
  return { name: file.suggestedFilename(), text, json: JSON.parse(text) };
}

/** Imports a file through the Mais → Importar screen (confirm() answers yes). */
async function importFile(page, name, text) {
  await goTo(page, 'Mais');
  await page.locator('#importFile').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#appToastBody')).toContainText('Backup importado');
  await expect(page.locator('#view-dashboard')).toBeVisible();
}

/** Opens the Apagar dados screen, ticks the box and erases everything. */
async function eraseEverything(page) {
  await goTo(page, 'Mais');
  await page.locator('#btnEraseAll').click();
  await expect(page.locator('#view-erase')).toBeVisible();
  await page.getByLabel('Quero realmente apagar todos os meus dados.').check();
  await page.getByRole('button', { name: 'Apagar tudo' }).click();
  await expect(page.locator('#eraseBody')).toContainText('Todos os dados do app foram apagados deste aparelho.');
}

/** Backup data without what changes on every export (the last-backup time). */
function comparable(backup) {
  const data = JSON.parse(JSON.stringify(backup.data));
  delete data.settings.lastBackupAt;
  return data;
}

const recent = (page) => page.locator('#recentWorkouts');
const sheetsList = (page) => page.locator('#sheetsList');
const libraryList = (page) => page.locator('#exercisesList');

/** Opens the workout detail from the Início list that has this text (e.g. the day "30"). */
async function openWorkout(page, text) {
  await goTo(page, 'Início');
  await recent(page).locator('button[data-view-workout]').filter({ hasText: text }).click();
  await expect(page.locator('#view-detail')).toBeVisible();
  return page.locator('#detailBody');
}

test.describe('Data · importing old backups through the screen', () => {
  test('format 1 (before sheets): workouts, sheets, Biblioteca, colinha and goals', async ({ page }) => {
    await importOld(page, V1);

    await expect(recent(page)).toContainText('2 treinos');
    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(2);
    await expect(recent(page)).toContainText('TREINO A - inferiores');
    await expect(recent(page)).toContainText('TREINO B - superiores');

    const detailA = await openWorkout(page, 'TREINO A - inferiores');
    await expect(detailA).toContainText('Elevação pélvica');
    await expect(detailA).toContainText('27');
    await expect(detailA).toContainText('32');
    await expect(detailA).toContainText('caiu a força');
    await expect(detailA).toContainText('treino leve');
    const detailB = await openWorkout(page, 'TREINO B - superiores');
    await expect(detailB).toContainText('Puxada frente supinada');
    await expect(detailB).toContainText('45');

    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('TREINO A - inferiores');
    await expect(sheetsList(page)).toContainText('TREINO B - superiores');
    await page.locator('#tabExercisesBtn').click();
    await expect(libraryList(page)).toContainText('Elevação pélvica');
    await expect(libraryList(page)).toContainText('Glúteos');
    await expect(libraryList(page)).toContainText('pausa de 1s no topo');

    await goTo(page, 'Mais');
    await expect(page.locator('#colinhaList')).toContainText('RIR 2 = ainda daria 2 repetições boas.');
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('4');
    await expect(page.locator('#setCardioTarget')).toHaveValue('90');
    await expect(page.locator('#setWeekAnchor')).toHaveValue('2026-08-24');
  });

  test('format 2 (sheets): sheet with reps per set, workout and goals', async ({ page }) => {
    await importOld(page, V2);

    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(1);
    await expect(recent(page)).toContainText('TREINO A - inferiores');
    await expect(recent(page)).toContainText('20 min cardio');
    const detail = await openWorkout(page, 'TREINO A - inferiores');
    await expect(detail).toContainText('Elevação pélvica');
    await expect(detail).toContainText('30');

    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('TREINO A - inferiores');
    await expect(sheetsList(page)).toContainText('Elevação pélvica');
    await expect(sheetsList(page)).toContainText('3×12-12-12');
    await expect(sheetsList(page)).toContainText('pausa de 1s');
    await expect(sheetsList(page)).toContainText('Leg press 45');
    await expect(sheetsList(page)).toContainText('3×12-10-8');

    await goTo(page, 'Mais');
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('3');
    await expect(page.locator('#setCardioTarget')).toHaveValue('120');
  });

  test('Undo returns to the data from before the import', async ({ page }) => {
    await importOld(page, V2);
    await importFile(page, 'backup-v1.json', fs.readFileSync(V1, 'utf8'));
    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(2);

    await goTo(page, 'Mais');
    await page.locator('#btnUndoImport').click();
    await expect(page.locator('#appToastBody')).toHaveText('Dados anteriores restaurados.');
    await expect(page.locator('#btnUndoImport')).toBeHidden();
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('3');

    await goTo(page, 'Início');
    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(1);
    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('3×12-10-8');
    await expect(sheetsList(page)).not.toContainText('TREINO B - superiores');
  });

  test('answering "Não" to importing changes nothing', async ({ page }) => {
    await importOld(page, V2);
    await goTo(page, 'Mais');
    const asked = await answerConfirm(page, false);

    await page.locator('#importFile').setInputFiles(V1);

    await expect.poll(asked).toEqual(['Substituir todos os dados atuais pelo backup importado?\n\n' +
      'Se algo estiver errado, você poderá desfazer em Mais → Dados.']);
    await expect(page.locator('#view-more')).toBeVisible();
    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('TREINO A - inferiores');
    await expect(sheetsList(page)).not.toContainText('TREINO B - superiores');
  });

  test('answering "Não" to Undo keeps the imported data', async ({ page }) => {
    await importOld(page, V2);
    await importFile(page, 'backup-v1.json', fs.readFileSync(V1, 'utf8'));
    await goTo(page, 'Mais');
    const asked = await answerConfirm(page, false);

    await page.locator('#btnUndoImport').click();

    await expect.poll(asked).toEqual(['Desfazer a última importação e voltar aos dados anteriores?']);
    await expect(page.locator('#btnUndoImport')).toBeVisible();
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
  });

  test('a file that is not a backup erases nothing', async ({ page }) => {
    await importOld(page, V2);
    const alerts = [];
    page.on('dialog', (dialog) => { alerts.push(dialog.message()); dialog.accept(); });

    await goTo(page, 'Mais');
    await page.locator('#importFile').setInputFiles({ name: 'outro.json', mimeType: 'application/json', buffer: Buffer.from('{"foo": 1}') });
    await expect.poll(() => alerts).toEqual(['Este arquivo não parece ser um backup do Meu Treino.']);
    await page.locator('#importFile').setInputFiles({ name: 'quebrado.json', mimeType: 'application/json', buffer: Buffer.from('{ não é json') });
    await expect.poll(() => alerts.length).toBe(2);
    expect(alerts[1]).toBe('Arquivo JSON inválido.');

    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
    expect(await storedRecords(page, 'sheets')).toHaveLength(1);
  });

  test('does not trust the file: an id with code is discarded and an invalid date becomes "Sem data"', async ({ page }) => {
    const set = { exerciseId: 'ex-1', exerciseName: 'Supino reto', number: 1, reps: 10, load: 30 };
    const backup = {
      app: 'meu-treino', version: 2,
      data: {
        workouts: [
          { id: 'w-bom', date: '2026-09-14', sheetId: 's-1', sets: [set] },
          { id: 'x\')"><img src=x onerror="__xss=1">', date: '2026-09-13', sheetId: 's-1', sets: [set] },
          { id: 'w-sem-data', date: '31/31/2026', sheetId: 's-1', sets: [set] }
        ],
        sheets: [
          { id: 's-1', name: 'Treino A', exercises: [{ exerciseId: 'ex-1', name: 'Supino reto', sets: 1 }] },
          { id: '<b>s-2</b>', name: 'Ficha com id ruim', exercises: [] }
        ],
        exercises: [{ id: 'ex-1', name: 'Supino reto', group: 'Peito', source: 'custom' }],
        settings: { id: 'app', weekAnchor: 'ontem', weeklyWorkoutTarget: 3, weeklyCardioTarget: 120 },
        colinha: []
      }
    };
    await importOld(page, backup);

    expect((await storedRecords(page, 'workouts')).map((w) => [w.id, w.date]).sort()).toEqual([['w-bom', '2026-09-14'], ['w-sem-data', '']]);
    expect((await storedRecords(page, 'sheets')).map((s) => s.id)).toEqual(['s-1']);
    await expect(recent(page).locator('.workout-month')).toHaveText(['setembro de 2026 · 1 treino', 'Sem data · 1 treino']);
    await expect(page.locator('#weekProgress .week-card')).toContainText('Semana ativa');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).not.toContainText('Ficha com id ruim');
  });
});

test.describe('Data · export and import again', () => {
  test('round trip: export, erase everything and import again loses nothing', async ({ page }) => {
    await exportAsDownload(page);
    await importOld(page, V1);
    await expect(page.locator('#backupStatus')).not.toContainText('16/09/2026');

    const first = await exportBackupFile(page);
    expect(first.name).toMatch(/^meu-treino-backup-.*\.json$/);
    expect(first.json).toMatchObject({ app: 'meu-treino', version: 2 });
    expect(first.json.appVersion).toBe(await page.locator('#appVersion').textContent());
    expect(first.json.data.workouts).toHaveLength(2);
    expect(first.json.data.sheets).toHaveLength(2);
    expect(first.json.data.exercises).toHaveLength(1);
    expect(first.json.data.colinha).toHaveLength(1);
    // Exportar counts as a backup made.
    expect(first.json.data.settings.lastBackupAt).toBeUndefined();
    expect((await storedRecords(page, 'settings')).find((s) => s.id === 'app').lastBackupAt).toBeTruthy();

    await eraseEverything(page);
    expect(await storedRecords(page, 'workouts')).toEqual([]);

    await importFile(page, first.name, first.text);
    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(2);
    const detail = await openWorkout(page, 'TREINO A - inferiores');
    await expect(detail).toContainText('caiu a força');

    const second = await exportBackupFile(page);
    expect(comparable(second.json)).toEqual(comparable(first.json));
  });

  test('on the phone, Exportar hands a single .json file to the share menu', async ({ page }) => {
    await page.addInitScript(() => {
      window.__shared = [];
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: async (payload) => {
          const files = await Promise.all((payload.files || []).map(async (f) => ({ name: f.name, type: f.type, text: await f.text() })));
          window.__shared.push({ keys: Object.keys(payload), files });
        }
      });
    });
    await importOld(page, V2);
    await goTo(page, 'Mais');
    await expect(page.locator('#btnExport')).toHaveText('Exportar');

    await page.locator('#btnExport').click();
    await expect(page.locator('#backupAction')).toContainText('Backup compartilhado: meu-treino-backup-');

    const shared = await page.evaluate(() => window.__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].keys).toEqual(['files']);
    expect(shared[0].files).toHaveLength(1);
    expect(shared[0].files[0].name).toMatch(/\.json$/);
    expect(shared[0].files[0].type).toBe('application/json');
    const backup = JSON.parse(shared[0].files[0].text);
    expect(backup.data.workouts.map((w) => w.id)).toEqual(['w3']);
    expect(backup.data.sheets[0].exercises.map((e) => e.name)).toEqual(['Elevação pélvica', 'Leg press 45']);
  });
});

test.describe('Data · erasing all data', () => {
  test('the button only works after ticking the confirmation; Cancelar erases nothing', async ({ page }) => {
    await importOld(page, V1);
    await goTo(page, 'Mais');
    await page.locator('#btnEraseAll').click();

    const confirmButton = page.getByRole('button', { name: 'Apagar tudo' });
    await expect(page.locator('#eraseBody')).toContainText('Não há como desfazer.');
    await expect(confirmButton).toBeDisabled();
    await page.getByLabel('Quero realmente apagar todos os meus dados.').check();
    await expect(confirmButton).toBeEnabled();
    await page.getByLabel('Quero realmente apagar todos os meus dados.').uncheck();
    await expect(confirmButton).toBeDisabled();

    await page.getByRole('link', { name: 'Cancelar' }).click();
    await expect(page.locator('#view-more')).toBeVisible();
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
    await goTo(page, 'Início');
    await expect(recent(page).locator('button[data-view-workout]')).toHaveCount(2);
  });

  test('erases workouts, sheets, Biblioteca, colinha, goals and the draft', async ({ page }) => {
    await importOld(page, V1);
    await goTo(page, 'Treinar');
    await page.locator('#workoutNotes').fill('rascunho que deve sumir');
    await expect.poll(() => storedDraft(page)).not.toBeNull();

    await eraseEverything(page);
    for (const store of ['workouts', 'exercises', 'sheets', 'colinha']) {
      expect(await storedRecords(page, store), 'store ' + store).toEqual([]);
    }
    expect(await storedDraft(page)).toBeNull();

    await page.getByRole('link', { name: 'Voltar para o início' }).click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(recent(page)).toContainText('Nenhum treino registrado ainda');
    await expect(page.locator('#draftBanner')).toBeEmpty();
    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('Nenhuma ficha ativa.');
    await page.locator('#tabExercisesBtn').click();
    await expect(libraryList(page)).toContainText('Nenhum exercício aqui.');
    await goTo(page, 'Mais');
    await expect(page.locator('#colinhaList')).toContainText('Nenhuma colinha ainda.');
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('3');
    await expect(page.locator('#setCardioTarget')).toHaveValue('120');

    // It stays erased after opening the app again.
    await page.goto('./');
    await waitForApp(page);
    await expect(recent(page)).toContainText('Nenhum treino registrado ainda');
  });
});

test.describe('Data · sample data', () => {
  test('they replace the current data and Undo brings back the previous ones', async ({ page }) => {
    await importOld(page, V1);
    await goTo(page, 'Mais');
    await page.locator('#btnLoadSample').click();
    await expect(page.locator('#sampleStatus')).toHaveText('Dados de exemplo carregados: 3 fichas, 12 treinos e 6 exercícios.');
    expect(await storedRecords(page, 'workouts')).toHaveLength(12);
    expect(await storedRecords(page, 'sheets')).toHaveLength(3);

    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('TREINO C - corpo inteiro + cardio');
    await goTo(page, 'Início');
    await expect(recent(page)).not.toContainText('Nenhum treino registrado ainda');

    await goTo(page, 'Mais');
    await page.locator('#btnUndoImport').click();
    await expect(page.locator('#appToastBody')).toHaveText('Dados anteriores restaurados.');
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
    await goTo(page, 'Fichas');
    await expect(sheetsList(page)).toContainText('TREINO B - superiores');
    await expect(sheetsList(page)).not.toContainText('TREINO C');
  });
});

test.describe('App update', () => {
  /** Opens the app with a service worker controlling the page and a workout in progress (draft saved). */
  async function appWithDraft(page) {
    await freshApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await goTo(page, 'Treinar');
    await page.locator('#workoutNotes').fill('treino em andamento');
    await page.locator('#workoutCardio').fill('25');
    await expect.poll(async () => (await storedDraft(page) || {}).notes).toBe('treino em andamento');
  }

  /** Opens the app again and checks that the draft comes back whole in Treinar. */
  async function expectDraftBack(page) {
    await page.goto('./');
    await waitForApp(page);
    await expect(page.locator('#draftBanner')).toContainText('Treino em andamento (não salvo)');
    await goTo(page, 'Treinar');
    await expect(page.locator('#workoutNotes')).toHaveValue('treino em andamento');
    await expect(page.locator('#workoutCardio')).toHaveValue('25');
  }

  test('the new service worker version takes over and the draft in progress survives', async ({ page, context }) => {
    await appWithDraft(page);
    const version = (await page.locator('#appVersion').textContent()).replace(/^v/, '');
    expect(await page.evaluate(() => caches.keys())).toEqual(['meu-treino-v' + version]);

    // The server starts serving a sw.js from another version, as after a deploy. The one that swaps it is
    // tests/e2e/server.js, through the cookie: Playwright does not intercept the service worker script download.
    await context.addCookies([{ name: 'e2e-sw-version', value: '999999', url: page.url() }]);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });

    // The new version installs, takes over the page and deletes the previous version's cache.
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 15_000 }).toEqual(['meu-treino-v999999']);
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.state))
      .toBe('activated');

    expect(await storedDraft(page)).not.toBeNull();
    await expectDraftBack(page);
  });

  test('"Atualizar app" clears the cache, reloads and the draft in progress survives', { annotation: RECARGA_DO_APP }, async ({ page }) => {
    await appWithDraft(page);
    const version = (await page.locator('#appVersion').textContent()).replace(/^v/, '');

    await goTo(page, 'Mais');
    const reloaded = page.waitForEvent('load');
    await page.locator('#btnForceUpdate').click();
    await reloaded;
    await expect(page.locator('#view-more')).toBeVisible();

    // After reloading, the service worker registers again and builds the cache again.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['meu-treino-v' + version]);

    await expectDraftBack(page);
  });

  test('answering "Não" to "Atualizar app" neither clears the cache nor reloads', async ({ page }) => {
    await appWithDraft(page);
    const keys = await page.evaluate(() => caches.keys());
    await goTo(page, 'Mais');
    await page.evaluate(() => { window.__semRecarregar = true; });
    const asked = await answerConfirm(page, false);

    await page.locator('#btnForceUpdate').click();

    await expect.poll(asked).toEqual(['Atualizar o app?\n\nIsso limpa o cache e recarrega a versão mais nova. ' +
      'Seus treinos salvos não são afetados.']);
    expect(await page.evaluate(() => window.__semRecarregar)).toBe(true);
    expect(await page.evaluate(() => caches.keys())).toEqual(keys);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(1);
  });
});

test.describe('Data · paths that were missing', () => {
  /** Phone with a share menu that ends with the `name` error (AbortError = the person cancelled). */
  function shareFailsWith(page, name) {
    return page.addInitScript((errorName) => {
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: async () => { throw new DOMException('falhou', errorName); }
      });
    }, name);
  }

  for (const [name, message] of [
    ['AbortError', 'Compartilhamento cancelado — nada foi gerado.'],
    ['NotAllowedError', 'Não deu para compartilhar agora. Tente de novo ou use um computador.']
  ]) {
    test(`Export on the phone: ${name === 'AbortError' ? 'cancelled' : 'failed'} sharing warns and does not count as a backup`, async ({ page }) => {
      await shareFailsWith(page, name);
      await importOld(page, V2);
      await goTo(page, 'Mais');
      await page.locator('#btnExport').click();

      await expect(page.locator('#backupAction')).toHaveText(message);
      const settings = (await storedRecords(page, 'settings')).find((s) => s.id === 'app');
      expect(settings.lastBackupAt).toBeUndefined();
    });
  }

  test('the Importar button opens the device file picker', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Mais');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#btnImport').click();
    await (await chooser).setFiles(V2);

    await expect(page.locator('#appToastBody')).toContainText('Backup importado');
    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
  });

  test('the sample-data file also imports through the screen, with dates from today', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-16T10:00:00-03:00'));
    await freshApp(page);
    await goTo(page, 'Mais');
    await page.locator('#importFile').setInputFiles(path.resolve(__dirname, '..', '..', 'data', 'sample-data.json'));

    await expect(page.locator('#appToastBody')).toContainText('Backup importado');
    const workouts = await storedRecords(page, 'workouts');
    expect(workouts).toHaveLength(12);
    expect(workouts.every((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date) && w.date <= '2026-09-16')).toBe(true);
    expect(await storedRecords(page, 'sheets')).toHaveLength(3);
  });

  test('answering "Não" to the sample data changes nothing', async ({ page }) => {
    await importOld(page, V2);
    await goTo(page, 'Mais');
    const asked = await answerConfirm(page, false);
    await page.locator('#btnLoadSample').click();

    await expect.poll(async () => (await asked()).map((q) => q.split('\n')[0])).toEqual(['Carregar os dados de exemplo?']);
    await expect(page.locator('#sampleStatus')).toHaveText('');
    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
    await expect(page.locator('#btnUndoImport')).toBeVisible();
  });
});
