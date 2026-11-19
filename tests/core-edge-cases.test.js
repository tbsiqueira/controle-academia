'use strict';

/* Core edge-case tests: they cover the fallback paths (missing or invalid data).
   They keep js/core.js coverage at 100%: every defensive branch has a case here. */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

test('formatDecimal returns empty when the value is not a number', () => {
  assert.equal(core.formatDecimal('abc'), '');
  assert.equal(core.formatDecimal(undefined), '');
  assert.equal(core.formatDecimal(''), '');
});

test('weekWindow with no argument uses today as the anchor', () => {
  const janela = core.weekWindow();

  assert.equal(janela.anchor, core.todayISO());
  assert.equal(janela.end, core.addDaysISO(janela.anchor, 6));
});

test('setLine shows a dash when there are no reps', () => {
  assert.equal(core.setLine({ reps: null, load: null, rir: null }), '—');
  assert.equal(core.setLine({}), '—');
});

test('setsSummaryLines with no sets generates no markup and accepts a set with no number', () => {
  assert.equal(core.setsSummaryLines(), '');
  assert.equal(core.setsSummaryLines([]), '');

  const html = core.setsSummaryLines([
    { number: 3, reps: 6 },
    { number: 1, reps: 12 },
    { reps: 10, note: 'subiu' }
  ]);

  assert.ok(html.indexOf('>?</span>') !== -1, 'a set with no number uses ?');
  assert.ok(html.indexOf('12 reps') !== -1);
  assert.ok(html.indexOf('>?</span>') < html.indexOf('12 reps'), 'no number counts as 0 and comes first');
  assert.ok(html.indexOf('12 reps') < html.indexOf('6 reps'), 'orders by set number');
});

test('groupSets with no sets or warm-ups returns an empty list', () => {
  assert.deepEqual(core.groupSets(), []);
  assert.deepEqual(core.groupSets([], []), []);
});

test('groupSets uses "(sem nome)" when the record has no name', () => {
  const grupos = core.groupSets([{ number: 1, reps: 10, load: 20 }], [{ exerciseName: 'Esteira', reps: 15, load: 10 }]);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].exerciseName, '(sem nome)');
  assert.equal(grupos[1].exerciseName, 'Esteira');

  const soAquecimento = core.groupSets([], [{ reps: 15 }]);
  assert.equal(soAquecimento.length, 1);
  assert.equal(soAquecimento[0].exerciseName, '(sem nome)', 'a warm-up with no name also gets a group');
});

test('groupSets keeps the note of the first set that has a note', () => {
  const grupos = core.groupSets([
    { exerciseName: 'Leg press 45', number: 1, reps: 10 },
    { exerciseName: 'Leg press 45', number: 2, reps: 8, exerciseNote: 'pausa de 1s' },
    { exerciseName: 'Leg press 45', number: 3, reps: 6, exerciseNote: 'outra observacao' }
  ], []);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].note, 'pausa de 1s');
});

test('groupSets finds the group by name when the old warm-up has no id', () => {
  const grupos = core.groupSets(
    [{ exerciseId: 5, exerciseName: 'Remada baixa', number: 1, reps: 10 }],
    [{ exerciseName: 'Remada baixa', reps: 15, load: 10, rir: 3 }]
  );

  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].warmup, { reps: 15, load: 10, rir: 3 });
});

test('history ignores workouts with no sets or no warm-up', () => {
  const treinos = [{ id: 'x', date: '2026-10-01' }, { id: 'y', date: '2026-10-02', sets: [], warmups: [] }];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'Nada'), {});
  assert.equal(core.lastWarmupForExercise(treinos, 'Nada'), null);
  assert.deepEqual(core.sessionsForExercise(treinos, 'Nada'), []);
  assert.equal(core.bestSetForExercise(null, 'Nada'), null);
  assert.equal(core.bestSetForExercise({}, 'Nada'), null);
});

test('history sorts both ways (newest first)', () => {
  const crescente = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] }
  ];
  const decrescente = [crescente[1], crescente[0]];

  assert.equal(core.sessionsForExercise(crescente, 'X')[0].id, 'b');
  assert.equal(core.sessionsForExercise(decrescente, 'X')[0].id, 'b');
  assert.equal(core.lastWarmupForExercise(crescente, 'X'), null, 'workout with no warm-up');
});

test('workoutAsText shows a set with no number', () => {
  const texto = core.workoutAsText({
    date: '2026-10-12',
    sets: [{ exerciseName: 'Leg press 45', reps: 10, load: 100, note: 'subiu' }]
  });

  assert.ok(texto.indexOf('- Série ?: 10 reps · 100 kg _(subiu)_') !== -1);
});

