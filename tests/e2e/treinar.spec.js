// Treinar (critical screen), issue #5. Part A: opening, sheet, sets, rest, exercises and fields.
// Every behaviour has its own test (documentation/REFACTOR.md, section 4). Part B: draft, saving and existing
// workout.
//
// Starting point of most tests: `fixtures/treinar-backup.json`, imported through the Mais screen.
// - Treino A (active): Supino reto 3 sets (reps 12-10-8) and Remada baixa 2 sets (reps 10-10).
// - Treino B (active): Agachamento livre 4 sets (8-8-6-6), never trained.
// - Treino Antigo (deactivated).
// - Last Treino A workout on 10/03/2025: Supino 40 kg × 11, 42,5 × 9, 45 × 7 (warm-up 15 reps, 20 kg,
//   RIR 3); Remada 50 × 10, 50 × 9. An older workout (03/03/2025) with smaller loads must not appear.
// - Biblioteca: Supino reto, Remada baixa, Agachamento livre and Rosca na máquina azul. Rest: 90 s.
const { test, expect, freshApp, withBackup, readFixture, storedDraft, storedRecords, goTo, answerConfirm } = require('./helpers');

const BACKUP = 'treinar-backup.json';

/** Card of an exercise in the Treinar form, by name. */
function exerciseCard(page, name) {
  return page.locator('#workoutExercises .card').filter({ has: page.locator('.ex-title', { hasText: name }) });
}

/** Values of a field (Reps/Carga/RIR/Observação) across all sets of a card, in order. */
async function setValues(card, field) {
  return card.locator(`input[aria-label^="${field} da série"]`).evaluateAll((els) => els.map((el) => el.value));
}

/** Set-number button (marks it as done and starts the rest). */
function setButton(card, number) {
  return card.getByRole('button', { name: new RegExp('^Série ' + number + '\\b') });
}

/** Imports the backup, opens Treinar and picks the sheet in the selector. */
async function workoutWithSheet(page, sheetName) {
  await withBackup(page, BACKUP);
  await goTo(page, 'Treinar');
  await page.locator('#workoutSheet').selectOption({ label: sheetName });
}

/**
 * Fixes the page clock (installed with `page.clock.install()` before opening the app): from now on time
 * only moves with `page.clock.runFor`/`setSystemTime`, so the rest is checked without fixed waits.
 */
async function pauseClock(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

const restBar = (page) => page.locator('#restBar');
const restClock = (page) => page.locator('#restClock');

test.describe('Treinar · opening', () => {
  test('from the Treinar tab with no draft: empty form and today\'s date', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-20T10:00:00-03:00'));
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    await expect(page.locator('#workoutTitle')).toHaveText('Treinar');
    await expect(page.locator('#workoutDate')).toHaveValue('2026-05-20');
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#sheetHint')).toHaveText('Selecione a ficha do treino de hoje.');
    await expect(page.locator('#workoutCardio')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
    await expect(page.locator('#workoutProgress')).toBeEmpty();
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#repeatLast')).toBeEmpty();
    await expect(page.locator('#workoutDelete')).toBeHidden();
    await expect(page.locator('#workoutExport')).toBeHidden();
  });

  test('from Início\'s "Treinar: <ficha>" shortcut: sheet already loaded', async ({ page }) => {
    await withBackup(page, BACKUP);
    // The last workout was Treino A's, so the shortcut suggests the next one: Treino B.
    await page.getByRole('button', { name: 'Treinar: Treino B' }).click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    const card = exerciseCard(page, 'Agachamento livre');
    expect(await setValues(card, 'Reps')).toEqual(['8', '8', '6', '6']);
  });

  test('deactivated sheets do not appear in the selector', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    const options = await page.locator('#workoutSheet option').allTextContents();
    expect(options).toEqual(['— Selecione a ficha —', 'Treino A', 'Treino B']);
  });
});

