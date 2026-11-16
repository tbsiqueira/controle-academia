'use strict';

/* Testes das melhorias de uso (Início, Treinar, Calendário, evolução) e das melhorias de tela.
   A lógica fica no core.js; o que é só marcação (index.html, css, app.js) é conferido lendo o arquivo. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}
const APP = read('js/app.js');
const HTML = read('index.html');
const CSS = read('css/styles.css');

/* ---------- resumo no card do Início ---------- */

test('fmtThousands separa o milhar com ponto, sem depender do idioma do aparelho', () => {
  assert.equal(core.fmtThousands(12400), '12.400');
  assert.equal(core.fmtThousands(999), '999');
  assert.equal(core.fmtThousands(1000), '1.000');
  assert.equal(core.fmtThousands(1234567.6), '1.234.568');
  assert.equal(core.fmtThousands(0), '0');
  assert.equal(core.fmtThousands(null), '0');
});

test('workoutSummary: exercicios, volume e cardio numa linha', () => {
  const treino = {
    cardioMinutes: 30,
    sets: [
      { exerciseId: 'e1', exerciseName: 'Supino', number: 1, reps: 10, load: 400 },
      { exerciseId: 'e1', exerciseName: 'Supino', number: 2, reps: 10, load: 400 },
      { exerciseId: 'e2', exerciseName: 'Remada', number: 1, reps: 10, load: 440 }
    ],
    warmups: [{ exerciseId: 'e1', exerciseName: 'Supino', reps: 15, load: 100 }, { exerciseId: 'e3', exerciseName: 'Rosca', reps: 15, load: 10 }]
  };
  assert.equal(core.workoutSummary(treino), '3 exercícios · 12.400 kg · 30 min cardio', 'aquecimento conta exercicio mas nao volume');
});

test('workoutSummary deixa de fora o que e zero e usa o singular', () => {
  assert.equal(core.workoutSummary({ sets: [{ exerciseName: 'Flexao', number: 1, reps: 20, load: null }] }), '1 exercício', 'peso do corpo: sem volume');
  assert.equal(core.workoutSummary({ cardioMinutes: 45, sets: [] }), '45 min cardio', 'treino so de cardio');
  assert.equal(core.workoutSummary({ sets: [], warmups: [] }), '');
  assert.equal(core.workoutSummary({}), '');
  assert.equal(core.workoutSummary(null), '');
});

test('workoutSummary bate com os dados de exemplo (mesmo volume da evolucao semanal)', () => {
  const sample = JSON.parse(read('data/sample-data.json')).data;
  sample.workouts.forEach((w) => {
    const texto = core.workoutSummary(w);
    assert.ok(texto.indexOf(core.groupSets(w.sets, w.warmups).length + ' exercícios') === 0, w.id);
    assert.ok(texto.indexOf(core.fmtThousands(core.workoutVolume(w)) + ' kg') !== -1, w.id);
  });
});

