// Tela Mais (issue #7): metas e descanso, colinha, importar treinos antigos, Instalar o app, botão Teste e o card Debug
// (armazenamento persistente). Backup, apagar dados, dados de exemplo e atualização ficam em dados.spec.js.
const { test, expect, freshApp, withBackup, storedRecords, goTo, answerConfirm } = require('./helpers');

const TODAY = '2026-05-20T10:00:00-03:00';

/** Junta as mensagens de alert() da página; cada uma é aceita. */
function collectAlerts(page) {
  const messages = [];
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'alert') messages.push(dialog.message());
    dialog.accept();
  });
  return messages;
}

/** Abre o app vazio na tela Mais, com o relógio parado em 20/05/2026. */
async function moreScreen(page) {
  await page.clock.setFixedTime(new Date(TODAY));
  await freshApp(page);
  await goTo(page, 'Mais');
}

test.describe('Mais · metas e descanso', () => {
  test('salvar metas e descanso: o Início usa as metas novas, o Treinar o descanso novo, e fica gravado', async ({ page }) => {
    await moreScreen(page);
    await expect(page.locator('#setWorkoutTarget')).toHaveValue('3');
    await expect(page.locator('#setCardioTarget')).toHaveValue('120');
    await expect(page.locator('#setRestSeconds')).toHaveValue('90');

    await page.locator('#setWorkoutTarget').fill('4');
    await page.locator('#setCardioTarget').fill('90');
    await page.locator('#setRestSeconds').fill('120');
    await page.locator('#btnSaveSettings').click();
    // Aviso de sucesso que some sozinho.
    await expect(page.locator('#appToastBody')).toHaveText('Metas salvas.');
    await expect(page.locator('#appToast')).toBeVisible();
    await expect(page.locator('#appToast')).toBeHidden({ timeout: 10_000 });

    await goTo(page, 'Início');
    await expect(page.locator('#weekProgress .week-stat .stat-big')).toHaveText(['0/4', '0/90']);
    const settings = (await storedRecords(page, 'settings')).find((s) => s.id === 'app');
    expect(settings).toMatchObject({ weeklyWorkoutTarget: 4, weeklyCardioTarget: 90, restSeconds: 120 });
  });

  test('"Iniciar semana" começa a semana hoje', async ({ page }) => {
    const backup = { app: 'meu-treino', version: 2, data: { workouts: [], sheets: [], exercises: [], colinha: [],
      settings: { id: 'app', weekAnchor: '2026-05-16', weeklyWorkoutTarget: 3, weeklyCardioTarget: 120 } } };
    await page.clock.setFixedTime(new Date(TODAY));
    await withBackup(page, backup);
    await expect(page.locator('#weekProgress .week-card')).toContainText('16/05 – 22/05');

    await goTo(page, 'Mais');
    await expect(page.locator('#setWeekAnchor')).toHaveValue('2026-05-16');
    await page.locator('#btnWeekToday').click();
    await expect(page.locator('#appToastBody')).toHaveText('Semana iniciada hoje (20/05/2026).');
    await expect(page.locator('#setWeekAnchor')).toHaveValue('2026-05-20');

    await goTo(page, 'Início');
    await expect(page.locator('#weekProgress .week-card')).toContainText('20/05 – 26/05');
  });
});

test.describe('Mais · colinha', () => {
  test('criar, editar e excluir uma colinha', async ({ page }) => {
    const alerts = collectAlerts(page);
    await moreScreen(page);
    const list = page.locator('#colinhaList');
    await expect(list).toContainText('Nenhuma colinha ainda.');

    await page.locator('#btnAddColinha').click();
    await expect(page.locator('#colinhaModal')).toBeVisible();
    await page.locator('#colinhaSave').click();
    await expect.poll(() => alerts).toEqual(['Preencha o título ou o conteúdo.']);

    await page.locator('#colinhaTitle').fill('RIR');
    await page.locator('#colinhaContent').fill('Repetições na reserva: quantas ainda dava para fazer.');
    await page.locator('#colinhaSave').click();
    await expect(page.locator('#colinhaModal')).toBeHidden();
    await expect(list.locator('.colinha-item')).toHaveCount(1);
    await expect(list.locator('.colinha-item strong')).toHaveText('RIR');

    await list.getByRole('button', { name: 'Editar colinha' }).click();
    await expect(page.locator('#colinhaTitle')).toHaveValue('RIR');
    await page.locator('#colinhaContent').fill('RIR 2 = mais duas repetições.');
    await page.locator('#colinhaSave').click();
    await expect(page.locator('#colinhaModal')).toBeHidden();
    await expect(list.locator('.colinha-item small')).toHaveText('RIR 2 = mais duas repetições.');
    expect(await storedRecords(page, 'colinha')).toHaveLength(1);

    await list.getByRole('button', { name: 'Excluir colinha' }).click();
    await expect(list).toContainText('Nenhuma colinha ainda.');
    expect(await storedRecords(page, 'colinha')).toHaveLength(0);
  });

  test('responder "Não" ao excluir não apaga a colinha', async ({ page }) => {
    await moreScreen(page);
    const list = page.locator('#colinhaList');
    await page.locator('#btnAddColinha').click();
    await page.locator('#colinhaTitle').fill('RIR');
    await page.locator('#colinhaSave').click();
    await expect(list.locator('.colinha-item')).toHaveCount(1);
    const asked = await answerConfirm(page, false);

    await list.getByRole('button', { name: 'Excluir colinha' }).click();

    await expect.poll(asked).toEqual(['Excluir esta colinha?']);
    await expect(list.locator('.colinha-item strong')).toHaveText('RIR');
    expect(await storedRecords(page, 'colinha')).toHaveLength(1);
  });
});