test.describe('Treinar · sheet', () => {
  test('choosing the sheet loads exercises and sets: reps from the sheet, load from the last workout', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    await expect(page.locator('#sheetHint')).toHaveText('2 exercícios na ficha — carregados no treino.');
    await expect(page.locator('#workoutExercises .card .ex-title')).toHaveText([/^Supino reto/, /^Remada baixa/]);

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.locator('.ex-title small')).toHaveText('3 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', '', '']);

    const remada = exerciseCard(page, 'Remada baixa');
    expect(await setValues(remada, 'Reps')).toEqual(['10', '10']);
    expect(await setValues(remada, 'Carga')).toEqual(['50', '50']);

    // Exercise never trained: reps from the sheet, load blank.
    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
    const agachamento = exerciseCard(page, 'Agachamento livre');
    expect(await setValues(agachamento, 'Reps')).toEqual(['8', '8', '6', '6']);
    expect(await setValues(agachamento, 'Carga')).toEqual(['', '', '', '']);
  });

  test('"last time" hint of the chosen sheet', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    await expect(exerciseCard(page, 'Supino reto').locator('.last-session')).toHaveText(
      'Última vez (10/03/2025): 40 kg × 11 (RIR 2) · 42,5 kg × 9 (RIR 1) · 45 kg × 7 (RIR 0)');
    await expect(exerciseCard(page, 'Remada baixa').locator('.last-session')).toHaveText(
      'Última vez (10/03/2025): 50 kg × 10 (RIR 2) · 50 kg × 9 (RIR 1)');

    // No history, no hint.
    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
    await expect(exerciseCard(page, 'Agachamento livre').locator('.last-session')).toHaveCount(0);
  });

  test('warm-up pre-filled with reps and weight from the previous workout, RIR blank', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('Peso do aquecimento')).toHaveValue('20');
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('');

    // Remada had no warm-up last time: everything blank.
    const remada = exerciseCard(page, 'Remada baixa');
    await expect(remada.getByLabel('Reps do aquecimento')).toHaveValue('');
    await expect(remada.getByLabel('Peso do aquecimento')).toHaveValue('');
    await expect(remada.getByLabel('RIR do aquecimento')).toHaveValue('');
  });

  test('"Repetir o último treino desta ficha" fills exercises, reps and loads', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8']);

    await page.getByRole('button', { name: 'Repetir o último treino desta ficha (10/03/2025)' }).click();

    // Reps now come from the 10/03 workout (not from the sheet); RIR and notes stay blank.
    await expect.poll(() => setValues(supino, 'Reps')).toEqual(['11', '9', '7']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '', '']);
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('Peso do aquecimento')).toHaveValue('20');

    const remada = exerciseCard(page, 'Remada baixa');
    expect(await setValues(remada, 'Reps')).toEqual(['10', '9']);
    expect(await setValues(remada, 'Carga')).toEqual(['50', '50']);
    expect(await setValues(remada, 'RIR')).toEqual(['', '']);
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);
  });

  test('switching sheet halfway replaces the exercises', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await exerciseCard(page, 'Supino reto').getByLabel('RIR da série 1').fill('2');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);

    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });

    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Agachamento livre')).toBeVisible();
    await expect(exerciseCard(page, 'Supino reto')).toHaveCount(0);
    await expect(page.locator('#sheetHint')).toHaveText('1 exercício na ficha — carregado no treino.');
  });
});

test.describe('Treinar · sets', () => {
  test('edit reps, load, RIR and note', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');

    await supino.getByLabel('Reps da série 2').fill('9');
    await supino.getByLabel('Carga da série 2').fill('44');
    await supino.getByLabel('RIR da série 2').fill('1');
    await supino.getByLabel('Observação da série 2').fill('falhou na última');

    // Redraws the form (+ set on another exercise): the values come from state, not only from the field.
    await exerciseCard(page, 'Remada baixa').locator('button:has(.bi-plus)').click();
    expect(await setValues(supino, 'Reps')).toEqual(['12', '9', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '44', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '1', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', 'falhou na última', '']);
  });

  test('load with a comma (27,5) stays 27,5 (iPhone regression)', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    const agachamento = exerciseCard(page, 'Agachamento livre');

    await agachamento.getByLabel('Carga da série 1').fill('27,5');
    // Marking the set redraws the form and adds the volume done: 8 reps × 27,5 kg = 220 kg (27 would give 216).
    await setButton(agachamento, 1).click();

    await expect(agachamento.getByLabel('Carga da série 1')).toHaveValue('27,5');
    await expect(page.locator('#workoutProgress')).toContainText('220 kg');
  });

  test('set observation field is at least 16px on the phone (no iPhone zoom on focus)', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const obs = exerciseCard(page, 'Supino reto').getByLabel('Observação da série 1');

    await expect(obs).toBeVisible();
    const size = await obs.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test('add a set', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');

    await supino.locator('button:has(.bi-plus)').click();

    await expect(supino.locator('.ex-title small')).toHaveText('4 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8', '']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45', '']);
    await expect(setButton(supino, 4)).toBeVisible();
    await expect(page.locator('#workoutProgress')).toContainText('0/6');
  });

  test('remove the last set', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    const minus = supino.locator('button:has(.bi-dash)');

    await minus.click();
    await expect(supino.locator('.ex-title small')).toHaveText('2 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10']);

    // At least one set always remains: with only one, the button is disabled.
    await minus.click();
    await expect(supino.locator('.ex-title small')).toHaveText('1 série · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12']);
    await expect(minus).toBeDisabled();
  });

  test('tapping the set number marks it as done and starts the rest; tapping again only unmarks it', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);
    const supino = exerciseCard(page, 'Supino reto');
    await expect(restBar(page)).toBeHidden();

    await setButton(supino, 1).click();
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(setButton(supino, 1)).toHaveClass(/btn-success/);
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('1:30');

    await page.clock.runFor(20_000);
    await expect(restClock(page)).toHaveText('1:10');

    // Unmarking neither restarts nor stops the rest.
    await setButton(supino, 1).click();
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'false');
    await expect(setButton(supino, 1)).not.toHaveClass(/btn-success/);
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('1:10');
  });

  test('progress counter counts only the sets done', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const progress = page.locator('#workoutProgress');
    const supino = exerciseCard(page, 'Supino reto');

    // Reps and loads are already filled in, but nothing has been done yet.
    await expect(progress).toContainText('0/5séries feitas');
    await expect(progress).toContainText('0 kgvolume feito');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');

    await setButton(supino, 1).click();
    await setButton(supino, 2).click();
    await expect(progress).toContainText('2/5séries feitas');
    await expect(progress).toContainText('905 kgvolume feito'); // 12 × 40 + 10 × 42,5
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');

    await setButton(supino, 3).click();
    await expect(progress).toContainText('3/5séries feitas');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '1 de 2 exercícios concluídos');

    await setButton(supino, 3).click();
    await expect(progress).toContainText('2/5séries feitas');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');
  });
});

