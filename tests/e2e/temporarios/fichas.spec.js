// TEMPORÁRIO (issue #39): um teste por comportamento da aba Fichas, só enquanto durar a refatoração.
// Os testes permanentes (caminho principal) ficam em ../fichas.spec.js. Desligamento: issue #40.
//
// Ponto de partida: `fixtures/treinar-backup.json` (Treino A: Supino reto 3×12-10-8 e Remada baixa 2×10-10;
// Treino B: Agachamento livre 4×8-8-6-6; Treino Antigo desativada: Remada baixa 3 séries).
const { test, expect, withBackup, storedRecords, goTo } = require('../helpers');
const { putRecords, reloadApp, collectAlerts } = require('./util');

const editor = (page) => page.locator('#sheetEditorModal');
const editorNames = (page) => editor(page).locator('.sheet-edit-item strong');

function sheetCard(page, name) {
  return page.locator('#sheetsList .card').filter({ has: page.locator('strong').getByText(name, { exact: true }) });
}

function editorRow(page, name) {
  return editor(page).locator('.sheet-edit-item').filter({ has: page.locator('strong', { hasText: name }) });
}

function sheetItems(card) {
  return card.locator('.sheet-items li').evaluateAll((els) => els.map((el) =>
    [...el.querySelectorAll('span')].map((s) => s.textContent.trim()).join(' ')));
}

async function openSheet(page, name) {
  await withBackup(page, 'treinar-backup.json');
  await goTo(page, 'Fichas');
  await sheetCard(page, name).getByRole('button', { name: 'Editar ficha' }).click();
  await expect(editor(page)).toBeVisible();
}

test.describe('Fichas · editor (temporário)', () => {
  test('salvar sem nome avisa e não fecha o editor', async ({ page }) => {
    const alerts = collectAlerts(page);
    await withBackup(page, 'treinar-backup.json');
    await goTo(page, 'Fichas');
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill('   ');
    await page.locator('#sheetEditorSave').click();

    await expect.poll(() => alerts).toEqual(['Informe o nome da ficha.']);
    await expect(editor(page)).toBeVisible();
    expect((await storedRecords(page, 'sheets')).length).toBe(3);
  });

  test('Descer leva o exercício uma posição para baixo; no último e no primeiro não faz nada', async ({ page }) => {
    await openSheet(page, 'Treino A');
    await expect(editorNames(page)).toHaveText(['1Supino reto', '2Remada baixa']);

    await editorRow(page, 'Supino reto').getByRole('button', { name: 'Descer exercício' }).click();
    await expect(editorNames(page)).toHaveText(['1Remada baixa', '2Supino reto']);

    await editorRow(page, 'Supino reto').getByRole('button', { name: 'Descer exercício' }).click();
    await editorRow(page, 'Remada baixa').getByRole('button', { name: 'Subir exercício' }).click();
    await expect(editorNames(page)).toHaveText(['1Remada baixa', '2Supino reto']);

    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();
    await expect.poll(() => sheetItems(sheetCard(page, 'Treino A'))).toEqual(['1 Remada baixa 2×10-10', '2 Supino reto 3×12-10-8']);
  });

  test('diminuir as séries tira os campos de reps que sobram e não grava reps a mais', async ({ page }) => {
    await openSheet(page, 'Treino A');
    const supino = editorRow(page, 'Supino reto');
    await supino.getByLabel('Séries').fill('2');
    await supino.getByLabel('Séries').blur();
    await expect(supino.locator('input[aria-label$="ª série"]')).toHaveCount(2);

    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();
    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino A');
    expect(saved.exercises[0]).toMatchObject({ name: 'Supino reto', sets: 2, reps: [12, 10] });
  });

  test('fechar o editor sem salvar não grava nada', async ({ page }) => {
    await openSheet(page, 'Treino A');
    await page.locator('#sheetName').fill('Treino A alterado');
    await editorRow(page, 'Remada baixa').getByRole('button', { name: 'Remover exercício' }).click();
    await editor(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(editor(page)).toBeHidden();

    await expect(sheetCard(page, 'Treino A').locator('.badge')).toHaveText('2 exercícios');
    expect((await storedRecords(page, 'sheets')).map((s) => s.name).sort()).toEqual(['Treino A', 'Treino Antigo', 'Treino B']);

    // Abrir de novo mostra a ficha como está gravada.
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await expect(page.locator('#sheetName')).toHaveValue('Treino A');
    await expect(editorNames(page)).toHaveText(['1Supino reto', '2Remada baixa']);
  });

  test('tirar todos os exercícios mostra como adicionar', async ({ page }) => {
    await openSheet(page, 'Treino A');
    await editorRow(page, 'Supino reto').getByRole('button', { name: 'Remover exercício' }).click();
    await editorRow(page, 'Remada baixa').getByRole('button', { name: 'Remover exercício' }).click();
    await expect(page.locator('#sheetExerciseList')).toHaveText(/Nenhum exercício na ficha ainda/);
  });

  test('"Adicionar exercício" abre e fecha a busca; abrir de novo começa vazia', async ({ page }) => {
    await openSheet(page, 'Treino A');
    const box = page.locator('#sheetPickerBox');
    await page.locator('#btnSheetAddExercise').click();
    await expect(page.locator('#sheetPickerResults')).toContainText('Catálogo (pt-BR)');
    await page.locator('#sheetPickerSearch').fill('rosca');
    await page.locator('#btnSheetAddExercise').click();
    await expect(box).toBeHidden();

    await page.locator('#btnSheetAddExercise').click();
    await expect(box).toBeVisible();
    await expect(page.locator('#sheetPickerSearch')).toHaveValue('');
  });

  test('editar uma ficha desativada mantém desativada, mesmo com o nome de uma ativa', async ({ page }) => {
    await openSheet(page, 'Treino Antigo');
    await page.locator('#sheetName').fill('Treino A');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const sheets = await storedRecords(page, 'sheets');
    expect(sheets.filter((s) => s.name === 'Treino A').map((s) => s.active).sort()).toEqual([false, true]);
  });
});

test.describe('Fichas · lista (temporário)', () => {
  test('ficha antiga sem reps por série mostra só o número de séries', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await putRecords(page, 'sheets', [{
      id: 's-velha', name: 'Ficha velha', active: true,
      exercises: [{ exerciseId: 'ex-supino', name: 'Supino reto', sets: 4 }],
      createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z'
    }]);
    await reloadApp(page);
    await goTo(page, 'Fichas');

    await expect.poll(() => sheetItems(sheetCard(page, 'Ficha velha'))).toEqual(['1 Supino reto 4 séries']);
  });

  test('as desativadas vêm depois das ativas, marcadas como desativadas', async ({ page }) => {
    await withBackup(page, 'treinar-backup.json');
    await goTo(page, 'Fichas');
    const names = (await page.locator('#sheetsList .card strong').allTextContents()).map((n) => n.trim());
    expect(names[names.length - 1]).toBe('Treino Antigo');
    await expect(sheetCard(page, 'Treino Antigo').getByRole('button', { name: 'Reativar ficha' })).toBeVisible();
  });
});
