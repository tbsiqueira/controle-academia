// Início (tela crítica), issue #19. Cada comportamento tem o seu teste (documentation/REFACTOR.md, seção 4).
//
// Ponto de partida da maioria dos testes: `fixtures/inicio-backup.json`, importado pela tela Mais, com o relógio
// da página parado em 20/05/2026 (quarta), 10:00 de Brasília.
// - Semana ativa: 18/05 a 24/05/2026, metas de 3 treinos e 120 min de cardio.
// - Treinos: 19/05 Treino A (30 min de cardio), 18/05 Treino B (15 min; gravado quando a ficha se chamava
//   "Pernas") e 17/05 Treino A (40 min), que fica FORA da semana.
// - Fichas: Treino A e Treino B ativas, Treino C desativada.
// - Último backup: 19/05/2026 (em dia).
const path = require('path');
const { test, expect, freshApp, withBackup, readFixture, storedDraft, goTo } = require('./helpers');

const BACKUP = 'inicio-backup.json';
const TODAY = '2026-05-20T10:00:00-03:00';

/** Para o relógio da página num dia e hora (os timers continuam rodando). Chamar antes de abrir o app. */
function at(page, isoDateTime) {
  return page.clock.setFixedTime(new Date(isoDateTime));
}

/** Importa o backup do Início (ou uma variação dele) com o relógio em 20/05/2026. */
async function homeWith(page, backup = BACKUP) {
  await at(page, TODAY);
  await withBackup(page, backup);
}

const weekCard = (page) => page.locator('#weekProgress .week-card');
const weekNumbers = (page) => page.locator('#weekProgress .week-stat .stat-big');
const quickStart = (page) => page.locator('#quickStart');
const draftBanner = (page) => page.locator('#draftBanner');
const backupReminder = (page) => page.locator('#backupReminder');
const workoutRows = (page) => page.locator('#recentWorkouts .workout-row');