test('materializeSampleData creates settings and accepts the given date', () => {
  const dados = core.materializeSampleData({
    workouts: [{ id: 'w1', dayOffset: -2 }, { id: 'w2' }]
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-10');
  assert.equal(dados.workouts[0].dayOffset, undefined);
  assert.equal(dados.workouts[1].date, undefined, 'a workout without dayOffset does not change');
  assert.equal(dados.settings.id, 'app');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('materializeSampleData with no arguments does not break', () => {
  const dados = core.materializeSampleData();

  assert.equal(dados.settings.id, 'app');
  assert.deepEqual(dados.workouts || [], []);
});

test('linkSheetItemsToExercises ignores an unnamed exercise and a sheet with no items', () => {
  const exercicios = [{ id: 'e1', name: '' }, { id: 'e2' }, { id: 'e3', name: 'Supino' }];
  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [{ name: 'Supino' }] }];

  const resultado = core.linkSheetItemsToExercises(fichas, exercicios);

  assert.equal(resultado.changed, 1);
  assert.equal(resultado.sheets[1].exercises[0].exerciseId, 'e3');
  assert.equal(resultado.sheets[0].exercises, undefined, 'a sheet with no items passes through');

  assert.deepEqual(core.linkSheetItemsToExercises(), { sheets: [], changed: 0 });
});

test('renameInSheets with no sheets or no old name changes nothing', () => {
  assert.deepEqual(core.renameInSheets(), { sheets: [], changed: 0 });

  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [] }];
  assert.deepEqual(core.renameInSheets(fichas, 'e1', 'Antigo', 'Novo'), { sheets: fichas, changed: 0 });
});

test('renameInWorkouts ignores workouts with no sets and different ids', () => {
  const treinos = [
    { id: 'w1' },
    { id: 'w2', sets: [{ exerciseId: 9, exerciseName: 'Outro' }], warmups: [{ exerciseId: 9, exerciseName: 'Outro' }] }
  ];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
  assert.equal(core.renameInWorkouts().changed, 0);
});

test('backupStatus with no arguments uses today and the default limit', () => {
  const info = core.backupStatus();

  assert.equal(info.lastBackupAt, null);
  assert.equal(info.overdue, true);
  assert.match(info.label, /nenhum backup/i);
});

test('backupStatus respects the given limit and date', () => {
  const agora = new Date(2026, 9, 12, 10, 0);
  const info = core.backupStatus({ lastBackupAt: new Date(2026, 9, 11, 10, 0).toISOString() }, agora, 1);

  assert.equal(info.daysSince, 1);
  assert.equal(info.overdue, true, 'limit of 1 day');
});

test('libraryExercises accepts a missing list', () => {
  assert.deepEqual(core.libraryExercises(), []);
  assert.deepEqual(core.libraryExercises([null, { id: 'e1', name: 'X', source: 'catalog', catalogId: 3 }]), []);
});

test('normalization discards invalid items and fills in missing fields', () => {
  const backup = core.normalizeBackup({
    workouts: [null, { id: 'w1', sets: [null, { reps: 10 }], warmups: [null, { reps: 15 }] }],
    sheets: [null, { id: 's1', exercises: [{ sets: 2 }, null] }],
    exercises: [null, { id: 'e1' }],
    colinha: [null]
  });

  assert.equal(backup.workouts.length, 1);
  assert.equal(backup.workouts[0].sets.length, 1);
  assert.equal(backup.workouts[0].sets[0].exerciseName, '(sem nome)');
  assert.equal(backup.workouts[0].sets[0].number, 2, 'the number falls back to the record position');
  assert.equal(backup.workouts[0].warmups.length, 1);
  assert.equal(backup.workouts[0].warmups[0].exerciseName, '(sem nome)');

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].exercises.length, 1);
  assert.deepEqual(backup.sheets[0].exercises[0].reps, [null, null], 'fills in the sets without reps');
  assert.equal(backup.sheets[0].exercises[0].name, '');

  assert.equal(backup.exercises.length, 1);
  assert.equal(backup.exercises[0].name, '');
  assert.equal(backup.exercises[0].group, 'Outros');
  assert.deepEqual(backup.colinha, []);
});

test('normalizeBackup covers a v2 sheet (single reps value) and missing targets', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', exercises: [{ reps: 12, sets: 3 }] }],
    settings: { weeklyCardioTarget: 0 }
  });

  assert.deepEqual(backup.sheets[0].exercises[0].reps, [12, 12, 12]);
  assert.equal(backup.settings.weeklyWorkoutTarget, 3);
  assert.equal(backup.settings.weeklyCardioTarget, 0, 'zero is a valid target');
  assert.equal(backup.settings.weekAnchor, core.todayISO());
});

test('exerciseKey and exerciseMatches accept an empty record', () => {
  assert.equal(core.exerciseKey(), 'nome:(sem nome)');
  assert.equal(core.exerciseMatches({ exerciseId: 1, exerciseName: '' }, { exerciseName: 'X' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: '' }), false);
});

test('a warm-up with no field does not count as filled in', () => {
  assert.equal(core.warmupHasData({ reps: null, load: null, rir: null }), false);
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData(undefined), false);
  assert.equal(core.warmupHasData({ reps: 0 }), true, 'zero is a filled-in value');
});

