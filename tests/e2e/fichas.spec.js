// Fichas and Create with AI (issue #7): the main path of every feature on the Fichas tab.
//
// Starting point: `fixtures/treinar-backup.json`, imported through the Mais screen.
// - Treino A (active): Supino reto 3 sets (12-10-8) and Remada baixa 2 sets (10-10).
// - Treino B (active): Agachamento livre 4 sets (8-8-6-6).
// - Treino Antigo (deactivated): Remada baixa 3 sets.
// - Biblioteca: Supino reto, Remada baixa, Agachamento livre and Rosca na máquina azul.
// - Workouts of Treino A on 03/03/2025 and 10/03/2025.
const { test, expect, withBackup, readFixture, storedRecords, goTo, answerConfirm } = require('./helpers');

const BACKUP = 'treinar-backup.json';

const sheetCards = (page) => page.locator('#sheetsList .card');
const editor = (page) => page.locator('#sheetEditorModal');
const importModal = (page) => page.locator('#sheetImportModal');

/** Card of a sheet in the list, by exact name. */
function sheetCard(page, name) {
  return sheetCards(page).filter({ has: page.locator('strong').getByText(name, { exact: true }) });
}

/** Sheet names in the list, in order (active first, then deactivated). */
function listedSheetNames(page) {
  return page.locator('#sheetsList .card strong').allTextContents().then((names) => names.map((n) => n.trim()));
}

/** Items of a sheet in the list: "1 Supino reto 3×12-10-8". */
function sheetItems(card) {
  return card.locator('.sheet-items li').evaluateAll((els) => els.map((el) =>
    [...el.querySelectorAll('span')].map((s) => s.textContent.trim()).join(' ')));
}

/** Exercise row in the sheet editor, by name. */
function editorRow(page, name) {
  return editor(page).locator('.sheet-edit-item').filter({ has: page.locator('strong', { hasText: name }) });
}

/** Reps-per-set fields of a sheet-editor row. */
const editorRepInputs = (row) => row.locator('input[aria-label$="ª série"]');

/** Values of the reps-per-set fields of a sheet-editor row. */
function editorReps(row) {
  return editorRepInputs(row).evaluateAll((els) => els.map((el) => el.value));
}

/** Options of Treinar's sheet selector (without the empty option). */
async function workoutSheetOptions(page) {
  const labels = await page.locator('#workoutSheet option').allTextContents();
  return labels.map((l) => l.trim()).filter((l) => l && !/^Selecione/i.test(l) && !/^—/.test(l) && !/^Sem ficha/i.test(l));
}

/** Opens the Fichas tab with the backup imported. */
async function sheetsWithBackup(page, backup = BACKUP) {
  await withBackup(page, backup);
  await goTo(page, 'Fichas');
}

/** Collects the page's alert() messages; each one is accepted. */
function collectAlerts(page) {
  const messages = [];
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'alert') messages.push(dialog.message());
    dialog.accept();
  });
  return messages;
}

/** In the open editor: opens the exercise search (if closed), searches and taps the result. */
async function addFromPicker(page, query, result) {
  const box = page.locator('#sheetPickerBox');
  if (await box.isHidden()) {
    await editor(page).locator('#btnSheetAddExercise').click();
    // The search opens empty after loading the catalog: only then can you type.
    await expect(page.locator('#sheetPickerResults')).toContainText('Catálogo (pt-BR)');
  }
  await page.locator('#sheetPickerSearch').fill(query);
  await page.locator('#sheetPickerResults').getByRole('button', { name: result }).first().click();
}