/** Nome da ficha e data de cada linha da lista de treinos, na ordem da tela (tirados do texto para leitor de tela). */
async function listedWorkouts(page) {
  const labels = await workoutRows(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  return labels.map((label) => label.split(', ').slice(0, 2).join(', '));
}

/** Começa um treino da Treino B pelo Treinar, com carga digitada, e volta ao Início. O rascunho fica gravado. */
async function startDraft(page) {
  await goTo(page, 'Treinar');
  await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
  await page.locator('#workoutExercises input[aria-label="Carga da série 1"]').fill('62,5');
  await expect.poll(async () => (await storedDraft(page))?.formSets?.[0]?.sets?.[0]?.load).toBe('62,5');
  await goTo(page, 'Início');
}

test.describe('Início · vazio', () => {
  test('primeiro uso sem dados: estado vazio correto, sem erro no console', async ({ page }) => {
    await at(page, TODAY);
    await freshApp(page);

    await expect(draftBanner(page)).toBeEmpty();
    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('Semana ativa');
    await expect(weekCard(page)).toContainText('20/05 – 26/05');
    await expect(weekNumbers(page)).toHaveText(['0/3', '0/120']);
    await expect(weekCard(page)).not.toContainText('Meta batida');
    await expect(quickStart(page)).toBeEmpty();
    await expect(backupReminder(page)).toBeEmpty();
    await expect(page.locator('#recentWorkouts')).toHaveText(
      'Nenhum treino registrado ainda. Toque em Treinar para começar.');
    await expect(workoutRows(page)).toHaveCount(0);
    // Erros no console reprovam o teste pelo fixture `appErrors` (helpers.js).
  });
});

test.describe('Início · aviso do rascunho', () => {
  test('aparece com um treino em andamento e descreve o rascunho', async ({ page }) => {
    await homeWith(page);
    await expect(draftBanner(page)).toBeEmpty();

    await startDraft(page);

    await expect(draftBanner(page)).toContainText('Treino em andamento (não salvo)');
    await expect(draftBanner(page).locator('.small')).toHaveText('Treino novo · Treino B · salvo hoje às 10:00');
    await expect(draftBanner(page).getByRole('button', { name: 'Continuar' })).toBeVisible();
    await expect(draftBanner(page).getByRole('button', { name: 'Descartar' })).toBeVisible();
  });

  test('Continuar abre o Treinar com o rascunho', async ({ page }) => {
    await homeWith(page);
    await startDraft(page);

    await draftBanner(page).getByRole('button', { name: 'Continuar' }).click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises input[aria-label="Carga da série 1"]')).toHaveValue('62,5');
  });

  test('Descartar remove o rascunho e o aviso', async ({ page }) => {
    await homeWith(page);
    await startDraft(page);

    await draftBanner(page).getByRole('button', { name: 'Descartar' }).click();

    await expect(draftBanner(page)).toBeEmpty();
    await expect.poll(() => storedDraft(page)).toBeNull();
    // Nada volta depois de recarregar, e o Treinar abre vazio.
    await page.reload();
    await expect(weekCard(page)).toBeVisible();
    await expect(draftBanner(page)).toBeEmpty();
    await goTo(page, 'Treinar');
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#draftNotice')).toBeEmpty();
  });
});

test.describe('Início · semana e metas', () => {
  test('progresso das metas: treinos e minutos de cardio, com as barras', async ({ page }) => {
    await homeWith(page);

    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('18/05 – 24/05');
    // 19/05 e 18/05 contam; 17/05 é da semana anterior.
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
    await expect(weekCard(page)).not.toContainText('Meta batida');

    const workoutsBar = page.getByRole('progressbar', { name: 'Meta de treinos' });
    const cardioBar = page.getByRole('progressbar', { name: 'Meta de cardio' });
    await expect(workoutsBar).toHaveAttribute('aria-valuenow', '67');
    await expect(cardioBar).toHaveAttribute('aria-valuenow', '38');
    await expect(workoutsBar.locator('.progress-bar')).toHaveAttribute('style', 'width: 67%');
    await expect(cardioBar.locator('.progress-bar')).toHaveAttribute('style', 'width: 38%');
  });

  test('meta batida: selo e barras cheias (sem passar de 100%)', async ({ page }) => {
    const backup = readFixture(BACKUP);
    backup.data.settings.weeklyWorkoutTarget = 2;
    backup.data.settings.weeklyCardioTarget = 30;
    await homeWith(page, backup);

    await expect(weekNumbers(page)).toHaveText(['2/2', '45/30']);
    await expect(weekCard(page)).toContainText('Meta batida');
    await expect(page.getByRole('progressbar', { name: 'Meta de treinos' })).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByRole('progressbar', { name: 'Meta de cardio' })).toHaveAttribute('aria-valuenow', '100');
  });

  test('treino com data fora da janela da semana não conta na semana atual (e não se perde)', async ({ page }) => {
    await homeWith(page);

    // O treino de 17/05 (40 min de cardio) não entra na conta da semana de 18/05...
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
    // ...mas continua salvo e na lista.
    expect(await listedWorkouts(page)).toContain('Treino A, 17/05/2026');
    await expect(page.locator('#recentWorkouts .section-head .chip')).toHaveText('3 treinos');
  });

  test('aviso de semana encerrada depois de 7 dias, com o resultado final', async ({ page }) => {
    await at(page, '2026-05-25T10:00:00-03:00');
    await withBackup(page, BACKUP);

    await expect(page.locator('#weekBanner')).toContainText('Semana encerrada! 18/05/2026 – 24/05/2026.');
    await expect(page.getByRole('button', { name: 'Iniciar próxima semana' })).toBeVisible();
    // O card continua mostrando a semana que acabou, com o resultado final.
    await expect(weekCard(page)).toContainText('18/05 – 24/05');
    await expect(weekNumbers(page)).toHaveText(['2/3', '45/120']);
  });

  test('confirmar o aviso avança para a próxima janela', async ({ page }) => {
    await at(page, '2026-05-25T10:00:00-03:00');
    await withBackup(page, BACKUP);

    await page.getByRole('button', { name: 'Iniciar próxima semana' }).click();

    await expect(page.locator('#weekBanner')).toBeEmpty();
    await expect(weekCard(page)).toContainText('25/05 – 31/05');
    await expect(weekNumbers(page)).toHaveText(['0/3', '0/120']);
    await expect(workoutRows(page)).toHaveCount(3);

    // A nova janela fica gravada no aparelho.
    await page.reload();
    await expect(weekCard(page)).toContainText('25/05 – 31/05');
    await expect(page.locator('#weekBanner')).toBeEmpty();
  });
});

test.describe('Início · atalho Treinar', () => {
  test('"Treinar: <ficha>" sugere a próxima ficha da rotina e abre o Treinar com ela carregada', async ({ page }) => {
    await homeWith(page);

    // O último treino foi da Treino A: a próxima é a Treino B.
    const button = quickStart(page).getByRole('button', { name: 'Treinar: Treino B' });
    await expect(button).toBeVisible();
    await expect(button).toContainText('Treinar agora');

    await button.click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises .card .ex-title')).toHaveText([/^Agachamento livre/]);
    const reps = await page.locator('#workoutExercises input[aria-label^="Reps da série"]')
      .evaluateAll((els) => els.map((el) => el.value));
    expect(reps).toEqual(['8', '8', '6']);
  });

  test('some enquanto existe um rascunho', async ({ page }) => {
    await homeWith(page);
    await expect(quickStart(page).getByRole('button', { name: /^Treinar: / })).toBeVisible();

    await startDraft(page);
    await expect(draftBanner(page)).not.toBeEmpty();
    await expect(quickStart(page)).toBeEmpty();

    // Descartou o rascunho: o atalho volta.
    await draftBanner(page).getByRole('button', { name: 'Descartar' }).click();
    await expect(quickStart(page).getByRole('button', { name: 'Treinar: Treino B' })).toBeVisible();
  });

  test('fichas desativadas não são sugeridas', async ({ page }) => {
    // Último treino da Treino B: em ordem, a próxima seria a Treino C, que está desativada. Volta para a Treino A.
    const backup = readFixture(BACKUP);
    backup.data.workouts.find((w) => w.id === 'w-ter').sheetId = 's-b';
    await homeWith(page, backup);

    await expect(quickStart(page).getByRole('button')).toHaveAccessibleName('Treinar: Treino A');
  });
});

