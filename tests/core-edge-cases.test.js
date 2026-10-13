'use strict';

/* Testes de borda do core: cobrem os caminhos de fallback (dados ausentes ou invalidos).
   Mantem a cobertura de js/core.js em 100%: cada ramo defensivo tem um caso aqui. */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

test('formatDecimal devolve vazio quando nao e numero', () => {
  assert.equal(core.formatDecimal('abc'), '');
  assert.equal(core.formatDecimal(undefined), '');
  assert.equal(core.formatDecimal(''), '');
});

test('weekWindow sem argumento usa hoje como ancora', () => {
  const janela = core.weekWindow();

  assert.equal(janela.anchor, core.todayISO());
  assert.equal(janela.end, core.addDaysISO(janela.anchor, 6));
});

test('setLine mostra travessao quando nao ha reps', () => {
  assert.equal(core.setLine({ reps: null, load: null, rir: null }), '—');
  assert.equal(core.setLine({}), '—');
});

test('setsSummaryLines sem series nao gera markup e aceita serie sem numero', () => {
  assert.equal(core.setsSummaryLines(), '');
  assert.equal(core.setsSummaryLines([]), '');

  const html = core.setsSummaryLines([
    { number: 3, reps: 6 },
    { number: 1, reps: 12 },
    { reps: 10, note: 'subiu' }
  ]);

  assert.ok(html.indexOf('>?</span>') !== -1, 'serie sem numero usa ?');
  assert.ok(html.indexOf('12 reps') !== -1);
  assert.ok(html.indexOf('>?</span>') < html.indexOf('12 reps'), 'sem numero conta como 0 e vem primeiro');
  assert.ok(html.indexOf('12 reps') < html.indexOf('6 reps'), 'ordena por numero da serie');
});

test('groupSets sem series nem aquecimentos devolve lista vazia', () => {
  assert.deepEqual(core.groupSets(), []);
  assert.deepEqual(core.groupSets([], []), []);
});

test('groupSets usa "(sem nome)" quando o registro nao tem nome', () => {
  const grupos = core.groupSets([{ number: 1, reps: 10, load: 20 }], [{ exerciseName: 'Esteira', reps: 15, load: 10 }]);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].exerciseName, '(sem nome)');
  assert.equal(grupos[1].exerciseName, 'Esteira');

  const soAquecimento = core.groupSets([], [{ reps: 15 }]);
  assert.equal(soAquecimento.length, 1);
  assert.equal(soAquecimento[0].exerciseName, '(sem nome)', 'aquecimento sem nome tambem tem grupo');
});

test('groupSets guarda a observacao da primeira serie que tem observacao', () => {
  const grupos = core.groupSets([
    { exerciseName: 'Leg press 45', number: 1, reps: 10 },
    { exerciseName: 'Leg press 45', number: 2, reps: 8, exerciseNote: 'pausa de 1s' },
    { exerciseName: 'Leg press 45', number: 3, reps: 6, exerciseNote: 'outra observacao' }
  ], []);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].note, 'pausa de 1s');
});

test('groupSets acha o grupo pelo nome quando o aquecimento antigo nao tem id', () => {
  const grupos = core.groupSets(
    [{ exerciseId: 5, exerciseName: 'Remada baixa', number: 1, reps: 10 }],
    [{ exerciseName: 'Remada baixa', reps: 15, load: 10, rir: 3 }]
  );

  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].warmup, { reps: 15, load: 10, rir: 3 });
});

test('historico ignora treinos sem series ou sem aquecimento', () => {
  const treinos = [{ id: 'x', date: '2026-10-01' }, { id: 'y', date: '2026-10-02', sets: [], warmups: [] }];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'Nada'), {});
  assert.equal(core.lastWarmupForExercise(treinos, 'Nada'), null);
  assert.deepEqual(core.sessionsForExercise(treinos, 'Nada'), []);
  assert.equal(core.bestSetForExercise(null, 'Nada'), null);
  assert.equal(core.bestSetForExercise({}, 'Nada'), null);
});

test('historico ordena dos dois lados (mais recente primeiro)', () => {
  const crescente = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] }
  ];
  const decrescente = [crescente[1], crescente[0]];

  assert.equal(core.sessionsForExercise(crescente, 'X')[0].id, 'b');
  assert.equal(core.sessionsForExercise(decrescente, 'X')[0].id, 'b');
  assert.equal(core.lastWarmupForExercise(crescente, 'X'), null, 'treino sem aquecimento');
});

test('workoutAsText mostra serie sem numero', () => {
  const texto = core.workoutAsText({
    date: '2026-10-12',
    sets: [{ exerciseName: 'Leg press 45', reps: 10, load: 100, note: 'subiu' }]
  });

  assert.ok(texto.indexOf('Série ?: 10 reps · 100 kg (subiu)') !== -1);
});

