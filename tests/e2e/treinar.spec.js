// Treinar (tela crítica), issue #5. Parte A: abrir, ficha, séries, descanso, exercícios e campos.
// Cada comportamento tem o seu teste (documentation/REFACTOR.md, seção 4). Parte B: rascunho, salvar e treino
// existente.
//
// Ponto de partida da maioria dos testes: `fixtures/treinar-backup.json`, importado pela tela Mais.
// - Treino A (ativa): Supino reto 3 séries (reps 12-10-8) e Remada baixa 2 séries (reps 10-10).
// - Treino B (ativa): Agachamento livre 4 séries (8-8-6-6), nunca treinado.
// - Treino Antigo (desativada).
// - Último treino da Treino A em 10/03/2025: Supino 40 kg × 11, 42,5 × 9, 45 × 7 (aquecimento 15 reps, 20 kg,
//   RIR 3); Remada 50 × 10, 50 × 9. Um treino mais velho (03/03/2025) com cargas menores não deve aparecer.
// - Biblioteca: Supino reto, Remada baixa, Agachamento livre e Rosca na máquina azul. Descanso: 90 s.
const { test, expect, freshApp, withBackup, goTo } = require('./helpers');

const BACKUP = 'treinar-backup.json';

/** Card de um exercício no formulário do Treinar, pelo nome. */
function exerciseCard(page, name) {
  return page.locator('#workoutExercises .card').filter({ has: page.locator('.ex-title', { hasText: name }) });
}

/** Valores de um campo (Reps/Carga/RIR/Observação) em todas as séries de um card, na ordem. */
async function setValues(card, field) {
  return card.locator(`input[aria-label^="${field} da série"]`).evaluateAll((els) => els.map((el) => el.value));
}

/** Botão do número da série (marca como feita e inicia o descanso). */
function setButton(card, number) {
  return card.getByRole('button', { name: new RegExp('^Série ' + number + '\\b') });
}

/** Importa o backup, abre o Treinar e escolhe a ficha no seletor. */
async function workoutWithSheet(page, sheetName) {
  await withBackup(page, BACKUP);
  await goTo(page, 'Treinar');
  await page.locator('#workoutSheet').selectOption({ label: sheetName });
}

/**
 * Para o relógio da página (instalado com `page.clock.install()` antes de abrir o app): daqui em diante o tempo
 * só anda com `page.clock.runFor`/`setSystemTime`, então o descanso é conferido sem esperas fixas.
 */
async function pauseClock(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

const restBar = (page) => page.locator('#restBar');
const restClock = (page) => page.locator('#restClock');

test.describe('Treinar · abrir', () => {
  test('pela aba Treinar sem rascunho: formulário vazio e data de hoje', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-20T10:00:00-03:00'));
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    await expect(page.locator('#workoutTitle')).toHaveText('Treinar');
    await expect(page.locator('#workoutDate')).toHaveValue('2026-05-20');
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#sheetHint')).toHaveText('Selecione a ficha do treino de hoje.');
    await expect(page.locator('#workoutCardio')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
    await expect(page.locator('#workoutProgress')).toBeEmpty();
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#repeatLast')).toBeEmpty();
    await expect(page.locator('#workoutDelete')).toBeHidden();
    await expect(page.locator('#workoutExport')).toBeHidden();
  });

  test('pelo atalho "Treinar: <ficha>" do Início: ficha já carregada', async ({ page }) => {
    await withBackup(page, BACKUP);
    // O último treino foi da Treino A, então o atalho sugere a próxima: Treino B.
    await page.getByRole('button', { name: 'Treinar: Treino B' }).click();

    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    const card = exerciseCard(page, 'Agachamento livre');
    expect(await setValues(card, 'Reps')).toEqual(['8', '8', '6', '6']);
  });

  test('fichas desativadas não aparecem no seletor', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    const options = await page.locator('#workoutSheet option').allTextContents();
    expect(options).toEqual(['— Selecione a ficha —', 'Treino A', 'Treino B']);
  });
});