test('renameInWorkouts with a missing list returns an empty list', () => {
  assert.deepEqual(core.renameInWorkouts(null, 5, 'Novo'), { workouts: [], changed: 0 });
  assert.deepEqual(core.renameInWorkouts(undefined, 5, 'Novo'), { workouts: [], changed: 0 });
});

test('materializeSampleData accepts a payload with data and settings ready', () => {
  const dados = core.materializeSampleData({
    data: {
      workouts: [{ id: 'w1', dayOffset: 0 }],
      settings: { id: 'app', weeklyWorkoutTarget: 4 }
    }
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-12');
  assert.equal(dados.settings.weeklyWorkoutTarget, 4, 'existing settings are preserved');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('history sorts longer lists in both directions', () => {
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

test('last load ignores sets with zero load', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] },
    { id: 'b', date: '2026-10-02', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), {}, 'a zero load does not become a suggestion');
});

test('workoutAsText with no sets or warm-up shows only the header', () => {
  const texto = core.workoutAsText({ date: '2026-10-12', sets: [], warmups: [] });

  assert.equal(texto, '*12/10/2026*');
});

test('normalizeBackup converts workout types (v1) and keeps dates', () => {
  const backup = core.normalizeBackup({
    workoutTypes: [{ id: 't1', name: 'TREINO A', active: false, createdAt: '2026-01-01' }],
    workouts: [{ id: 'w1', typeId: 't1', typeName: 'TREINO A', date: '2026-10-01' }]
  });

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].id, 't1');
  assert.equal(backup.sheets[0].active, false);
  assert.deepEqual(backup.sheets[0].exercises, []);
  assert.equal(backup.workouts[0].sheetId, 't1', 'typeId becomes sheetId');
  assert.equal(backup.workouts[0].sheetName, 'TREINO A');
  assert.equal(backup.workouts[0].typeId, undefined);
});

test('normalizeBackup accepts an inactive sheet and an inactive exercise', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', name: 'A', active: false }],
    exercises: [{ id: 'e1', name: 'X', active: false }]
  });

  assert.equal(backup.sheets[0].active, false);
  assert.equal(backup.exercises[0].active, false);
  assert.equal(core.libraryExercises(backup.exercises).length, 0, 'an inactive one does not show in the library');
});

test('parseLocalNumber and toNumOrNull with empty or invalid values', () => {
  assert.equal(core.parseLocalNumber(''), Number.NaN);
  assert.equal(core.parseLocalNumber('   '), Number.NaN);
  assert.equal(core.parseLocalNumber(null), Number.NaN);
  assert.equal(core.parseLocalNumber(undefined), Number.NaN);
  assert.equal(core.parseLocalNumber('12,5'), 12.5);
  assert.equal(core.parseLocalNumber('1.234,5'), 1234.5, 'Brazilian format');
  assert.equal(core.parseLocalNumber('1,234.5'), 1.2345, 'an ambiguous input follows the pt-BR reading (dot = thousands)');
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('abc'), null);
  assert.equal(core.toNumOrNull(0), 0);
  assert.equal(core.formatDecimal(0), '0');
  assert.equal(core.formatDecimal(2.5, true), '2,5');
});

test('renameInWorkouts does nothing when the name is already up to date', () => {
  const treinos = [{
    id: 'w1',
    sets: [{ exerciseId: 5, exerciseName: 'Novo', number: 1, reps: 10, load: 30 }],
    warmups: [{ exerciseId: 5, exerciseName: 'Novo', reps: 15, load: 10, rir: 3 }]
  }];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
});

test('isValidWorkout tells an empty workout from a cardio-only one', () => {
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 0 }), false);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 20 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10 }] }), true, 'an empty set does not count');
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10, load: 20 }] }), true);
});

test('exerciseMatches covers both sides of the "(sem nome)" fallback', () => {
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: 'X' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, { exerciseName: '' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: '' }), false);
  assert.equal(core.exerciseMatches({ exerciseId: 3 }, { exerciseId: 3, exerciseName: '' }), true, 'the id wins');
});

test('lastWarmupForExercise returns null when the workout has another exercise warm-up', () => {
  const treinos = [{
    id: 'a',
    date: '2026-10-01',
    warmups: [{ exerciseId: 1, exerciseName: 'Esteira', reps: 5, load: 0, rir: 4 }]
  }];

  assert.equal(core.lastWarmupForExercise(treinos, { exerciseId: 2, exerciseName: 'Leg press' }), null);
  assert.equal(core.lastWarmupForExercise(treinos, 'Leg press'), null, 'lookup by name too');
});

