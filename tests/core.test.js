'use strict';

/* Testes de unidade do Meu Treino.
   Rodam em Node sem nenhuma dependência:  node --test tests/
   Cobrem a lógica pura (js/core.js) e a compatibilidade de dados entre versões. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

/* ---------- datas ---------- */

test('pad2 completa com zero a esquerda', () => {
  assert.equal(core.pad2(3), '03');
  assert.equal(core.pad2(12), '12');
});

test('fmtDate e parseDate fazem ida e volta', () => {
  assert.equal(core.fmtDate(new Date(2026, 9, 8)), '2026-10-08');
  assert.equal(core.fmtDate(core.parseDate('2026-10-08')), '2026-10-08');
  assert.equal(core.fmtDate(new Date(2027, 0, 1)), '2027-01-01');
});

test('addDaysISO atravessa fim de mes e de ano', () => {
  assert.equal(core.addDaysISO('2026-10-08', 6), '2026-10-14');
  assert.equal(core.addDaysISO('2026-10-30', 3), '2026-11-02');
  assert.equal(core.addDaysISO('2026-12-30', 3), '2027-01-02');
});

test('fmtBR formata no padrao brasileiro', () => {
  assert.equal(core.fmtBR('2026-10-08'), '08/10/2026');
  assert.equal(core.fmtBR(''), '—');
});

/* ---------- texto e numeros ---------- */

test('esc neutraliza HTML', () => {
  assert.equal(core.esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  assert.equal(core.esc(null), '');
  assert.equal(core.esc(undefined), '');
  assert.equal(core.esc(0), '0');
});

test('toNum e toNumOrNull', () => {
  assert.equal(core.toNum('12'), 12);
  assert.equal(core.toNum('12.5'), 12.5);
  assert.equal(core.toNum('abc'), 0);
  assert.equal(core.toNum(null), 0);
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('0'), 0);
  assert.equal(core.toNumOrNull('27.5'), 27.5);
});

test('normalizeText ignora acentos, caixa e espacos', () => {
  assert.equal(core.normalizeText('Puxada Máquina'), 'puxada maquina');
  assert.equal(core.normalizeText('  ELEVAÇÃO Pélvica '), 'elevacao pelvica');
  assert.equal(core.normalizeText(null), '');
  assert.ok(core.normalizeText('Puxada Máquina').indexOf(core.normalizeText('puxada maquina')) === 0);
});

/* ---------- configuracoes e semana ---------- */

test('defaultSettings usa metas padrao e a semana comecando hoje', () => {
  const s = core.defaultSettings();
  assert.equal(s.id, 'app');
  assert.equal(s.weeklyWorkoutTarget, 3);
  assert.equal(s.weeklyCardioTarget, 120);
  assert.equal(s.weekAnchor, core.todayISO());
});

test('weekWindow cobre 7 dias (inclusive)', () => {
  assert.deepEqual(core.weekWindow('2026-10-08'), { anchor: '2026-10-08', end: '2026-10-14' });
  assert.deepEqual(core.weekWindow('2026-12-30'), { anchor: '2026-12-30', end: '2027-01-05' });
});

test('isValidWorkout aceita series ou cardio', () => {
  assert.equal(core.isValidWorkout({ sets: [{ reps: 12, load: 0 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 27 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 30 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 0 }] }), false);
  assert.equal(core.isValidWorkout({}), false);
});

/* ---------- aquecimento e series ---------- */

test('warmupLine omite campos vazios e mantem zero', () => {
  assert.equal(core.warmupLine({ reps: 15, load: 20, rir: 3 }), '15 reps · 20 kg · RIR 3');
  assert.equal(core.warmupLine({ reps: 15, load: '', rir: '' }), '15 reps');
  assert.equal(core.warmupLine({ reps: 0, load: 0, rir: 0 }), '0 reps · 0 kg · RIR 0');
  assert.equal(core.warmupLine(null), '');
});

test('warmupHasData detecta aquecimento preenchido', () => {
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData({ reps: 15, load: '', rir: '' }), true);
  assert.equal(core.warmupHasData({ reps: '', load: 0, rir: '' }), true);
  assert.equal(core.warmupHasData(null), false);
});

