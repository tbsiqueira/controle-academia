// Fichas e Criar com IA (issue #7): o caminho principal de cada funcionalidade da aba Fichas.
//
// Ponto de partida: `fixtures/treinar-backup.json`, importado pela tela Mais.
// - Treino A (ativa): Supino reto 3 séries (12-10-8) e Remada baixa 2 séries (10-10).
// - Treino B (ativa): Agachamento livre 4 séries (8-8-6-6).
// - Treino Antigo (desativada): Remada baixa 3 séries.
// - Biblioteca: Supino reto, Remada baixa, Agachamento livre e Rosca na máquina azul.
// - Treinos da Treino A em 03/03/2025 e 10/03/2025.
const { test, expect, withBackup, readFixture, storedRecords, goTo, answerConfirm } = require('./helpers');

const BACKUP = 'treinar-backup.json';

const sheetCards = (page) => page.locator('#sheetsList .card');
const editor = (page) => page.locator('#sheetEditorModal');
const importModal = (page) => page.locator('#sheetImportModal');

/** Card de uma ficha na lista, pelo nome exato. */
function sheetCard(page, name) {
  return sheetCards(page).filter({ has: page.locator('strong').getByText(name, { exact: true }) });
}

/** Nomes das fichas na lista, na ordem (ativas primeiro, depois as desativadas). */
function listedSheetNames(page) {
  return page.locator('#sheetsList .card strong').allTextContents().then((names) => names.map((n) => n.trim()));
}

/** Itens de uma ficha na lista: "1 Supino reto 3×12-10-8". */
function sheetItems(card) {
  return card.locator('.sheet-items li').evaluateAll((els) => els.map((el) =>
    [...el.querySelectorAll('span')].map((s) => s.textContent.trim()).join(' ')));
}

/** Linha de um exercício no editor de ficha, pelo nome. */
function editorRow(page, name) {
  return editor(page).locator('.sheet-edit-item').filter({ has: page.locator('strong', { hasText: name }) });
}

/** Campos de reps por série de uma linha do editor de ficha. */
const editorRepInputs = (row) => row.locator('input[aria-label$="ª série"]');

/** Valores dos campos de reps por série de uma linha do editor de ficha. */
function editorReps(row) {
  return editorRepInputs(row).evaluateAll((els) => els.map((el) => el.value));
}

/** Opções do seletor de ficha do Treinar (sem a opção vazia). */
async function workoutSheetOptions(page) {
  const labels = await page.locator('#workoutSheet option').allTextContents();
  return labels.map((l) => l.trim()).filter((l) => l && !/^Selecione/i.test(l) && !/^—/.test(l) && !/^Sem ficha/i.test(l));
}

/** Abre a aba Fichas com o backup importado. */
async function sheetsWithBackup(page, backup = BACKUP) {
  await withBackup(page, backup);
  await goTo(page, 'Fichas');
}

/** Junta as mensagens de alert() da página; cada uma é aceita. */
function collectAlerts(page) {
  const messages = [];
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'alert') messages.push(dialog.message());
    dialog.accept();
  });
  return messages;
}

/** No editor aberto: abre a busca de exercícios (se fechada), busca e toca no resultado. */
async function addFromPicker(page, query, result) {
  const box = page.locator('#sheetPickerBox');
  if (await box.isHidden()) {
    await editor(page).locator('#btnSheetAddExercise').click();
    // A busca abre vazia depois de carregar o catálogo: só então dá para digitar.
    await expect(page.locator('#sheetPickerResults')).toContainText('Catálogo (pt-BR)');
  }
  await page.locator('#sheetPickerSearch').fill(query);
  await page.locator('#sheetPickerResults').getByRole('button', { name: result }).first().click();
}