test.describe('Mais · importar treinos antigos', () => {
  const PASTED = JSON.stringify({
    fichas: [{
      name: 'Treino C - pernas',
      exercises: [
        { name: 'Agachamento livre', sets: 2, reps: [10, 8] },
        { name: 'Voador invertido da academia', sets: 1, reps: [12] }
      ]
    }],
    treinos: [
      {
        date: '2025-02-10',
        ficha: 'Treino C - pernas',
        cardioMinutes: 10,
        exercises: [
          { name: 'Agachamento livre', warmup: { reps: 15, load: 20 }, sets: [{ reps: 10, load: 40 }, { reps: 8, load: 45 }] },
          { name: 'Voador invertido da academia', sets: [{ reps: 12, load: 15 }] }
        ]
      },
      { date: '14/02/2025', ficha: 'Treino A', exercises: [{ name: 'Supino reto', sets: [{ reps: 10, load: '27,5' }] }] }
    ]
  });

  async function openHistoryImport(page) {
    await withBackup(page, 'treinar-backup.json');
    await goTo(page, 'Mais');
    await page.locator('#btnHistoryImport').click();
    await expect(page.locator('#historyImportModal')).toBeVisible();
  }

  test('o texto para a IA traz o contrato, as fichas e os exercícios do app', async ({ page }) => {
    await openHistoryImport(page);
    const ia = page.locator('#historyIaText');
    await expect(ia).toHaveValue(/^# Contrato: treinos antigos \+ fichas em JSON \(Meu Treino\)/);
    const text = await ia.inputValue();
    expect(text).toContain('## Fichas que já existem no app');
    expect(text).toContain('- Treino A\n- Treino B\n- Treino Antigo (desativada)\n');
    expect(text).toContain('### Minha biblioteca\n- Agachamento livre (Pernas)');
    await expect(page.locator('#historyImportConfirm')).toHaveText('Revisar');
  });

  test('texto que não é JSON mostra o motivo e não importa nada', async ({ page }) => {
    const alerts = collectAlerts(page);
    await openHistoryImport(page);
    await page.locator('#historyImportText').fill('{ "treinos": [');
    await page.locator('#historyImportConfirm').click();
    await expect.poll(() => alerts).toEqual([
      'Não deu para importar os treinos.\n\nO texto não é um JSON válido. Copie a resposta inteira da IA.'
    ]);
    await expect(page.locator('#historyImportPaste')).toBeVisible();
    expect(await storedRecords(page, 'workouts')).toHaveLength(2);
  });

  test('revisar e importar: treinos no histórico, ficha recriada com a carga da última vez; reimportar não duplica', async ({ page }) => {
    const alerts = collectAlerts(page);
    await openHistoryImport(page);
    await page.locator('#historyImportText').fill(PASTED);
    await page.locator('#historyImportConfirm').click();

    const body = page.locator('#historyImportBody');
    await expect(body).toContainText('2 treinos novos (10/02/2025 a 14/02/2025)');
    await expect(body.locator('.sheet-items li')).toHaveText([/Treino C - pernas\s*nova · 2 exercícios/]);
    await expect(body.locator('.import-name')).toHaveText(['Voador invertido da academia']);
    await expect(body.locator('#imph-0 option:checked')).toHaveText('➕ Criar novo: Voador invertido da academia');
    await expect(page.locator('#historyImportConfirm')).toHaveText('Importar');

    await page.locator('#historyImportConfirm').click();
    await expect(page.locator('#historyImportModal')).toBeHidden();
    await expect(page.locator('#appToastBody')).toHaveText('2 treinos importados e 1 ficha criada.');

    // Histórico: os treinos importados, com a vírgula e o aquecimento.
    await goTo(page, 'Início');
    await expect(page.locator('#recentWorkouts .workout-row')).toHaveCount(4);
    await page.locator('#recentWorkouts .workout-row[aria-label^="Treino C - pernas, 10/02/2025"]').click();
    await expect(page.locator('#detailBody')).toContainText('Aquecimento: 15 reps · 20 kg');
    await expect(page.locator('#detailBody .ex-title')).toHaveText(['Agachamento livre', 'Voador invertido da academia']);
    const imported = (await storedRecords(page, 'workouts')).find((w) => w.date === '2025-02-14');
    expect(imported.sets[0]).toMatchObject({ exerciseId: 'ex-supino', reps: 10, load: 27.5 });

    // A ficha recriada já traz a carga da última vez.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino C - pernas' });
    const loads = await page.locator('#workoutExercises input[aria-label^="Carga da série"]').evaluateAll((els) => els.map((el) => el.value));
    expect(loads).toEqual(['40', '45', '15']);
    await page.locator('#workoutCancel').click();

    // Colar de novo: nada novo, nada duplicado.
    await goTo(page, 'Mais');
    await page.locator('#btnHistoryImport').click();
    await page.locator('#historyImportText').fill(PASTED);
    await page.locator('#historyImportConfirm').click();
    await expect.poll(() => alerts).toEqual(['Nada novo para importar: esses treinos e fichas já estão no app.']);
    expect(await storedRecords(page, 'workouts')).toHaveLength(4);
    expect(await storedRecords(page, 'sheets')).toHaveLength(4);
  });
});

test.describe('Mais · Instalar o app', () => {
  test('sem o botão do navegador: explica como instalar pelo menu', async ({ page }) => {
    await moreScreen(page);
    await expect(page.locator('#installStatus')).toHaveText(
      'Abra o menu do navegador (⋮ ou ⋯) e escolha "Instalar app" ou "Adicionar à tela inicial".');
    await expect(page.locator('#btnInstall')).toBeHidden();
  });

  test('com o pedido de instalação do navegador: botão Instalar abre o pedido uma vez', async ({ page }) => {
    await moreScreen(page);
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      window.__installPrompts = 0;
      event.prompt = () => { window.__installPrompts++; };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await expect(page.locator('#installStatus')).toHaveText(
      'Toque em Instalar: o Meu Treino ganha um ícone próprio e abre em tela cheia, sem a barra do navegador.');
    await page.locator('#btnInstall').click();

    await expect(page.locator('#btnInstall')).toBeHidden();
    expect(await page.evaluate(() => window.__installPrompts)).toBe(1);
    await expect(page.locator('#installStatus')).toContainText('Abra o menu do navegador');
  });

  test('já instalado (tela cheia): avisa e não mostra o botão', async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => (query === '(display-mode: standalone)'
        ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
        : original(query));
    });
    await moreScreen(page);
    await expect(page.locator('#installStatus')).toHaveText('O app já está instalado neste aparelho.');
    await expect(page.locator('#btnInstall')).toBeHidden();
  });

  test.describe('no iPhone', () => {
    test.use({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    });

    test('explica o Compartilhar → "Adicionar à Tela de Início" e o backup antes', async ({ page }) => {
      await moreScreen(page);
      await expect(page.locator('#installStatus')).toHaveText(
        'No iPhone, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". ' +
        'O app instalado começa vazio: antes, use Exportar no card Dados e depois Importar dentro do app.');
      await expect(page.locator('#btnInstall')).toBeHidden();
    });
  });
});

