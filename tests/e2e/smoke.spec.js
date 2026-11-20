// Smoke tests: the app opens, navigates, works offline and does not talk to anyone outside.
// The real flows (Treinar, Início, data, sheets) live in the other files in this folder.
const { test, expect, TABS, freshApp, waitForApp, withSampleData, goTo } = require('./helpers');

test('opens with no error with an empty database', async ({ page }) => {
  await freshApp(page);
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await expect(page.locator('#recentWorkouts')).toContainText('Nenhum treino registrado ainda');
  await expect(page.locator('.bottom-nav a.active')).toHaveAttribute('href', '#/dashboard');
});

test('the version is the same in the footer, in the asset URLs and in the service worker cache', async ({ page }) => {
  await freshApp(page);
  const footer = await page.locator('#appVersion').textContent();
  const version = footer.replace(/^v/, '');
  expect(version).toMatch(/^\d+$/);

  const assetVersions = await page.evaluate(() =>
    [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
      .map((el) => el.getAttribute('src') || el.getAttribute('href'))
      .filter((url) => url.includes('?v='))
      .map((url) => url.split('?v=')[1]));
  expect(assetVersions.length).toBeGreaterThan(0);
  expect(new Set(assetVersions)).toEqual(new Set([version]));

  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('meu-treino-v' + version);
});

test('the 5 bottom-bar tabs open the right screen', async ({ page }) => {
  await freshApp(page);
  for (const [name, tab] of Object.entries(TABS)) {
    await goTo(page, name);
    await expect(page).toHaveURL(new RegExp(tab.hash.replace('/', '\\/') + '$'));
    await expect(page.locator('.bottom-nav a.active')).toHaveAttribute('href', tab.hash);
    await expect(page.locator('.view:not(.d-none)')).toHaveCount(1);
  }
});

test('inner screens: Fichas ↔ Biblioteca and Mais → Erase data → back', async ({ page }) => {
  await freshApp(page);

  await goTo(page, 'Fichas');
  await expect(page.locator('#tabSheets')).toBeVisible();
  await page.locator('#tabExercisesBtn').click();
  await expect(page.locator('#tabExercises')).toBeVisible();
  await expect(page.locator('#tabSheets')).toBeHidden();
  await page.locator('#tabSheetsBtn').click();
  await expect(page.locator('#tabSheets')).toBeVisible();

  await goTo(page, 'Mais');
  await page.locator('#btnEraseAll').click();
  await expect(page.locator('#view-erase')).toBeVisible();
  await expect(page.locator('#eraseBody')).not.toBeEmpty();
  await expect(page.locator('.bottom-nav a.active')).toHaveAttribute('href', '#/more');
  await page.locator('#view-erase .btn-back').click();
  await expect(page.locator('#view-more')).toBeVisible();
});

test('with data: Início lists workouts and Calendário marks the days', async ({ page }) => {
  await withSampleData(page);
  await expect(page.locator('#recentWorkouts')).not.toContainText('Nenhum treino registrado ainda');
  await expect(page.locator('#recentWorkouts button[data-view-workout]').first()).toBeVisible();
  await expect(page.locator('#quickStart button')).toBeVisible();

  // The sample data always has a workout today, so the current month has at least one marked day.
  await goTo(page, 'Calendário');
  await expect(page.locator('#calendarGrid .has-workout').first()).toBeVisible();
  await expect(page.locator('#calendarGrid .today.has-workout')).toHaveCount(1);
});

test('works offline after the first load', async ({ page, context }) => {
  await freshApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('#view-dashboard')).toBeVisible();

  const catalogSize = await page.evaluate(() => fetch('data/exercises.json').then((r) => r.json()).then((d) => d.exercises.length));
  expect(catalogSize).toBeGreaterThan(900);

  await goTo(page, 'Treinar');
  await goTo(page, 'Fichas');
});

test('nothing leaves the device: no request outside the local server', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const outside = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url);
  });

  await withSampleData(page);
  for (const name of Object.keys(TABS)) await goTo(page, name);
  await goTo(page, 'Início');
  await page.locator('#recentWorkouts button[data-view-workout]').first().click();
  await expect(page.locator('#view-detail')).toBeVisible();

  expect(outside).toEqual([]);
});

test('fits a phone: no screen scrolls sideways at 375px', async ({ page }) => {
  await withSampleData(page);
  for (const name of Object.keys(TABS)) {
    await goTo(page, name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal scroll on the ' + name + ' tab').toBeLessThanOrEqual(0);
  }
});

/**
 * Visible form fields (except checkbox/radio/range) whose computed font size is below 16px, named by
 * aria-label, id or placeholder. iOS Safari zooms in when such a field gets focus.
 */
function smallFields(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => !['checkbox', 'radio', 'range', 'hidden'].includes(el.type))
      .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0)
      .map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }))
      .filter(({ size }) => size < 16)
      .map(({ el, size }) => (el.getAttribute('aria-label') || el.id || el.placeholder || el.name || el.tagName) + ' (' + size + 'px)'));
}

test('no iPhone zoom: every visible form field is at least 16px at phone width', async ({ page }) => {
  await withSampleData(page);

  // Treinar with a sheet loaded: set rows, warm-up and observation fields exist.
  await goTo(page, 'Treinar');
  await page.locator('#workoutSheet').selectOption({ index: 1 });
  await expect(page.locator('#workoutExercises input[aria-label^="Observação da série"]').first()).toBeVisible();
  expect(await smallFields(page), 'fields below 16px on Treinar').toEqual([]);

  // Sheet editor.
  await goTo(page, 'Fichas');
  await page.getByRole('button', { name: 'Editar ficha' }).first().click();
  await expect(page.locator('#sheetEditorModal')).toBeVisible();
  await expect(page.locator('#sheetEditorModal input[aria-label^="Reps da"]').first()).toBeVisible();
  expect(await smallFields(page), 'fields below 16px in the ficha editor').toEqual([]);
  await page.locator('#sheetEditorModal').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#sheetEditorModal')).toBeHidden();

  // "Criar com IA": the text for the AI and the pasted answer.
  await page.locator('#btnImportSheet').click();
  await expect(page.locator('#sheetImportText')).toBeVisible();
  expect(await smallFields(page), 'fields below 16px in "Criar com IA"').toEqual([]);
  await page.locator('#sheetImportModal').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#sheetImportModal')).toBeHidden();

  // Biblioteca.
  await page.locator('#tabExercisesBtn').click();
  await expect(page.locator('#tabExercises')).toBeVisible();
  expect(await smallFields(page), 'fields below 16px on Biblioteca').toEqual([]);

  // Mais.
  await goTo(page, 'Mais');
  expect(await smallFields(page), 'fields below 16px on Mais').toEqual([]);

  // Mais → "Importar treinos antigos": the other pair of AI text areas.
  await page.locator('#btnHistoryImport').click();
  await expect(page.locator('#historyImportText')).toBeVisible();
  expect(await smallFields(page), 'fields below 16px in "Importar treinos antigos"').toEqual([]);
});