test.describe('Treinar · rest', () => {
  test('starts when the set is marked, with the time from Ajustes', async ({ page }) => {
    await page.clock.install();
    await withBackup(page, BACKUP);
    await goTo(page, 'Mais');
    await page.locator('#setRestSeconds').fill('45');
    await page.locator('#btnSaveSettings').click();
    await expect(page.locator('#appToastBody')).toHaveText('Metas salvas.');

    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.locator('.ex-title small')).toHaveText('3 séries · descanso 0:45');
    await pauseClock(page);
    await expect(restBar(page)).toBeHidden();

    await setButton(supino, 1).click();
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('0:45');

    await page.clock.runFor(10_000);
    await expect(restClock(page)).toHaveText('0:35');
  });

  test('add-time button (+15s)', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restClock(page)).toHaveText('1:30');

    await page.locator('#restAdd').click();
    await expect(restClock(page)).toHaveText('1:45');

    await page.clock.runFor(100_000);
    await expect(restClock(page)).toHaveText('0:05');
    await expect(restBar(page)).not.toHaveClass(/is-done/);

    await page.clock.runFor(5_000);
    await expect(restBar(page)).toHaveClass(/is-done/);
  });

  test('stop', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restBar(page)).toBeVisible();

    await page.getByRole('button', { name: 'Parar descanso' }).click();
    await expect(restBar(page)).toBeHidden();

    // Really stopped: after the time passes, the end of the rest does not come back.
    await page.clock.runFor(120_000);
    await expect(restBar(page)).toBeHidden();
    await expect(restBar(page)).not.toHaveClass(/is-done/);
  });

  test('at the end it only changes colour: no sound, no vibration, no flashing', async ({ page }) => {
    // Records any attempt at sound, speech or vibration.
    await page.addInitScript(() => {
      window.__alertas = [];
      const anota = (nome) => window.__alertas.push(nome);
      navigator.vibrate = () => { anota('vibrate'); return true; };
      const Audio = window.Audio;
      window.Audio = function () { anota('Audio'); return new Audio(); };
      for (const nome of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext']) {
        const Original = window[nome];
        if (Original) window[nome] = function () { anota(nome); return new Original(); };
      }
      HTMLMediaElement.prototype.play = function () { anota('play'); return Promise.resolve(); };
      if (window.speechSynthesis) window.speechSynthesis.speak = () => anota('speak');
    });
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    const bar = restBar(page);
    const background = () => bar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const counting = await background();

    await page.clock.runFor(90_000);
    await expect(bar).toHaveClass(/is-done/);
    await expect(bar).toBeVisible();
    await expect(restClock(page)).toHaveText('0:00');
    const done = await background();
    expect(done).toBe('rgb(162, 106, 0)'); // --mt-warn
    expect(done).not.toBe(counting);

    // It stays like this until closed: it does not disappear, resume counting or alternate colour.
    for (let i = 0; i < 4; i++) {
      await page.clock.runFor(5_000);
      await expect(bar).toBeVisible();
      await expect(bar).toHaveClass(/is-done/);
      await expect(restClock(page)).toHaveText('0:00');
      expect(await background()).toBe(done);
    }

    // No CSS animation (blinking/pulsing) on the bar or inside it.
    const animations = await bar.evaluate((el) => [el, ...el.querySelectorAll('*')]
      .map((node) => getComputedStyle(node).animationName)
      .filter((name) => name && name !== 'none'));
    expect(animations).toEqual([]);
    expect(await bar.evaluate((el) => el.getAnimations({ subtree: true })
      .filter((a) => !(a instanceof CSSTransition)).length)).toBe(0);

    expect(await page.evaluate(() => window.__alertas)).toEqual([]);
  });

  test('stays correct after the app goes to the background (it counts by the end time)', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restClock(page)).toHaveText('1:30');

    // In the background the phone freezes timers: the clock moves 60 s without any tick running.
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 60_000);
    // On return, the first tick already shows the right time (counting ticks would show 1:30).
    await page.clock.runFor(250);
    await expect(restClock(page)).toHaveText('0:30');

    // And if the rest ended while it was away, it comes back already at the end.
    const later = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(later + 120_000);
    await page.clock.runFor(250);
    await expect(restClock(page)).toHaveText('0:00');
    await expect(restBar(page)).toHaveClass(/is-done/);
  });
});