test.describe('Mais · botão Teste', () => {
  test('tocar em Teste mostra um alerta "hello world"', async ({ page }) => {
    const alerts = collectAlerts(page);
    await moreScreen(page);
    await page.locator('#btnTest').click();
    await expect.poll(() => alerts).toEqual(['hello world']);
  });
});

test.describe('Mais · Debug e armazenamento', () => {
  /** Simula o armazenamento do navegador: espaço usado e se o pedido de proteção é aceito. */
  function fakeStorage(page, grant) {
    return page.addInitScript((granted) => {
      let persisted = false;
      window.__persistRequests = 0;
      StorageManager.prototype.persisted = async () => persisted;
      StorageManager.prototype.persist = async () => { window.__persistRequests++; persisted = granted; return granted; };
      StorageManager.prototype.estimate = async () => ({ usage: 2.5 * 1024 * 1024, quota: 1024 * 1024 * 1024 });
    }, grant);
  }

  test('o card Debug fica à vista no fim de Mais, com Atualizar app, Apagar dados e dados de exemplo', async ({ page }) => {
    await moreScreen(page);
    await expect(page.locator('#view-more details')).toHaveCount(0);
    const debug = page.locator('#view-more .card').last();
    await expect(debug.locator('.card-header')).toHaveText(' Debug');
    for (const id of ['#storageInfo', '#btnForceUpdate', '#btnEraseAll', '#btnLoadSample']) {
      await expect(debug.locator(id)).toBeVisible();
    }
  });

  test('pede armazenamento persistente ao abrir; aceito, o card mostra "protegido"', async ({ page }) => {
    await fakeStorage(page, true);
    await moreScreen(page);
    await expect(page.locator('#storageInfo')).toHaveText(
      'Espaço usado: 2,5 MB de 1,0 GB disponíveis · armazenamento protegido');
    expect(await page.evaluate(() => window.__persistRequests)).toBe(1);
  });

  test('recusado pelo navegador: o card avisa para manter o backup em dia', async ({ page }) => {
    await fakeStorage(page, false);
    await moreScreen(page);
    await expect(page.locator('#storageInfo')).toHaveText('Espaço usado: 2,5 MB de 1,0 GB disponíveis · armazenamento não ' +
      'protegido (o navegador pode apagar se faltar espaço — mantenha o backup em dia)');
  });
});