test.describe('Fichas · create and edit', () => {
  test('create a sheet with exercises from Biblioteca, the catalog and a new one; sets, reps, note and order', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('#sheetEditorTitle')).toHaveText('Nova ficha');
    await expect(page.locator('#sheetExerciseList')).toContainText('Nenhum exercício na ficha ainda');

    await page.locator('#sheetName').fill('Treino C - braços');
    // Biblioteca (the accent-insensitive search finds "máquina"), catalog and a new exercise created from the search.
    await addFromPicker(page, 'maquina azul', /^Rosca na máquina azul/);
    await addFromPicker(page, 'Rosca 21', /^Rosca 21/);
    await addFromPicker(page, 'Tríceps no banco da praça', /Criar "Tríceps no banco da praça"/);
    await expect(editor(page).locator('.sheet-edit-item strong')).toHaveText([
      '1Rosca na máquina azul', '2Rosca 21', '3Tríceps no banco da praça'
    ]);

    // Sets: 4 reps fields; each set's reps and the teacher's note.
    const rosca = editorRow(page, 'Rosca na máquina azul');
    await rosca.getByLabel('Séries').fill('4');
    await rosca.getByLabel('Séries').blur();
    await expect(editorRepInputs(rosca)).toHaveCount(4);
    for (const [i, reps] of ['12', '10', '8', '8'].entries()) {
      await rosca.getByLabel(`Reps da ${i + 1}ª série`).fill(reps);
    }
    await rosca.getByLabel('Observação da professora').fill('pausa de 1s em cima');

    // Order: Rosca 21 goes up to first place; the new exercise leaves the sheet.
    await editorRow(page, 'Rosca 21').getByRole('button', { name: 'Subir exercício' }).click();
    await editorRow(page, 'Tríceps no banco da praça').getByRole('button', { name: 'Remover exercício' }).click();
    await expect(editor(page).locator('.sheet-edit-item strong')).toHaveText(['1Rosca 21', '2Rosca na máquina azul']);

    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const card = sheetCard(page, 'Treino C - braços');
    await expect(card.locator('.badge')).toHaveText('2 exercícios');
    await expect.poll(() => sheetItems(card)).toEqual(['1 Rosca 21 3 séries', '2 Rosca na máquina azul 4×12-10-8-8 pausa de 1s em cima']);

    // Saved linked to the exercises by id; the exercise created from the search stayed in Biblioteca.
    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino C - braços');
    expect(saved.active).toBe(true);
    expect(saved.exercises.map((e) => [e.exerciseId, e.name, e.sets, e.reps, e.note])).toEqual([
      [expect.any(Number), 'Rosca 21', 3, [null, null, null], ''],
      ['ex-rosca', 'Rosca na máquina azul', 4, [12, 10, 8, 8], 'pausa de 1s em cima']
    ]);
    expect((await storedRecords(page, 'exercises')).map((e) => e.name)).toContain('Tríceps no banco da praça');

    // The new sheet can already be chosen in Treinar.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino C - braços' });
    await expect(page.locator('#workoutExercises .ex-title')).toHaveText([/^Rosca 21/, /^Rosca na máquina azul/]);
  });

  test('edit a sheet: reps, note and removing an exercise', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await expect(page.locator('#sheetEditorTitle')).toHaveText('Editar ficha');
    await expect(page.locator('#sheetName')).toHaveValue('Treino A');

    const supino = editorRow(page, 'Supino reto');
    expect(await editorReps(supino)).toEqual(['12', '10', '8']);
    await supino.getByLabel('Reps da 3ª série').fill('6');
    await supino.getByLabel('Observação da professora').fill('descer em 3s');
    await editorRow(page, 'Remada baixa').getByRole('button', { name: 'Remover exercício' }).click();
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const card = sheetCard(page, 'Treino A');
    await expect(card.locator('.badge')).toHaveText('1 exercício');
    await expect.poll(() => sheetItems(card)).toEqual(['1 Supino reto 3×12-10-6 descer em 3s']);

    // Treinar uses the new sheet: reps 12-10-6, only the supino.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(page.locator('#workoutExercises .ex-title')).toHaveText([/^Supino reto/]);
    expect(await page.locator('#workoutExercises input[aria-label^="Reps da série"]').evaluateAll((els) => els.map((el) => el.value)))
      .toEqual(['12', '10', '6']);
  });

  test('rename: the new name appears in the list, in Treinar, in Início, in the detail and in the exercise history', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await page.locator('#sheetName').fill('Treino A - peito e costas');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    await expect.poll(() => listedSheetNames(page)).toEqual(['Treino A - peito e costas', 'Treino B', 'Treino Antigo']);

    await goTo(page, 'Treinar');
    await expect.poll(() => workoutSheetOptions(page)).toEqual(['Treino A - peito e costas', 'Treino B']);

    await goTo(page, 'Início');
    const rows = page.locator('#recentWorkouts .workout-row strong');
    await expect(rows).toHaveText(['Treino A - peito e costas', 'Treino A - peito e costas']);
    await rows.first().click();
    await expect(page.locator('#detailBody .detail-hero strong')).toHaveText('Treino A - peito e costas');

    await page.locator('#detailBody .ex-link', { hasText: 'Supino reto' }).click();
    await expect(page.locator('#exerciseHistory .badge').first()).toHaveText('Treino A - peito e costas');
  });

  test('a sheet with no exercises can be saved and shows how to add', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill('Treino E - a montar');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const card = sheetCard(page, 'Treino E - a montar');
    await expect(card.locator('.badge')).toHaveText('0 exercícios');
    await expect(card).toContainText('sem exercícios ainda — toque em ✏️ para adicionar');
  });

  test('a repeated name among active sheets is refused', async ({ page }) => {
    const alerts = collectAlerts(page);
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill('treino b');
    await page.locator('#sheetEditorSave').click();

    await expect.poll(() => alerts).toEqual(['Já existe uma ficha com esse nome.']);
    await expect(editor(page)).toBeVisible();
    expect((await storedRecords(page, 'sheets')).length).toBe(3);

    // Without a name it does not save either.
    await page.locator('#sheetName').fill('  ');
    await page.locator('#sheetEditorSave').click();
    await expect.poll(() => alerts).toEqual(['Já existe uma ficha com esse nome.', 'Informe o nome da ficha.']);
  });

  test('at most 20 sets per exercise', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino B').getByRole('button', { name: 'Editar ficha' }).click();
    const row = editorRow(page, 'Agachamento livre');
    await row.getByLabel('Séries').fill('500');
    await row.getByLabel('Séries').blur();
    await expect(editorRepInputs(row)).toHaveCount(20);
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino B');
    expect(saved.exercises[0].sets).toBe(20);
    expect(saved.exercises[0].reps).toHaveLength(20);
    expect(saved.exercises[0].reps.slice(0, 5)).toEqual([8, 8, 6, 6, null]);
  });

  test('the same exercise does not enter a sheet twice', async ({ page }) => {
    const alerts = collectAlerts(page);
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await addFromPicker(page, 'supino reto', /^Supino reto\s*Peito$/);

    await expect.poll(() => alerts).toEqual(['"Supino reto" já está nesta ficha. Aumente o número de séries dele.']);
    await expect(editor(page).locator('.sheet-edit-item')).toHaveCount(2);
  });
});

