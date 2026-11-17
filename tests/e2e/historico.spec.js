// Histórico, evolução do exercício, Calendário e detalhe do treino (issue #7).
//
// Ponto de partida: `fixtures/historico-backup.json`, importado pela tela Mais, com o relógio da página parado em
// 20/05/2026 (quarta), 10:00 de Brasília. Semana ativa 18/05–24/05, meta de 3 treinos.
// - Treino A: 30/03 (Supino 40×10, 42,5×8; Barra fixa ×8), 15/04 (Supino 45×8, 42,5×10; Barra ×10; 20 min de
//   cardio) e 18/05 (aquecimento 15 reps 20 kg RIR 3; Supino 47,5×6, 45×8; Barra ×12; 30 min; observação).
// - Treino B: 04/05 (Agachamento 50×10) e 18/05 de noite (Agachamento 60×10, 60×9): dois treinos no mesmo dia.
// - Barra fixa é sempre com o peso do corpo (carga 0).
const { test, expect, withBackup, readFixture, goTo } = require('./helpers');

const BACKUP = 'historico-backup.json';
const TODAY = '2026-05-20T10:00:00-03:00';

/** Importa o backup do histórico (ou uma variação dele) com o relógio parado num dia. */
async function historyWith(page, backup = BACKUP, now = TODAY) {
  await page.clock.setFixedTime(new Date(now));
  await withBackup(page, backup);
}

const workoutRows = (page) => page.locator('#recentWorkouts .workout-row');
const detail = (page) => page.locator('#detailBody');
const history = (page) => page.locator('#exerciseHistory');