test('card do Inicio mostra o resumo e a contagem de recordes (app.js)', () => {
  const body = APP.slice(APP.indexOf('function renderWorkoutList'), APP.indexOf('/* ---------- referências por id'));
  assert.match(body, /workoutSummary\(w\)/);
  assert.match(body, /recordCounts\(state\.workouts\)/, 'recordes numa passada só, não por card');
  assert.match(body, /esc\(summary\)/, 'o resumo e escapado');
  assert.match(CSS, /\.pr-count \{/);
});

/* ---------- começar o treino de hoje em um toque ---------- */

const FICHAS = [
  { id: 'sc', name: 'TREINO C - corpo inteiro', active: true },
  { id: 'sa', name: 'TREINO A - inferiores', active: true },
  { id: 'sb', name: 'TREINO B - superiores', active: true }
];

test('nextSheet sugere a ficha seguinte a ultima usada, em ordem alfabetica, e da a volta', () => {
  const treino = (sheetId, date) => ({ id: sheetId + date, date: date, sheetId: sheetId });
  assert.equal(core.nextSheet([treino('sa', '2026-10-01')], FICHAS).id, 'sb');
  assert.equal(core.nextSheet([treino('sa', '2026-10-01'), treino('sb', '2026-10-03')], FICHAS).id, 'sc');
  assert.equal(core.nextSheet([treino('sc', '2026-10-05'), treino('sb', '2026-10-03')], FICHAS).id, 'sa', 'depois da ultima volta para a primeira');
  assert.equal(core.nextSheet([treino('sb', '2026-10-03'), treino('sc', '2026-10-01')], FICHAS).id, 'sc', 'vale a data, nao a ordem da lista');
});

test('nextSheet sem historico (ou com a ultima ficha excluida/desativada) comeca pela primeira', () => {
  assert.equal(core.nextSheet([], FICHAS).id, 'sa');
  assert.equal(core.nextSheet(null, FICHAS).id, 'sa');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'apagada' }], FICHAS).id, 'sa');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: null }], FICHAS).id, 'sa', 'treino sem ficha nao conta');

  const comInativa = FICHAS.map((f) => (f.id === 'sb' ? Object.assign({}, f, { active: false }) : f));
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'sa' }], comInativa).id, 'sc', 'pula a desativada');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'sb' }], comInativa).id, 'sa');
});

test('nextSheet: sem ficha ativa nao sugere nada; uma ficha so e sempre ela; aceita dados antigos', () => {
  assert.equal(core.nextSheet([], []), null);
  assert.equal(core.nextSheet([], null), null);
  assert.equal(core.nextSheet([], [null, { id: 's1', name: 'A', active: false }]), null);
  const uma = [{ id: 's1', name: 'Unica' }];
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 's1' }], uma).id, 's1');
  // v1: treino guardava typeId; id numerico x texto
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', typeId: 1 }], [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]).id, '2');
});

test('Inicio tem o botao "Treinar: <ficha>" e o Treinar carrega a ficha escolhida', () => {
  assert.match(HTML, /<div id="quickStart"><\/div>/);
  const quick = APP.slice(APP.indexOf('function renderQuickStart'), APP.indexOf('function renderWeek()'));
  assert.match(quick, /draftHasContent\(state\.draft\) \? null : nextSheet\(state\.workouts, state\.sheets\)/, 'some com treino em andamento');
  assert.match(quick, /esc\(sheet\.name\)/);
  const form = APP.slice(APP.indexOf('function renderWorkoutForm'), APP.indexOf('function renderFormSets'));
  assert.match(form, /if \(quickSheet && !draft && !editing\)/, 'nunca por cima de um rascunho ou de uma edicao');
  assert.match(form, /state\.pendingSheetId = null;/, 'vale para uma abertura so');
});

/* ---------- remover uma série ---------- */

test('setHasData: serie com qualquer campo preenchido tem dado; em branco nao', () => {
  const vazio = { number: 3, reps: '', load: '', rir: '', note: '' };
  assert.equal(core.setHasData(vazio), false, 'o numero da serie nao conta como dado');
  assert.equal(core.setHasData({ number: 3, reps: null, load: undefined }), false);
  assert.equal(core.setHasData(Object.assign({}, vazio, { reps: 12 })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { load: '27,5' })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { rir: 0 })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { note: 'caiu' })), true);
});

test('groupHasData continua igual depois de reaproveitar setHasData', () => {
  assert.equal(core.groupHasData({ sets: [{ reps: '', load: '' }, { reps: '', load: 40 }] }), true);
  assert.equal(core.groupHasData({ warmup: { reps: '', load: '', rir: '' }, sets: [{ reps: '', load: '' }] }), false);
  assert.equal(core.groupHasData({ warmup: { reps: 15 }, sets: [] }), true);
});