test('groupSets uses the right group warm-up when there are several exercises', () => {
  const grupos = core.groupSets(
    [
      { exerciseId: 1, exerciseName: 'Leg press', number: 1, reps: 12, load: 100 },
      { exerciseId: 2, exerciseName: 'Cadeira flexora', number: 1, reps: 12, load: 40 }
    ],
    [
      { exerciseId: 2, exerciseName: 'Cadeira flexora', reps: 15, load: 20, rir: 3 },
      { exerciseId: 1, exerciseName: 'Leg press', reps: 20, load: 40, rir: 4 }
    ]
  );

  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos[0].warmup, { reps: 20, load: 40, rir: 4 });
  assert.deepEqual(grupos[1].warmup, { reps: 15, load: 20, rir: 3 });
});

test('exerciseLabel and sheetLabel skip invalid entries in the list', () => {
  const exercicios = [null, { id: 7 }, { id: 7, name: 'Remada baixa' }];
  assert.equal(core.exerciseLabel({ exerciseId: 7, exerciseName: 'Antigo' }, exercicios), 'Remada baixa');

  const fichas = [null, { id: 's1' }, { id: 's1', name: 'Ficha A' }];
  assert.equal(core.sheetLabel({ sheetId: 's1', sheetName: 'Antiga' }, fichas), 'Ficha A');
});

test('normalizeSheetItem infers the sets from other sources when sets is missing', () => {
  const backup = core.normalizeBackup({
    sheets: [{
      id: 's1',
      exercises: [
        { name: 'A', reps: [12, 10] },
        { name: 'B', reps: '' },
        { name: 'C', reps: [], sets: 1 }
      ]
    }]
  });

  const itens = backup.sheets[0].exercises;
  assert.deepEqual(itens[0].reps, [12, 10], 'with no sets, the number of reps counts');
  assert.equal(itens[0].sets, 2);
  assert.deepEqual(itens[1].reps, [null, null, null], 'empty reps fall back to the default of 3 sets');
  assert.deepEqual(itens[2].reps, [null], 'a given sets wins over the reps list');
});

test('normalizeWorkout fills in a missing sheet and name', () => {
  const backup = core.normalizeBackup({
    workouts: [
      { id: 'w1', sets: [] },
      { id: 'w2', sheetId: 's9', typeName: 'Antigo', sets: [] }
    ]
  });

  assert.equal(backup.workouts[0].sheetId, null, 'without typeId it is null');
  assert.equal(backup.workouts[0].sheetName, '');
  assert.equal(backup.workouts[1].sheetId, 's9', 'a given sheetId is kept');
  assert.equal(backup.workouts[1].sheetName, 'Antigo', 'typeName becomes sheetName');
});

test('normalizeText and toNumOrNull accept undefined', () => {
  assert.equal(core.normalizeText(undefined), '');
  assert.equal(core.normalizeText(0), '0');
  assert.equal(core.toNumOrNull(undefined), null);
});

test('history and normalization accept missing arguments', () => {
  assert.deepEqual(core.lastLoadsForExercise(), {});
  assert.equal(core.lastWarmupForExercise(), null);
  assert.deepEqual(core.sessionsForExercise(), []);
  assert.deepEqual(core.lastLoadsForExercise(null, 'X'), {});
  assert.equal(core.lastWarmupForExercise(null, 'X'), null);
  assert.deepEqual(core.sessionsForExercise(null, 'X'), []);

  const vazio = core.normalizeBackup();
  assert.deepEqual(vazio.workouts, []);
  assert.deepEqual(vazio.sheets, []);
  assert.deepEqual(vazio.exercises, []);

  const semListas = core.normalizeBackup({ settings: {} });
  assert.deepEqual(semListas.sheets, []);
  assert.deepEqual(semListas.exercises, []);
});

test('lastLoadsForExercise sorts three workouts (comparator in both directions)', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] },
    { id: 'c', date: '2026-10-03', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 15 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), { 1: 20 }, 'takes the most recent workout');
  assert.deepEqual(core.lastLoadsForExercise(treinos.slice().reverse(), 'X'), { 1: 20 });
});

test('an id as text and as a number are the same exercise (data-* returns text)', () => {
  assert.equal(core.exerciseMatches({ exerciseId: 887, exerciseName: 'Puxada' }, { exerciseId: '887', exerciseName: 'Puxada' }), true);
  assert.equal(core.exerciseMatches({ exerciseId: '887' }, { exerciseId: 887 }), true);
  assert.equal(core.exerciseMatches({ exerciseId: 887 }, { exerciseId: 888 }), false);
  assert.equal(core.exerciseKey({ exerciseId: 887 }), core.exerciseKey({ exerciseId: '887' }));

  assert.equal(core.exerciseLabel({ exerciseId: '887' }, [{ id: 887, name: 'Puxada frente supinada' }]), 'Puxada frente supinada');
  assert.equal(core.sheetLabel({ sheetId: 3 }, [{ id: '3', name: 'Ficha antiga' }]), 'Ficha antiga');
});

