// Dados, backup e atualização (issue #6): o não negociável nº 2, dados antigos nunca se perdem.
// Tudo pela tela Mais, como uma pessoa faria: importar os backups antigos de `tests/fixtures/`, exportar e
// reimportar, apagar tudo, dados de exemplo, desfazer e a atualização do app (service worker novo e o botão
// "Atualizar app") sem perder o rascunho do treino em andamento.
// O lembrete de backup no Início está em `inicio.spec.js` (Início · lembrete de backup).
//
// Backups antigos (relógio parado em 16/09/2026 para a lista do Início mostrar todos os treinos):
// - `backup-v1.json` (formato 1, antes das fichas): "tipos de treino" A e B viram fichas; 2 treinos (30/08 com
//   Elevação pélvica 27 kg × 12 e 32 kg × 10 "caiu a força"; 25/08 com Puxada frente supinada 45 kg × 10),
//   Elevação pélvica na Biblioteca (Glúteos), colinha "RIR", metas 4 treinos / 90 min.
// - `backup-v2-sheets.json` (formato 2): ficha TREINO A com Elevação pélvica (3×12, "pausa de 1s") e Leg press 45
//   (reps 12-10-8); 1 treino em 14/09 (Elevação pélvica 30 kg × 12, 20 min de cardio), metas 3 / 120.
const fs = require('fs');
const path = require('path');
const { test, expect, freshApp, waitForApp, withBackup, storedDraft, storedRecords, goTo, answerConfirm } = require('./helpers');

const OLD_BACKUPS = path.resolve(__dirname, '..', 'fixtures');
const V1 = path.join(OLD_BACKUPS, 'backup-v1.json');
const V2 = path.join(OLD_BACKUPS, 'backup-v2-sheets.json');

/** Importa um backup antigo com o relógio parado num dia logo depois dele. */
async function importOld(page, file) {
  await page.clock.setFixedTime(new Date('2026-09-16T10:00:00-03:00'));
  await withBackup(page, file);
}

/** Sem o menu de compartilhar, Exportar vira um download (o caminho do computador). Chamar antes de abrir o app. */
async function exportAsDownload(page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
  });
}

/** Toca em Mais → Exportar e devolve o arquivo baixado: nome e conteúdo. */
async function exportBackupFile(page) {
  await goTo(page, 'Mais');
  const download = page.waitForEvent('download');
  await page.locator('#btnExport').click();
  const file = await download;
  const text = fs.readFileSync(await file.path(), 'utf8');
  await expect(page.locator('#backupAction')).toHaveText('Arquivo gerado: ' + file.suggestedFilename());
  return { name: file.suggestedFilename(), text, json: JSON.parse(text) };
}

/** Importa um arquivo pela tela Mais → Importar (o confirm() responde sim). */
async function importFile(page, name, text) {
  await goTo(page, 'Mais');
  await page.locator('#importFile').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#appToastBody')).toContainText('Backup importado');
  await expect(page.locator('#view-dashboard')).toBeVisible();
}

/** Abre a tela Apagar dados, marca a caixa e apaga tudo. */
async function eraseEverything(page) {
  await goTo(page, 'Mais');
  await page.locator('#btnEraseAll').click();
  await expect(page.locator('#view-erase')).toBeVisible();
  await page.getByLabel('Quero realmente apagar todos os meus dados.').check();
  await page.getByRole('button', { name: 'Apagar tudo' }).click();
  await expect(page.locator('#eraseBody')).toContainText('Todos os dados do app foram apagados deste aparelho.');
}

/** Dados de um backup sem o que muda a cada exportação (hora do último backup). */
function comparable(backup) {
  const data = JSON.parse(JSON.stringify(backup.data));
  delete data.settings.lastBackupAt;
  return data;
}

const recent = (page) => page.locator('#recentWorkouts');
const sheetsList = (page) => page.locator('#sheetsList');
const libraryList = (page) => page.locator('#exercisesList');

/** Abre o detalhe do treino da lista do Início que tem esse texto (ex.: o dia "30"). */
async function openWorkout(page, text) {
  await goTo(page, 'Início');
  await recent(page).locator('button[data-view-workout]').filter({ hasText: text }).click();
  await expect(page.locator('#view-detail')).toBeVisible();
  return page.locator('#detailBody');
}

