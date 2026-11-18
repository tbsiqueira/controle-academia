// TEMPORÁRIO (issue #39): caminhos de erro e dados fora do normal, para a cobertura de linhas do js/app.js
// chegar a 100% durante a refatoração. As falhas são simuladas no próprio navegador (IndexedDB, Cache Storage,
// confirm), sem tocar nas funções do app. Desligamento: issue #40.
const { test, expect, freshApp, withBackup, storedDraft, goTo, RECARGA_DO_APP } = require('../helpers');
const { putRecords, reloadApp, failWritesTo, failDeletesIn, collectAlerts } = require('./util');

const BACKUP = 'treinar-backup.json';
const draftBanner = (page) => page.locator('#draftBanner');

test.describe('Rascunho · aparelho sem espaço (temporário)', () => {
  test('se o rascunho não grava no aparelho, o treino em andamento fica na memória e o app segue funcionando', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');
    await failWritesTo(page, 'settings');
    await page.locator('#workoutNotes').fill('sem espaço');

    await goTo(page, 'Início');
    await expect(draftBanner(page)).toContainText('Treino em andamento');
    expect(await storedDraft(page)).toBeNull();

    await draftBanner(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#workoutNotes')).toHaveValue('sem espaço');
  });

  test('se apagar o rascunho falha, cancelar o treino ainda limpa a tela', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');
    await page.locator('#workoutNotes').fill('vou desistir');
    await expect.poll(() => storedDraft(page)).not.toBeNull();

    await failDeletesIn(page, 'settings');
    await page.locator('#workoutCancel').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(draftBanner(page)).toBeEmpty();
  });

  test('rascunho antigo sem hora de gravação aparece sem "salvo às"', async ({ page }) => {
    await withBackup(page, BACKUP);
    await putRecords(page, 'settings', [{
      id: 'workoutDraft', editingWorkoutId: null, date: '2025-03-12', sheetId: 's-a',
      cardio: '', notes: 'rascunho de uma versão antiga', formSets: []
    }]);
    await reloadApp(page);

    await expect(draftBanner(page)).toContainText('Treino em andamento');
    await expect(draftBanner(page).locator('.small')).toHaveText('Treino novo · Treino A');
  });
});

test.describe('Criar exercício · aparelho sem espaço (temporário)', () => {
  test('no Treinar, "Criar" que não grava avisa o erro e não adiciona o exercício', async ({ page }) => {
    const alerts = collectAlerts(page);
    await freshApp(page);
    await goTo(page, 'Treinar');
    await page.locator('#btnAddExercise').click();
    await expect(page.locator('#exercisePickerModal')).toBeVisible();
    await page.locator('#pickerSearch').fill('Prancha com peso');
    await failWritesTo(page, 'exercises');
    await page.locator('#pickerResults').getByRole('button', { name: 'Criar "Prancha com peso"' }).click();

    await expect.poll(() => alerts).toEqual([expect.stringMatching(/^Erro ao criar exercício: .*sem espaço no aparelho/)]);
    await expect(page.locator('#exercisePickerModal')).toBeVisible();
    await expect(page.locator('#workoutExercises .card')).toHaveCount(0);
  });

  test('no cadastro da Biblioteca, "Criar" que não grava avisa o erro e não preenche o nome', async ({ page }) => {
    const alerts = collectAlerts(page);
    await withBackup(page, BACKUP);
    await goTo(page, 'Fichas');
    await page.locator('#tabExercisesBtn').click();
    await page.locator('#btnNewExercise').click();
    await page.locator('#btnFichaCatalog').click();
    await expect(page.locator('#fichaCatalogResults')).toContainText('Catálogo (pt-BR)');
    await page.locator('#fichaCatalogSearch').fill('Remada curvada na barra T');
    await failWritesTo(page, 'exercises');
    await page.locator('#fichaCatalogResults').getByRole('button', { name: 'Criar "Remada curvada na barra T"' }).click();

    await expect.poll(() => alerts).toEqual([expect.stringMatching(/^Erro ao criar exercício: .*sem espaço no aparelho/)]);
    await expect(page.locator('#fichaName')).toHaveValue('');
    await expect(page.locator('#fichaCatalogBox')).toBeVisible();
  });
});

test.describe('Exportar · navegador que falha ao perguntar se compartilha arquivos (temporário)', () => {
  test('se canShare dá erro, Exportar baixa o arquivo como no computador', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', {
        configurable: true,
        value: () => { throw new TypeError('canShare quebrado'); }
      });
    });
    await withBackup(page, BACKUP);
    await goTo(page, 'Mais');
    await expect(page.locator('#view-more')).toContainText('Baixa o arquivo .json do backup para guardar onde quiser.');

    const download = page.waitForEvent('download');
    await page.locator('#btnExport').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.json$/);
    await expect(page.locator('#backupAction')).toHaveText('Arquivo gerado: ' + file.suggestedFilename());
  });
});

test.describe('Erros inesperados (temporário)', () => {
  test('"Atualizar app" recarrega mesmo se limpar o cache falhar', { annotation: RECARGA_DO_APP }, async ({ page }) => {
    await freshApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.evaluate(() => {
      CacheStorage.prototype.keys = () => Promise.reject(new DOMException('bloqueado', 'SecurityError'));
    });
    await goTo(page, 'Mais');
    await page.evaluate(() => { window.__antesDeRecarregar = true; });

    const reloaded = page.waitForEvent('load');
    await page.locator('#btnForceUpdate').click();
    await reloaded;
    await expect(page.locator('#view-more')).toBeVisible();
    expect(await page.evaluate(() => window.__antesDeRecarregar)).toBeUndefined();
  });

  test('erro inesperado ao trocar a ficha mostra o aviso "Erro:" e o app continua', async ({ page }) => {
    const alerts = collectAlerts(page);
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);

    // Com exercícios no formulário, trocar a ficha pergunta antes; aqui a pergunta falha.
    await page.evaluate(() => { window.confirm = () => { throw new Error('pergunta bloqueada'); }; });
    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });

    await expect.poll(() => alerts).toEqual(['Erro: pergunta bloqueada']);
    await expect(page.locator('#workoutExercises .ex-title')).toHaveText([/^Supino reto/, /^Remada baixa/]);
  });
});