test.describe('Treinar · ficha', () => {
  test('escolher a ficha carrega exercícios e séries: reps da ficha, carga do último treino', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    await expect(page.locator('#sheetHint')).toHaveText('2 exercícios na ficha — carregados no treino.');
    await expect(page.locator('#workoutExercises .card .ex-title')).toHaveText([/^Supino reto/, /^Remada baixa/]);

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.locator('.ex-title small')).toHaveText('3 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', '', '']);

    const remada = exerciseCard(page, 'Remada baixa');
    expect(await setValues(remada, 'Reps')).toEqual(['10', '10']);
    expect(await setValues(remada, 'Carga')).toEqual(['50', '50']);

    // Exercício nunca treinado: reps da ficha, carga em branco.
    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
    const agachamento = exerciseCard(page, 'Agachamento livre');
    expect(await setValues(agachamento, 'Reps')).toEqual(['8', '8', '6', '6']);
    expect(await setValues(agachamento, 'Carga')).toEqual(['', '', '', '']);
  });

  test('dica "da última vez" da ficha escolhida', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    await expect(exerciseCard(page, 'Supino reto').locator('.last-session')).toHaveText(
      'Última vez (10/03/2025): 40 kg × 11 (RIR 2) · 42,5 kg × 9 (RIR 1) · 45 kg × 7 (RIR 0)');
    await expect(exerciseCard(page, 'Remada baixa').locator('.last-session')).toHaveText(
      'Última vez (10/03/2025): 50 kg × 10 (RIR 2) · 50 kg × 9 (RIR 1)');

    // Sem histórico, sem dica.
    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });
    await expect(exerciseCard(page, 'Agachamento livre').locator('.last-session')).toHaveCount(0);
  });

  test('aquecimento pré-preenchido com reps e peso do treino anterior, RIR em branco', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('Peso do aquecimento')).toHaveValue('20');
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('');

    // A remada não teve aquecimento da última vez: tudo em branco.
    const remada = exerciseCard(page, 'Remada baixa');
    await expect(remada.getByLabel('Reps do aquecimento')).toHaveValue('');
    await expect(remada.getByLabel('Peso do aquecimento')).toHaveValue('');
    await expect(remada.getByLabel('RIR do aquecimento')).toHaveValue('');
  });

  test('"Repetir o último treino desta ficha" preenche exercícios, reps e cargas', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8']);

    await page.getByRole('button', { name: 'Repetir o último treino desta ficha (10/03/2025)' }).click();

    // Reps agora vêm do treino de 10/03 (não da ficha); RIR e observações ficam em branco.
    await expect.poll(() => setValues(supino, 'Reps')).toEqual(['11', '9', '7']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '', '']);
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('Peso do aquecimento')).toHaveValue('20');

    const remada = exerciseCard(page, 'Remada baixa');
    expect(await setValues(remada, 'Reps')).toEqual(['10', '9']);
    expect(await setValues(remada, 'Carga')).toEqual(['50', '50']);
    expect(await setValues(remada, 'RIR')).toEqual(['', '']);
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);
  });

  test('trocar de ficha no meio substitui os exercícios', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await exerciseCard(page, 'Supino reto').getByLabel('RIR da série 1').fill('2');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(2);

    await page.locator('#workoutSheet').selectOption({ label: 'Treino B' });

    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Agachamento livre')).toBeVisible();
    await expect(exerciseCard(page, 'Supino reto')).toHaveCount(0);
    await expect(page.locator('#sheetHint')).toHaveText('1 exercício na ficha — carregado no treino.');
  });
});