test('regression: history of a catalog exercise opened by a click', () => {
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 887, exerciseName: 'Puxada frente supinada', number: 1, reps: 12, load: 40 }] },
    { id: 'w2', date: '2026-10-08', sets: [{ exerciseId: 887, exerciseName: 'Puxada frente supinada', number: 1, reps: 10, load: 45 }] }
  ];

  // the click in the workout detail sends the id as TEXT (data-* attribute)
  const alvo = { exerciseId: '887', exerciseName: 'Puxada frente supinada' };

  assert.equal(core.sessionsForExercise(treinos, alvo).length, 2, 'found zero before the fix');
  assert.deepEqual(core.lastLoadsForExercise(treinos, alvo), { 1: 45 });
  assert.equal(core.bestSetForExercise(treinos[0], alvo).load, 40);
  assert.equal(core.previousWarmupFields(treinos, alvo).reps, '', 'no warm-up recorded');
  assert.equal(core.groupSets([{ exerciseId: '887' }, { exerciseId: 887 }], []).length, 1, 'text and number count as the same exercise');
});

/* ---------- calendar: switching month ---------- */

test('shiftMonth neither skips nor repeats a month when today is the 29th, 30th or 31st', () => {
  // regression: setMonth() on Oct 31 went back to October; on Jan 31 it jumped to March
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 9, 31), -1)), '2026-09-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2027, 0, 31), 1)), '2027-02-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2027, 0, 29), 1)), '2027-02-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 4, 31), 1)), '2026-06-01');
});

test('shiftMonth crosses the year and does not change the given date', () => {
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 11, 15), 1)), '2027-01-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 0, 15), -1)), '2025-12-01');
  const cursor = new Date(2026, 9, 31);
  core.shiftMonth(cursor, -1);
  assert.equal(core.fmtDate(cursor), '2026-10-31');
});

/* ---------- PR on the progress screen ---------- */

test('maxBestLoad is 0 for an exercise with no load (does not invent "PR 1 kg")', () => {
  const flexao = { exerciseId: 'e1', exerciseName: 'Flexao' };
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 'e1', exerciseName: 'Flexao', number: 1, reps: 20, load: null }] },
    { id: 'w2', date: '2026-10-03', sets: [{ exerciseId: 'e1', exerciseName: 'Flexao', number: 1, reps: 22, load: 0 }] },
    { id: 'w3', date: '2026-10-05', sets: [], warmups: [{ exerciseId: 'e1', exerciseName: 'Flexao', reps: 10 }] }
  ];
  assert.equal(core.maxBestLoad(treinos, flexao), 0);
  assert.equal(core.maxBestLoad([], flexao), 0);
  assert.equal(core.maxBestLoad(null, flexao), 0);
});

test('maxBestLoad returns the highest load across the exercise workouts', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 'e1', number: 1, reps: 10, load: 40 }, { exerciseId: 'e1', number: 2, reps: 8, load: 42.5 }] },
    { id: 'w2', date: '2026-10-03', sets: [{ exerciseId: 'e1', number: 1, reps: 10, load: 0.5 }, { exerciseId: 'e2', number: 1, reps: 10, load: 200 }] }
  ];
  assert.equal(core.maxBestLoad(treinos, alvo), 42.5);
  assert.equal(core.maxBestLoad([treinos[1]], alvo), 0.5, 'a load under 1 kg does not become 1');
});

/* ---------- imported backup: ids and dates coming from outside ---------- */

test('normalizeBackup discards records with an id that would break the HTML (quotes, spaces, tags)', () => {
  const ruim = "x');alert(1);//";
  const b = core.normalizeBackup({
    workouts: [{ id: 'w1', date: '2026-10-01' }, { id: ruim, date: '2026-10-02' }, null, { date: '2026-10-03' }],
    sheets: [{ id: 's1', name: 'A' }, { id: 'a b', name: 'B' }],
    exercises: [{ id: 'e1', name: 'Supino' }, { id: '<img src=x>', name: 'X' }],
    colinha: [{ id: 'c1', title: 'RIR' }, { id: 'c"2', title: 'Y' }]
  });
  assert.deepEqual(b.workouts.map((w) => w.id), ['w1']);
  assert.deepEqual(b.sheets.map((s) => s.id), ['s1']);
  assert.deepEqual(b.exercises.map((e) => e.id), ['e1']);
  assert.deepEqual(b.colinha.map((c) => c.id), ['c1']);
});

test('normalizeBackup keeps every id format the app has generated', () => {
  const ids = ['3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f', 'id-1760000000000-a3f9c2', 'w1', 'sample_sheet_a', 12];
  const b = core.normalizeBackup({
    workouts: ids.map((id) => ({ id: id, date: '2026-10-01' })),
    exercises: ids.map((id) => ({ id: id, name: 'E' })),
    workoutTypes: ids.map((id) => ({ id: id, name: 'T' }))   // v1
  });
  assert.deepEqual(b.workouts.map((w) => w.id), ids);
  assert.deepEqual(b.exercises.map((e) => e.id), ids);
  assert.deepEqual(b.sheets.map((s) => s.id), ids);
});