test.describe('Fichas · criar e editar', () => {
  test('criar ficha com exercícios da Biblioteca, do catálogo e um novo; séries, reps, observação e ordem', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('#sheetEditorTitle')).toHaveText('Nova ficha');
    await expect(page.locator('#sheetExerciseList')).toContainText('Nenhum exercício na ficha ainda');

    await page.locator('#sheetName').fill('Treino C - braços');
    // Biblioteca (busca sem acento acha "máquina"), catálogo e um exercício novo criado pela busca.
    await addFromPicker(page, 'maquina azul', /^Rosca na máquina azul/);
    await addFromPicker(page, 'Rosca 21', /^Rosca 21/);
    await addFromPicker(page, 'Tríceps no banco da praça', /Criar "Tríceps no banco da praça"/);
    await expect(editor(page).locator('.sheet-edit-item strong')).toHaveText([
      '1Rosca na máquina azul', '2Rosca 21', '3Tríceps no banco da praça'
    ]);

    // Séries: 4 campos de reps; reps de cada série e observação da professora.
    const rosca = editorRow(page, 'Rosca na máquina azul');
    await rosca.getByLabel('Séries').fill('4');
    await rosca.getByLabel('Séries').blur();
    await expect(editorRepInputs(rosca)).toHaveCount(4);
    for (const [i, reps] of ['12', '10', '8', '8'].entries()) {
      await rosca.getByLabel(`Reps da ${i + 1}ª série`).fill(reps);
    }
    await rosca.getByLabel('Observação da professora').fill('pausa de 1s em cima');

    // Ordem: a Rosca 21 sobe para o primeiro lugar; o exercício novo sai da ficha.
    await editorRow(page, 'Rosca 21').getByRole('button', { name: 'Subir exercício' }).click();
    await editorRow(page, 'Tríceps no banco da praça').getByRole('button', { name: 'Remover exercício' }).click();
    await expect(editor(page).locator('.sheet-edit-item strong')).toHaveText(['1Rosca 21', '2Rosca na máquina azul']);

    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const card = sheetCard(page, 'Treino C - braços');
    await expect(card.locator('.badge')).toHaveText('2 exercícios');
    expect(await sheetItems(card)).toEqual(['1 Rosca 21 3 séries', '2 Rosca na máquina azul 4×12-10-8-8 pausa de 1s em cima']);

    // Gravada ligada aos exercícios pelo id; o exercício criado pela busca ficou na Biblioteca.
    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino C - braços');
    expect(saved.active).toBe(true);
    expect(saved.exercises.map((e) => [e.exerciseId, e.name, e.sets, e.reps, e.note])).toEqual([
      [expect.any(Number), 'Rosca 21', 3, [null, null, null], ''],
      ['ex-rosca', 'Rosca na máquina azul', 4, [12, 10, 8, 8], 'pausa de 1s em cima']
    ]);
    expect((await storedRecords(page, 'exercises')).map((e) => e.name)).toContain('Tríceps no banco da praça');

    // A ficha nova já pode ser escolhida no Treinar.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino C - braços' });
    await expect(page.locator('#workoutExercises .ex-title')).toHaveText([/^Rosca 21/, /^Rosca na máquina azul/]);
  });

  test('editar ficha: reps, observação e tirar um exercício', async ({ page }) => {
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
    expect(await sheetItems(card)).toEqual(['1 Supino reto 3×12-10-6 descer em 3s']);

    // O Treinar usa a ficha nova: reps 12-10-6, só o supino.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(page.locator('#workoutExercises .ex-title')).toHaveText([/^Supino reto/]);
    expect(await page.locator('#workoutExercises input[aria-label^="Reps da série"]').evaluateAll((els) => els.map((el) => el.value)))
      .toEqual(['12', '10', '6']);
  });

  test('renomear: o nome novo aparece na lista, no Treinar, no Início, no detalhe e no histórico do exercício', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await page.locator('#sheetName').fill('Treino A - peito e costas');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    expect(await listedSheetNames(page)).toEqual(['Treino A - peito e costas', 'Treino B', 'Treino Antigo']);

    await goTo(page, 'Treinar');
    expect(await workoutSheetOptions(page)).toEqual(['Treino A - peito e costas', 'Treino B']);

    await goTo(page, 'Início');
    const rows = page.locator('#recentWorkouts .workout-row strong');
    await expect(rows).toHaveText(['Treino A - peito e costas', 'Treino A - peito e costas']);
    await rows.first().click();
    await expect(page.locator('#detailBody .detail-hero strong')).toHaveText('Treino A - peito e costas');

    await page.locator('#detailBody .ex-link', { hasText: 'Supino reto' }).click();
    await expect(page.locator('#exerciseHistory .badge').first()).toHaveText('Treino A - peito e costas');
  });

  test('ficha sem exercícios pode ser salva e mostra como adicionar', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill('Treino E - a montar');
    await page.locator('#sheetEditorSave').click();
    await expect(editor(page)).toBeHidden();

    const card = sheetCard(page, 'Treino E - a montar');
    await expect(card.locator('.badge')).toHaveText('0 exercícios');
    await expect(card).toContainText('sem exercícios ainda — toque em ✏️ para adicionar');
  });

  test('nome repetido entre as fichas ativas é recusado', async ({ page }) => {
    const alerts = collectAlerts(page);
    await sheetsWithBackup(page);
    await page.locator('#btnNewSheet').click();
    await page.locator('#sheetName').fill('treino b');
    await page.locator('#sheetEditorSave').click();

    await expect.poll(() => alerts).toEqual(['Já existe uma ficha com esse nome.']);
    await expect(editor(page)).toBeVisible();
    expect((await storedRecords(page, 'sheets')).length).toBe(3);

    // Sem nome também não salva.
    await page.locator('#sheetName').fill('  ');
    await page.locator('#sheetEditorSave').click();
    await expect.poll(() => alerts).toEqual(['Já existe uma ficha com esse nome.', 'Informe o nome da ficha.']);
  });

  test('no máximo 20 séries por exercício', async ({ page }) => {
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

  test('o mesmo exercício não entra duas vezes na ficha', async ({ page }) => {
    const alerts = collectAlerts(page);
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Editar ficha' }).click();
    await addFromPicker(page, 'supino reto', /^Supino reto\s*Peito$/);

    await expect.poll(() => alerts).toEqual(['"Supino reto" já está nesta ficha. Aumente o número de séries dele.']);
    await expect(editor(page).locator('.sheet-edit-item')).toHaveCount(2);
  });
});

