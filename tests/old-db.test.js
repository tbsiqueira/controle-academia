'use strict';

/* Simulates an old database (v33 era): workouts and sheets WITHOUT ids, names that were later
   renamed and exercises with "source: catalog" without proof.
   It proves that the init path (sources repair + linking by name) and display by id
   do NOT lose any set, load, warm-up or sheet item — and that the old history
   can still be found by the stored name. */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

function baseAntiga() {
  return {
    workouts: [
      {
        id: 'w1', date: '2026-09-20', sheetId: null, sheetName: 'TREINO A',
        sets: [
          { exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40, rir: 2, exerciseNote: '', note: '' },
          { exerciseId: null, exerciseName: 'Puxada frente', number: 2, reps: 10, load: 45, rir: 1, exerciseNote: '', note: 'caiu' },
          { exerciseId: null, exerciseName: 'Remada baixa', number: 1, reps: 12, load: 30, rir: 2, exerciseNote: '', note: '' }
        ],
        warmups: [{ exerciseId: null, exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }]
      },
      {
        id: 'w2', date: '2026-09-27', sheetId: null, sheetName: 'TREINO A',
        sets: [{ exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 42.5, rir: 2, exerciseNote: '', note: '' }]
      }
    ],
    sheets: [{
      id: 's1', name: 'TREINO A', active: true,
      exercises: [
        { exerciseId: null, name: 'Puxada frente', sets: 2, reps: [12, 10], note: '' },
        { exerciseId: null, name: 'Remada baixa', sets: 1, reps: [12], note: '' }
      ]
    }],
    exercises: [
      { id: 'e1', name: 'Puxada frente supinada', group: 'Costas', source: 'custom' },
      { id: 'e2', name: 'Remada baixa', group: 'Costas', source: 'custom' },
      { id: 'e3', name: 'Leg press 45', group: 'Pernas', source: 'catalog' }
    ]
  };
}

test('old database: the sources repair neither loses nor changes valid exercises', () => {
  const base = baseAntiga();
  const reparo = core.fixLibrarySources(base.exercises);

  assert.equal(reparo.changed, 1, 'only the exercise with an unproven source');
  assert.equal(reparo.exercises[2].source, 'custom');
  assert.equal(reparo.exercises[0].source, 'custom', 'custom untouched');
  assert.equal(reparo.exercises.length, base.exercises.length);

  assert.deepEqual(core.fixLibrarySources(), { exercises: [], changed: 0 });
  assert.equal(core.fixLibrarySources([null, { id: 'x', source: 'catalog', catalogId: 3 }]).changed, 0);
});

test('old database: linking by name is unambiguous and removes no items', () => {
  const base = baseAntiga();
  const reparo = core.fixLibrarySources(base.exercises);
  const ligadas = core.linkSheetItemsToExercises(base.sheets, reparo.exercises);

  assert.equal(ligadas.changed, 1, 'only "Remada baixa" matches unambiguously');
  assert.equal(ligadas.sheets[0].exercises.length, 2, 'no sheet item disappeared');
  assert.equal(ligadas.sheets[0].exercises[0].exerciseId, null, 'a renamed exercise stays without an id (no guessing)');
  assert.equal(ligadas.sheets[0].exercises[1].exerciseId, 'e2');
});

test('old database: normalization preserves sets, loads, notes and warm-ups', () => {
  const base = baseAntiga();
  const backup = core.normalizeBackup(base);

  assert.equal(backup.workouts.length, 2);
  assert.equal(backup.workouts[0].sets.length, 3);
  assert.equal(backup.workouts[0].sets[1].load, 45);
  assert.equal(backup.workouts[0].sets[1].note, 'caiu');
  assert.equal(backup.workouts[0].warmups.length, 1);
  assert.deepEqual(backup.workouts[0].warmups[0], { exerciseId: null, exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 });
  assert.equal(backup.workouts[1].sets[0].load, 42.5);
  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].exercises.length, 2);
  assert.deepEqual(backup.sheets[0].exercises[0].reps, [12, 10]);
});

test('old database: history by stored name keeps working', () => {
  const base = baseAntiga();
  const alvo = core.historyTarget({ exerciseId: null, exerciseName: 'Puxada frente' });

  assert.deepEqual(alvo, { exerciseId: null, exerciseName: 'Puxada frente' });
  assert.equal(core.sessionsForExercise(base.workouts, alvo).length, 2, 'both old sessions');
  assert.deepEqual(core.lastLoadsForExercise(base.workouts, alvo), { 1: 42.5 });
  assert.equal(core.bestSetForExercise(base.workouts[0], alvo).load, 45);

  assert.deepEqual(core.historyTarget(), { exerciseId: null, exerciseName: '' });
  assert.equal(core.historyTarget({ exerciseId: 'e1', exerciseName: 'Novo' }).exerciseId, 'e1');
});

test('old database: records without an id and with an id meet in the same history', () => {
  const treinos = [
    { id: 'a', date: '2026-09-20', sets: [{ exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40 }] },
    { id: 'b', date: '2026-09-27', sets: [{ exerciseId: 'e1', exerciseName: 'Puxada frente supinada', number: 1, reps: 12, load: 42.5 }] }
  ];
  const alvo = core.historyTarget({ exerciseId: 'e1', exerciseName: 'Puxada frente' });

  assert.deepEqual(core.sessionsForExercise(treinos, alvo).map(function (w) { return w.id; }), ['b', 'a']);
  assert.deepEqual(core.lastLoadsForExercise(treinos, alvo), { 1: 42.5 });
});

test('old database: grouping preserves the sets and the warm-up of the record', () => {
  const base = baseAntiga();
  const grupos = core.groupSets(base.workouts[0].sets, base.workouts[0].warmups);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].sets.length, 2);
  assert.deepEqual(grupos[0].warmup, { reps: 15, load: 20, rir: 3 });
  assert.equal(grupos[1].sets[0].load, 30);
});