test.describe('Treinar · exercises and fields', () => {
  /** Opens Treinar's exercise picker and searches for a name. */
  async function searchExercise(page, query) {
    await page.locator('#btnAddExercise').click();
    await expect(page.locator('#exercisePickerModal')).toBeVisible();
    await page.locator('#pickerSearch').fill(query);
  }

  test('add an exercise from Biblioteca', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'maquina azul'); // accent-insensitive search
    const results = page.locator('#pickerResults');
    await expect(results).toContainText('Biblioteca');
    await results.getByRole('button', { name: /^Rosca na máquina azul/ }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    const rosca = exerciseCard(page, 'Rosca na máquina azul');
    await expect(rosca).toBeVisible();
    await expect(rosca.locator('.ex-title small')).toHaveText('3 séries · descanso 1:30');
  });

  test('add an exercise from the catalog', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'Rosca 21');
    const results = page.locator('#pickerResults');
    await expect(results).toContainText('Catálogo (pt-BR)');
    await results.getByRole('button', { name: /^Rosca 21/ }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
  });

  test('add an exercise by creating a new one', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'Prancha com peso');
    await page.locator('#pickerResults').getByRole('button', { name: 'Criar "Prancha com peso"' }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    await expect(exerciseCard(page, 'Prancha com peso')).toBeVisible();

    // The new exercise entered Biblioteca.
    await goTo(page, 'Fichas');
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#tabExercises')).toContainText('Prancha com peso');
  });

  test('remove an exercise', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await expect(page.locator('#workoutProgress')).toContainText('0/5séries feitas');

    await exerciseCard(page, 'Supino reto').getByRole('button', { name: 'Remover exercício' }).click();

    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Supino reto')).toHaveCount(0);
    await expect(exerciseCard(page, 'Remada baixa')).toBeVisible();
    await expect(page.locator('#workoutProgress')).toContainText('0/2séries feitas');

    await exerciseCard(page, 'Remada baixa').getByRole('button', { name: 'Remover exercício' }).click();
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
    await expect(page.locator('#workoutProgress')).toBeEmpty();
  });

  test('warm-up per exercise: reps, weight and RIR', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const remada = exerciseCard(page, 'Remada baixa');

    await remada.getByLabel('Reps do aquecimento').fill('12');
    await remada.getByLabel('Peso do aquecimento').fill('22,5');
    await remada.getByLabel('RIR do aquecimento').fill('4');

    // Redraws the form: the warm-up stayed saved on the right exercise.
    await remada.locator('button:has(.bi-plus)').click();
    await expect(remada.getByLabel('Reps do aquecimento')).toHaveValue('12');
    await expect(remada.getByLabel('Peso do aquecimento')).toHaveValue('22,5');
    await expect(remada.getByLabel('RIR do aquecimento')).toHaveValue('4');

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('');
  });

  test('cardio and notes', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const progress = page.locator('#workoutProgress');
    await expect(progress).toContainText('0 mincardio');

    await page.locator('#workoutCardio').fill('25');
    await expect(progress).toContainText('25 mincardio');
    await page.locator('#workoutNotes').fill('Academia cheia, troquei a ordem');

    // Redrawing the sets does not erase the two fields.
    await exerciseCard(page, 'Supino reto').locator('button:has(.bi-plus)').click();
    await expect(page.locator('#workoutCardio')).toHaveValue('25');
    await expect(page.locator('#workoutNotes')).toHaveValue('Academia cheia, troquei a ordem');
    await expect(progress).toContainText('25 mincardio');
  });
});