test('materializeSampleData cria settings e aceita a data informada', () => {
  const dados = core.materializeSampleData({
    workouts: [{ id: 'w1', dayOffset: -2 }, { id: 'w2' }]
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-10');
  assert.equal(dados.workouts[0].dayOffset, undefined);
  assert.equal(dados.workouts[1].date, undefined, 'treino sem dayOffset nao muda');
  assert.equal(dados.settings.id, 'app');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('materializeSampleData sem argumentos nao quebra', () => {
  const dados = core.materializeSampleData();

  assert.equal(dados.settings.id, 'app');
  assert.deepEqual(dados.workouts || [], []);
});

test('linkSheetItemsToExercises ignora exercicio sem nome e ficha sem itens', () => {
  const exercicios = [{ id: 'e1', name: '' }, { id: 'e2' }, { id: 'e3', name: 'Supino' }];
  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [{ name: 'Supino' }] }];

  const resultado = core.linkSheetItemsToExercises(fichas, exercicios);

  assert.equal(resultado.changed, 1);
  assert.equal(resultado.sheets[1].exercises[0].exerciseId, 'e3');
  assert.equal(resultado.sheets[0].exercises, undefined, 'ficha sem itens passa direto');

  assert.deepEqual(core.linkSheetItemsToExercises(), { sheets: [], changed: 0 });
});

test('renameInSheets sem fichas ou sem nome antigo nao muda nada', () => {
  assert.deepEqual(core.renameInSheets(), { sheets: [], changed: 0 });

  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [] }];
  assert.deepEqual(core.renameInSheets(fichas, 'e1', 'Antigo', 'Novo'), { sheets: fichas, changed: 0 });
});

test('renameInWorkouts ignora treinos sem series e ids diferentes', () => {
  const treinos = [
    { id: 'w1' },
    { id: 'w2', sets: [{ exerciseId: 9, exerciseName: 'Outro' }], warmups: [{ exerciseId: 9, exerciseName: 'Outro' }] }
  ];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
  assert.equal(core.renameInWorkouts().changed, 0);
});

test('backupStatus sem argumentos usa hoje e o limite padrao', () => {
  const info = core.backupStatus();

  assert.equal(info.lastBackupAt, null);
  assert.equal(info.overdue, true);
  assert.match(info.label, /nenhum backup/i);
});

test('backupStatus respeita limite e data informados', () => {
  const agora = new Date(2026, 9, 12, 10, 0);
  const info = core.backupStatus({ lastBackupAt: new Date(2026, 9, 11, 10, 0).toISOString() }, agora, 1);

  assert.equal(info.daysSince, 1);
  assert.equal(info.overdue, true, 'limite de 1 dia');
});

test('libraryExercises e exercisesNeedingRepair aceitam lista ausente', () => {
  assert.deepEqual(core.libraryExercises(), []);
  assert.deepEqual(core.exercisesNeedingRepair(), []);
  assert.deepEqual(core.libraryExercises([null, { id: 'e1', name: 'X', source: 'catalog', catalogId: 3 }]), []);
  assert.deepEqual(core.exercisesNeedingRepair([null, { id: 'e1', name: 'X' }]), []);
});

test('normalizacao descarta itens invalidos e completa campos ausentes', () => {
  const backup = core.normalizeBackup({
    workouts: [null, { id: 'w1', sets: [null, { reps: 10 }], warmups: [null, { reps: 15 }] }],
    sheets: [null, { id: 's1', exercises: [{ sets: 2 }, null] }],
    exercises: [null, { id: 'e1' }],
    colinha: [null]
  });

  assert.equal(backup.workouts.length, 1);
  assert.equal(backup.workouts[0].sets.length, 1);
  assert.equal(backup.workouts[0].sets[0].exerciseName, '(sem nome)');
  assert.equal(backup.workouts[0].sets[0].number, 2, 'numero cai na posicao do registro');
  assert.equal(backup.workouts[0].warmups.length, 1);
  assert.equal(backup.workouts[0].warmups[0].exerciseName, '(sem nome)');

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].exercises.length, 1);
  assert.deepEqual(backup.sheets[0].exercises[0].reps, [null, null], 'completa as series sem reps');
  assert.equal(backup.sheets[0].exercises[0].name, '');

  assert.equal(backup.exercises.length, 1);
  assert.equal(backup.exercises[0].name, '');
  assert.equal(backup.exercises[0].group, 'Outros');
  assert.deepEqual(backup.colinha, []);
});

test('normalizeBackup cobre ficha v2 (reps unico) e metas ausentes', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', exercises: [{ reps: 12, sets: 3 }] }],
    settings: { weeklyCardioTarget: 0 }
  });

  assert.deepEqual(backup.sheets[0].exercises[0].reps, [12, 12, 12]);
  assert.equal(backup.settings.weeklyWorkoutTarget, 3);
  assert.equal(backup.settings.weeklyCardioTarget, 0, 'zero e um alvo valido');
  assert.equal(backup.settings.weekAnchor, core.todayISO());
});

