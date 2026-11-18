// TEMPORÁRIO (issue #39): um teste por comportamento da Biblioteca (Fichas → Biblioteca), só enquanto durar a
// refatoração. Os permanentes ficam em ../biblioteca.spec.js. Desligamento: issue #40.
//
// Ponto de partida: `fixtures/treinar-backup.json` (Biblioteca: Supino reto, Remada baixa, Agachamento livre e
// Rosca na máquina azul; Treino A usa Supino reto e Remada baixa).
const { test, expect, withBackup, storedRecords, goTo } = require('../helpers');

const libraryCards = (page) => page.locator('#exercisesList .card');
const libraryNames = (page) => page.locator('#exercisesList .card strong');
const exerciseForm = (page) => page.locator('#exerciseFormModal');

function libraryCard(page, name) {
  return libraryCards(page).filter({ has: page.locator('strong').getByText(name, { exact: true }) });
}

async function openLibrary(page) {
  await withBackup(page, 'treinar-backup.json');
  await goTo(page, 'Fichas');
  await page.locator('#tabExercisesBtn').click();
  await expect(page.locator('#tabExercises')).toBeVisible();
}

test.describe('Biblioteca (temporário)', () => {
  test('editar grupo e correção sem renomear mantém o nome e o histórico', async ({ page }) => {
    await openLibrary(page);
    const workoutsBefore = await storedRecords(page, 'workouts');
    await libraryCard(page, 'Supino reto').getByRole('button', { name: 'Editar exercício' }).click();
    await expect(page.locator('#exerciseFormTitle')).toHaveText('Editar exercício');
    await expect(page.locator('#fichaName')).toHaveValue('Supino reto');
    await page.locator('#fichaGroup').selectOption('Ombros');
    await page.locator('#fichaCorrection').fill('escápulas encaixadas');
    await page.locator('#exerciseFormSave').click();
    await expect(exerciseForm(page)).toBeHidden();

    const card = libraryCard(page, 'Supino reto');
    await expect(card.locator('.badge')).toHaveText('Ombros');
    await expect(card).toContainText('escápulas encaixadas');
    const saved = (await storedRecords(page, 'exercises')).find((e) => e.id === 'ex-supino');
    expect(saved).toMatchObject({ name: 'Supino reto', group: 'Ombros', correction: 'escápulas encaixadas' });
    expect(await storedRecords(page, 'workouts')).toEqual(workoutsBefore);
  });

  test('a correção da professora vem como observação ao pôr o exercício numa ficha', async ({ page }) => {
    await openLibrary(page);
    await libraryCard(page, 'Rosca na máquina azul').getByRole('button', { name: 'Editar exercício' }).click();
    await page.locator('#fichaCorrection').fill('não balançar o tronco');
    await page.locator('#exerciseFormSave').click();
    await expect(exerciseForm(page)).toBeHidden();

    await page.locator('#tabSheetsBtn').click();
    await page.locator('#btnNewSheet').click();
    await page.locator('#btnSheetAddExercise').click();
    await expect(page.locator('#sheetPickerResults')).toContainText('Catálogo (pt-BR)');
    await page.locator('#sheetPickerSearch').fill('maquina azul');
    await page.locator('#sheetPickerResults').getByRole('button', { name: /^Rosca na máquina azul/ }).first().click();
    await expect(page.locator('#sheetEditorModal').getByLabel('Observação da professora')).toHaveValue('não balançar o tronco');
  });

  test('fechar o cadastro sem salvar não cria o exercício', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#btnNewExercise').click();
    await page.locator('#fichaName').fill('Exercício que desisti');
    await exerciseForm(page).getByRole('button', { name: 'Fechar' }).click();
    await expect(exerciseForm(page)).toBeHidden();

    await expect(libraryNames(page)).toHaveCount(4);
    expect((await storedRecords(page, 'exercises')).map((e) => e.name)).not.toContain('Exercício que desisti');
  });

  test('busca e filtro de grupo valem juntos', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#libraryGroupFilter button').filter({ hasText: 'Costas' }).click();
    await page.locator('#librarySearch').fill('supino');
    await expect(libraryCards(page)).toHaveCount(0);
    await page.locator('#librarySearch').fill('remada');
    await expect(libraryNames(page)).toHaveText(['Remada baixa']);
  });

  test('no cadastro, o botão do catálogo abre e fecha a busca', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#btnNewExercise').click();
    const box = page.locator('#fichaCatalogBox');
    await page.locator('#btnFichaCatalog').click();
    await expect(box).toBeVisible();
    await page.locator('#btnFichaCatalog').click();
    await expect(box).toBeHidden();
  });
});