test('normalizeBackup: a workout with an invalid date becomes "no date" instead of breaking the calendar', () => {
  const b = core.normalizeBackup({
    workouts: [
      { id: 'w1', date: '2026-10-01', sets: [{ exerciseName: 'Supino', reps: 10, load: 40 }] },
      { id: 'w2', sets: [{ exerciseName: 'Supino', reps: 8, load: 45 }] },
      { id: 'w3', date: '<b>01/10/2026</b>' },
      { id: 'w4', date: 20261001 }
    ]
  });
  assert.deepEqual(b.workouts.map((w) => w.date), ['2026-10-01', '', '', '']);
  assert.equal(b.workouts[1].sets[0].load, 45, 'the dateless workout keeps its sets');
  assert.equal(core.dateParts(b.workouts[1].date), null);
  assert.equal(core.fmtBR(b.workouts[1].date), '—');
});

test('normalizeBackup: an invalid week start goes back to today; a valid one is preserved', () => {
  assert.equal(core.normalizeBackup({ settings: { weekAnchor: '<img src=x onerror=alert(1)>' } }).settings.weekAnchor, core.todayISO());
  assert.equal(core.normalizeBackup({ settings: {} }).settings.weekAnchor, core.todayISO());
  assert.equal(core.normalizeBackup({ settings: { weekAnchor: '2026-10-05' } }).settings.weekAnchor, '2026-10-05');
});

test('normalizeBackup stays idempotent after id and date validation', () => {
  const uma = core.normalizeBackup({
    workouts: [{ id: 'w1', date: '2026-10-01' }, { id: 'w2' }],
    sheets: [{ id: 's1', name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: [12, 10, 8] }] }],
    settings: { weekAnchor: '2026-10-05' }
  });
  assert.deepEqual(core.normalizeBackup(uma), uma);
});

/* ---------- target week: starting the next one ---------- */

test('nextWeekAnchor moves forward one week when the previous one has just ended', () => {
  // window Oct 1–7; today Oct 8 -> next window Oct 8–14
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-08'), '2026-10-08');
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-14'), '2026-10-08');
});

test('nextWeekAnchor skips the missed weeks at once, keeping the weekday', () => {
  // regression: after 3 idle weeks you had to tap the button 3 times
  const anchor = core.nextWeekAnchor('2026-10-01', '2026-10-25');
  assert.equal(anchor, '2026-10-22');
  const janela = core.weekWindow(anchor);
  assert.ok(janela.anchor <= '2026-10-25' && '2026-10-25' <= janela.end, 'today falls inside the new window');
  assert.equal(core.parseDate(anchor).getDay(), core.parseDate('2026-10-01').getDay());
  assert.equal(core.nextWeekAnchor('2026-12-20', '2027-01-15'), '2027-01-10', 'crosses the year');
});

test('nextWeekAnchor always moves forward at least 7 days', () => {
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-03'), '2026-10-08');
});

/* ---------- load with a comma outside the form ---------- */

test('setLine and warmupLine show the load with a comma when asked (same as the form)', () => {
  // regression: the form showed "27,5" while the summary/history/text showed "27.5 kg"
  assert.equal(core.setLine({ reps: 12, load: 27.5, rir: 2 }, true), '12 reps · 27,5 kg · RIR 2');
  assert.equal(core.warmupLine({ reps: 15, load: 16.2, rir: 3 }, true), '15 reps · 16,2 kg · RIR 3');
  assert.equal(core.setLine({ reps: 12, load: 40, rir: null }, true), '12 reps · 40 kg', 'a whole number does not get a comma');
  assert.equal(core.setLine({ reps: 5, load: 0 }, true), '5 reps · 0 kg');
});

test('without the parameter the old format (dot) does not change', () => {
  assert.equal(core.setLine({ reps: 12, load: 27.5, rir: 2 }), '12 reps · 27.5 kg · RIR 2');
  assert.equal(core.warmupLine({ reps: 15, load: 16.2, rir: 3 }), '15 reps · 16.2 kg · RIR 3');
  assert.equal(core.setLine({ reps: 12, load: '27,5' }), '12 reps · 27.5 kg', 'old load stored as text');
});

test('setsSummaryLines and workoutAsText pass the comma on to sets and warm-up', () => {
  const treino = {
    date: '2026-10-08',
    sets: [{ exerciseName: 'Supino', number: 1, reps: 10, load: 42.5, rir: 1 }],
    warmups: [{ exerciseName: 'Supino', reps: 15, load: 22.5, rir: 3 }]
  };
  assert.ok(core.setsSummaryLines(treino.sets, true).indexOf('42,5 kg') !== -1);
  assert.ok(core.setsSummaryLines(treino.sets).indexOf('42.5 kg') !== -1);

  const comVirgula = core.workoutAsText(treino, [], [], true);
  assert.ok(comVirgula.indexOf('Aquecimento: 15 reps · 22,5 kg · RIR 3') !== -1);
  assert.ok(comVirgula.indexOf('Série 1: 10 reps · 42,5 kg · RIR 1') !== -1);
  assert.ok(core.workoutAsText(treino, [], []).indexOf('42.5 kg') !== -1, 'without the parameter it keeps the dot');
});