test('exerciseKey e exerciseMatches aceitam registro vazio', () => {
  assert.equal(core.exerciseKey(), 'nome:(sem nome)');
  assert.equal(core.exerciseMatches({ exerciseId: 1, exerciseName: '' }, { exerciseName: 'X' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: '' }), false);
});

test('aquecimento sem nenhum campo nao conta como preenchido', () => {
  assert.equal(core.warmupHasData({ reps: null, load: null, rir: null }), false);
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData(undefined), false);
  assert.equal(core.warmupHasData({ reps: 0 }), true, 'zero e um valor preenchido');
});

test('renameInWorkouts com lista ausente devolve lista vazia', () => {
  assert.deepEqual(core.renameInWorkouts(null, 5, 'Novo'), { workouts: [], changed: 0 });
  assert.deepEqual(core.renameInWorkouts(undefined, 5, 'Novo'), { workouts: [], changed: 0 });
});

test('materializeSampleData aceita payload com data e settings prontos', () => {
  const dados = core.materializeSampleData({
    data: {
      workouts: [{ id: 'w1', dayOffset: 0 }],
      settings: { id: 'app', weeklyWorkoutTarget: 4 }
    }
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-12');
  assert.equal(dados.settings.weeklyWorkoutTarget, 4, 'settings existentes sao preservados');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('historico ordena listas maiores nas duas direcoes', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-03', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] },
    { id: 'c', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 30 }] }
  ];

  assert.deepEqual(core.sessionsForExercise(treinos, 'X').map(function (w) { return w.id; }), ['c', 'b', 'a']);
  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), { 1: 30 });

  const comAquecimento = treinos.map(function (w) {
    return Object.assign({}, w, { warmups: [{ exerciseName: 'X', reps: 15, load: 10, rir: 3 }] });
  });

  assert.deepEqual(core.lastWarmupForExercise(comAquecimento, 'X').load, 10);
  assert.deepEqual(core.lastWarmupForExercise(comAquecimento.slice().reverse(), 'X').load, 10);
});

test('ultima carga ignora series com carga zero', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] },
    { id: 'b', date: '2026-10-02', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), {}, 'carga zero nao vira sugestao');
});

test('workoutAsText sem series nem aquecimento mostra so o cabecalho', () => {
  const texto = core.workoutAsText({ date: '2026-10-12', sets: [], warmups: [] });

  assert.equal(texto, 'MEU TREINO — 12/10/2026');
});

test('normalizeBackup converte tipos de treino (v1) e mantem datas', () => {
  const backup = core.normalizeBackup({
    workoutTypes: [{ id: 't1', name: 'TREINO A', active: false, createdAt: '2026-01-01' }],
    workouts: [{ id: 'w1', typeId: 't1', typeName: 'TREINO A', date: '2026-10-01' }]
  });

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].id, 't1');
  assert.equal(backup.sheets[0].active, false);
  assert.deepEqual(backup.sheets[0].exercises, []);
  assert.equal(backup.workouts[0].sheetId, 't1', 'typeId vira sheetId');
  assert.equal(backup.workouts[0].sheetName, 'TREINO A');
  assert.equal(backup.workouts[0].typeId, undefined);
});

test('normalizeBackup aceita ficha inativa e exercicio inativo', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', name: 'A', active: false }],
    exercises: [{ id: 'e1', name: 'X', active: false }]
  });

  assert.equal(backup.sheets[0].active, false);
  assert.equal(backup.exercises[0].active, false);
  assert.equal(core.libraryExercises(backup.exercises).length, 0, 'inativo nao aparece na biblioteca');
});

test('parseLocalNumber e toNumOrNull com valores vazios ou invalidos', () => {
  assert.equal(core.parseLocalNumber(''), Number.NaN);
  assert.equal(core.parseLocalNumber('   '), Number.NaN);
  assert.equal(core.parseLocalNumber(null), Number.NaN);
  assert.equal(core.parseLocalNumber(undefined), Number.NaN);
  assert.equal(core.parseLocalNumber('12,5'), 12.5);
  assert.equal(core.parseLocalNumber('1.234,5'), 1234.5, 'formato brasileiro');
  assert.equal(core.parseLocalNumber('1,234.5'), 1234.5, 'formato americano');
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('abc'), null);
  assert.equal(core.toNumOrNull(0), 0);
  assert.equal(core.formatDecimal(0), '0');
  assert.equal(core.formatDecimal(2.5, true), '2,5');
});

test('renameInWorkouts nao mexe quando o nome ja esta atualizado', () => {
  const treinos = [{
    id: 'w1',
    sets: [{ exerciseId: 5, exerciseName: 'Novo', number: 1, reps: 10, load: 30 }],
    warmups: [{ exerciseId: 5, exerciseName: 'Novo', reps: 15, load: 10, rir: 3 }]
  }];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
});

test('isValidWorkout distingue treino vazio de treino so com cardio', () => {
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 0 }), false);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 20 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10 }] }), true, 'serie vazia nao conta');
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10, load: 20 }] }), true);
});