test.describe('Início · lembrete de backup', () => {
  test('aparece quando nunca houve backup', async ({ page }) => {
    const backup = readFixture(BACKUP);
    delete backup.data.settings.lastBackupAt;
    await homeWith(page, backup);

    await expect(backupReminder(page)).toContainText('Backup pendente');
    await expect(backupReminder(page)).toContainText('Você ainda não fez nenhum backup.');
    await expect(backupReminder(page).getByRole('button', { name: 'Fazer' })).toBeVisible();
  });

  test('aparece quando o último backup está velho; some quando está em dia', async ({ page }) => {
    const old = readFixture(BACKUP);
    old.data.settings.lastBackupAt = '2026-05-11T15:00:00.000Z';
    await homeWith(page, old);
    await expect(backupReminder(page)).toContainText('Backup pendente');
    await expect(backupReminder(page)).toContainText('Último backup: 11/05/2026');
    await expect(backupReminder(page)).toContainText('(há 8 dias)');

    // O backup da fixture é de ontem: em dia, sem lembrete.
    await goTo(page, 'Mais');
    await page.locator('#importFile').setInputFiles(path.join(__dirname, 'fixtures', BACKUP));
    await expect(page.locator('#appToastBody')).toContainText('Backup importado');
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(weekCard(page)).toBeVisible();
    await expect(backupReminder(page)).toBeEmpty();
  });

  test('some depois de fazer um backup', async ({ page }) => {
    // Sem o menu de compartilhar, o backup vira um download (o caminho do computador).
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
    });
    const backup = readFixture(BACKUP);
    delete backup.data.settings.lastBackupAt;
    await homeWith(page, backup);
    await expect(backupReminder(page)).toContainText('Backup pendente');

    const download = page.waitForEvent('download');
    await backupReminder(page).getByRole('button', { name: 'Fazer' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.json$/);

    await expect(backupReminder(page)).toBeEmpty();
    // Fica gravado: depois de recarregar, continua sem lembrete.
    await page.reload();
    await expect(weekCard(page)).toBeVisible();
    await expect(backupReminder(page)).toBeEmpty();
  });
});

test.describe('Início · treinos recentes', () => {
  test('lista com data e nome da ficha, do mais recente para o mais antigo', async ({ page }) => {
    await homeWith(page);

    expect(await listedWorkouts(page)).toEqual([
      'Treino A, 19/05/2026',
      'Treino B, 18/05/2026',
      'Treino A, 17/05/2026'
    ]);
    await expect(workoutRows(page).locator('strong')).toHaveText(['Treino A', 'Treino B', 'Treino A']);
    await expect(workoutRows(page).locator('.workout-date-day')).toHaveText(['19', '18', '17']);
    await expect(page.locator('#recentWorkouts .workout-month')).toHaveText([/3 treinos$/]);
  });

  test('tocar num treino abre o detalhe', async ({ page }) => {
    await homeWith(page);

    await page.locator('#recentWorkouts button[data-view-workout="w-seg"]').click();

    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page).toHaveURL(/#\/detail\/w-seg$/);
    await expect(page.locator('#detailBody .detail-hero')).toContainText('Treino B');
    await expect(page.locator('#detailBody .detail-hero')).toContainText('18/05/2026');
    await expect(page.locator('#detailBody')).toContainText('Agachamento livre');
  });

  test('ficha renomeada aparece com o nome novo', async ({ page }) => {
    await homeWith(page);
    // O treino de 18/05 foi gravado quando a Treino B se chamava "Pernas": mostra o nome atual.
    await expect(workoutRows(page).locator('strong')).toHaveText(['Treino A', 'Treino B', 'Treino A']);
    await expect(page.locator('#recentWorkouts')).not.toContainText('Pernas');

    // Renomeia a Treino A pela tela Fichas.
    await goTo(page, 'Fichas');
    const sheetCard = page.locator('#tabSheets .card').filter({ has: page.locator('strong', { hasText: /^\s*Treino A$/ }) });
    await sheetCard.getByRole('button', { name: 'Editar ficha' }).click();
    await expect(page.locator('#sheetEditorModal')).toBeVisible();
    await page.locator('#sheetName').fill('Peito e costas');
    await page.locator('#sheetEditorSave').click();
    await expect(page.locator('#sheetEditorModal')).toBeHidden();

    await goTo(page, 'Início');
    await expect(workoutRows(page).locator('strong')).toHaveText(['Peito e costas', 'Treino B', 'Peito e costas']);
    expect(await listedWorkouts(page)).toEqual([
      'Peito e costas, 19/05/2026',
      'Treino B, 18/05/2026',
      'Peito e costas, 17/05/2026'
    ]);
  });
});
