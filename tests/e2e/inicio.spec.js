// Início (critical screen), issue #19. Every behaviour has its own test (documentation/REFACTOR.md, section 4).
//
// Starting point of most tests: `fixtures/inicio-backup.json`, imported through the Mais screen, with the page
// clock fixed at 20/05/2026 (Wednesday), 10:00 in Brasília.
// - Active week: 18/05 to 24/05/2026, goals of 3 workouts and 120 min of cardio.
// - Workouts: 19/05 Treino A (30 min of cardio), 18/05 Treino B (15 min; saved when the sheet was called
//   "Pernas") and 17/05 Treino A (40 min), which stays OUTSIDE the week.
// - Sheets: Treino A and Treino B active, Treino C deactivated.
// - Last backup: 19/05/2026 (up to date).
const path = require('path');
const { test, expect, freshApp, withBackup, readFixture, storedDraft, goTo, answerConfirm } = require('./helpers');

const BACKUP = 'inicio-backup.json';
const TODAY = '2026-05-20T10:00:00-03:00';

/** Fixes the page clock at a day and time (timers keep running). Call it before opening the app. */
function at(page, isoDateTime) {
  return page.clock.setFixedTime(new Date(isoDateTime));
}

/** Imports the Início backup (or a variation of it) with the clock at 20/05/2026. */
async function homeWith(page, backup = BACKUP) {
  await at(page, TODAY);
  await withBackup(page, backup);
}

const weekCard = (page) => page.locator('#weekProgress .week-card');
const weekNumbers = (page) => page.locator('#weekProgress .week-stat .stat-big');
const quickStart = (page) => page.locator('#quickStart');
const draftBanner = (page) => page.locator('#draftBanner');
const backupReminder = (page) => page.locator('#backupReminder');
const workoutRows = (page) => page.locator('#recentWorkouts .workout-row');

