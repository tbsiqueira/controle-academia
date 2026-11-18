// TEMPORÁRIO (issue #39): um teste por comportamento do detalhe do treino, da evolução do exercício e do
// Calendário, só enquanto durar a refatoração. Os permanentes ficam em ../historico.spec.js. Desligamento: #40.
const { test, expect, withBackup } = require('../helpers');
const { putRecords, reloadApp } = require('./util');

test.describe('Detalhe do treino (temporário)', () => {
  test('treino só de cardio, sem exercícios, avisa que não há exercícios registrados', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await putRecords(page, 'workouts', [{
      id: 'w-cardio', date: '2025-03-11', sheetId: '', sheetName: '', cardioMinutes: 40, notes: 'só esteira',
      warmups: [], sets: [], createdAt: '2025-03-11T12:00:00.000Z', updatedAt: '2025-03-11T12:00:00.000Z'
    }]);
    await reloadApp(page);
    await page.goto('./#/detail/w-cardio');

    const detail = page.locator('#view-detail');
    await expect(detail).toContainText('Este treino não tem exercícios registrados.');
    await expect(detail).toContainText('só esteira');
  });

  test('"Editar" no detalhe abre o treino no Treinar', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await page.goto('./#/detail/w-ultimo');
    await page.locator('#detailEdit').click();
    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutDate')).toHaveValue('2025-03-10');
    await expect(page.locator('#workoutNotes')).toHaveValue('Bom treino');
  });
});

test.describe('Evolução do exercício (temporário)', () => {
  test('"Voltar" na evolução volta para a tela de onde veio', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await page.goto('./#/detail/w-ultimo');
    await expect(page.locator('#view-detail')).toBeVisible();
    await page.goto('./#/exercise/ex-supino');
    await expect(page.locator('#view-exercise')).toBeVisible();

    await page.locator('#exerciseBack').click();
    await expect(page.locator('#view-detail')).toBeVisible();
  });
});
