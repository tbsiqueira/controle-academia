// TEMPORÁRIO (issue #39): comportamentos de Dados (backup, Desfazer) sem teste próprio, só enquanto durar a
// refatoração. Os permanentes ficam em ../dados.spec.js. Desligamento: issue #40.
const { test, expect, freshApp, withBackup, goTo } = require('../helpers');

test.describe('Dados · Desfazer (temporário)', () => {
  test('antes de importar não há o que desfazer', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Mais');
    await expect(page.locator('#btnUndoImport')).toBeHidden();
  });

  test('o Desfazer vale só até recarregar a página: depois some', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await goTo(page, 'Mais');
    await expect(page.locator('#btnUndoImport')).toBeVisible();

    await page.reload();
    await expect(page.locator('#view-more')).toBeVisible();
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('3');
    await expect(page.locator('#btnUndoImport')).toBeHidden();
  });
});