test('warmupSummary conta os aquecimentos', () => {
  assert.equal(core.warmupSummary([]), '');
  assert.equal(core.warmupSummary(null), '');
  assert.equal(core.warmupSummary([{}]), '1 aquecimento');
  assert.equal(core.warmupSummary([{}, {}]), '2 aquecimentos');
});

test('setsSummaryLines ordena por serie e escapa a observacao', () => {
  const html = core.setsSummaryLines([
    { number: 2, reps: 10, load: 27, rir: 1, note: '' },
    { number: 1, reps: 12, load: 27, rir: 2, note: '<b>forte</b>' }
  ]);
  assert.ok(html.indexOf('Série 1: 12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(html.indexOf('Série 2: 10 reps · 27 kg · RIR 1') !== -1);
  assert.ok(html.indexOf('&lt;b&gt;forte&lt;/b&gt;') !== -1);
  assert.ok(html.indexOf('Série 1') < html.indexOf('Série 2'));
});

test('groupSets agrupa por exercicio, preserva a ordem e junta o aquecimento', () => {
  const sets = [
    { exerciseName: 'Elevação pélvica', exerciseNote: 'pausa de 1s', number: 1, reps: 12, load: 27, rir: 2, note: '' },
    { exerciseName: 'Elevação pélvica', number: 2, reps: 10, load: 27, rir: 1, note: 'boa' },
    { exerciseName: 'Leg press 45', number: 1, reps: 12, load: 100, rir: 2, note: '' }
  ];
  const warmups = [{ exerciseName: 'Elevação pélvica', reps: 15, load: 20, rir: 3 }];

  const groups = core.groupSets(sets, warmups);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].exerciseName, 'Elevação pélvica');
  assert.equal(groups[0].note, 'pausa de 1s');
  assert.equal(groups[0].sets.length, 2);
  assert.deepEqual(groups[0].warmup, { reps: 15, load: 20, rir: 3 });
  assert.deepEqual(groups[1].warmup, { reps: '', load: '', rir: '' });
  assert.equal(groups[1].sets[0].load, 100);
});

/* ---------- historico por exercicio ---------- */

const history = [
  {
    id: 'a', date: '2026-10-01',
    sets: [{ exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40, rir: 2 }],
    warmups: [{ exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }]
  },
  {
    id: 'b', date: '2026-10-08',
    sets: [
      { exerciseName: 'Puxada frente', number: 1, reps: 10, load: 45, rir: 1 },
      { exerciseName: 'Puxada frente', number: 2, reps: 8, load: 50, rir: 1 }
    ],
    warmups: [{ exerciseName: 'Puxada frente', reps: 15, load: 25, rir: 3 }]
  },
  {
    id: 'c', date: '2026-10-10',
    sets: [{ exerciseName: 'Leg press 45', number: 1, reps: 12, load: 100, rir: 2 }]
  }
];

test('lastLoadsForExercise usa o treino mais recente, por numero de serie', () => {
  assert.deepEqual(core.lastLoadsForExercise(history, 'Puxada frente'), { 1: 45, 2: 50 });
  assert.deepEqual(core.lastLoadsForExercise(history, 'Inexistente'), {});
  assert.deepEqual(core.lastLoadsForExercise([], 'Puxada frente'), {});
});

test('previousWarmupFields traz reps e peso do aquecimento anterior (RIR vazio)', () => {
  assert.deepEqual(core.previousWarmupFields(history, 'Puxada frente'), { reps: 15, load: 25, rir: '' });
  assert.deepEqual(core.previousWarmupFields(history, 'Inexistente'), { reps: '', load: '', rir: '' });
});

test('sessionsForExercise ordena do mais recente e inclui sessoes so de aquecimento', () => {
  const withWarmupOnly = history.concat([
    { id: 'd', date: '2026-10-09', sets: [], warmups: [{ exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }] }
  ]);
  assert.deepEqual(core.sessionsForExercise(withWarmupOnly, 'Puxada frente').map(function (w) { return w.id; }), ['d', 'b', 'a']);
});

