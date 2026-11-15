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
  assert.match(body, /workoutRecords\(state\.workouts, w\)\.length/);
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

/* ---------- peso corporal ---------- */

test('setBodyWeight grava um peso por dia (aceita virgula) e nao altera o mapa recebido', () => {
  const antes = { '2026-10-01': 72 };
  const depois = core.setBodyWeight(antes, '2026-10-03', '72,5');
  assert.deepEqual(depois, { '2026-10-01': 72, '2026-10-03': 72.5 });
  assert.deepEqual(antes, { '2026-10-01': 72 });
  assert.deepEqual(core.setBodyWeight(depois, '2026-10-03', '71.8'), { '2026-10-01': 72, '2026-10-03': 71.8 }, 'mesmo dia substitui');
  assert.deepEqual(core.setBodyWeight(undefined, '2026-10-03', 70), { '2026-10-03': 70 }, 'primeiro registro');
});

test('setBodyWeight: campo vazio ou invalido apaga o registro daquele dia', () => {
  const mapa = { '2026-10-01': 72, '2026-10-03': 72.5 };
  ['', '   ', 'abc', 0, -5, 900, null].forEach((valor) => {
    assert.deepEqual(core.setBodyWeight(mapa, '2026-10-03', valor), { '2026-10-01': 72 }, String(valor));
  });
  assert.deepEqual(core.setBodyWeight(mapa, 'ontem', 70), mapa, 'data invalida nao grava nada');
});

test('bodyWeightRows: mais recente primeiro, diferenca para o registro anterior e barra entre 30 e 100', () => {
  const linhas = core.bodyWeightRows({ '2026-10-01': 74, '2026-10-08': 73, '2026-10-15': 72 }, 8);
  assert.deepEqual(linhas.map((r) => r.date), ['2026-10-15', '2026-10-08', '2026-10-01']);
  assert.deepEqual(linhas.map((r) => r.weight), [72, 73, 74]);
  assert.deepEqual(linhas.map((r) => r.diff), [-1, -1, null], 'o primeiro registro nao tem com o que comparar');
  assert.deepEqual(linhas.map((r) => r.pct), [30, 65, 100]);
});

test('bodyWeightRows: limite, peso igual, arredondamento e lista vazia', () => {
  const muitos = {};
  for (let d = 1; d <= 12; d++) muitos['2026-10-' + String(d).padStart(2, '0')] = 70 + d / 10;
  const linhas = core.bodyWeightRows(muitos, 8);
  assert.equal(linhas.length, 8);
  assert.equal(linhas[7].date, '2026-10-05');
  assert.equal(linhas[7].diff, 0.1, 'o ultimo mostrado compara com um registro que ficou fora da lista');
  assert.equal(core.bodyWeightRows(muitos).length, 8, 'limite padrao');

  assert.deepEqual(core.bodyWeightRows({ '2026-10-01': 72, '2026-10-02': 72 }, 8).map((r) => r.pct), [100, 100]);
  assert.equal(core.bodyWeightRows({ '2026-10-01': 72 }, 8)[0].diff, null);
  assert.deepEqual(core.bodyWeightRows({}, 8), []);
  assert.deepEqual(core.bodyWeightRows(undefined, 8), []);
});

test('peso corporal entra no backup e e validado na importacao', () => {
  const b = core.normalizeBackup({ settings: { weekAnchor: '2026-10-05', bodyWeights: {
    '2026-10-01': 72.5, '2026-10-02': '73,1', '<img src=x>': 70, '2026-10-03': 'abc', '2026-10-04': 9999
  } } });
  assert.deepEqual(b.settings.bodyWeights, { '2026-10-01': 72.5, '2026-10-02': 73.1 });
  assert.deepEqual(core.normalizeBackup(b).settings.bodyWeights, b.settings.bodyWeights, 'idempotente');
});

test('backups antigos (sem peso corporal) continuam iguais: o campo nao e inventado', () => {
  const antigo = JSON.parse(read('tests/fixtures/backup-v1.json'));
  const b = core.normalizeBackup(antigo.data || antigo);
  assert.equal('bodyWeights' in b.settings, false);
  assert.deepEqual(core.bodyWeightRows(b.settings.bodyWeights, 8), []);
});

test('tela do peso corporal: campos no Calendario, salva nas configuracoes (sem store novo no banco)', () => {
  ['bodyWeightDate', 'bodyWeightValue', 'btnSaveBodyWeight', 'bodyWeightList'].forEach((id) => {
    assert.ok(HTML.indexOf('id="' + id + '"') !== -1, id);
  });
  assert.match(HTML, /id="bodyWeightValue"[^>]*|inputmode="decimal"[^>]*id="bodyWeightValue"/);
  const save = APP.slice(APP.indexOf('async function saveBodyWeight'), APP.indexOf('/* ---------- colinha ---------- */'));
  assert.match(save, /state\.settings\.bodyWeights = setBodyWeight\(/);
  assert.match(save, /dbPut\('settings', state\.settings\)/);
  assert.match(read('js/db.js'), /const DB_VERSION = 2;/, 'versao do banco intacta');
});