/* ---------- Part B: draft, saving and existing workout ---------- */

/** Simulates the app going to the background (switching apps, locking the screen). */
async function hidePage(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Makes the next confirm() answer "Cancelar" and stores the question in window.__pergunta. */
async function answerNextConfirmNo(page) {
  await page.evaluate(() => {
    const original = window.confirm;
    window.confirm = (message) => { window.__pergunta = message; window.confirm = original; return false; };
  });
}

/** Opens a saved workout from Início (Histórico list) and taps Editar treino. */
async function editSavedWorkout(page, workoutId) {
  await goTo(page, 'Início');
  await page.locator(`#recentWorkouts button[data-view-workout="${workoutId}"]`).click();
  await expect(page.locator('#view-detail')).toBeVisible();
  await page.locator('#detailEdit').click();
  await expect(page.locator('#view-workout')).toBeVisible();
}

const historyCount = (page) => page.locator('#recentWorkouts .section-head .chip');

test.describe('Treinar · draft', () => {
  test('every change saves the draft; reloading the page mid-workout continues where it stopped', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    const draft = () => storedDraft(page);

    // Every kind of change reaches the draft on its own, without leaving the screen.
    await expect.poll(async () => (await draft())?.sheetId).toBe('s-a');
    await supino.getByLabel('Reps da série 2').fill('9');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].reps).toBe('9');
    await supino.getByLabel('Carga da série 2').fill('44');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].load).toBe('44');
    await supino.getByLabel('RIR da série 2').fill('1');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].rir).toBe('1');
    await supino.getByLabel('Observação da série 2').fill('pegada fechada');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].note).toBe('pegada fechada');
    await supino.getByLabel('RIR do aquecimento').fill('3');
    await expect.poll(async () => (await draft())?.formSets[0].warmup.rir).toBe('3');
    await setButton(supino, 1).click();
    await expect.poll(async () => (await draft())?.formSets[0].sets[0].done).toBe(true);
    await page.locator('#workoutCardio').fill('20');
    await expect.poll(async () => (await draft())?.cardio).toBe('20');
    await page.locator('#workoutNotes').fill('no meio do treino');
    await expect.poll(async () => (await draft())?.notes).toBe('no meio do treino');

    await page.reload();

    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '9', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '44', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '1', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', 'pegada fechada', '']);
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('3');
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#workoutProgress')).toContainText('1/5séries feitas');
    await expect(page.locator('#workoutCardio')).toHaveValue('20');
    await expect(page.locator('#workoutNotes')).toHaveValue('no meio do treino');
    await expect(exerciseCard(page, 'Remada baixa')).toBeVisible();
  });

  test('leaving the app (hidden page) saves the draft right away', async ({ page }) => {
    await page.clock.install();
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');
    // Clock fixed: the save 500 ms after the change never gets to run.
    await pauseClock(page);
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await exerciseCard(page, 'Supino reto').getByLabel('Carga da série 1').fill('41');
    expect(await storedDraft(page)).toBeNull();

    await hidePage(page);

    await expect.poll(async () => (await storedDraft(page))?.formSets[0].sets[0].load).toBe('41');
  });

  test('Cancelar discards the changes and the draft', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutNotes').fill('vou desistir');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('vou desistir');

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    await expect.poll(() => storedDraft(page)).toBeNull();
    await expect(historyCount(page)).toHaveText('2 treinos');

    await goTo(page, 'Treinar');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
  });

  test('draft of another workout: continuing keeps the new workout, without mixing it with the one opened', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    await page.locator('#workoutNotes').fill('treino novo de pernas');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('treino novo de pernas');

    // Opening the 10/03 workout to edit asks; "OK" continues the draft (new workout).
    await editSavedWorkout(page, 'w-ultimo');

    await expect(page.locator('#workoutTitle')).toHaveText('Treinar');
    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutNotes')).toHaveValue('treino novo de pernas');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Agachamento livre')).toBeVisible();
    await expect(page.locator('#workoutDelete')).toBeHidden();
    expect((await storedDraft(page)).editingWorkoutId).toBeNull();
  });

  test('draft of another workout: discarding opens the chosen workout with only its data', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    await page.locator('#workoutNotes').fill('treino novo de pernas');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('treino novo de pernas');

    await goTo(page, 'Início');
    await page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]').click();
    await expect(page.locator('#view-detail')).toBeVisible();
    await answerNextConfirmNo(page);
    await page.locator('#detailEdit').click();

    await expect(page.locator('#workoutTitle')).toHaveText('Editar treino');
    expect(await page.evaluate(() => window.__pergunta)).toContain('Você tem um treino em andamento que não foi salvo');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutDate')).toHaveValue('2025-03-10');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    await expect(page.locator('#workoutNotes')).toHaveValue('Bom treino');
    await expect(page.locator('#workoutCardio')).toHaveValue('15');
    await expect(exerciseCard(page, 'Agachamento livre')).toHaveCount(0);
    expect(await setValues(exerciseCard(page, 'Supino reto'), 'Reps')).toEqual(['11', '9', '7']);
    await expect.poll(() => storedDraft(page)).toBeNull();
  });
});