test('bestSetForExercise escolhe a maior carga e desempata por reps', () => {
  assert.deepEqual(core.bestSetForExercise(history[1], 'Puxada frente'), { load: 50, reps: 8 });
  assert.deepEqual(
    core.bestSetForExercise({ sets: [
      { exerciseName: 'X', reps: 10, load: 30 },
      { exerciseName: 'X', reps: 12, load: 30 }
    ] }, 'X'),
    { load: 30, reps: 12 }
  );
  assert.equal(core.bestSetForExercise({ sets: [] }, 'X'), null);
});

/* ---------- exportar treino como texto ---------- */

test('workoutAsText monta a mensagem com o aquecimento dentro de cada exercicio', () => {
  const workout = {
    date: '2026-10-08',
    sheetName: 'TREINO A - inferiores',
    cardioMinutes: 30,
    notes: 'treino leve',
    warmups: [
      { exerciseName: 'Elevação pélvica', reps: 15, load: 20, rir: 3 },
      { exerciseName: 'Esteira', reps: 5, load: 0, rir: 4 }
    ],
    sets: [
      { exerciseName: 'Elevação pélvica', exerciseNote: 'pausa de 1s', number: 1, reps: 12, load: 27, rir: 2, note: '' },
      { exerciseName: 'Elevação pélvica', number: 2, reps: 10, load: 27, rir: 1, note: 'caiu a força' }
    ]
  };

  const text = core.workoutAsText(workout);
  const lines = text.split('\n');

  assert.equal(lines[0], 'MEU TREINO — 08/10/2026');
  assert.equal(lines[1], 'Ficha: TREINO A - inferiores');
  assert.ok(text.indexOf('1. Elevação pélvica (obs.: pausa de 1s)') !== -1);
  assert.ok(text.indexOf('   Aquecimento: 15 reps · 20 kg · RIR 3') !== -1);
  assert.ok(text.indexOf('   Série 1: 12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(text.indexOf('   Série 2: 10 reps · 27 kg · RIR 1 (caiu a força)') !== -1);
  assert.ok(text.indexOf('2. Esteira') !== -1, 'exercicio so com aquecimento tambem aparece');
  assert.ok(text.indexOf('Cardio: 30 min') !== -1);
  assert.ok(text.indexOf('Observações: treino leve') !== -1);
});

test('workoutAsText omite cardio, observacoes e ficha quando vazios', () => {
  const text = core.workoutAsText({
    date: '2026-10-08',
    sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20, rir: 2 }]
  });
  assert.equal(text.indexOf('Cardio'), -1);
  assert.equal(text.indexOf('Observações'), -1);
  assert.equal(text.indexOf('Ficha:'), -1);
  assert.ok(text.indexOf('1. X') !== -1);
});

/* ---------- biblioteca do usuario ---------- */

test('isUserExercise nao esconde exercicio criado pelo usuario', () => {
  assert.equal(core.isUserExercise({ id: 'e1', name: 'Puxada frente supinada' }), true, 'sem source = criado pelo usuario');
  assert.equal(core.isUserExercise({ id: 'e2', name: 'X', source: 'custom' }), true);
  assert.equal(core.isUserExercise({ id: 'e3', name: 'X', source: 'catalog' }), true, 'marcado sem catalogId nao pode esconder');
  assert.equal(core.isUserExercise({ id: 'e4', name: 'X', source: 'catalog', catalogId: 887 }), false, 'do catalogo com comprovacao');
  assert.equal(core.isUserExercise(null), false);
});

test('libraryExercises lista os exercicios do usuario e ignora inativos', () => {
  const list = core.libraryExercises([
    { id: 'a', name: 'Elevação pélvica' },
    { id: 'b', name: 'Puxada frente supinada', source: 'catalog' },
    { id: 'c', name: 'Do catálogo', source: 'catalog', catalogId: 1 },
    { id: 'd', name: 'Inativo', active: false },
    null
  ]);
  assert.deepEqual(list.map(function (e) { return e.id; }), ['a', 'b']);
});