test.describe('Treinar · séries', () => {
  test('editar reps, carga, RIR e observação', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');

    await supino.getByLabel('Reps da série 2').fill('9');
    await supino.getByLabel('Carga da série 2').fill('44');
    await supino.getByLabel('RIR da série 2').fill('1');
    await supino.getByLabel('Observação da série 2').fill('falhou na última');

    // Redesenha o formulário (+ série em outro exercício): os valores vêm do estado, não só do campo.
    await exerciseCard(page, 'Remada baixa').locator('button:has(.bi-plus)').click();
    expect(await setValues(supino, 'Reps')).toEqual(['12', '9', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '44', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '1', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', 'falhou na última', '']);
  });

  test('carga com vírgula (27,5) fica 27,5 (regressão do iPhone)', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    const agachamento = exerciseCard(page, 'Agachamento livre');

    await agachamento.getByLabel('Carga da série 1').fill('27,5');
    // Marcar a série redesenha o formulário e soma o volume feito: 8 reps × 27,5 kg = 220 kg (27 daria 216).
    await setButton(agachamento, 1).click();

    await expect(agachamento.getByLabel('Carga da série 1')).toHaveValue('27,5');
    await expect(page.locator('#workoutProgress')).toContainText('220 kg');
  });

  test('adicionar série', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');

    await supino.locator('button:has(.bi-plus)').click();

    await expect(supino.locator('.ex-title small')).toHaveText('4 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10', '8', '']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45', '']);
    await expect(setButton(supino, 4)).toBeVisible();
    await expect(page.locator('#workoutProgress')).toContainText('0/6');
  });

  test('tirar a última série', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    const minus = supino.locator('button:has(.bi-dash)');

    await minus.click();
    await expect(supino.locator('.ex-title small')).toHaveText('2 séries · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '10']);

    // Sempre sobra pelo menos uma série: com uma só, o botão fica desligado.
    await minus.click();
    await expect(supino.locator('.ex-title small')).toHaveText('1 série · descanso 1:30');
    expect(await setValues(supino, 'Reps')).toEqual(['12']);
    await expect(minus).toBeDisabled();
  });

  test('tocar no número da série marca como feita e inicia o descanso; tocar de novo só desmarca', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);
    const supino = exerciseCard(page, 'Supino reto');
    await expect(restBar(page)).toBeHidden();

    await setButton(supino, 1).click();
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(setButton(supino, 1)).toHaveClass(/btn-success/);
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('1:30');

    await page.clock.runFor(20_000);
    await expect(restClock(page)).toHaveText('1:10');

    // Desmarcar não reinicia nem para o descanso.
    await setButton(supino, 1).click();
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'false');
    await expect(setButton(supino, 1)).not.toHaveClass(/btn-success/);
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('1:10');
  });

  test('contador de progresso conta só as séries feitas', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const progress = page.locator('#workoutProgress');
    const supino = exerciseCard(page, 'Supino reto');

    // Reps e cargas já vêm preenchidas, mas nada foi feito ainda.
    await expect(progress).toContainText('0/5séries feitas');
    await expect(progress).toContainText('0 kgvolume feito');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');

    await setButton(supino, 1).click();
    await setButton(supino, 2).click();
    await expect(progress).toContainText('2/5séries feitas');
    await expect(progress).toContainText('905 kgvolume feito'); // 12 × 40 + 10 × 42,5
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');

    await setButton(supino, 3).click();
    await expect(progress).toContainText('3/5séries feitas');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '1 de 2 exercícios concluídos');

    await setButton(supino, 3).click();
    await expect(progress).toContainText('2/5séries feitas');
    await expect(progress.getByRole('img')).toHaveAttribute('aria-label', '0 de 2 exercícios concluídos');
  });
});

