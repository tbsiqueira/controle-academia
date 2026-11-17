// Testes de fumaça: o app abre, navega, funciona offline e não fala com ninguém de fora.
// Os fluxos de verdade (Treinar, Início, dados, fichas) ficam nos outros arquivos desta pasta.
const { test, expect, TABS, freshApp, waitForApp, withSampleData, goTo } = require('./helpers');

test('abre sem erro com o banco vazio', async ({ page }) => {
  await freshApp(page);
  await expect(page.locator('#view-dashboard')).toBeVisible();
  await expect(page.locator('#recentWorkouts')).toContainText('Nenhum treino registrado ainda');
  await expect(page.locator('.bottom-nav a.active')).toHaveAttribute('href', '#/dashboard');
});

test('a versão é a mesma no rodapé, nos arquivos e no cache do service worker', async ({ page }) => {
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

test('as 5 abas da barra inferior abrem a tela certa', async ({ page }) => {
  await freshApp(page);
  for (const [name, tab] of Object.entries(TABS)) {
    await goTo(page, name);
    await expect(page).toHaveURL(new RegExp(tab.hash.replace('/', '\\/') + '$'));
    await expect(page.locator('.bottom-nav a.active')).toHaveAttribute('href', tab.hash);
    await expect(page.locator('.view:not(.d-none)')).toHaveCount(1);
  }
});

test('telas internas: Fichas ↔ Biblioteca e Mais → Apagar dados → voltar', async ({ page }) => {
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

test('com dados: Início lista treinos e o Calendário marca os dias', async ({ page }) => {
  await withSampleData(page);
  await expect(page.locator('#recentWorkouts')).not.toContainText('Nenhum treino registrado ainda');
  await expect(page.locator('#recentWorkouts button[data-view-workout]').first()).toBeVisible();
  await expect(page.locator('#quickStart button')).toBeVisible();

  // Os dados de exemplo sempre têm um treino hoje, então o mês atual tem pelo menos um dia marcado.
  await goTo(page, 'Calendário');
  await expect(page.locator('#calendarGrid .has-workout').first()).toBeVisible();
  await expect(page.locator('#calendarGrid .today.has-workout')).toHaveCount(1);
});

test('funciona offline depois do primeiro carregamento', async ({ page, context }) => {
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

test('nada sai do aparelho: nenhuma requisição para fora do servidor local', async ({ page, baseURL }) => {
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

test('cabe no celular: nenhuma tela rola para o lado em 375px', async ({ page }) => {
  await withSampleData(page);
  for (const name of Object.keys(TABS)) {
    await goTo(page, name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'rolagem horizontal na aba ' + name).toBeLessThanOrEqual(0);
  }
});