/* ---------- navigation: workout id in the address ---------- */

test('parseRoute reads the screen and the id from the address', () => {
  assert.deepEqual(core.parseRoute('#/detail/3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f'), { view: 'detail', id: '3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f' });
  assert.deepEqual(core.parseRoute('#/detail/id-1760000000000-a3f9c2'), { view: 'detail', id: 'id-1760000000000-a3f9c2' });
});

test('parseRoute keeps old addresses working (no id)', () => {
  ['dashboard', 'workout', 'detail', 'exercise', 'erase', 'exercises', 'calendar', 'more'].forEach((view) => {
    assert.deepEqual(core.parseRoute('#/' + view), { view: view, id: '' });
  });
});

test('parseRoute with no address opens Início', () => {
  assert.deepEqual(core.parseRoute(''), { view: 'dashboard', id: '' });
  assert.deepEqual(core.parseRoute('#/'), { view: 'dashboard', id: '' });
  assert.deepEqual(core.parseRoute('#'), { view: 'dashboard', id: '' });
  assert.deepEqual(core.parseRoute(null), { view: 'dashboard', id: '' });
  assert.deepEqual(core.parseRoute(undefined), { view: 'dashboard', id: '' });
});

test('app.js always opens the workout with the id in the address', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /location\.hash = '#\/detail';/, 'no #/detail without an id');
  assert.equal((app.match(/location\.hash = '#\/detail\/' \+/g) || []).length, 2, 'the Início list and Cancel in the edit screen');
  assert.match(app, /viewName === 'detail' && route\.id\) state\.viewingWorkoutId = route\.id/);
});

/* ---------- same exercise twice in the workout / in the sheet ---------- */

test('regression: the same exercise twice in a saved workout becomes a single group (which is why the app blocks it)', () => {
  const sets = [1, 2, 3, 1, 2, 3].map((n) => ({ exerciseId: 'e1', exerciseName: 'Agachamento', number: n, reps: 10, load: 50 }));
  const grupos = core.groupSets(sets, [
    { exerciseId: 'e1', exerciseName: 'Agachamento', reps: 15, load: 20 },
    { exerciseId: 'e1', exerciseName: 'Agachamento', reps: 12, load: 30 }
  ]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].sets.length, 6);
  assert.deepEqual(grupos[0].warmup, { reps: 12, load: 30, rir: undefined }, 'one of the warm-ups is lost');
});

test('hasExercise finds the exercise already in the workout form (by id)', () => {
  const form = [{ exerciseId: 'e1', exerciseName: 'Agachamento', sets: [] }, { exerciseId: 12, exerciseName: 'Leg press 45', sets: [] }];
  assert.equal(core.hasExercise(form, { exerciseId: 'e1', exerciseName: 'Agachamento livre' }), true, 'same id, renamed');
  assert.equal(core.hasExercise(form, { exerciseId: '12', exerciseName: 'Leg press 45' }), true, 'catalog id as text');
  assert.equal(core.hasExercise(form, { exerciseId: 'e2', exerciseName: 'Agachamento' }), false, 'same name, different exercise');
  assert.equal(core.hasExercise(form, { exerciseId: 'e9', exerciseName: 'Cadeira extensora' }), false);
});

test('hasExercise works with sheet items (name field) and with old records without an id', () => {
  const ficha = [{ exerciseId: 'e1', name: 'Agachamento', sets: 3 }, { exerciseId: null, name: 'Puxada frente', sets: 3 }];
  assert.equal(core.hasExercise(ficha, { exerciseId: 'e1', name: 'Agachamento' }), true);
  assert.equal(core.hasExercise(ficha, { exerciseId: 'e7', name: 'Puxada frente' }), true, 'an old item without an id matches by name');
  assert.equal(core.hasExercise(ficha, { exerciseId: 'e7', name: 'Remada baixa' }), false);
});

test('hasExercise with an empty or missing list', () => {
  assert.equal(core.hasExercise([], { exerciseId: 'e1', exerciseName: 'X' }), false);
  assert.equal(core.hasExercise(null, { exerciseId: 'e1', exerciseName: 'X' }), false);
  assert.equal(core.hasExercise([{ exerciseId: 'e1', exerciseName: 'X' }], null), false);
});

test('app.js refuses to repeat an exercise in the workout and in the sheet', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /if \(hasExercise\(state\.formSets, ref\)\)/);
  assert.match(app, /if \(hasExercise\(state\.sheetExercises, opts\)\)/);
});

/* ---------- sheet: set limit ---------- */