test.describe('Fichas · deactivate, reactivate and delete', () => {
  test('deactivating hides it from Treinar without deleting; reactivating brings it back', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino B').getByRole('button', { name: 'Desativar ficha' }).click();

    await expect(page.locator('#sheetsList h6')).toContainText('Desativadas (não aparecem no Treinar)');
    await expect.poll(() => listedSheetNames(page)).toEqual(['Treino A', 'Treino B', 'Treino Antigo']);
    await expect(page.locator('#sheetsList .opacity-50 strong')).toHaveText([/Treino B/, /Treino Antigo/]);
    await goTo(page, 'Treinar');
    await expect.poll(() => workoutSheetOptions(page)).toEqual(['Treino A']);

    await goTo(page, 'Fichas');
    await sheetCard(page, 'Treino B').getByRole('button', { name: 'Reativar ficha' }).click();
    await expect(page.locator('#sheetsList .opacity-50 strong')).toHaveText([/Treino Antigo/]);
    await goTo(page, 'Treinar');
    await expect.poll(() => workoutSheetOptions(page)).toEqual(['Treino A', 'Treino B']);
    expect((await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino B').exercises).toHaveLength(1);
  });

  test('reactivating with the same name as an active sheet is refused', async ({ page }) => {
    const alerts = collectAlerts(page);
    const backup = readFixture(BACKUP);
    backup.data.sheets.find((s) => s.id === 's-velha').name = 'Treino A';
    await sheetsWithBackup(page, backup);

    await page.locator('#sheetsList .opacity-50').getByRole('button', { name: 'Reativar ficha' }).click();
    await expect.poll(() => alerts).toEqual(['Já existe uma ficha ativa com esse nome. Renomeie uma delas antes de reativar.']);
    await expect(page.locator('#sheetsList .opacity-50 .card')).toHaveCount(1);
  });

  test('deleting removes the sheet from the list and from Treinar; the workouts already recorded stay', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Excluir ficha' }).click();

    await expect.poll(() => listedSheetNames(page)).toEqual(['Treino B', 'Treino Antigo']);
    await goTo(page, 'Treinar');
    await expect.poll(() => workoutSheetOptions(page)).toEqual(['Treino B']);
    await goTo(page, 'Início');
    await expect(page.locator('#recentWorkouts .workout-row strong')).toHaveText(['Treino A', 'Treino A']);
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
  });

  test('answering "Não" to deleting does not delete the sheet', async ({ page }) => {
    await sheetsWithBackup(page);
    const before = await listedSheetNames(page);
    const asked = await answerConfirm(page, false);

    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Excluir ficha' }).click();

    await expect.poll(asked).toEqual(['Excluir esta ficha? Os treinos já registrados não são afetados.']);
    await expect.poll(() => listedSheetNames(page)).toEqual(before);
    expect(await storedRecords(page, 'sheets')).toHaveLength(before.length);
  });
});