test.describe('Treinar · saving', () => {
  test('an invalid workout is not saved and shows the reason', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');
    // Catalog exercise with no set filled in, no warm-up and no cardio.
    await page.locator('#btnAddExercise').click();
    await page.locator('#pickerSearch').fill('Rosca 21');
    await page.locator('#pickerResults').getByRole('button', { name: /^Rosca 21/ }).click();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();

    const messages = [];
    page.once('dialog', (dialog) => { messages.push(dialog.message()); dialog.accept(); });
    await page.locator('#workoutSave').click();

    await expect.poll(() => messages).toEqual([
      'Preencha pelo menos uma série (reps ou carga), um aquecimento ou os minutos de cardio.'
    ]);
    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();

    await goTo(page, 'Início');
    await expect(page.locator('#recentWorkouts')).toContainText('Nenhum treino registrado ainda');
  });

  test('saving goes to Início with the summary, and the workout appears in Calendário and in each exercise\'s history', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-20T10:00:00-03:00'));
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutCardio').fill('30');

    await page.locator('#workoutSave').click();

    // Início: today's workout at the top, with the summary (2 exercises, volume 1.265 + 1.000 kg, cardio).
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('3 treinos');
    const first = page.locator('#recentWorkouts button[data-view-workout]').first();
    await expect(first).toHaveAttribute('aria-label', 'Treino A, 20/05/2026, 2 exercícios · 2.265 kg · 30 min cardio');
    await expect(first).toContainText('2 exercícios · 2.265 kg · 30 min cardio');

    // Calendário: today marked and with a link to the workout.
    await goTo(page, 'Calendário');
    await expect(page.locator('#calMonthLabel')).toHaveText('maio de 2026');
    const today = page.getByRole('link', { name: 'Abrir treino de 20/05/2026' });
    await expect(today).toHaveClass(/has-workout/);
    await expect(today).toHaveClass(/today/);
    await today.click();
    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page.locator('#detailBody')).toContainText('Treino A');
    await expect(page.locator('#detailBody')).toContainText('20/05/2026');

    // History of each exercise: today's workout is the first.
    for (const [name, total] of [['Supino reto', '3 treinos'], ['Remada baixa', '2 treinos']]) {
      await page.locator('#detailBody .ex-link', { hasText: name }).click();
      await expect(page.locator('#view-exercise')).toBeVisible();
      await expect(page.locator('#exerciseHistoryTitle')).toHaveText(name);
      await expect(page.locator('#exerciseHistory .history-head .chip')).toContainText(total);
      const firstSession = page.locator('#exerciseHistory .card-body.py-2').first();
      await expect(firstSession).toContainText('20/05/2026');
      await expect(firstSession).toContainText('Treino A');
      await page.locator('#exerciseBack').click();
      await expect(page.locator('#view-detail')).toBeVisible();
    }
  });

  test('"Recorde" line when it beats the previous best load', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    // Previous best supino load: 45 kg. Remada repeats the 50 kg (equal does not count).
    await exerciseCard(page, 'Supino reto').getByLabel('Carga da série 1').fill('47,5');
    await page.locator('#workoutSave').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();

    const first = page.locator('#recentWorkouts button[data-view-workout]').first();
    await expect(first.locator('.pr-count')).toHaveText('1');
    await first.click();

    const supino = page.locator('#detailBody .card').filter({ has: page.locator('.ex-link', { hasText: 'Supino reto' }) });
    await expect(supino.locator('.pr-line')).toHaveText('Recorde: 47,5 kg × 12 (antes: 45 kg)');
    const remada = page.locator('#detailBody .card').filter({ has: page.locator('.ex-link', { hasText: 'Remada baixa' }) });
    await expect(remada.locator('.pr-line')).toHaveCount(0);
  });

  test('after saving, the draft disappears', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutNotes').fill('salvando');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('salvando');

    await page.locator('#workoutSave').click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    expect(await storedDraft(page)).toBeNull();
    // With no workout in progress, Início's shortcut is back (the next sheet after A is B).
    await expect(page.getByRole('button', { name: 'Treinar: Treino B' })).toBeVisible();

    await page.reload();
    await expect(page.locator('#weekProgress .week-card')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    await goTo(page, 'Treinar');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
  });
});