test('normalizeSheetItem caps the sets at 20 (the editor only draws 20 fields)', () => {
  // regression: typing 500 (or the AI answering 500) created 500 rows in Treinar
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: 500, reps: [] }).sets, 20);
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: '1000000' }).reps.length, 20);
  const longo = core.normalizeSheetItem({ name: 'Supino', reps: new Array(50).fill(10) });
  assert.equal(longo.sets, 20);
  assert.equal(longo.reps.length, 20);
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: 30, reps: 12 }).reps.length, 20, 'v2 format (single reps value)');
  assert.equal(core.parseSheetImport({ name: 'A', exercises: [{ name: 'Supino', sets: 99, reps: [12] }] })[0].exercises[0].sets, 20);
});

test('normalizeSheetItem leaves normal sheets alone (1 to 20 sets)', () => {
  assert.deepEqual(core.normalizeSheetItem({ exerciseId: 'e1', name: 'Supino', sets: 3, reps: [12, 10, 8], note: 'pausa' }),
    { exerciseId: 'e1', name: 'Supino', sets: 3, reps: [12, 10, 8], note: 'pausa' });
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: 20, reps: [] }).sets, 20);
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: 0, reps: [] }).sets, 3, 'empty/zero still becomes 3');
  assert.equal(core.normalizeSheetItem({ name: 'Supino', sets: -4 }).sets, 1);
  assert.deepEqual(core.normalizeSheetItem({ name: 'Supino', sets: 4, reps: ['12', '', undefined] }).reps, [12, null, null, null]);
  assert.equal(core.normalizeSheetItem(null), null);
});

test('saving the sheet in the editor uses the same normalization (with the same cap)', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const body = app.slice(app.indexOf('async function saveSheetEditor'), app.indexOf('async function toggleSheetActive'));
  assert.match(body, /normalizeSheetItem\(\{/);
  assert.match(body, /clean\.reps\.slice\(0, clean\.sets\)/);
});

/* ---------- two workouts on the same day ---------- */

function doisNoMesmoDia() {
  const serie = (load) => [{ exerciseId: 'e1', exerciseName: 'Supino', number: 1, reps: 10, load: load }];
  const manha = { id: 'manha', date: '2026-10-08', createdAt: '2026-10-08T08:00:00.000Z', sheetId: 's1', sets: serie(40), warmups: [{ exerciseId: 'e1', reps: 15, load: 20 }] };
  const noite = { id: 'noite', date: '2026-10-08', createdAt: '2026-10-08T20:00:00.000Z', sheetId: 's1', sets: serie(45), warmups: [{ exerciseId: 'e1', reps: 12, load: 25 }] };
  const antes = { id: 'antes', date: '2026-10-01', createdAt: '2026-10-09T10:00:00.000Z', sheetId: 's1', sets: serie(30) };
  return { manha: manha, noite: noite, antes: antes };
}

test('byDateDesc: on the same day the most recently created workout comes first, in any input order', () => {
  const t = doisNoMesmoDia();
  const ordens = [[t.manha, t.noite, t.antes], [t.noite, t.manha, t.antes], [t.antes, t.noite, t.manha], [t.antes, t.manha, t.noite]];
  ordens.forEach((lista) => {
    assert.deepEqual(lista.slice().sort(core.byDateDesc).map((w) => w.id), ['noite', 'manha', 'antes']);
  });
});

test('byDateDesc: the date still rules (createdAt only breaks ties) and old records without createdAt do not break', () => {
  const t = doisNoMesmoDia();
  assert.ok(core.byDateDesc(t.antes, t.manha) > 0, 'an older date goes to the end even if created later');
  const semHora = [{ id: 'a', date: '2026-10-08' }, { id: 'b', date: '2026-10-08' }];
  assert.equal(core.byDateDesc(semHora[0], semHora[1]), 0, 'a real tie returns 0 (stable sort)');
  assert.deepEqual(semHora.slice().sort(core.byDateDesc).map((w) => w.id), ['a', 'b']);
  assert.deepEqual([semHora[0], t.noite].sort(core.byDateDesc).map((w) => w.id), ['noite', 'a']);
});

test('"last time", loads and suggested warm-up come from the most recent workout of the day', () => {
  const t = doisNoMesmoDia();
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  [[t.manha, t.noite], [t.noite, t.manha]].forEach((lista) => {
    assert.equal(core.lastSessionForExercise(lista, alvo).sets[0].load, 45);
    assert.deepEqual(core.lastLoadsForExercise(lista, alvo), { 1: 45 });
    assert.equal(core.lastWarmupForExercise(lista, alvo).load, 25);
    assert.equal(core.lastWorkoutForSheet(lista, 's1').id, 'noite');
    assert.deepEqual(core.sessionsForExercise(lista, alvo).map((w) => w.id), ['noite', 'manha']);
  });
});

test('normalizeBackup ignores unknown fields (e.g. body weight from old versions) without an error', () => {
  const backup = core.normalizeBackup({ settings: { weekAnchor: '2026-10-05', bodyWeights: { '2026-10-01': 72.5 } } });
  assert.equal(backup.settings.weekAnchor, '2026-10-05');
});