test.describe('Fichas · safety and touch', () => {
  test('a name with HTML appears as text (it does not become code on the screen)', async ({ page }) => {
    await sheetsWithBackup(page);
    const name = '<img src=x onerror="__xss=1"> Treino X';
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill(name);
    await addFromPicker(page, '<b>Remo</b>', 'Criar "<b>Remo</b>"');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    await expect(sheetCard(page, name)).toHaveCount(1);
    await expect(sheetCard(page, name).locator('.sheet-item-name')).toHaveText('<b>Remo</b>');
    await expect(page.locator('#sheetsList img, #sheetsList b')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    // Biblioteca is only redrawn when the Fichas tab is opened again.
    await goTo(page, 'Início');
    await goTo(page, 'Fichas');
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#exercisesList')).toContainText('<b>Remo</b>');
    await expect(page.locator('#exercisesList b')).toHaveCount(0);
  });

  test('icon-only buttons have a 44px touch area', async ({ page }) => {
    await sheetsWithBackup(page);
    const buttons = page.locator('#sheetsList .btn-sm[aria-label]');
    await expect(buttons).toHaveCount(9);
    const sizes = await buttons.evaluateAll((els) => els.map((el) => {
      const r = el.getBoundingClientRect();
      return [el.getAttribute('aria-label'), Math.round(r.width) >= 44 && Math.round(r.height) >= 44];
    }));
    expect(sizes.filter(([, ok]) => !ok)).toEqual([]);
  });
});

test.describe('Fichas · Create with AI', () => {
  const PASTED = JSON.stringify([
    {
      name: 'Treino D - costas',
      exercises: [
        { name: 'SUPINO RETO', sets: 4, reps: 10 },
        { name: 'Remada baixa na polia', sets: 3, reps: [12, 10, 8], note: 'pegada neutra' },
        { name: 'Voador invertido da academia', sets: 2 }
      ]
    }
  ]);

  test('the text for the AI brings the contract and the exercises from Biblioteca and the catalog', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await expect(importModal(page)).toBeVisible();
    await expect(page.locator('#sheetImportConfirm')).toHaveText('Revisar');

    const ia = page.locator('#iaText');
    await expect(ia).toHaveValue(/^# Contrato: ficha de treino em JSON \(Meu Treino\)/);
    const text = await ia.inputValue();
    expect(text).toContain('### Minha biblioteca\n- Agachamento livre (Pernas)\n- Remada baixa (Costas)\n' +
      '- Rosca na máquina azul (Bíceps)\n- Supino reto (Peito)\n');
    expect(text).toContain('### Catálogo do app\n- Abdominais (Abdômen)');

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#iaCopy').click();
    await expect(page.locator('#appToastBody')).toHaveText('Texto copiado!');
    // The Windows clipboard returns line breaks as CRLF.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('text that is not JSON shows the reason and imports nothing', async ({ page }) => {
    const alerts = collectAlerts(page);
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await page.locator('#sheetImportText').fill('Claro! Aqui está a sua ficha: [{ "name": ');
    await page.locator('#sheetImportConfirm').click();

    await expect.poll(() => alerts).toEqual([
      'Não deu para importar a ficha.\n\nO texto não é um JSON válido. Copie a resposta inteira da IA.'
    ]);
    await expect(page.locator('#sheetImportPaste')).toBeVisible();
    await expect(page.locator('#sheetImportConfirm')).toHaveText('Revisar');
    expect(await storedRecords(page, 'sheets')).toHaveLength(3);
  });

  test('paste, review with a similar-exercise suggestion and import', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await page.locator('#sheetImportText').fill('```json\n' + PASTED + '\n```');
    await page.locator('#sheetImportConfirm').click();

    // Review: the sheet, and a selector only for names without an exact match ("SUPINO RETO" already exists).
    const body = page.locator('#sheetImportBody');
    await expect(body).toContainText('Ficha encontrada');
    await expect(body.locator('.sheet-items li')).toHaveText([/Treino D - costas\s*3 exercícios/]);
    await expect(page.locator('#sheetImportPaste')).toBeHidden();
    await expect(page.locator('#sheetImportConfirm')).toHaveText('Importar');
    await expect(body.locator('.import-name')).toHaveText(['Remada baixa na polia', 'Voador invertido da academia']);
    // A strong match comes already chosen (Biblioteca before the catalog); with no strong match, "Criar novo".
    await expect(body.locator('#imp-0 option:checked')).toHaveText('Remada baixa (biblioteca)');
    await expect(body.locator('#imp-1 option:checked')).toHaveText('➕ Criar novo: Voador invertido da academia');

    await page.locator('#sheetImportConfirm').click();
    await expect(importModal(page)).toBeHidden();

    const card = sheetCard(page, 'Treino D - costas');
    await expect.poll(() => sheetItems(card)).toEqual([
      '1 Supino reto 4×10-10-10-10',
      '2 Remada baixa 3×12-10-8 pegada neutra',
      '3 Voador invertido da academia 2 séries'
    ]);
    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino D - costas');
    const library = await storedRecords(page, 'exercises');
    const created = library.find((e) => e.name === 'Voador invertido da academia');
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['ex-supino', 'ex-remada', created.id]);

    // The new exercise entered Biblioteca.
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#exercisesList')).toContainText('Voador invertido da academia');
  });

  test('a sheet with the name of an existing one enters as "(importada)"', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await page.locator('#sheetImportText').fill(JSON.stringify({ name: 'Treino A', exercises: [{ name: 'Supino reto' }] }));
    await page.locator('#sheetImportConfirm').click();
    await expect(page.locator('#sheetImportBody')).toContainText('Todos os exercícios já existem no app.');
    await page.locator('#sheetImportConfirm').click();
    await expect(importModal(page)).toBeHidden();

    // Active in the order they are saved (the imported one has a new id), the deactivated one at the end.
    const names = await listedSheetNames(page);
    expect(names.slice(0, 3).sort()).toEqual(['Treino A', 'Treino A (importada)', 'Treino B']);
    expect(names[3]).toBe('Treino Antigo');
  });
});