test.describe('Treinar · descanso', () => {
  test('começa ao marcar a série, com o tempo dos Ajustes', async ({ page }) => {
    await page.clock.install();
    await withBackup(page, BACKUP);
    await goTo(page, 'Mais');
    await page.locator('#setRestSeconds').fill('45');
    await page.locator('#btnSaveSettings').click();
    await expect(page.locator('#appToastBody')).toHaveText('Metas salvas.');

    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.locator('.ex-title small')).toHaveText('3 séries · descanso 0:45');
    await pauseClock(page);
    await expect(restBar(page)).toBeHidden();

    await setButton(supino, 1).click();
    await expect(restBar(page)).toBeVisible();
    await expect(restClock(page)).toHaveText('0:45');

    await page.clock.runFor(10_000);
    await expect(restClock(page)).toHaveText('0:35');
  });

  test('botão de somar tempo (+15s)', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restClock(page)).toHaveText('1:30');

    await page.locator('#restAdd').click();
    await expect(restClock(page)).toHaveText('1:45');

    await page.clock.runFor(100_000);
    await expect(restClock(page)).toHaveText('0:05');
    await expect(restBar(page)).not.toHaveClass(/is-done/);

    await page.clock.runFor(5_000);
    await expect(restBar(page)).toHaveClass(/is-done/);
  });

  test('parar', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restBar(page)).toBeVisible();

    await page.getByRole('button', { name: 'Parar descanso' }).click();
    await expect(restBar(page)).toBeHidden();

    // Parado de verdade: passado o tempo, o fim do descanso não reaparece.
    await page.clock.runFor(120_000);
    await expect(restBar(page)).toBeHidden();
    await expect(restBar(page)).not.toHaveClass(/is-done/);
  });

  test('no fim só muda de cor: sem som, sem vibração, sem piscar', async ({ page }) => {
    // Registra qualquer tentativa de som, fala ou vibração.
    await page.addInitScript(() => {
      window.__alertas = [];
      const anota = (nome) => window.__alertas.push(nome);
      navigator.vibrate = () => { anota('vibrate'); return true; };
      const Audio = window.Audio;
      window.Audio = function () { anota('Audio'); return new Audio(); };
      for (const nome of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext']) {
        const Original = window[nome];
        if (Original) window[nome] = function () { anota(nome); return new Original(); };
      }
      HTMLMediaElement.prototype.play = function () { anota('play'); return Promise.resolve(); };
      if (window.speechSynthesis) window.speechSynthesis.speak = () => anota('speak');
    });
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    const bar = restBar(page);
    const background = () => bar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const counting = await background();

    await page.clock.runFor(90_000);
    await expect(bar).toHaveClass(/is-done/);
    await expect(bar).toBeVisible();
    await expect(restClock(page)).toHaveText('0:00');
    const done = await background();
    expect(done).toBe('rgb(162, 106, 0)'); // --mt-warn
    expect(done).not.toBe(counting);

    // Fica parado assim até fechar: não some sozinho, não volta a contar, não alterna de cor.
    for (let i = 0; i < 4; i++) {
      await page.clock.runFor(5_000);
      await expect(bar).toBeVisible();
      await expect(bar).toHaveClass(/is-done/);
      await expect(restClock(page)).toHaveText('0:00');
      expect(await background()).toBe(done);
    }

    // Nenhuma animação de CSS (piscar/pulsar) na barra nem dentro dela.
    const animations = await bar.evaluate((el) => [el, ...el.querySelectorAll('*')]
      .map((node) => getComputedStyle(node).animationName)
      .filter((name) => name && name !== 'none'));
    expect(animations).toEqual([]);
    expect(await bar.evaluate((el) => el.getAnimations({ subtree: true })
      .filter((a) => !(a instanceof CSSTransition)).length)).toBe(0);

    expect(await page.evaluate(() => window.__alertas)).toEqual([]);
  });

  test('continua certo depois de o app ir para segundo plano (conta pelo horário de término)', async ({ page }) => {
    await page.clock.install();
    await workoutWithSheet(page, 'Treino A');
    await pauseClock(page);

    await setButton(exerciseCard(page, 'Supino reto'), 1).click();
    await expect(restClock(page)).toHaveText('1:30');

    // Em segundo plano o celular congela os timers: o relógio anda 60 s sem nenhum tick rodar.
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 60_000);
    // Ao voltar, o primeiro tick já mostra o tempo certo (contando ticks mostraria 1:30).
    await page.clock.runFor(250);
    await expect(restClock(page)).toHaveText('0:30');

    // E se o descanso acabou enquanto estava fora, volta já no fim.
    const later = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(later + 120_000);
    await page.clock.runFor(250);
    await expect(restClock(page)).toHaveText('0:00');
    await expect(restBar(page)).toHaveClass(/is-done/);
  });
});