/** Nome da ficha e data de cada linha da lista do Início, na ordem da tela. */
async function listedWorkouts(page) {
  const labels = await workoutRows(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  return labels.map((label) => label.split(', ').slice(0, 2).join(', '));
}

/** Abre o detalhe do treino da linha do Início com este texto para leitor de tela (ex.: "Treino A, 18/05/2026"). */
async function openWorkout(page, label) {
  await page.locator(`#recentWorkouts .workout-row[aria-label^="${label}"]`).click();
  await expect(page.locator('#view-detail')).toBeVisible();
}

/** Card de um exercício no detalhe do treino. */
function detailCard(page, name) {
  return detail(page).locator('.card').filter({ has: page.locator('.ex-link', { hasText: name }) });
}

/** Abre a evolução de um exercício pelo detalhe do treino. */
async function openExercise(page, name) {
  await detail(page).locator('.ex-link', { hasText: name }).click();
  await expect(page.locator('#view-exercise')).toBeVisible();
  await expect(page.locator('#exerciseHistoryTitle')).toHaveText(name);
}

/** Texto das linhas "Melhor série por dia" (data e série), na ordem. */
function bestSetRows(page) {
  return history(page).locator('.progress').evaluateAll((bars) => bars.map((bar) =>
    [...bar.previousElementSibling.children].map((span) => span.textContent.trim()).join(' ')));
}

test.describe('Detalhe do treino', () => {
  test('mostra ficha, data, volume, cardio, recordes, observação, aquecimento e séries com vírgula', async ({ page }) => {
    await historyWith(page);
    await openWorkout(page, 'Treino A, 18/05/2026');
    await expect(page).toHaveURL(/#\/detail\/h-mai-a$/);

    await expect(detail(page).locator('.detail-hero')).toContainText('Treino A');
    await expect(detail(page).locator('.detail-hero')).toContainText('18/05/2026');
    await expect(detail(page).locator('.detail-stats > div')).toHaveText(['645kg volume', '30min cardio', '1recorde']);
    await expect(detail(page)).toContainText('Supino pesado hoje');

    await expect(detail(page).locator('.ex-title')).toHaveText(['Supino reto', 'Barra fixa']);
    const supino = detailCard(page, 'Supino reto');
    await expect(supino.locator('.pr-line')).toHaveText('Recorde: 47,5 kg × 6 (antes: 45 kg)');
    await expect(supino).toContainText('Aquecimento: 15 reps · 20 kg · RIR 3');
    await expect(supino).toContainText('47,5 kg');
    await expect(detailCard(page, 'Barra fixa').locator('.pr-line')).toHaveCount(0);
  });

  test('o treino aberto continua aberto depois de recarregar a página; Voltar volta ao Início', async ({ page }) => {
    await historyWith(page);
    await openWorkout(page, 'Treino B, 04/05/2026');
    await expect(page).toHaveURL(/#\/detail\/h-mai-b1$/);

    await page.reload();
    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(detail(page).locator('.detail-hero')).toContainText('04/05/2026');
    await expect(detail(page).locator('.ex-title')).toHaveText(['Agachamento livre']);

    await page.locator('#detailBack').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });

  test('excluir pelo detalhe volta ao Início sem o treino', async ({ page }) => {
    await historyWith(page);
    await openWorkout(page, 'Treino B, 04/05/2026');
    await page.locator('#detailDelete').click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    expect(await listedWorkouts(page)).toEqual([
      'Treino B, 18/05/2026', 'Treino A, 18/05/2026', 'Treino A, 15/04/2026', 'Treino A, 30/03/2026'
    ]);
  });

  test('exportar pelo detalhe: texto do treino e Compartilhar', async ({ page }) => {
    await page.addInitScript(() => {
      window.__shared = [];
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true, value: async (data) => { window.__shared.push(data); }
      });
    });
    await historyWith(page);
    await openWorkout(page, 'Treino B, 04/05/2026');
    await page.locator('#detailExport').click();
    await expect(page.locator('#exportModal')).toBeVisible();
    const text = await page.locator('#exportText').inputValue();
    expect(text).toContain('04/05/2026');
    expect(text).toContain('Agachamento livre');

    await page.locator('#exportShare').click();
    await expect.poll(() => page.evaluate(() => window.__shared)).toEqual([{ title: 'Meu Treino', text }]);
  });

  test('treino que não existe mais mostra "Treino não encontrado."', async ({ page }) => {
    await historyWith(page);
    await page.goto('./#/detail/nao-existe');
    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(detail(page)).toHaveText('Treino não encontrado.');
  });
});

test.describe('Evolução do exercício', () => {
  test('carga máxima, número de treinos e tendência, 1RM estimado, melhor série por dia e histórico', async ({ page }) => {
    await historyWith(page);
    await openWorkout(page, 'Treino A, 18/05/2026');
    await openExercise(page, 'Supino reto');

    const head = history(page).locator('.history-head');
    await expect(head).toContainText('Carga máxima');
    await expect(head.locator('.stat-big')).toHaveText('47,5 kg');
    await expect(head.locator('.chip')).toHaveText('3 treinos');
    // Tendência de alta: a melhor carga do último treino (47,5) passou a do anterior (45).
    await expect(head.locator('.chip .bi-arrow-up-right')).toHaveCount(1);
    await expect(history(page)).toContainText('1RM estimado: 57 kg');

    expect(await bestSetRows(page)).toEqual([
      '18/05/2026 47,5 kg × 6 · 1RM 57',
      '15/04/2026 45 kg × 8 · 1RM 57',
      '30/03/2026 42,5 kg × 8 · 1RM 53,8'
    ]);

    // Histórico: um card por treino, do mais novo ao mais velho, com a ficha e o aquecimento daquele dia.
    const sessions = history(page).locator('.card-body.py-2');
    await expect(sessions.locator('strong').first()).toHaveText('18/05/2026');
    await expect(sessions).toHaveCount(3);
    await expect(sessions.first().locator('.badge')).toHaveText('Treino A');
    await expect(sessions.first()).toContainText('Aquecimento: 15 reps · 20 kg · RIR 3');
    await expect(sessions.nth(2)).toContainText('30/03/2026');
    await expect(sessions.nth(2)).not.toContainText('Aquecimento');

    await page.locator('#exerciseBack').click();
    await expect(page.locator('#view-detail')).toBeVisible();
  });

  test('exercício sem carga (peso do corpo): sem selo de carga máxima e sem 1RM', async ({ page }) => {
    await historyWith(page);
    await openWorkout(page, 'Treino A, 18/05/2026');
    await openExercise(page, 'Barra fixa');

    const head = history(page).locator('.history-head');
    await expect(head).toContainText('Sem carga registrada');
    await expect(head).not.toContainText('Carga máxima');
    await expect(head.locator('.chip')).toHaveText('3 treinos');
    await expect(history(page)).not.toContainText('1RM');
    expect(await bestSetRows(page)).toEqual(['18/05/2026 0 kg × 12', '15/04/2026 0 kg × 10', '30/03/2026 0 kg × 8']);
  });
});

test.describe('Calendário', () => {
  test('marca os dias com treino e conta os treinos do mês; trocar de mês', async ({ page }) => {
    await historyWith(page);
    await goTo(page, 'Calendário');
    await expect(page.locator('#calMonthLabel')).toHaveText('maio de 2026');
    await expect(page.locator('#calendarTotal')).toHaveText(' 3 treinos em maio.');
    await expect(page.locator('#calendarGrid .has-workout')).toHaveText(['41', '182']);
    await expect(page.locator('#calendarGrid .today')).toHaveText('20');

    await page.locator('#calPrev').click();
    await expect(page.locator('#calMonthLabel')).toHaveText('abril de 2026');
    await expect(page.locator('#calendarTotal')).toHaveText(' 1 treino em abril.');
    await expect(page.locator('#calendarGrid .today')).toHaveCount(0);

    await page.locator('#calNext').click();
    await page.locator('#calNext').click();
    await expect(page.locator('#calMonthLabel')).toHaveText('junho de 2026');
    await expect(page.locator('#calendarTotal')).toHaveText(' 0 treinos em junho.');
    await expect(page.locator('#calendarGrid .has-workout')).toHaveCount(0);
  });

  test('tocar no dia abre o treino daquele dia (com dois no dia, o mais recente)', async ({ page }) => {
    await historyWith(page);
    await goTo(page, 'Calendário');
    const day = page.getByRole('link', { name: 'Abrir treino de 18/05/2026 (2 treinos no dia)' });
    await expect(day.locator('.cal-badge')).toHaveText('2');
    await day.click();

    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page).toHaveURL(/#\/detail\/h-mai-b2$/);
    await expect(detail(page).locator('.detail-hero')).toContainText('Treino B');
  });

  for (const [today, button, expected] of [
    ['2026-10-31T10:00:00-03:00', '#calPrev', ['outubro de 2026', 'setembro de 2026', 'agosto de 2026']],
    ['2026-01-31T10:00:00-03:00', '#calNext', ['janeiro de 2026', 'fevereiro de 2026', 'março de 2026']],
    ['2026-01-31T10:00:00-03:00', '#calPrev', ['janeiro de 2026', 'dezembro de 2025', 'novembro de 2025']]
  ]) {
    test(`trocar de mês num dia 31 não pula nem repete mês (${today.slice(0, 10)}, ${button === '#calPrev' ? '‹' : '›'})`, async ({ page }) => {
      await historyWith(page, BACKUP, today);
      await goTo(page, 'Calendário');
      await expect(page.locator('#calMonthLabel')).toHaveText(expected[0]);
      await page.locator(button).click();
      await expect(page.locator('#calMonthLabel')).toHaveText(expected[1]);
      await page.locator(button).click();
      await expect(page.locator('#calMonthLabel')).toHaveText(expected[2]);
    });
  }

  test('evolução das últimas 8 semanas: volume, treinos da meta e cardio', async ({ page }) => {
    await historyWith(page);
    await goTo(page, 'Calendário');
    const card = page.locator('#weeklyProgress');
    await expect(card).toContainText('Evolução das últimas 8 semanas');
    const weeks = card.locator('.week-row');
    await expect(weeks).toHaveCount(8);
    // Esta semana: 645 kg (Treino A) + 1.140 kg (Treino B), 2 de 3 treinos, 30 min de cardio.
    await expect(weeks.nth(0)).toContainText('Esta semana');
    await expect(weeks.nth(0)).toContainText('1.785 kg');
    await expect(weeks.nth(0)).toContainText('2/3 treinos · 30 min cardio');
    await expect(weeks.nth(1)).toContainText('11/05 – 17/05');
    await expect(weeks.nth(1)).toContainText('0 kg');
    await expect(weeks.nth(2)).toContainText('04/05 – 10/05');
    await expect(weeks.nth(2)).toContainText('500 kg');
    await expect(weeks.nth(2)).toContainText('1/3 treino');
    await expect(weeks.nth(0).locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
  });
});

test.describe('Histórico no Início', () => {
  test('dois treinos no mesmo dia: o mais recente vem primeiro', async ({ page }) => {
    await historyWith(page);
    expect(await listedWorkouts(page)).toEqual([
      'Treino B, 18/05/2026', 'Treino A, 18/05/2026', 'Treino B, 04/05/2026', 'Treino A, 15/04/2026', 'Treino A, 30/03/2026'
    ]);
    await expect(workoutRows(page).first()).toHaveAttribute('aria-label', 'Treino B, 18/05/2026, 1 exercício · 1.140 kg, 1 recorde');
    await expect(workoutRows(page).nth(1)).toHaveAttribute('aria-label',
      'Treino A, 18/05/2026, 2 exercícios · 645 kg · 30 min cardio, 1 recorde');
  });

  test('lista curta (mês atual e anterior, no mínimo 10) com "Ver meses anteriores", e filtro por ficha', async ({ page }) => {
    // Mais 8 treinos da Treino A em 2025: 13 no total, 4 em abril/maio de 2026.
    const backup = readFixture(BACKUP);
    const old = backup.data.workouts[0];
    for (let i = 1; i <= 8; i++) {
      const date = `2025-${String(i).padStart(2, '0')}-10`;
      backup.data.workouts.push(Object.assign({}, old, { id: 'h-old-' + i, date, createdAt: date + 'T12:00:00.000Z' }));
    }
    await historyWith(page, backup);

    const head = page.locator('#recentWorkouts .section-head');
    await expect(head).toHaveText(/Histórico\s*13 treinos/);
    await expect(workoutRows(page)).toHaveCount(10);
    const more = page.locator('#btnShowAllWorkouts');
    await expect(more).toHaveText(' Ver meses anteriores (3 treinos)');
    await more.click();
    await expect(workoutRows(page)).toHaveCount(13);
    await page.locator('#btnShowLessWorkouts').click();
    await expect(workoutRows(page)).toHaveCount(10);

    // Filtro por ficha: só os treinos da Treino B.
    const chips = page.locator('#workoutFilter button');
    await expect(chips).toHaveText(['Todas', 'Treino A', 'Treino B']);
    await chips.filter({ hasText: 'Treino B' }).click();
    await expect(chips.filter({ hasText: 'Treino B' })).toHaveAttribute('aria-pressed', 'true');
    await expect(head).toHaveText(/Treinos da ficha\s*2 treinos/);
    expect(await listedWorkouts(page)).toEqual(['Treino B, 18/05/2026', 'Treino B, 04/05/2026']);
    await expect(more).toHaveCount(0);

    await chips.filter({ hasText: 'Todas' }).click();
    await expect(head).toHaveText(/Histórico\s*13 treinos/);
  });
});

test.describe('Detalhe · compartilhar sem o menu do aparelho', () => {
  test('sem menu de compartilhar, Compartilhar copia o texto', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await historyWith(page);
    await openWorkout(page, 'Treino B, 04/05/2026');
    await page.locator('#detailExport').click();
    const text = await page.locator('#exportText').inputValue();

    await page.locator('#exportShare').click();

    await expect(page.locator('#appToastBody')).toHaveText('Texto copiado!');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(text);
  });

  test('menu cancelado e área de transferência bloqueada: copia selecionando o texto', async ({ page }) => {
    await page.addInitScript(() => {
      window.__execCommands = [];
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true, value: async () => { throw new DOMException('cancelado', 'AbortError'); }
      });
      Clipboard.prototype.writeText = async () => { throw new DOMException('bloqueado', 'NotAllowedError'); };
      document.execCommand = (command) => { window.__execCommands.push(command); return true; };
    });
    await historyWith(page);
    await openWorkout(page, 'Treino B, 04/05/2026');
    await page.locator('#detailExport').click();

    await page.locator('#exportShare').click();

    await expect(page.locator('#appToastBody')).toHaveText('Texto copiado!');
    expect(await page.evaluate(() => window.__execCommands)).toEqual(['copy']);
  });
});

test.describe('Evolução · sem registros', () => {
  test('abrir a evolução direto pelo endereço, sem exercício escolhido, mostra que não há registros', async ({ page }) => {
    await historyWith(page);
    await page.goto('./#/exercise');
    await expect(page.locator('#view-exercise')).toBeVisible();
    await expect(history(page)).toHaveText('Nenhum registro deste exercício ainda.');
  });
});