test.describe('Fichas · desativar, reativar e excluir', () => {
  test('desativar esconde do Treinar sem apagar; reativar traz de volta', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino B').getByRole('button', { name: 'Desativar ficha' }).click();

    await expect(page.locator('#sheetsList h6')).toContainText('Desativadas (não aparecem no Treinar)');
    expect(await listedSheetNames(page)).toEqual(['Treino A', 'Treino B', 'Treino Antigo']);
    await expect(page.locator('#sheetsList .opacity-50 strong')).toHaveText([/Treino B/, /Treino Antigo/]);
    await goTo(page, 'Treinar');
    expect(await workoutSheetOptions(page)).toEqual(['Treino A']);

    await goTo(page, 'Fichas');
    await sheetCard(page, 'Treino B').getByRole('button', { name: 'Reativar ficha' }).click();
    await expect(page.locator('#sheetsList .opacity-50 strong')).toHaveText([/Treino Antigo/]);
    await goTo(page, 'Treinar');
    expect(await workoutSheetOptions(page)).toEqual(['Treino A', 'Treino B']);
    expect((await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino B').exercises).toHaveLength(1);
  });

  test('reativar com o mesmo nome de uma ficha ativa é recusado', async ({ page }) => {
    const alerts = collectAlerts(page);
    const backup = readFixture(BACKUP);
    backup.data.sheets.find((s) => s.id === 's-velha').name = 'Treino A';
    await sheetsWithBackup(page, backup);

    await page.locator('#sheetsList .opacity-50').getByRole('button', { name: 'Reativar ficha' }).click();
    await expect.poll(() => alerts).toEqual(['Já existe uma ficha ativa com esse nome. Renomeie uma delas antes de reativar.']);
    await expect(page.locator('#sheetsList .opacity-50 .card')).toHaveCount(1);
  });

  test('excluir tira a ficha da lista e do Treinar; os treinos já registrados ficam', async ({ page }) => {
    await sheetsWithBackup(page);
    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Excluir ficha' }).click();

    expect(await listedSheetNames(page)).toEqual(['Treino B', 'Treino Antigo']);
    await goTo(page, 'Treinar');
    expect(await workoutSheetOptions(page)).toEqual(['Treino B']);
    await goTo(page, 'Início');
    await expect(page.locator('#recentWorkouts .workout-row strong')).toHaveText(['Treino A', 'Treino A']);
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
  });

  test('responder "Não" ao excluir não apaga a ficha', async ({ page }) => {
    await sheetsWithBackup(page);
    const before = await listedSheetNames(page);
    const asked = await answerConfirm(page, false);

    await sheetCard(page, 'Treino A').getByRole('button', { name: 'Excluir ficha' }).click();

    await expect.poll(asked).toEqual(['Excluir esta ficha? Os treinos já registrados não são afetados.']);
    expect(await listedSheetNames(page)).toEqual(before);
    expect(await storedRecords(page, 'sheets')).toHaveLength(before.length);
  });
});

test.describe('Fichas · segurança e toque', () => {
  test('nome com HTML aparece como texto (não vira código na tela)', async ({ page }) => {
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
    // A Biblioteca só é redesenhada ao abrir a aba Fichas de novo.
    await goTo(page, 'Início');
    await goTo(page, 'Fichas');
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#exercisesList')).toContainText('<b>Remo</b>');
    await expect(page.locator('#exercisesList b')).toHaveCount(0);
  });

  test('botões só com ícone têm área de toque de 44px', async ({ page }) => {
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

test.describe('Fichas · Criar com IA', () => {
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

  test('o texto para a IA traz o contrato e os exercícios da Biblioteca e do catálogo', async ({ page }) => {
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
    // A área de transferência do Windows devolve as quebras de linha como CRLF.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('texto que não é JSON mostra o motivo e não importa nada', async ({ page }) => {
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

  test('colar, revisar com sugestão de exercício parecido e importar', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await page.locator('#sheetImportText').fill('```json\n' + PASTED + '\n```');
    await page.locator('#sheetImportConfirm').click();

    // Revisão: a ficha, e um seletor só para os nomes sem par exato ("SUPINO RETO" já existe).
    const body = page.locator('#sheetImportBody');
    await expect(body).toContainText('Ficha encontrada');
    await expect(body.locator('.sheet-items li')).toHaveText([/Treino D - costas\s*3 exercícios/]);
    await expect(page.locator('#sheetImportPaste')).toBeHidden();
    await expect(page.locator('#sheetImportConfirm')).toHaveText('Importar');
    await expect(body.locator('.import-name')).toHaveText(['Remada baixa na polia', 'Voador invertido da academia']);
    // Parecido forte já vem escolhido (Biblioteca antes do catálogo); sem parecido forte, "Criar novo".
    await expect(body.locator('#imp-0 option:checked')).toHaveText('Remada baixa (biblioteca)');
    await expect(body.locator('#imp-1 option:checked')).toHaveText('➕ Criar novo: Voador invertido da academia');

    await page.locator('#sheetImportConfirm').click();
    await expect(importModal(page)).toBeHidden();

    const card = sheetCard(page, 'Treino D - costas');
    expect(await sheetItems(card)).toEqual([
      '1 Supino reto 4×10-10-10-10',
      '2 Remada baixa 3×12-10-8 pegada neutra',
      '3 Voador invertido da academia 2 séries'
    ]);
    const saved = (await storedRecords(page, 'sheets')).find((s) => s.name === 'Treino D - costas');
    const library = await storedRecords(page, 'exercises');
    const created = library.find((e) => e.name === 'Voador invertido da academia');
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['ex-supino', 'ex-remada', created.id]);

    // O exercício novo entrou na Biblioteca.
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#exercisesList')).toContainText('Voador invertido da academia');
  });

  test('ficha com o nome de uma que já existe entra como "(importada)"', async ({ page }) => {
    await sheetsWithBackup(page);
    await page.locator('#btnImportSheet').click();
    await page.locator('#sheetImportText').fill(JSON.stringify({ name: 'Treino A', exercises: [{ name: 'Supino reto' }] }));
    await page.locator('#sheetImportConfirm').click();
    await expect(page.locator('#sheetImportBody')).toContainText('Todos os exercícios já existem no app.');
    await page.locator('#sheetImportConfirm').click();
    await expect(importModal(page)).toBeHidden();

    // Ativas na ordem em que estão gravadas (a importada tem id novo), a desativada no fim.
    const names = await listedSheetNames(page);
    expect(names.slice(0, 3).sort()).toEqual(['Treino A', 'Treino A (importada)', 'Treino B']);
    expect(names[3]).toBe('Treino Antigo');
  });
});
