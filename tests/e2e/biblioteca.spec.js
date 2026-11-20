// Biblioteca and catalog (issue #7): the main path of every feature on the Fichas → Biblioteca tab.
//
// Starting point: `fixtures/treinar-backup.json`, imported through the Mais screen.
// - Biblioteca: Supino reto (Peito), Remada baixa (Costas), Agachamento livre (Pernas), Rosca na máquina azul (Bíceps).
// - Treino A uses Supino reto and Remada baixa; Treino B uses Agachamento livre; Treino Antigo (deactivated) uses Remada.
// - Workouts of Treino A on 03/03/2025 and 10/03/2025, with Supino reto (and Remada in the last one).
const { test, expect, freshApp, withBackup, storedRecords, goTo, answerConfirm } = require('./helpers');

const BACKUP = 'treinar-backup.json';

const libraryCards = (page) => page.locator('#exercisesList .card');
const libraryNames = (page) => page.locator('#exercisesList .card strong');
const exerciseForm = (page) => page.locator('#exerciseFormModal');

/** Card of a Biblioteca exercise, by exact name. */
function libraryCard(page, name) {
  return libraryCards(page).filter({ has: page.locator('strong').getByText(name, { exact: true }) });
}

/** Opens Fichas → Biblioteca with the backup imported. */
async function libraryWithBackup(page) {
  await withBackup(page, BACKUP);
  await openLibrary(page);
}