test.describe('Treinar · exercícios e campos', () => {
  /** Abre o seletor de exercício do Treinar e busca um nome. */
  async function searchExercise(page, query) {
    await page.locator('#btnAddExercise').click();
    await expect(page.locator('#exercisePickerModal')).toBeVisible();
    await page.locator('#pickerSearch').fill(query);
  }

  test('adicionar exercício da Biblioteca', async ({ page }) => {
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'maquina azul'); // busca sem acento
    const results = page.locator('#pickerResults');
    await expect(results).toContainText('Biblioteca');
    await results.getByRole('button', { name: /^Rosca na máquina azul/ }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    const rosca = exerciseCard(page, 'Rosca na máquina azul');
    await expect(rosca).toBeVisible();
    await expect(rosca.locator('.ex-title small')).toHaveText('3 séries · descanso 1:30');
  });

  test('adicionar exercício do catálogo', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'Rosca 21');
    const results = page.locator('#pickerResults');
    await expect(results).toContainText('Catálogo (pt-BR)');
    await results.getByRole('button', { name: /^Rosca 21/ }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
  });

  test('adicionar exercício criando um novo', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');

    await searchExercise(page, 'Prancha com peso');
    await page.locator('#pickerResults').getByRole('button', { name: 'Criar "Prancha com peso"' }).click();

    await expect(page.locator('#exercisePickerModal')).toBeHidden();
    await expect(exerciseCard(page, 'Prancha com peso')).toBeVisible();

    // O exercício novo entrou na Biblioteca.
    await goTo(page, 'Fichas');
    await page.locator('#tabExercisesBtn').click();
    await expect(page.locator('#tabExercises')).toContainText('Prancha com peso');
  });

  test('remover um exercício', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await expect(page.locator('#workoutProgress')).toContainText('0/5séries feitas');

    await exerciseCard(page, 'Supino reto').getByRole('button', { name: 'Remover exercício' }).click();

    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Supino reto')).toHaveCount(0);
    await expect(exerciseCard(page, 'Remada baixa')).toBeVisible();
    await expect(page.locator('#workoutProgress')).toContainText('0/2séries feitas');

    await exerciseCard(page, 'Remada baixa').getByRole('button', { name: 'Remover exercício' }).click();
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
    await expect(page.locator('#workoutProgress')).toBeEmpty();
  });

  test('aquecimento por exercício: reps, peso e RIR', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const remada = exerciseCard(page, 'Remada baixa');

    await remada.getByLabel('Reps do aquecimento').fill('12');
    await remada.getByLabel('Peso do aquecimento').fill('22,5');
    await remada.getByLabel('RIR do aquecimento').fill('4');

    // Redesenha o formulário: o aquecimento ficou guardado no exercício certo.
    await remada.locator('button:has(.bi-plus)').click();
    await expect(remada.getByLabel('Reps do aquecimento')).toHaveValue('12');
    await expect(remada.getByLabel('Peso do aquecimento')).toHaveValue('22,5');
    await expect(remada.getByLabel('RIR do aquecimento')).toHaveValue('4');

    const supino = exerciseCard(page, 'Supino reto');
    await expect(supino.getByLabel('Reps do aquecimento')).toHaveValue('15');
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('');
  });

  test('cardio e observações', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const progress = page.locator('#workoutProgress');
    await expect(progress).toContainText('0 mincardio');

    await page.locator('#workoutCardio').fill('25');
    await expect(progress).toContainText('25 mincardio');
    await page.locator('#workoutNotes').fill('Academia cheia, troquei a ordem');

    // Redesenhar as séries não apaga os dois campos.
    await exerciseCard(page, 'Supino reto').locator('button:has(.bi-plus)').click();
    await expect(page.locator('#workoutCardio')).toHaveValue('25');
    await expect(page.locator('#workoutNotes')).toHaveValue('Academia cheia, troquei a ordem');
    await expect(progress).toContainText('25 mincardio');
  });
});

/* ---------- Parte B: rascunho, salvar e treino existente ---------- */