test.describe('Dados · importar backups antigos pela tela', () => {
  test('formato 1 (antes das fichas): treinos, fichas, Biblioteca, colinha e metas', async ({ page }) => {
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

  test('formato 2 (fichas): ficha com reps por série, treino e metas', async ({ page }) => {
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

  test('Desfazer volta aos dados de antes da importação', async ({ page }) => {
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

  test('arquivo que não é backup não apaga nada', async ({ page }) => {
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

  test('não confia no arquivo: id com código é descartado e data inválida vira "sem data"', async ({ page }) => {
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

test.describe('Dados · exportar e reimportar', () => {
  test('ida e volta: exportar, apagar tudo e reimportar não perde nada', async ({ page }) => {
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
    // Exportar conta como backup feito.
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

  test('no celular, Exportar entrega um único arquivo .json ao menu de compartilhar', async ({ page }) => {
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

test.describe('Dados · apagar todos os dados', () => {
  test('o botão só funciona depois de marcar a confirmação; Cancelar não apaga nada', async ({ page }) => {
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

  test('apaga treinos, fichas, Biblioteca, colinha, metas e rascunho', async ({ page }) => {
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

    // Continua apagado depois de abrir o app de novo.
    await page.goto('./');
    await waitForApp(page);
    await expect(recent(page)).toContainText('Nenhum treino registrado ainda');
  });
});

test.describe('Dados · dados de exemplo', () => {
  test('substituem os dados atuais e o Desfazer devolve os anteriores', async ({ page }) => {
    await importOld(page, V1);
    await goTo(page, 'Mais');
    await page.locator('#btnLoadSample').click();
    await expect(page.locator('#sampleStatus')).toHaveText('Dados de exemplo carregados: 3 fichas, 12 treinos e 6 exercicios.');
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

test.describe('Atualização do app', () => {
  /** Abre o app com um service worker controlando a página e um treino em andamento (rascunho gravado). */
  async function appWithDraft(page) {
    await freshApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await goTo(page, 'Treinar');
    await page.locator('#workoutNotes').fill('treino em andamento');
    await page.locator('#workoutCardio').fill('25');
    await expect.poll(async () => (await storedDraft(page) || {}).notes).toBe('treino em andamento');
  }

  /** Abre o app de novo e confere que o rascunho volta inteiro no Treinar. */
  async function expectDraftBack(page) {
    await page.goto('./');
    await waitForApp(page);
    await expect(page.locator('#draftBanner')).toContainText('Treino em andamento (não salvo)');
    await goTo(page, 'Treinar');
    await expect(page.locator('#workoutNotes')).toHaveValue('treino em andamento');
    await expect(page.locator('#workoutCardio')).toHaveValue('25');
  }

  test('a versão nova do service worker assume e o rascunho em andamento sobrevive', async ({ page, context }) => {
    await appWithDraft(page);
    const version = (await page.locator('#appVersion').textContent()).replace(/^v/, '');
    expect(await page.evaluate(() => caches.keys())).toEqual(['meu-treino-v' + version]);

    // O servidor passa a entregar um sw.js de outra versão, como depois de um deploy. Quem troca é o
    // tests/e2e/server.js, pelo cookie: o Playwright não intercepta o download do script do service worker.
    await context.addCookies([{ name: 'e2e-sw-version', value: '999999', url: page.url() }]);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });

    // A versão nova instala, assume a página e apaga o cache da versão anterior.
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 15_000 }).toEqual(['meu-treino-v999999']);
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.state))
      .toBe('activated');

    expect(await storedDraft(page)).not.toBeNull();
    await expectDraftBack(page);
  });

  test('"Atualizar app" limpa o cache, recarrega e o rascunho em andamento sobrevive', async ({ page }) => {
    await appWithDraft(page);
    const version = (await page.locator('#appVersion').textContent()).replace(/^v/, '');

    await goTo(page, 'Mais');
    const reloaded = page.waitForEvent('load');
    await page.locator('#btnForceUpdate').click();
    await reloaded;
    await expect(page.locator('#view-more')).toBeVisible();

    // Depois de recarregar, o service worker volta a se registrar e monta o cache de novo.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['meu-treino-v' + version]);

    await expectDraftBack(page);
  });
});

test.describe('Dados · caminhos que faltavam', () => {
  /** Celular com menu de compartilhar que termina com o erro `name` (AbortError = a pessoa cancelou). */
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
    test(`Exportar no celular: compartilhamento ${name === 'AbortError' ? 'cancelado' : 'com erro'} avisa e não conta como backup`, async ({ page }) => {
      await shareFailsWith(page, name);
      await importOld(page, V2);
      await goTo(page, 'Mais');
      await page.locator('#btnExport').click();

      await expect(page.locator('#backupAction')).toHaveText(message);
      const settings = (await storedRecords(page, 'settings')).find((s) => s.id === 'app');
      expect(settings.lastBackupAt).toBeUndefined();
    });
  }

  test('o botão Importar abre o seletor de arquivo do aparelho', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Mais');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#btnImport').click();
    await (await chooser).setFiles(V2);

    await expect(page.locator('#appToastBody')).toContainText('Backup importado');
    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
  });

  test('o arquivo dos dados de exemplo também importa pela tela, com as datas a partir de hoje', async ({ page }) => {
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

  test('responder "Não" aos dados de exemplo não troca nada', async ({ page }) => {
    await importOld(page, V2);
    await goTo(page, 'Mais');
    const asked = await answerConfirm(page, false);
    await page.locator('#btnLoadSample').click();

    await expect.poll(asked).toHaveLength(1);
    await expect(page.locator('#sampleStatus')).toHaveText('');
    expect(await storedRecords(page, 'workouts')).toHaveLength(1);
    await expect(page.locator('#btnUndoImport')).toBeVisible();
  });
});