async function openLibrary(page) {
  await goTo(page, 'Fichas');
  await page.locator('#tabExercisesBtn').click();
  await expect(page.locator('#tabExercises')).toBeVisible();
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

/** Writes records straight to the app's IndexedDB (to simulate data from an older version). */
function putRecords(page, store, records) {
  return page.evaluate(([storeName, list]) => new Promise((resolve, reject) => {
    const open = indexedDB.open('meu-treino');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, 'readwrite');
      list.forEach((r) => tx.objectStore(storeName).put(r));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), [store, records]);
}

test.describe('Biblioteca · list and search', () => {
  test('only the person\'s exercises, with the sheets that use each one; the catalog stays out', async ({ page }) => {
    await libraryWithBackup(page);
    await expect(libraryNames(page)).toHaveText(['Agachamento livre', 'Remada baixa', 'Rosca na máquina azul', 'Supino reto']);
    await expect(libraryCard(page, 'Remada baixa')).toContainText('Costas');
    await expect(libraryCard(page, 'Remada baixa')).toContainText('usada em: Treino A, Treino Antigo');
    await expect(libraryCard(page, 'Rosca na máquina azul')).toContainText('não usada em nenhuma ficha');
  });

  test('with an empty database, Biblioteca explains that the catalog does not enter the list', async ({ page }) => {
    await freshApp(page);
    await openLibrary(page);
    await expect(page.locator('#exercisesList')).toHaveText(
      ' Nenhum exercício aqui. Crie um novo — os exercícios do catálogo não entram nesta lista.');
    await expect(page.locator('#libraryGroupFilter button')).toHaveCount(0);
  });

  test('filter by muscle group', async ({ page }) => {
    await libraryWithBackup(page);
    const chips = page.locator('#libraryGroupFilter button');
    await expect(chips).toHaveText(['Todos', 'Bíceps', 'Costas', 'Peito', 'Pernas']);
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');

    await chips.filter({ hasText: 'Costas' }).click();
    await expect(chips.filter({ hasText: 'Costas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(libraryNames(page)).toHaveText(['Remada baixa']);

    await chips.filter({ hasText: 'Todos' }).click();
    await expect(libraryNames(page)).toHaveCount(4);
  });

  test('search without accents and case-insensitive', async ({ page }) => {
    await libraryWithBackup(page);
    const search = page.locator('#librarySearch');

    await search.fill('MAQUINA');
    await expect(libraryNames(page)).toHaveText(['Rosca na máquina azul']);
    await search.fill('remada');
    await expect(libraryNames(page)).toHaveText(['Remada baixa']);
    await search.fill('crucifixo');
    await expect(libraryCards(page)).toHaveCount(0);
    await expect(page.locator('#exercisesList')).toContainText('Nenhum exercício aqui.');
    await search.fill('');
    await expect(libraryNames(page)).toHaveCount(4);
  });
});

test.describe('Biblioteca · create, rename and delete', () => {
  test('create an exercise with group and the teacher\'s correction', async ({ page }) => {
    const alerts = collectAlerts(page);
    await libraryWithBackup(page);
    await page.locator('#btnNewExercise').click();
    await expect(exerciseForm(page)).toBeVisible();
    await expect(page.locator('#exerciseFormTitle')).toHaveText('Novo exercício');

    // Without a name it does not save.
    await page.locator('#exerciseFormSave').click();
    await expect.poll(() => alerts).toEqual(['Informe o nome do exercício.']);

    await page.locator('#fichaName').fill('Elevação lateral no cabo');
    await page.locator('#fichaGroup').selectOption('Ombros');
    await page.locator('#fichaCorrection').fill('cotovelo levemente dobrado');
    await page.locator('#exerciseFormSave').click();
    await expect(exerciseForm(page)).toBeHidden();

    const card = libraryCard(page, 'Elevação lateral no cabo');
    await expect(card.locator('.badge')).toHaveText('Ombros');
    await expect(card).toContainText('cotovelo levemente dobrado');
    await expect(card).toContainText('não usada em nenhuma ficha');
    const saved = (await storedRecords(page, 'exercises')).find((e) => e.name === 'Elevação lateral no cabo');
    expect(saved).toMatchObject({ group: 'Ombros', source: 'custom', correction: 'cotovelo levemente dobrado', active: true });
  });

  test('in the form, searching the catalog fills name and group; "Criar" uses the typed name', async ({ page }) => {
    await libraryWithBackup(page);
    await page.locator('#btnNewExercise').click();
    await page.locator('#btnFichaCatalog').click();
    await expect(page.locator('#fichaCatalogBox')).toBeVisible();
    await expect(page.locator('#fichaCatalogResults')).toContainText('Catálogo (pt-BR)');
    // The form's search shows only the catalog (Biblioteca is already this list).
    await expect(page.locator('#fichaCatalogResults')).not.toContainText('Biblioteca');

    await page.locator('#fichaCatalogSearch').fill('rosca 21');
    await page.locator('#fichaCatalogResults').getByRole('button', { name: /^Rosca 21/ }).click();
    await expect(page.locator('#fichaCatalogBox')).toBeHidden();
    await expect(page.locator('#fichaName')).toHaveValue('Rosca 21');
    await expect(page.locator('#fichaGroup')).toHaveValue('Bíceps');
    await page.locator('#exerciseFormSave').click();
    await expect(libraryCard(page, 'Rosca 21').locator('.badge')).toHaveText('Bíceps');

    await page.locator('#btnNewExercise').click();
    await page.locator('#btnFichaCatalog').click();
    await page.locator('#fichaCatalogSearch').fill('Remada curvada na barra T');
    await page.locator('#fichaCatalogResults').getByRole('button', { name: 'Criar "Remada curvada na barra T"' }).click();
    await expect(page.locator('#fichaName')).toHaveValue('Remada curvada na barra T');
    await expect(page.locator('#fichaGroup')).toHaveValue('Outros');
  });

  test('rename: sheets, history and Treinar show the new name, and the history stays linked by id', async ({ page }) => {
    await libraryWithBackup(page);
    await libraryCard(page, 'Supino reto').getByRole('button', { name: 'Editar exercício' }).click();
    await expect(page.locator('#exerciseFormTitle')).toHaveText('Editar exercício');
    await expect(page.locator('#fichaName')).toHaveValue('Supino reto');
    await expect(page.locator('#fichaGroup')).toHaveValue('Peito');
    await page.locator('#fichaName').fill('Supino reto com barra');
    await page.locator('#exerciseFormSave').click();
    await expect(exerciseForm(page)).toBeHidden();
    await expect(libraryCard(page, 'Supino reto com barra')).toContainText('usada em: Treino A');

    // Sheet and workouts saved with the new name, the same id.
    const sheetA = (await storedRecords(page, 'sheets')).find((s) => s.id === 's-a');
    expect(sheetA.exercises[0]).toMatchObject({ exerciseId: 'ex-supino', name: 'Supino reto com barra' });
    const workouts = await storedRecords(page, 'workouts');
    expect(workouts.flatMap((w) => w.sets).filter((s) => s.exerciseId === 'ex-supino')
      .every((s) => s.exerciseName === 'Supino reto com barra')).toBe(true);

    // The sheet list is only redrawn when the Fichas tab is opened again.
    await goTo(page, 'Início');
    await goTo(page, 'Fichas');
    await expect(page.locator('#sheetsList')).toContainText('Supino reto com barra');

    // Exercise history: both old workouts are still there, with the new name.
    await goTo(page, 'Início');
    await page.locator('#recentWorkouts .workout-row').first().click();
    const link = page.locator('#detailBody .ex-link', { hasText: 'Supino reto com barra' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('#exerciseHistoryTitle')).toHaveText('Supino reto com barra');
    await expect(page.locator('#exerciseHistory .history-head .chip')).toContainText('2 treinos');

    // Treinar: the sheet loads the exercise with the new name and the load from last time.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(page.locator('#workoutExercises .ex-title').first()).toContainText('Supino reto com barra');
    await expect(page.locator('#workoutExercises input[aria-label="Carga da série 1"]').first()).toHaveValue('40');
  });

  test('delete an exercise', async ({ page }) => {
    await libraryWithBackup(page);
    await libraryCard(page, 'Rosca na máquina azul').getByRole('button', { name: 'Excluir exercício' }).click();
    await expect(libraryNames(page)).toHaveText(['Agachamento livre', 'Remada baixa', 'Supino reto']);
    expect((await storedRecords(page, 'exercises')).map((e) => e.id).sort()).toEqual(['ex-agachamento', 'ex-remada', 'ex-supino']);
  });

  test('answering "Não" to deleting an exercise deletes nothing', async ({ page }) => {
    await libraryWithBackup(page);
    const asked = await answerConfirm(page, false);

    await libraryCard(page, 'Rosca na máquina azul').getByRole('button', { name: 'Excluir exercício' }).click();

    await expect.poll(asked).toEqual(['Excluir este exercício?']);
    await expect(libraryNames(page)).toHaveText(['Agachamento livre', 'Remada baixa', 'Rosca na máquina azul', 'Supino reto']);
    expect(await storedRecords(page, 'exercises')).toHaveLength(4);
  });
});

test.describe('Biblioteca · old database', () => {
  test('data from the era without ids survives opening the app: sheets linked, Biblioteca repaired, history by name', async ({ page }) => {
    await freshApp(page);
    // How an old version saved it: sets and sheet items with only the name; a user exercise marked as
    // "catalog" without proof (old versions hid it from Biblioteca).
    await putRecords(page, 'exercises', [
      { id: 'e1', name: 'Puxada frente supinada', group: 'Costas', source: 'custom' },
      { id: 'e2', name: 'Remada baixa', group: 'Costas', source: 'custom' },
      { id: 'e3', name: 'Leg press 45', group: 'Pernas', source: 'catalog' }
    ]);
    await putRecords(page, 'sheets', [{
      id: 's1', name: 'TREINO A', active: true,
      exercises: [
        { exerciseId: null, name: 'Puxada frente', sets: 2, reps: [12, 10], note: '' },
        { exerciseId: null, name: 'Remada baixa', sets: 1, reps: [12], note: '' }
      ]
    }]);
    await putRecords(page, 'workouts', [
      {
        id: 'w1', date: '2026-09-20', sheetId: null, sheetName: 'TREINO A',
        sets: [
          { exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40, rir: 2, exerciseNote: '', note: '' },
          { exerciseId: null, exerciseName: 'Puxada frente', number: 2, reps: 10, load: 45, rir: 1, exerciseNote: '', note: 'caiu' },
          { exerciseId: null, exerciseName: 'Remada baixa', number: 1, reps: 12, load: 30, rir: 2, exerciseNote: '', note: '' }
        ],
        warmups: [{ exerciseId: null, exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }]
      },
      {
        id: 'w2', date: '2026-09-27', sheetId: null, sheetName: 'TREINO A',
        sets: [{ exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 42.5, rir: 2, exerciseNote: '', note: '' }]
      }
    ]);
    await page.reload();
    await expect(page.locator('#weekProgress .week-card')).toBeVisible();

    // Biblioteca: the exercise hidden by old versions appears (and is saved as a user exercise).
    await openLibrary(page);
    await expect(libraryNames(page)).toHaveText(['Puxada frente supinada', 'Remada baixa', 'Leg press 45']);
    expect((await storedRecords(page, 'exercises')).find((e) => e.id === 'e3').source).toBe('custom');

    // Sheet: no item is lost; only the name that matches unambiguously gets the id.
    await page.locator('#tabSheetsBtn').click();
    await expect(page.locator('#sheetsList .sheet-item-name')).toHaveText(['Puxada frente', 'Remada baixa']);
    const sheet = (await storedRecords(page, 'sheets'))[0];
    expect(sheet.exercises.map((e) => e.exerciseId)).toEqual([null, 'e2']);

    // History by the stored name: both workouts, with sets, load and warm-up.
    await goTo(page, 'Início');
    await page.locator('#recentWorkouts .workout-row').last().click();
    await expect(page.locator('#detailBody')).toContainText('Aquecimento: 15 reps · 20 kg · RIR 3');
    await page.locator('#detailBody .ex-link', { hasText: 'Puxada frente' }).click();
    await expect(page.locator('#exerciseHistory .history-head .chip')).toContainText('2 treinos');
    await expect(page.locator('#exerciseHistory .history-head')).toContainText('45 kg');
  });
});