/** Rascunho gravado no aparelho (IndexedDB do app, store `settings`, id `workoutDraft`), ou null. */
function storedDraft(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('meu-treino');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const get = db.transaction('settings').objectStore('settings').get('workoutDraft');
      get.onsuccess = () => { db.close(); resolve(get.result || null); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}

/** Simula o app indo para segundo plano (trocar de app, bloquear a tela). */
async function hidePage(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Faz o próximo confirm() responder "Cancelar" e guarda a pergunta em window.__pergunta. */
async function answerNextConfirmNo(page) {
  await page.evaluate(() => {
    const original = window.confirm;
    window.confirm = (message) => { window.__pergunta = message; window.confirm = original; return false; };
  });
}

/** Abre um treino salvo pelo Início (lista Histórico) e toca em Editar treino. */
async function editSavedWorkout(page, workoutId) {
  await goTo(page, 'Início');
  await page.locator(`#recentWorkouts button[data-view-workout="${workoutId}"]`).click();
  await expect(page.locator('#view-detail')).toBeVisible();
  await page.locator('#detailEdit').click();
  await expect(page.locator('#view-workout')).toBeVisible();
}

const historyCount = (page) => page.locator('#recentWorkouts .section-head .chip');

test.describe('Treinar · rascunho', () => {
  test('toda alteração grava o rascunho; recarregar a página no meio do treino continua de onde parou', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    const supino = exerciseCard(page, 'Supino reto');
    const draft = () => storedDraft(page);

    // Cada tipo de alteração chega sozinho ao rascunho, sem precisar sair da tela.
    await expect.poll(async () => (await draft())?.sheetId).toBe('s-a');
    await supino.getByLabel('Reps da série 2').fill('9');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].reps).toBe('9');
    await supino.getByLabel('Carga da série 2').fill('44');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].load).toBe('44');
    await supino.getByLabel('RIR da série 2').fill('1');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].rir).toBe('1');
    await supino.getByLabel('Observação da série 2').fill('pegada fechada');
    await expect.poll(async () => (await draft())?.formSets[0].sets[1].note).toBe('pegada fechada');
    await supino.getByLabel('RIR do aquecimento').fill('3');
    await expect.poll(async () => (await draft())?.formSets[0].warmup.rir).toBe('3');
    await setButton(supino, 1).click();
    await expect.poll(async () => (await draft())?.formSets[0].sets[0].done).toBe(true);
    await page.locator('#workoutCardio').fill('20');
    await expect.poll(async () => (await draft())?.cardio).toBe('20');
    await page.locator('#workoutNotes').fill('no meio do treino');
    await expect.poll(async () => (await draft())?.notes).toBe('no meio do treino');

    await page.reload();

    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    expect(await setValues(supino, 'Reps')).toEqual(['12', '9', '8']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '44', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['', '1', '']);
    expect(await setValues(supino, 'Observação')).toEqual(['', 'pegada fechada', '']);
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('3');
    await expect(setButton(supino, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#workoutProgress')).toContainText('1/5séries feitas');
    await expect(page.locator('#workoutCardio')).toHaveValue('20');
    await expect(page.locator('#workoutNotes')).toHaveValue('no meio do treino');
    await expect(exerciseCard(page, 'Remada baixa')).toBeVisible();
  });

  test('sair do app (página oculta) grava o rascunho na hora', async ({ page }) => {
    await page.clock.install();
    await withBackup(page, BACKUP);
    await goTo(page, 'Treinar');
    // Relógio parado: a gravação de 500 ms depois da alteração nunca chega a rodar.
    await pauseClock(page);
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await exerciseCard(page, 'Supino reto').getByLabel('Carga da série 1').fill('41');
    expect(await storedDraft(page)).toBeNull();

    await hidePage(page);

    await expect.poll(async () => (await storedDraft(page))?.formSets[0].sets[0].load).toBe('41');
  });

  test('Cancelar descarta as alterações e o rascunho', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutNotes').fill('vou desistir');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('vou desistir');

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    await expect.poll(() => storedDraft(page)).toBeNull();
    await expect(historyCount(page)).toHaveText('2 treinos');

    await goTo(page, 'Treinar');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
    await expect(page.locator('#workoutExercises')).toHaveText('Adicione exercícios ao treino.');
  });

  test('rascunho de outro treino: continuar mantém o treino novo, sem misturar com o que foi aberto', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    await page.locator('#workoutNotes').fill('treino novo de pernas');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('treino novo de pernas');

    // Abrir para editar o treino de 10/03 pergunta; "OK" continua o rascunho (treino novo).
    await editSavedWorkout(page, 'w-ultimo');

    await expect(page.locator('#workoutTitle')).toHaveText('Treinar');
    await expect(page.locator('#draftNotice')).toContainText('Rascunho recuperado');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-b');
    await expect(page.locator('#workoutNotes')).toHaveValue('treino novo de pernas');
    await expect(page.locator('#workoutExercises .card')).toHaveCount(1);
    await expect(exerciseCard(page, 'Agachamento livre')).toBeVisible();
    await expect(page.locator('#workoutDelete')).toBeHidden();
    expect((await storedDraft(page)).editingWorkoutId).toBeNull();
  });

  test('rascunho de outro treino: descartar abre o treino escolhido só com os dados dele', async ({ page }) => {
    await workoutWithSheet(page, 'Treino B');
    await page.locator('#workoutNotes').fill('treino novo de pernas');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('treino novo de pernas');

    await goTo(page, 'Início');
    await page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]').click();
    await expect(page.locator('#view-detail')).toBeVisible();
    await answerNextConfirmNo(page);
    await page.locator('#detailEdit').click();

    await expect(page.locator('#workoutTitle')).toHaveText('Editar treino');
    expect(await page.evaluate(() => window.__pergunta)).toContain('Você tem um treino em andamento que não foi salvo');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutDate')).toHaveValue('2025-03-10');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    await expect(page.locator('#workoutNotes')).toHaveValue('Bom treino');
    await expect(page.locator('#workoutCardio')).toHaveValue('15');
    await expect(exerciseCard(page, 'Agachamento livre')).toHaveCount(0);
    expect(await setValues(exerciseCard(page, 'Supino reto'), 'Reps')).toEqual(['11', '9', '7']);
    await expect.poll(() => storedDraft(page)).toBeNull();
  });
});

