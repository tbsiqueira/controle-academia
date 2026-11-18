// TEMPORÁRIO (issue #39): um teste por comportamento da tela Mais (metas, colinha, importar treinos antigos),
// só enquanto durar a refatoração. Os permanentes ficam em ../mais.spec.js. Desligamento: issue #40.
const { test, expect, freshApp, storedRecords, goTo } = require('../helpers');
const { collectAlerts } = require('./util');

async function moreScreen(page) {
  await freshApp(page);
  await goTo(page, 'Mais');
}

const appSettings = async (page) => (await storedRecords(page, 'settings')).find((s) => s.id === 'app');

test.describe('Mais · metas (temporário)', () => {
  test('meta de treinos zerada vira 1 e cardio vazio vira 0', async ({ page }) => {
    await moreScreen(page);
    await page.locator('#setWorkoutTarget').fill('0');
    await page.locator('#setCardioTarget').fill('');
    await page.locator('#btnSaveSettings').click();
    await expect(page.locator('#appToastBody')).toHaveText('Metas salvas.');

    expect(await appSettings(page)).toMatchObject({ weeklyWorkoutTarget: 1, weeklyCardioTarget: 0 });
    await goTo(page, 'Início');
    await expect(page.locator('#weekProgress .week-stat .stat-big')).toHaveText(['0/1', '0/0']);
  });

  test('trocar a data de início da semana muda a semana do Início', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-20T10:00:00-03:00'));
    await moreScreen(page);
    await page.locator('#setWeekAnchor').fill('2026-05-18');
    await page.locator('#btnSaveSettings').click();
    await expect(page.locator('#appToastBody')).toHaveText('Metas salvas.');

    expect(await appSettings(page)).toMatchObject({ weekAnchor: '2026-05-18' });
    await goTo(page, 'Início');
    await expect(page.locator('#weekProgress .week-card')).toContainText('18/05 – 24/05');
  });
});

test.describe('Mais · colinha (temporário)', () => {
  test('só o título basta para salvar', async ({ page }) => {
    await moreScreen(page);
    await page.locator('#btnAddColinha').click();
    await page.locator('#colinhaTitle').fill('Só título');
    await page.locator('#colinhaSave').click();
    await expect(page.locator('#colinhaModal')).toBeHidden();
    await expect(page.locator('#colinhaList .colinha-item strong')).toHaveText('Só título');
  });

  test('só o conteúdo basta para salvar', async ({ page }) => {
    await moreScreen(page);
    await page.locator('#btnAddColinha').click();
    await page.locator('#colinhaContent').fill('Beber água entre as séries.');
    await page.locator('#colinhaSave').click();
    await expect(page.locator('#colinhaModal')).toBeHidden();
    await expect(page.locator('#colinhaList .colinha-item small')).toHaveText('Beber água entre as séries.');
    expect((await storedRecords(page, 'colinha')).map((c) => [c.title, c.content])).toEqual([['', 'Beber água entre as séries.']]);
  });

  test('título e conteúdo só com espaços são recusados', async ({ page }) => {
    const alerts = collectAlerts(page);
    await moreScreen(page);
    await page.locator('#btnAddColinha').click();
    await page.locator('#colinhaTitle').fill('   ');
    await page.locator('#colinhaContent').fill('  ');
    await page.locator('#colinhaSave').click();
    await expect.poll(() => alerts).toEqual(['Preencha o título ou o conteúdo.']);
    expect(await storedRecords(page, 'colinha')).toHaveLength(0);
  });

  test('as colinhas aparecem na ordem em que foram criadas, e editar não muda a ordem', async ({ page }) => {
    await moreScreen(page);
    const items = page.locator('#colinhaList .colinha-item strong');
    for (const title of ['Primeira', 'Segunda']) {
      await page.locator('#btnAddColinha').click();
      await page.locator('#colinhaTitle').fill(title);
      await page.locator('#colinhaSave').click();
      await expect(page.locator('#colinhaModal')).toBeHidden();
    }
    await expect(items).toHaveText(['Primeira', 'Segunda']);

    await page.locator('#colinhaList .colinha-item').first().getByRole('button', { name: 'Editar colinha' }).click();
    await page.locator('#colinhaTitle').fill('Primeira editada');
    await page.locator('#colinhaSave').click();
    await expect(page.locator('#colinhaModal')).toBeHidden();
    await expect(items).toHaveText(['Primeira editada', 'Segunda']);
  });
});

test.describe('Mais · importar treinos antigos (temporário)', () => {
  test('"Copiar texto" copia o texto para a IA', async ({ page }) => {
    await moreScreen(page);
    await page.locator('#btnHistoryImport').click();
    await expect(page.locator('#historyImportModal')).toBeVisible();
    const ia = page.locator('#historyIaText');
    await expect(ia).not.toHaveValue('');
    const text = await ia.inputValue();

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#historyIaCopy').click();
    await expect(page.locator('#appToastBody')).toHaveText('Texto copiado!');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('Cancelar fecha a janela sem importar nada', async ({ page }) => {
    await moreScreen(page);
    await page.locator('#btnHistoryImport').click();
    await page.locator('#historyImportText').fill('{"workouts": []}');
    await page.locator('#historyImportModal').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#historyImportModal')).toBeHidden();
    expect(await storedRecords(page, 'workouts')).toHaveLength(0);
  });
});