test('exercisesNeedingRepair aponta so as marcacoes sem comprovacao', () => {
  const need = core.exercisesNeedingRepair([
    { id: 'a', source: 'catalog' },
    { id: 'b', source: 'catalog', catalogId: 5 },
    { id: 'c', source: 'custom' },
    { id: 'd' }
  ]);
  assert.deepEqual(need.map(function (e) { return e.id; }), ['a']);
});

test('regressao: exercicio do usuario com nome igual ao do catalogo continua visivel', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const nomeDoCatalogo = catalog.exercises[0].name;
  const meu = { id: 'meu', name: nomeDoCatalogo, correction: '' };

  assert.equal(core.isUserExercise(meu), true);
  assert.equal(core.libraryExercises([meu]).length, 1);
  assert.deepEqual(core.exercisesNeedingRepair([meu]), []);
});

/* ---------- compatibilidade de dados entre versoes ---------- */

test('backup v1 (tipos de treino) migra para fichas sem perder dados', () => {
  const data = loadFixture('backup-v1.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 2, 'tipos de treino viram fichas');
  assert.equal(normalized.sheets[0].name, 'TREINO A - inferiores');
  assert.deepEqual(normalized.sheets[0].exercises, []);

  assert.equal(normalized.workouts.length, 2);
  const w = normalized.workouts[0];
  assert.equal(w.sheetId, 't1');
  assert.equal(w.sheetName, 'TREINO A - inferiores');
  assert.equal(w.typeId, undefined, 'campo antigo removido');
  assert.equal(w.typeName, undefined, 'campo antigo removido');
  assert.equal(w.cardioMinutes, 30);
  assert.equal(w.notes, 'treino leve');
  assert.deepEqual(w.warmups, []);
  assert.equal(w.sets.length, 2);
  assert.equal(w.sets[0].reps, 12);
  assert.equal(w.sets[0].load, 27);
  assert.equal(w.sets[0].rir, 2);
  assert.equal(w.sets[1].number, 2);
  assert.equal(w.sets[1].note, 'caiu a força');

  assert.equal(normalized.exercises.length, 1);
  assert.equal(normalized.exercises[0].name, 'Elevação pélvica');
  assert.equal(normalized.exercises[0].correction, 'pausa de 1s no topo');

  assert.equal(normalized.settings.weekAnchor, '2026-08-24');
  assert.equal(normalized.settings.weeklyWorkoutTarget, 4);
  assert.equal(normalized.settings.weeklyCardioTarget, 90);

  assert.equal(normalized.colinha.length, 1);
  assert.equal(normalized.colinha[0].title, 'RIR');
});

test('backup v1 nao perde nenhuma serie', () => {
  const data = loadFixture('backup-v1.json').data;
  const before = data.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  const after = core.normalizeBackup(data).workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  assert.equal(after, before);
});

test('backup v2 (ficha com reps unico) normaliza reps por serie', () => {
  const data = loadFixture('backup-v2-sheets.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 1);
  const items = normalized.sheets[0].exercises;

  assert.equal(items[0].name, 'Elevação pélvica');
  assert.equal(items[0].sets, 3);
  assert.deepEqual(items[0].reps, [12, 12, 12], 'reps unico vale para todas as series');
  assert.equal(items[0].load, undefined, 'carga saiu da ficha');
  assert.equal(items[0].rir, undefined, 'RIR saiu da ficha');
  assert.equal(items[0].note, 'pausa de 1s');

  assert.deepEqual(items[1].reps, [12, 10, 8], 'reps por serie preservadas');

  assert.equal(normalized.workouts[0].sheetName, 'TREINO A - inferiores');
  assert.equal(normalized.workouts[0].sets[0].load, 30);
});

test('normalizeBackup e idempotente (normalizar duas vezes nao muda nada)', () => {
  ['backup-v1.json', 'backup-v2-sheets.json'].forEach(function (name) {
    const data = loadFixture(name).data;
    const once = core.normalizeBackup(data);
    const twice = core.normalizeBackup(once);
    assert.deepEqual(twice, once, name + ' nao ficou estavel');
  });
});

test('backup no formato atual faz ida e volta sem perder dados', () => {
  const current = {
    workouts: [{
      id: 'w', date: '2026-10-08', sheetId: 's', sheetName: 'A', cardioMinutes: 30, notes: 'ok',
      warmups: [{ exerciseName: 'X', reps: 10, load: 20, rir: 3 }],
      sets: [{ exerciseName: 'X', exerciseNote: 'obs do exercicio', number: 1, reps: 12, load: 27, rir: 2, note: 'obs da serie' }]
    }],
    sheets: [{ id: 's', name: 'A', active: true, exercises: [{ exerciseId: null, name: 'X', sets: 3, reps: [12, 10, 8], note: 'obs' }] }],
    exercises: [{ id: 'e', name: 'X', group: 'Peito', correction: 'obs', active: true }],
    settings: { id: 'app', weekAnchor: '2026-10-08', weeklyWorkoutTarget: 3, weeklyCardioTarget: 120 },
    colinha: [{ id: 'c', title: 'T', content: 'C', order: 1 }]
  };

  const normalized = core.normalizeBackup(current);
  assert.deepEqual(normalized, core.normalizeBackup(normalized));
  assert.equal(normalized.workouts[0].sets[0].exerciseNote, 'obs do exercicio');
  assert.equal(normalized.workouts[0].sets[0].note, 'obs da serie');
  assert.equal(normalized.workouts[0].warmups[0].load, 20);
  assert.deepEqual(normalized.sheets[0].exercises[0].reps, [12, 10, 8]);
  assert.equal(normalized.exercises[0].correction, 'obs');
  assert.equal(normalized.colinha.length, 1);
});

test('normalizeBackup lida com backup vazio ou invalido sem quebrar', () => {
  [{}, { data: null }, { workouts: null }].forEach(function (input) {
    const normalized = core.normalizeBackup(input);
    assert.deepEqual(normalized.workouts, []);
    assert.deepEqual(normalized.sheets, []);
    assert.deepEqual(normalized.exercises, []);
    assert.deepEqual(normalized.colinha, []);
    assert.equal(normalized.settings.id, 'app');
    assert.equal(normalized.settings.weeklyWorkoutTarget, 3);
    assert.equal(normalized.settings.weeklyCardioTarget, 120);
  });
});

test('itens invalidos (sem id) sao descartados', () => {
  const normalized = core.normalizeBackup({
    workouts: [null, { date: '2026-10-08' }, { id: 'w1', date: '2026-10-08' }],
    sheets: [null, { name: 'sem id' }, { id: 's1', name: 'A' }],
    exercises: [null, { name: 'sem id' }, { id: 'e1', name: 'X' }],
    colinha: [{ id: 'c1', title: 'T' }]
  });
  assert.equal(normalized.workouts.length, 1);
  assert.equal(normalized.sheets.length, 1);
  assert.equal(normalized.exercises.length, 1);
  assert.equal(normalized.colinha.length, 1);
});

/* ---------- catalogo embutido ---------- */

test('catalogo mantem ids unicos, contiguos e estaveis entre versoes', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const items = catalog.exercises;

  assert.equal(items.length, 927);
  assert.equal(catalog.meta.nextId, 928, 'proximo id livre para novos exercicios');

  const ids = items.map(function (i) { return i.id; });
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados no catalogo');
  const sorted = ids.slice().sort(function (a, b) { return a - b; });
  assert.equal(sorted[0], 1);
  assert.equal(sorted[sorted.length - 1], 927);

  // Trava de compatibilidade: estes ids nao podem ser renumerados entre versoes.
  const byId = {};
  items.forEach(function (i) { byId[i.id] = i.name; });
  assert.equal(byId[1], 'Abdominais');
  assert.equal(byId[870], 'Abdominal infra');
  assert.equal(byId[887], 'Puxada frente supinada');
  assert.equal(byId[927], 'Tríceps testa');

  items.forEach(function (i) {
    assert.ok(i.name, 'todo exercicio tem nome');
    assert.ok(i.group, 'todo exercicio tem grupo');
    assert.ok(i.sourceId, 'todo exercicio guarda o sourceId de origem');
  });
});