/** Sheet name and date of each workout-list row, in screen order (taken from the screen-reader text). */
async function listedWorkouts(page) {
  const labels = await workoutRows(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  return labels.map((label) => label.split(', ').slice(0, 2).join(', '));
}

/** Starts a Treino B workout from Treinar, with a typed load, and goes back to Início. The draft stays saved. */
async function startDraft(page) {
  await goTo(page, 'Treinar');
  await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
  await page.locator('#workoutExercises input[aria-label="Carga da série 1"]').fill('62,5');
  await expect.poll(async () => (await storedDraft(page))?.formSets?.[0]?.sets?.[0]?.load).toBe('62,5');
  await goTo(page, 'Início');
}

test.describe('Início · empty', () => {
  test('first use with no data: correct empty state, no console error', async ({ page }) => {
    await at(page, TODAY);
    await freshApp(page);

    await expect(draftBanner(page)).toBeEmpty();
    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('Semana ativa');
    await expect(weekCard(page)).toContainText('20/05 – 26/05');
    await expect(weekNumbers(page)).toHaveText(['0/3', '0/120']);
    await expect(weekCard(page)).not.toContainText('Meta batida');
    await expect(quickStart(page)).toBeEmpty();
    await expect(backupReminder(page)).toBeEmpty();
    await expect(page.locator('#recentWorkouts')).toHaveText(
      'Nenhum treino registrado ainda. Toque em Treinar para começar.');
    await expect(workoutRows(page)).toHaveCount(0);
    // Console errors fail the test through the `appErrors` fixture (helpers.js).
  });
});

test.describe('Início · draft banner', () => {
  test('appears with a workout in progress and describes the draft', async ({ page }) => {
    await homeWith(page);
    await expect(draftBanner(page)).toBeEmpty();

    await startDraft(page);

    await expect(draftBanner(page)).toContainText('Treino em andamento (não salvo)');
    await expect(draftBanner(page).locator('.small')).toHaveText('Treino novo · Treino B · salvo hoje às 10:00');
    await expect(draftBanner(page).getByRole('button', { name: 'Continuar' })).toBeVisible();
    await expect(draftBanner(page).getByRole('button', { name: 'Descartar' })).toBeVisible();
  });

  test('Continuar opens Treinar with the draft', async ({ page }) => {
    await homeWith(page);
    await startDraft(page);

    await draftBanner(page).getByRole('button', { name: 'Continuar' }).click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises input[aria-label="Carga da série 1"]')).toHaveValue('62,5');
  });

  test('Descartar removes the draft and the banner', async ({ page }) => {
    await homeWith(page);
    await startDraft(page);

    await draftBanner(page).getByRole('button', { name: 'Descartar' }).click();

    await expect(draftBanner(page)).toBeEmpty();
    await expect.poll(() => storedDraft(page)).toBeNull();
    // Nothing comes back after reloading, and Treinar opens empty.
    await page.reload();
    await expect(weekCard(page)).toBeVisible();
    await expect(draftBanner(page)).toBeEmpty();
    await goTo(page, 'Treinar');
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#draftNotice')).toBeEmpty();
  });

  test('answering "Não" to Descartar keeps the draft and the banner', async ({ page }) => {
    await homeWith(page);
    await startDraft(page);
    const asked = await answerConfirm(page, false);

    await draftBanner(page).getByRole('button', { name: 'Descartar' }).click();

    await expect.poll(asked).toEqual(['Descartar o treino em andamento? O que foi digitado e não salvo será perdido.']);
    await expect(draftBanner(page)).toContainText('Treino em andamento (não salvo)');
    expect((await storedDraft(page)).formSets[0].sets[0].load).toBe('62,5');
    await draftBanner(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#workoutExercises input[aria-label="Carga da série 1"]')).toHaveValue('62,5');
  });

  test('describes the editing of a saved workout, with its date', async ({ page }) => {
    await homeWith(page);
    await page.locator('#recentWorkouts button[data-view-workout="w-seg"]').click();
    await page.locator('#detailEdit').click();
    await expect(page.locator('#view-workout')).toBeVisible();
    await page.locator('#workoutNotes').fill('ajuste depois');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('ajuste depois');

    await goTo(page, 'Início');

    await expect(draftBanner(page).locator('.small')).toHaveText('Edição do treino de 18/05/2026 · Treino B · salvo hoje às 10:00');
    await draftBanner(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#workoutTitle')).toHaveText('Editar treino');
    await expect(page.locator('#workoutNotes')).toHaveValue('ajuste depois');
  });
});

test.describe('Início · week and goals', () => {
  test('goal progress: workouts and cardio minutes, with the bars', async ({ page }) => {
    await homeWith(page);

    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('18/05 – 24/05');
    // 19/05 and 18/05 count; 17/05 belongs to the previous week.
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
    await expect(weekCard(page)).not.toContainText('Meta batida');

    const workoutsBar = page.getByRole('progressbar', { name: 'Meta de treinos' });
    const cardioBar = page.getByRole('progressbar', { name: 'Meta de cardio' });
    await expect(workoutsBar).toHaveAttribute('aria-valuenow', '67');
    await expect(cardioBar).toHaveAttribute('aria-valuenow', '38');
    await expect(workoutsBar.locator('.progress-bar')).toHaveAttribute('style', 'width: 67%');
    await expect(cardioBar.locator('.progress-bar')).toHaveAttribute('style', 'width: 38%');
  });

  test('goal reached: badge and full bars (without going past 100%)', async ({ page }) => {
    const backup = readFixture(BACKUP);
    backup.data.settings.weeklyWorkoutTarget = 2;
    backup.data.settings.weeklyCardioTarget = 30;
    await homeWith(page, backup);

    await expect(weekNumbers(page)).toHaveText(['2/2', '45/30']);
    await expect(weekCard(page)).toContainText('Meta batida');
    await expect(page.getByRole('progressbar', { name: 'Meta de treinos' })).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByRole('progressbar', { name: 'Meta de cardio' })).toHaveAttribute('aria-valuenow', '100');
  });

  test('a workout dated outside the week window does not count in the current week (and is not lost)', async ({ page }) => {
    await homeWith(page);

    // The 17/05 workout (40 min of cardio) does not enter the 18/05 week's count...
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
    // ...but it stays saved and in the list.
    expect(await listedWorkouts(page)).toContain('Treino A, 17/05/2026');
    await expect(page.locator('#recentWorkouts .section-head .chip')).toHaveText('3 treinos');
  });

  test('week-over banner after 7 days, with the final result', async ({ page }) => {
    await at(page, '2026-05-25T10:00:00-03:00');
    await withBackup(page, BACKUP);

    await expect(page.locator('#weekBanner')).toContainText('Semana encerrada! 18/05/2026 – 24/05/2026.');
    await expect(page.getByRole('button', { name: 'Iniciar próxima semana' })).toBeVisible();
    // The card keeps showing the week that ended, with the final result.
    await expect(weekCard(page)).toContainText('18/05 – 24/05');
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
  });

  test('confirming the banner advances to the next window', async ({ page }) => {
    await at(page, '2026-05-25T10:00:00-03:00');
    await withBackup(page, BACKUP);

    await page.getByRole('button', { name: 'Iniciar próxima semana' }).click();

    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('25/05 – 31/05');
    await expect(weekNumbers(page)).toHaveText(['0/3', '0/120']);
    await expect(workoutRows(page)).toHaveCount(3);

    // The new window is saved on the device.
    await page.reload();
    await expect(weekCard(page)).toContainText('25/05 – 31/05');
    await expect(page.locator('#weekBanner')).toBeEmpty();
  });
});

test.describe('Início · Treinar shortcut', () => {
  test('"Treinar: <ficha>" suggests the next sheet in the routine and opens Treinar with it loaded', async ({ page }) => {
    await homeWith(page);

    // The last workout was Treino A's: the next one is Treino B.
    const button = quickStart(page).getByRole('button', { name: 'Treinar: Treino B' });
    await expect(button).toBeVisible();
    await expect(button).toContainText('Treinar agora');

    await button.click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises .card .ex-title')).toHaveText([/^Agachamento livre/]);
    const reps = await page.locator('#workoutExercises input[aria-label^="Reps da série"]')
      .evaluateAll((els) => els.map((el) => el.value));
    expect(reps).toEqual(['8', '8', '6']);
  });

  test('disappears while a draft exists', async ({ page }) => {
    await homeWith(page);
    await expect(quickStart(page).getByRole('button', { name: /^Treinar: / })).toBeVisible();

    await startDraft(page);
    await expect(draftBanner(page)).not.toBeEmpty();
    await expect(quickStart(page)).toBeEmpty();

    // Draft discarded: the shortcut is back.
    await draftBanner(page).getByRole('button', { name: 'Descartar' }).click();
    await expect(quickStart(page).getByRole('button', { name: 'Treinar: Treino B' })).toBeVisible();
  });

  test('deactivated sheets are not suggested', async ({ page }) => {
    // Last workout of Treino B: in order, the next one would be Treino C, which is deactivated. It falls back to Treino A.
    const backup = readFixture(BACKUP);
    backup.data.workouts.find((w) => w.id === 'w-ter').sheetId = 's-b';
    await homeWith(page, backup);

    await expect(quickStart(page).getByRole('button')).toHaveAccessibleName('Treinar: Treino A');
  });
});

test.describe('Início · backup reminder', () => {
  test('appears when there has never been a backup', async ({ page }) => {
    const backup = readFixture(BACKUP);
    delete backup.data.settings.lastBackupAt;
    await homeWith(page, backup);

    await expect(backupReminder(page)).toContainText('Backup pendente');
    await expect(backupReminder(page)).toContainText('Você ainda não fez nenhum backup.');
    await expect(backupReminder(page).getByRole('button', { name: 'Fazer' })).toBeVisible();
  });

  test('appears when the last backup is old; disappears when it is up to date', async ({ page }) => {
    const old = readFixture(BACKUP);
    old.data.settings.lastBackupAt = '2026-05-11T15:00:00.000Z';
    await homeWith(page, old);
    await expect(backupReminder(page)).toContainText('Backup pendente');
    await expect(backupReminder(page)).toContainText('Último backup: 11/05/2026');
    await expect(backupReminder(page)).toContainText('(há 8 dias)');

    // The fixture's backup is from yesterday: up to date, no reminder.
    await goTo(page, 'Mais');
    await page.locator('#importFile').setInputFiles(path.join(__dirname, 'fixtures', BACKUP));
    await expect(page.locator('#appToastBody')).toContainText('Backup importado');
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(weekCard(page)).toBeVisible();
    await expect(backupReminder(page)).toBeEmpty();
  });

  test('"Lembrar depois" (✕) hides the reminder', async ({ page }) => {
    const backup = readFixture(BACKUP);
    delete backup.data.settings.lastBackupAt;
    await homeWith(page, backup);
    await expect(backupReminder(page)).toContainText('Backup pendente');

    await backupReminder(page).getByRole('button', { name: 'Lembrar depois' }).click();

    await expect(backupReminder(page)).toBeEmpty();
    await goTo(page, 'Calendário');
    await goTo(page, 'Início');
    await expect(backupReminder(page)).toBeEmpty();
  });

  test('disappears after making a backup', async ({ page }) => {
    // Without the share menu, the backup becomes a download (the computer path).
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
    });
    const backup = readFixture(BACKUP);
    delete backup.data.settings.lastBackupAt;
    await homeWith(page, backup);
    await expect(backupReminder(page)).toContainText('Backup pendente');

    const download = page.waitForEvent('download');
    await backupReminder(page).getByRole('button', { name: 'Fazer' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.json$/);

    await expect(backupReminder(page)).toBeEmpty();
    // It stays saved: after reloading, there is still no reminder.
    await page.reload();
    await expect(weekCard(page)).toBeVisible();
    await expect(backupReminder(page)).toBeEmpty();
  });
});

test.describe('Início · recent workouts', () => {
  test('list with date and sheet name, newest first', async ({ page }) => {
    await homeWith(page);

    expect(await listedWorkouts(page)).toEqual([
      'Treino A, 19/05/2026',
      'Treino B, 18/05/2026',
      'Treino A, 17/05/2026'
    ]);
    await expect(workoutRows(page).locator('strong')).toHaveText(['Treino A', 'Treino B', 'Treino A']);
    await expect(workoutRows(page).locator('.workout-date-day')).toHaveText(['19', '18', '17']);
    await expect(page.locator('#recentWorkouts .workout-month')).toHaveText([/3 treinos$/]);
  });

  test('tapping a workout opens the detail', async ({ page }) => {
    await homeWith(page);

    await page.locator('#recentWorkouts button[data-view-workout="w-seg"]').click();

    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page).toHaveURL(/#\/detail\/w-seg$/);
    await expect(page.locator('#detailBody .detail-hero')).toContainText('Treino B');
    await expect(page.locator('#detailBody .detail-hero')).toContainText('18/05/2026');
    await expect(page.locator('#detailBody')).toContainText('Agachamento livre');
  });

  test('the row\'s share button opens the workout text', async ({ page }) => {
    await homeWith(page);
    await page.locator('#recentWorkouts button[data-share-workout="w-seg"]').click();

    await expect(page.locator('#exportModal')).toBeVisible();
    const text = await page.locator('#exportText').inputValue();
    expect(text).toContain('18/05/2026');
    expect(text).toContain('Agachamento livre');
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });

  test('a renamed sheet appears with the new name', async ({ page }) => {
    await homeWith(page);
    // The 18/05 workout was saved when Treino B was called "Pernas": it shows the current name.
    await expect(workoutRows(page).locator('strong')).toHaveText(['Treino A', 'Treino B', 'Treino A']);
    await expect(page.locator('#recentWorkouts')).not.toContainText('Pernas');

    // Renames Treino A through the Fichas screen.
    await goTo(page, 'Fichas');
    const sheetCard = page.locator('#tabSheets .card').filter({ has: page.locator('strong', { hasText: /^\s*Treino A$/ }) });
    await sheetCard.getByRole('button', { name: 'Editar ficha' }).click();
    await expect(page.locator('#sheetEditorModal')).toBeVisible();
    await page.locator('#sheetName').fill('Peito e costas');
    await page.locator('#sheetEditorSave').click();
    await expect(page.locator('#sheetEditorModal')).toBeHidden();

    await goTo(page, 'Início');
    await expect(workoutRows(page).locator('strong')).toHaveText(['Peito e costas', 'Treino B', 'Peito e costas']);
    expect(await listedWorkouts(page)).toEqual([
      'Peito e costas, 19/05/2026',
      'Treino B, 18/05/2026',
      'Peito e costas, 17/05/2026'
    ]);
  });
});