test('Treinar tem o botao "- serie": tira a ultima, nunca a unica, e confirma se tem dado', () => {
  const body = APP.slice(APP.indexOf('function removeFormSet'), APP.indexOf('function removeFormExercise'));
  assert.match(body, /group\.sets\.length <= 1\) return;/, 'sempre sobra uma serie');
  assert.match(body, /setHasData\(last\) && !confirm\(/);
  assert.ok(body.indexOf('confirm(') < body.indexOf('.pop()'), 'pergunta antes de remover');
  assert.match(body, /scheduleDraftSave\(\)/, 'o rascunho acompanha');
  assert.match(APP, /onclick="removeFormSet\(' \+ exIdx \+ '\)"' \+ \(group\.sets\.length <= 1 \? ' disabled' : ''\)/);
});

/* ---------- série feita: inicia o descanso pela própria linha ---------- */

test('setRowHtml: o numero da serie e um botao que chama toggleSetDone', () => {
  const html = core.setRowHtml(2, 1, { number: 2, reps: 10, load: 40, rir: '', note: '' }, true);
  assert.match(html, /<button type="button" class="btn set-done w-100 btn-outline-secondary"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-label="Série 2: marcar como feita e iniciar o descanso"/);
  assert.match(html, /onclick="toggleSetDone\(2,1\)">2<\/button>/);
  assert.equal((html.match(/<input /g) || []).length, 4, 'os quatro campos continuam la');
});

test('setRowHtml: serie feita fica verde, com o visto, e avisa o leitor de tela', () => {
  const html = core.setRowHtml(0, 0, { number: 1, reps: 10, load: 40, done: true }, true);
  assert.match(html, /class="btn set-done w-100 btn-success"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="Série 1 feita \(toque para desmarcar\)"/);
  assert.match(html, />1 <i class="bi bi-check-lg"><\/i><\/button>/);
});

test('a carga continua com a coluna larga e a linha fecha a grade de 12', () => {
  const html = core.setRowHtml(0, 0, { number: 1, load: 102.5 }, true);
  assert.match(html, /<div class="col-3"><input type="text" inputmode="decimal"[^>]*value="102,5"/);
  const cols = (html.match(/class="col-(\d+)/g) || []).map((c) => Number(c.replace(/\D/g, '')));
  assert.equal(cols.reduce((a, b) => a + b, 0), 12);
});

test('toggleSetDone marca, inicia o descanso so ao marcar e nao vaza para o treino salvo', () => {
  const body = APP.slice(APP.indexOf('function toggleSetDone'), APP.indexOf('function removeFormSet'));
  assert.match(body, /if \(group\.sets\[setIdx\]\.done\) startRest\(\);/, 'desmarcar nao reinicia o timer');
  assert.match(body, /scheduleDraftSave\(\)/, 'o rascunho guarda o que ja foi feito');

  const save = APP.slice(APP.indexOf('async function saveWorkout'), APP.indexOf('async function deleteWorkout'));
  assert.doesNotMatch(save, /done/, 'o treino salvo nao ganha campo novo (formato do banco intacto)');

  // repetir/editar um treino monta o formulario sem "done"
  const form = core.formFromWorkout({ sets: [{ exerciseName: 'Supino', number: 1, reps: 10, load: 40, done: true }] });
  assert.equal('done' in form[0].sets[0], false);
  assert.equal('done' in core.groupSets([{ exerciseName: 'Supino', number: 1, done: true }], [])[0].sets[0], false);
});

test('fim do descanso continua sem som, vibracao nem animacao (so cor)', () => {
  assert.doesNotMatch(APP, /vibrate\(|new Audio|AudioContext|\.play\(\)/);
  const rule = CSS.slice(CSS.indexOf('.set-done {'), CSS.indexOf('}', CSS.indexOf('.set-done {')));
  assert.doesNotMatch(rule, /animation|transition/);
});

/* ---------- calendário: tocar no dia abre o treino ---------- */

test('workoutsByDate agrupa por dia, com o treino mais recente do dia primeiro', () => {
  const manha = { id: 'manha', date: '2026-10-08', createdAt: '2026-10-08T08:00:00.000Z' };
  const noite = { id: 'noite', date: '2026-10-08', createdAt: '2026-10-08T20:00:00.000Z' };
  const outro = { id: 'outro', date: '2026-10-10' };
  const original = [manha, outro, noite];
  const mapa = core.workoutsByDate(original);

  assert.deepEqual(Object.keys(mapa).sort(), ['2026-10-08', '2026-10-10']);
  assert.deepEqual(mapa['2026-10-08'].map((w) => w.id), ['noite', 'manha'], 'o link do dia abre o mais recente');
  assert.deepEqual(mapa['2026-10-10'].map((w) => w.id), ['outro']);
  assert.deepEqual(original.map((w) => w.id), ['manha', 'outro', 'noite'], 'nao reordena a lista do app');
});

test('workoutsByDate ignora treino sem data valida e aceita lista vazia', () => {
  const mapa = core.workoutsByDate([{ id: 'a', date: '' }, { id: 'b' }, { id: 'c', date: '08/10/2026' }, { id: 'd', date: '2026-10-08' }]);
  assert.deepEqual(Object.keys(mapa), ['2026-10-08']);
  assert.deepEqual(core.workoutsByDate([]), {});
  assert.deepEqual(core.workoutsByDate(null), {});
});

test('calendario: dia com treino vira link para #/detail/<id>; dia vazio continua sem link', () => {
  const body = APP.slice(APP.indexOf('function renderCalendar'), APP.indexOf('/* ---------- evolução semanal (volume'));
  assert.match(body, /workoutsByDate\(state\.workouts\)/);
  assert.match(body, /href="#\/detail\/' \+ esc\(dayWorkouts\[0\]\.id\)/);
  assert.match(body, /aria-label="' \+ esc\('Abrir treino de '/);
  assert.match(body, /: '<div class="' \+ classes \+ '">' \+ day \+ '<\/div>'/);
  assert.doesNotMatch(body, /w\.date\.indexOf/, 'nao quebra mais com treino sem data');
  assert.match(CSS, /a\.cal-cell \{/);
});

/* ---------- 1RM estimado ---------- */

test('estimate1RM usa Epley: carga x (1 + reps/30), com uma casa decimal', () => {
  assert.equal(core.estimate1RM(100, 10), 133.3);
  assert.equal(core.estimate1RM(60, 5), 70);
  assert.equal(core.estimate1RM(40, 30), 80);
  assert.equal(core.estimate1RM(100, 1), 100, 'uma repeticao e a propria carga');
  assert.equal(core.estimate1RM('27,5', '12'), 38.5, 'aceita o texto do formulario');
});

test('estimate1RM sem carga ou sem reps nao estima nada', () => {
  assert.equal(core.estimate1RM(0, 10), 0, 'peso do corpo');
  assert.equal(core.estimate1RM(null, 10), 0);
  assert.equal(core.estimate1RM(100, 0), 0);
  assert.equal(core.estimate1RM(100, null), 0);
  assert.equal(core.estimate1RM(-20, 10), 0);
});

test('best1RMForExercise: mais reps com a mesma carga tambem e progresso', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const serie = (reps, load, id) => ({ exerciseId: id || 'e1', exerciseName: 'Supino', number: 1, reps: reps, load: load });
  const semana1 = { id: 'w1', date: '2026-10-01', sets: [serie(8, 60)] };
  const semana2 = { id: 'w2', date: '2026-10-08', sets: [serie(10, 60)] };

  assert.equal(core.bestSetForExercise(semana1, alvo).load, core.bestSetForExercise(semana2, alvo).load, 'a carga nao mudou');
  assert.ok(core.best1RMForExercise(semana2, alvo) > core.best1RMForExercise(semana1, alvo));
  assert.equal(core.best1RMForExercise(semana1, alvo), 76);
  assert.equal(core.best1RMForExercise(semana2, alvo), 80);
});

test('best1RMForExercise pega a melhor serie do exercicio e ignora os outros', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const treino = { sets: [
    { exerciseId: 'e1', number: 1, reps: 12, load: 50 },   // 70
    { exerciseId: 'e1', number: 2, reps: 6, load: 60 },    // 72
    { exerciseId: 'e2', number: 1, reps: 10, load: 200 }
  ] };
  assert.equal(core.best1RMForExercise(treino, alvo), 72, 'nem sempre e a serie mais pesada nem a de mais reps');
  assert.equal(core.best1RMForExercise({ sets: [{ exerciseId: 'e1', reps: 20, load: null }] }, alvo), 0);
  assert.equal(core.best1RMForExercise({ sets: [] }, alvo), 0);
  assert.equal(core.best1RMForExercise({}, alvo), 0);
  assert.equal(core.best1RMForExercise(null, alvo), 0);
});

test('evolucao do exercicio mostra o 1RM estimado so quando existe (app.js)', () => {
  const body = APP.slice(APP.indexOf('function renderExerciseHistory'), APP.indexOf('/* ---------- workout draft'));
  assert.match(body, /rm: best1RMForExercise\(w, target\)/);
  assert.match(body, /topRM > 0 \?/, 'exercicio sem carga nao ganha "1RM 0 kg"');
  assert.match(body, /r\.rm > 0 \?/);
  assert.match(body, /prLoad > 0 \?/, 'o selo de PR continua condicionado a carga real');
});

/* ---------- avisos de sucesso sem toque extra (toast) ---------- */

test('index.html tem o aviso que some sozinho, anunciado para leitor de tela', () => {
  assert.match(HTML, /<div id="appToast" class="toast[^"]*" role="status" aria-live="polite"/);
  assert.match(HTML, /id="appToastBody"/);
});

test('mensagens de sucesso usam showToast e nao pedem mais um toque em OK', () => {
  ['Metas salvas.', 'Semana iniciada hoje (', 'Texto copiado!', 'Backup importado', 'Dados anteriores restaurados.'].forEach((msg) => {
    assert.ok(APP.indexOf("showToast('" + msg) !== -1, msg + ' virou toast');
    assert.ok(APP.indexOf("alert('" + msg) === -1, msg + ' nao e mais alert');
  });
  assert.match(APP, /getElementById\('appToastBody'\)\.textContent = message;/, 'texto puro (sem HTML)');
});

test('erros, validacoes e confirmacoes continuam bloqueando (alert/confirm)', () => {
  ['Arquivo JSON inválido.', 'Informe o nome da ficha.', 'Preencha pelo menos uma série', "Erro: '"].forEach((msg) => {
    assert.ok(APP.indexOf("alert('" + msg) !== -1, msg);
  });
  assert.ok((APP.match(/confirm\(/g) || []).length >= 10, 'perguntas antes de apagar/substituir continuam');
});

/* ---------- área de toque dos botões de ícone ---------- */

test('botoes pequenos so com icone tem pelo menos 44px de area de toque', () => {
  const rule = CSS.slice(CSS.indexOf('.btn-sm[aria-label] {'), CSS.indexOf('}', CSS.indexOf('.btn-sm[aria-label] {')));
  assert.match(rule, /min-width: 44px;/);
  assert.match(rule, /min-height: 44px;/);
});

test('todo botao pequeno so com icone tem aria-label (e por ele que a regra de 44px pega)', () => {
  const fontes = APP + read('js/core.js') + HTML;
  const botoes = fontes.match(/<button[^>]*class="btn btn-sm[^>]*>(?:' \+\s*)?<i class="bi [^"]*"><\/i><\/button>/g) || [];
  assert.ok(botoes.length >= 8, 'achou os botoes de icone (' + botoes.length + ')');
  botoes.forEach((b) => assert.match(b, /aria-label="/, b.slice(0, 120)));
});

/* ---------- card Debug fechado por padrão ---------- */

// O <details> das opcoes avancadas, na tela Mais (as dicas recolhiveis das Fichas tambem usam <details>).
const ADVANCED = HTML.indexOf('<details', HTML.indexOf('id="view-more"'));

test('Debug (atualizar, apagar tudo, dados de exemplo) fica dentro de um <details> fechado', () => {
  const inicio = ADVANCED;
  const fim = HTML.indexOf('</details>', inicio);
  assert.ok(inicio !== -1 && fim > inicio);
  assert.doesNotMatch(HTML.slice(inicio, HTML.indexOf('>', inicio)), /\bopen\b/, 'comeca fechado');
  const dentro = HTML.slice(inicio, fim);
  ['btnForceUpdate', 'btnEraseAll', 'btnLoadSample', 'sampleStatus', 'storageInfo'].forEach((id) => {
    assert.ok(dentro.indexOf('id="' + id + '"') !== -1, id + ' dentro das opcoes avancadas');
  });
  assert.match(dentro, /<summary[^>]*>[^<]*apagar dados/i, 'o resumo diz o que tem dentro');
});

test('backup (Exportar/Importar/Desfazer) continua a vista, fora das opcoes avancadas', () => {
  const antes = HTML.slice(HTML.indexOf('id="view-more"'), ADVANCED);
  ['btnExport', 'btnImport', 'btnUndoImport', 'backupStatus'].forEach((id) => {
    assert.ok(antes.indexOf('id="' + id + '"') !== -1, id);
  });
});

/* ---------- campos do aquecimento com nome para leitor de tela ---------- */

test('os tres campos do aquecimento tem aria-label (placeholder some quando o campo e preenchido)', () => {
  const body = APP.slice(APP.indexOf('function renderFormSets'), APP.indexOf('function setWarmupField'));
  ['Reps do aquecimento', 'Peso do aquecimento', 'RIR do aquecimento'].forEach((label) => {
    assert.ok(body.indexOf('aria-label="' + label + '"') !== -1, label);
  });
  assert.equal((body.match(/oninput="setWarmupField\(/g) || []).length, 3, 'os tres continuam ligados ao setWarmupField');
});

/* ---------- Criar com IA: texto para a IA e resposta na mesma janela ---------- */

test('Criar com IA junta pedir e importar num botao e numa janela so', () => {
  assert.match(HTML, /id="btnImportSheet"><i class="bi bi-stars"><\/i> Criar com IA</, 'botao unico na aba Fichas');
  const modal = HTML.slice(HTML.indexOf('id="sheetImportModal"'), HTML.indexOf('id="exportModal"'));
  assert.match(modal, /class="btn btn-primary w-100 mb-2" id="iaCopy"/, 'Copiar texto verde, dentro da janela');
  assert.match(modal, /id="iaText" rows="2" readonly/, 'texto para a IA com 2 linhas');
  assert.ok(modal.indexOf('id="iaText"') < modal.indexOf('id="sheetImportText"'), 'primeiro copia, depois cola a resposta');
  assert.match(CSS, /\.steps\[start="3"\] \{\s*counter-reset: step 2;/, 'segunda lista continua no passo 3');
  assert.match(APP, /function openSheetImport\(\) \{[\s\S]*?guard\(renderIa\)\(\);[\s\S]*?\.show\(\);/, 'abrir a janela carrega o texto');
  assert.doesNotMatch(HTML + APP, /view-ia|#\/ia|iaShare|Pedir uma ficha/, 'tela #/ia e Compartilhar removidos');
});

/* ---------- Mais -> Instalar o app (PWA) ---------- */

test('installHint: instalado, botao do navegador, iPhone ou menu do navegador', () => {
  assert.match(core.installHint(true, true, true), /já está instalado/, 'instalado vence tudo');
  assert.match(core.installHint(false, true, false), /Toque em Instalar/);
  assert.match(core.installHint(false, false, true), /Safari.*Adicionar à Tela de Início.*Exportar/);
  assert.match(core.installHint(false, false, false), /menu do navegador/);
});

test('card Instalar o app fica entre Dados e as opcoes avancadas', () => {
  const dados = HTML.indexOf('bi-database"></i> Dados');
  const install = HTML.indexOf('bi-download"></i> Instalar o app');
  assert.ok(dados > 0 && install > dados && install < HTML.indexOf('Opções avançadas'));
  assert.match(HTML, /id="btnInstall"/);
  assert.match(APP, /addEventListener\('beforeinstallprompt', function \(e\) \{\s*e\.preventDefault\(\);\s*installPrompt = e;/);
  assert.match(APP, /getElementById\('btnInstall'\)\.addEventListener\('click', guard\(installApp\)\)/);
});