test.describe('Treinar · existing workout', () => {
  test('open from the detail, edit and save (without duplicating)', async ({ page }) => {
    await withBackup(page, BACKUP);
    await expect(historyCount(page)).toHaveText('2 treinos');
    await editSavedWorkout(page, 'w-ultimo');

    await expect(page.locator('#workoutTitle')).toHaveText('Editar treino');
    await expect(page.locator('#workoutDate')).toHaveValue('2025-03-10');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    await expect(page.locator('#workoutCardio')).toHaveValue('15');
    await expect(page.locator('#workoutNotes')).toHaveValue('Bom treino');
    const supino = exerciseCard(page, 'Supino reto');
    expect(await setValues(supino, 'Reps')).toEqual(['11', '9', '7']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['2', '1', '0']);
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('3');
    await expect(page.locator('#workoutDelete')).toBeVisible();
    await expect(page.locator('#workoutExport')).toBeVisible();

    await supino.getByLabel('Reps da série 3').fill('8');
    await page.locator('#workoutNotes').fill('Editado depois');
    await page.locator('#workoutSave').click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('2 treinos');
    await expect(page.locator('#recentWorkouts button[data-view-workout]')).toHaveCount(2);
    await page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]').click();
    await expect(page.locator('#detailBody')).toContainText('Editado depois');
    await expect(page.locator('#detailBody')).toContainText('8 reps · 45 kg · RIR 0');
    await expect(page.locator('#detailBody')).toContainText('10/03/2025');
  });

  test('delete the workout', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');

    await page.getByRole('button', { name: 'Excluir treino' }).click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('1 treino');
    await expect(page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]')).toHaveCount(0);
    await expect(page.locator('#recentWorkouts button[data-view-workout="w-antigo"]')).toBeVisible();

    // Really deleted: supino's "last time" becomes the 03/03 workout again.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(exerciseCard(page, 'Supino reto').locator('.last-session')).toContainText('Última vez (03/03/2025)');
  });

  test('export as text (WhatsApp format, only the date at the top)', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');

    await page.locator('#workoutExport').click();

    await expect(page.locator('#exportModal')).toBeVisible();
    await expect(page.locator('#exportText')).toHaveValue([
      '*10/03/2025*',
      'Ficha: _Treino A_',
      '',
      '1. *Supino reto*',
      '- Aquecimento: 15 reps · 20 kg · RIR 3',
      '- Série 1: 11 reps · 40 kg · RIR 2',
      '- Série 2: 9 reps · 42,5 kg · RIR 1',
      '- Série 3: 7 reps · 45 kg · RIR 0',
      '',
      '2. *Remada baixa*',
      '- Série 1: 10 reps · 50 kg · RIR 2',
      '- Série 2: 9 reps · 50 kg · RIR 1',
      '',
      '*Cardio:* 15 min',
      '*Observações:* Bom treino'
    ].join('\n'));
  });

  test("the exported text leaves out the teacher's note, which stays on Treinar and in the saved sets", async ({ page }) => {
    const backup = readFixture(BACKUP);
    backup.data.sheets.find((s) => s.id === 's-a').exercises.find((e) => e.exerciseId === 'ex-supino').note = 'descer em 3s';
    await withBackup(page, backup);
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(exerciseCard(page, 'Supino reto')).toContainText('descer em 3s');

    await page.locator('#workoutSave').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    const saved = (await storedRecords(page, 'workouts')).find((w) => !['w-antigo', 'w-ultimo'].includes(w.id));
    expect(saved.sets.find((s) => s.exerciseName === 'Supino reto').exerciseNote).toBe('descer em 3s');

    await editSavedWorkout(page, saved.id);
    await page.locator('#workoutExport').click();
    await expect(page.locator('#exportModal')).toBeVisible();
    const text = await page.locator('#exportText').inputValue();
    expect(text).toContain('1. *Supino reto*\n- Aquecimento:');
    expect(text).not.toContain('Obs.:');
    expect(text).not.toContain('descer em 3s');
  });
});

