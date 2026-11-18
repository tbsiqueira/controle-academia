// TEMPORÁRIO (issue #39): comportamentos do Treinar cujas linhas já rodavam em outros testes, mas sem nenhum
// teste conferindo o resultado. Só enquanto durar a refatoração; desligamento: issue #40.
//
// Ponto de partida: `fixtures/treinar-backup.json` (Treino A: Supino reto e Remada baixa; treino w-ultimo de
// 10/03/2025 com a Treino A).
const { test, expect, freshApp, withBackup, goTo } = require('../helpers');
const { putRecords, reloadApp } = require('./util');

const sheetSelect = (page) => page.locator('#workoutSheet');
const selectedSheet = (page) => sheetSelect(page).locator('option:checked');

/** Abre a edição do treino w-ultimo pelo detalhe, como uma pessoa faria. */
async function editLastWorkout(page) {
  await page.goto('./#/detail/w-ultimo');
  await expect(page.locator('#view-detail')).toBeVisible();
  await page.locator('#detailEdit').click();
  await expect(page.locator('#view-workout')).toBeVisible();
}

async function sheetAction(page, sheetName, action) {
  await goTo(page, 'Fichas');
  const card = page.locator('#sheetsList .card').filter({ has: page.locator('strong').getByText(sheetName, { exact: true }) });
  await card.getByRole('button', { name: action }).click();
}

test.describe('Treinar · ficha do treino em edição (temporário)', () => {
  test('editar um treino de ficha desativada mostra a ficha como "(inativa)"', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await sheetAction(page, 'Treino A', 'Desativar ficha');
    await expect(page.locator('#sheetsList')).toContainText('Treino A');

    await editLastWorkout(page);
    await expect(selectedSheet(page)).toHaveText('Treino A (inativa)');
    await expect(page.locator('#sheetHint')).toHaveText('2 exercícios na ficha — carregados no treino.');
  });

  test('editar um treino de ficha excluída mostra o nome guardado como "(excluída)" e explica', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await sheetAction(page, 'Treino A', 'Excluir ficha');
    await expect(page.locator('#sheetsList .card strong').getByText('Treino A', { exact: true })).toHaveCount(0);

    await editLastWorkout(page);
    await expect(selectedSheet(page)).toHaveText('Treino A (excluída)');
    await expect(page.locator('#sheetHint')).toHaveText('Esta ficha foi excluída — o nome dela continua guardado neste treino.');
  });

  test('escolher uma ficha sem exercícios explica onde adicionar', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await putRecords(page, 'sheets', [{
      id: 's-vazia', name: 'Ficha vazia', active: true, exercises: [],
      createdAt: '2025-03-01T00:00:00.000Z', updatedAt: '2025-03-01T00:00:00.000Z'
    }]);
    await reloadApp(page);
    await goTo(page, 'Treinar');
    await sheetSelect(page).selectOption({ label: 'Ficha vazia' });
    await expect(page.locator('#sheetHint')).toHaveText('Esta ficha ainda não tem exercícios. Adicione na aba Fichas.');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(0);
  });

  test('sem nenhuma ficha, o Treinar aponta para a aba Fichas', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');
    const hint = page.locator('#sheetHint');
    await expect(hint).toHaveText('Você ainda não tem fichas. Crie a sua na aba Fichas.');
    await hint.getByRole('link', { name: 'Fichas' }).click();
    await expect(page.locator('#view-exercises')).toBeVisible();
  });
});