test.describe('Treinar · salvar', () => {
  test('treino inválido não é salvo e mostra o motivo', async ({ page }) => {
    await freshApp(page);
    await goTo(page, 'Treinar');
    // Exercício do catálogo sem nenhuma série preenchida, sem aquecimento e sem cardio.
    await page.locator('#btnAddExercise').click();
    await page.locator('#pickerSearch').fill('Rosca 21');
    await page.locator('#pickerResults').getByRole('button', { name: /^Rosca 21/ }).click();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();

    const messages = [];
    page.once('dialog', (dialog) => { messages.push(dialog.message()); dialog.accept(); });
    await page.locator('#workoutSave').click();

    await expect.poll(() => messages).toEqual([
      'Preencha pelo menos uma série (reps ou carga), um aquecimento ou os minutos de cardio.'
    ]);
    await expect(page.locator('#view-workout')).toBeVisible();
    await expect(exerciseCard(page, 'Rosca 21')).toBeVisible();

    await goTo(page, 'Início');
    await expect(page.locator('#recentWorkouts')).toContainText('Nenhum treino registrado ainda');
  });

  test('salvar leva ao Início com o resumo, e o treino aparece no Calendário e no histórico de cada exercício', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-20T10:00:00-03:00'));
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutCardio').fill('30');

    await page.locator('#workoutSave').click();

    // Início: o treino de hoje no topo, com o resumo (2 exercícios, volume 1.265 + 1.000 kg, cardio).
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('3 treinos');
    const first = page.locator('#recentWorkouts button[data-view-workout]').first();
    await expect(first).toHaveAttribute('aria-label', 'Treino A, 20/05/2026, 2 exercícios · 2.265 kg · 30 min cardio');
    await expect(first).toContainText('2 exercícios · 2.265 kg · 30 min cardio');

    // Calendário: o dia de hoje marcado e com link para o treino.
    await goTo(page, 'Calendário');
    await expect(page.locator('#calMonthLabel')).toHaveText('maio de 2026');
    const today = page.getByRole('link', { name: 'Abrir treino de 20/05/2026' });
    await expect(today).toHaveClass(/has-workout/);
    await expect(today).toHaveClass(/today/);
    await today.click();
    await expect(page.locator('#view-detail')).toBeVisible();
    await expect(page.locator('#detailBody')).toContainText('Treino A');
    await expect(page.locator('#detailBody')).toContainText('20/05/2026');

    // Histórico de cada exercício: o treino de hoje é o primeiro.
    for (const [name, total] of [['Supino reto', '3 treinos'], ['Remada baixa', '2 treinos']]) {
      await page.locator('#detailBody .ex-link', { hasText: name }).click();
      await expect(page.locator('#view-exercise')).toBeVisible();
      await expect(page.locator('#exerciseHistoryTitle')).toHaveText(name);
      await expect(page.locator('#exerciseHistory .history-head .chip')).toContainText(total);
      const firstSession = page.locator('#exerciseHistory .card-body.py-2').first();
      await expect(firstSession).toContainText('20/05/2026');
      await expect(firstSession).toContainText('Treino A');
      await page.locator('#exerciseBack').click();
      await expect(page.locator('#view-detail')).toBeVisible();
    }
  });

  test('linha "Recorde" quando bate a maior carga anterior', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    // Maior carga anterior do supino: 45 kg. A remada repete os 50 kg (igual não conta).
    await exerciseCard(page, 'Supino reto').getByLabel('Carga da série 1').fill('47,5');
    await page.locator('#workoutSave').click();
    await expect(page.locator('#view-dashboard')).toBeVisible();

    const first = page.locator('#recentWorkouts button[data-view-workout]').first();
    await expect(first.locator('.pr-count')).toHaveText('1');
    await first.click();

    const supino = page.locator('#detailBody .card').filter({ has: page.locator('.ex-link', { hasText: 'Supino reto' }) });
    await expect(supino.locator('.pr-line')).toHaveText('Recorde: 47,5 kg × 12 (antes: 45 kg)');
    const remada = page.locator('#detailBody .card').filter({ has: page.locator('.ex-link', { hasText: 'Remada baixa' }) });
    await expect(remada.locator('.pr-line')).toHaveCount(0);
  });

  test('depois de salvar, o rascunho some', async ({ page }) => {
    await workoutWithSheet(page, 'Treino A');
    await page.locator('#workoutNotes').fill('salvando');
    await expect.poll(async () => (await storedDraft(page))?.notes).toBe('salvando');

    await page.locator('#workoutSave').click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    expect(await storedDraft(page)).toBeNull();
    // Sem treino em andamento, o atalho do Início volta (a próxima ficha depois da A é a B).
    await expect(page.getByRole('button', { name: 'Treinar: Treino B' })).toBeVisible();

    await page.reload();
    await expect(page.locator('#weekProgress .week-card')).toBeVisible();
    await expect(page.locator('#draftBanner')).toBeEmpty();
    await goTo(page, 'Treinar');
    await expect(page.locator('#draftNotice')).toBeEmpty();
    await expect(page.locator('#workoutSheet')).toHaveValue('');
    await expect(page.locator('#workoutNotes')).toHaveValue('');
  });
});