test.describe('Treinar · repeated exercise', () => {
  test('the same exercise does not enter the workout twice', async ({ page }) => {
    const alerts = [];
    page.on('dialog', (dialog) => { alerts.push(dialog.message()); dialog.accept(); });
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#btnAddExercise').click();
    await page.locator('#pickerSearch').fill('Supino reto');
    await page.locator('#pickerResults').getByRole('button', { name: /^Supino reto/ }).first().click();

    await expect.poll(() => alerts).toEqual([
      '"Supino reto" já está neste treino. Use o botão "+ série" dele para fazer mais séries.'
    ]);
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);
    expect(await setValues(exerciseCard(page, 'Supino reto'), 'Reps')).toEqual(['12', '10', '8']);
  });
});

test.describe('Treinar · answering "Não" keeps what was filled in', () => {
  test('switching sheet', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await exerciseCard(page, 'Supino reto').getByLabel('RIR da série 1').fill('2');
    const asked = await answerConfirm(page, false);

    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });

    await expect.poll(asked).toEqual(['Substituir os exercícios já no formulário pelos da ficha "Treino B"?']);
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);
    await expect(exerciseCard(page, 'Supino reto').getByLabel('RIR da série 1')).toHaveValue('2');
    await expect(exerciseCard(page, 'Agachamento livre')).toHaveCount(0);
  });

  test('repeat the last workout of this sheet', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const asked = await answerConfirm(page, false);

    await page.getByRole('button', { name: 'Repetir o último treino desta ficha (10/03/2025)' }).click();

    await expect.poll(asked).toEqual(['Substituir os exercícios do formulário pelo treino de 10/03/2025?\n\n' +
      'Reps e cargas vêm daquele treino; RIR e observações ficam em branco.']);
    expect(await setValues(exerciseCard(page, 'Supino reto'), 'Reps')).toEqual(['12', '10', '8']);
  });

  test('remove a filled-in exercise', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const asked = await answerConfirm(page, false);

    await exerciseCard(page, 'Supino reto').getByRole('button', { name: 'Remover exercício' }).click();

    await expect.poll(asked).toEqual(['Remover "Supino reto" do treino?\n\nO que foi preenchido neste exercício será perdido.']);
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);
    expect(await setValues(exerciseCard(page, 'Supino reto'), 'Carga')).toEqual(['40', '42,5', '45']);
  });

  test('Cancelar (asks even with only the note filled in)', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');
    await page.locator('#workoutNotes').fill('só uma anotação');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('só uma anotação');
    const asked = await answerConfirm(page, false);

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect.poll(asked).toEqual(['Descartar as alterações deste treino?']);
    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutNotes')).toHaveValue('só uma anotação');
    expect((await storedDraft(page)).notes).toBe('só uma anotação');
  });

  test('remove the last filled-in set', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    const asked = await answerConfirm(page, false);

    await supino.locator('button:has(.bi-dash)').click();

    await expect.poll(asked).toEqual(['Remover a série 3 de "Supino reto"?']);
    await expect(supino.locator('.ex-title small')).toHaveText('3 séries · descanso 1:30');
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
  });

  test('delete the workout', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');
    const asked = await answerConfirm(page, false);

    await page.getByRole('button', { name: 'Excluir treino' }).click();

    await expect.poll(asked).toEqual(['Excluir este treino?']);
    await expect(page.locator('#view-workout')).toBeVisible();
    expect((await storedRecords(page, 'workouts')).map((w) => w.id).sort()).toEqual(['w-antigo', 'w-ultimo']);
  });
});

test.describe('Treinar · cancelling and emptying', () => {
  test('Cancelar while editing a saved workout goes back to its detail, changing nothing', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');
    await page.locator('#workoutNotes').fill('mudei de ideia');

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page).toHaveURL(/#\/detail\/w-ultimo$/);
    await expect(page.locator('#detailBody')).toContainText('Bom treino');
    await expect(page.locator('#detailBody')).not.toContainText('mudei de ideia');
    await expect.poll(() => storedDraft(page)).toBeNull();
  });

  test('erasing everything that was typed erases the draft', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');
    await page.locator('#workoutCardio').fill('20');
    await expect.poll(async () => (await storedDraft(page))?.cardio).toBe('20');

    await page.locator('#workoutCardio').fill('');

    await expect.poll(() => storedDraft(page)).toBeNull();
    await goTo(page, 'Início');
    await expect(page.locator('#draftBanner')).toBeEmpty();
  });
});

test.describe('Treinar · old browser', () => {
  test('saves the workout even without crypto.randomUUID', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Crypto.prototype, 'randomUUID', { configurable: true, value: undefined });
    });
    await workoutWithSheet(page, 'Treino B');
    await page.locator('#workoutSave').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();

    const saved = (await storedRecords(page, 'workouts')).filter((w) => !w.id.startsWith('w-'));
    expect(saved.map((w) => w.id)).toEqual([expect.stringMatching(/^id-\d+-[0-9a-f]+$/)]);
  });
});