test.describe('Treinar · treino existente', () => {
  test('abrir pelo detalhe, editar e salvar (sem duplicar)', async ({ page }) => {
    await withBackup(page, BACKUP);
    await expect(historyCount(page)).toHaveText('2 treinos');
    await editSavedWorkout(page, 'w-ultimo');

    await expect(page.locator('#workoutTitle')).toHaveText('Editar treino');
    await expect(page.locator('#workoutDate')).toHaveValue('2025-03-10');
    await expect(page.locator('#workoutSheet')).toHaveValue('s-a');
    await expect(page.locator('#workoutCardio')).toHaveValue('15');
    await expect(page.locator('#workoutNotes')).toHaveValue('Bom treino');
    const supino = exerciseCard(page, 'Supino reto');
    expect(await setValues(supino, 'Reps')).toEqual(['11', '9', '7']);
    expect(await setValues(supino, 'Carga')).toEqual(['40', '42,5', '45']);
    expect(await setValues(supino, 'RIR')).toEqual(['2', '1', '0']);
    await expect(supino.getByLabel('RIR do aquecimento')).toHaveValue('3');
    await expect(page.locator('#workoutDelete')).toBeVisible();
    await expect(page.locator('#workoutExport')).toBeVisible();

    await supino.getByLabel('Reps da série 3').fill('8');
    await page.locator('#workoutNotes').fill('Editado depois');
    await page.locator('#workoutSave').click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('2 treinos');
    await expect(page.locator('#recentWorkouts button[data-view-workout]')).toHaveCount(2);
    await page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]').click();
    await expect(page.locator('#detailBody')).toContainText('Editado depois');
    await expect(page.locator('#detailBody')).toContainText('8 reps · 45 kg · RIR 0');
    await expect(page.locator('#detailBody')).toContainText('10/03/2025');
  });

  test('excluir o treino', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');

    await page.getByRole('button', { name: 'Excluir treino' }).click();

    await expect(page.locator('#view-dashboard')).toBeVisible();
    await expect(historyCount(page)).toHaveText('1 treino');
    await expect(page.locator('#recentWorkouts button[data-view-workout="w-ultimo"]')).toHaveCount(0);
    await expect(page.locator('#recentWorkouts button[data-view-workout="w-antigo"]')).toBeVisible();

    // Excluído de verdade: a "última vez" do supino volta a ser o treino de 03/03.
    await goTo(page, 'Treinar');
    await page.locator('#workoutSheet').selectOption({ label: 'Treino A' });
    await expect(exerciseCard(page, 'Supino reto').locator('.last-session')).toContainText('Última vez (03/03/2025)');
  });

  test('exportar como texto (formato do WhatsApp, só a data no topo)', async ({ page }) => {
    await withBackup(page, BACKUP);
    await editSavedWorkout(page, 'w-ultimo');

    await page.locator('#workoutExport').click();

    await expect(page.locator('#exportModal')).toBeVisible();
    await expect(page.locator('#exportText')).toHaveValue([
      '*10/03/2025*',
      'Ficha: _Treino A_',
      '',
      '1. *Supino reto*',
      '- Aquecimento: 15 reps · 20 kg · RIR 3',
      '- Série 1: 11 reps · 40 kg · RIR 2',
      '- Série 2: 9 reps · 42,5 kg · RIR 1',
      '- Série 3: 7 reps · 45 kg · RIR 0',
      '',
      '2. *Remada baixa*',
      '- Série 1: 10 reps · 50 kg · RIR 2',
      '- Série 2: 9 reps · 50 kg · RIR 1',
      '',
      '*Cardio:* 15 min',
      '*Observações:* Bom treino'
    ].join('\n'));
  });
});
