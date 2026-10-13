'use strict';

/* Simula uma base antiga (era v33): treinos e fichas SEM ids, nomes que depois foram
   renomeados e exercícios com "source: catalog" sem comprovação.
   Prova que o caminho do init (reparo de sources + ligação por nome) e a exibição por id
   NÃO perdem nenhuma série, carga, aquecimento ou item de ficha — e que o histórico
   antigo continua encontrável pelo nome guardado. */

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

test('base antiga: reparo de sources nao perde nem altera exercicios validos', () => {
  const base = baseAntiga();
  const reparo = core.fixLibrarySources(base.exercises);

  assert.equal(reparo.changed, 1, 'apenas o exercicio com source sem comprovacao');
  assert.equal(reparo.exercises[2].source, 'custom');
  assert.equal(reparo.exercises[0].source, 'custom', 'custom intacto');
  assert.equal(reparo.exercises.length, base.exercises.length);

  assert.deepEqual(core.fixLibrarySources(), { exercises: [], changed: 0 });
  assert.equal(core.fixLibrarySources([null, { id: 'x', source: 'catalog', catalogId: 3 }]).changed, 0);
});

test('base antiga: ligacao por nome e inequivoca e nao remove itens', () => {
  const base = baseAntiga();
  const reparo = core.fixLibrarySources(base.exercises);
  const ligadas = core.linkSheetItemsToExercises(base.sheets, reparo.exercises);

  assert.equal(ligadas.changed, 1, 'apenas "Remada baixa" casa de forma inequivoca');
  assert.equal(ligadas.sheets[0].exercises.length, 2, 'nenhum item de ficha sumiu');
  assert.equal(ligadas.sheets[0].exercises[0].exerciseId, null, 'exercicio renomeado fica sem id (sem adivinhacao)');
  assert.equal(ligadas.sheets[0].exercises[1].exerciseId, 'e2');
});

test('base antiga: normalizacao preserva series, cargas, notas e aquecimentos', () => {
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

test('base antiga: historico por nome guardado continua funcionando', () => {
  const base = baseAntiga();
  const alvo = core.historyTarget({ exerciseId: null, exerciseName: 'Puxada frente' });

  assert.deepEqual(alvo, { exerciseId: null, exerciseName: 'Puxada frente' });
  assert.equal(core.sessionsForExercise(base.workouts, alvo).length, 2, 'as duas sessoes antigas');
  assert.deepEqual(core.lastLoadsForExercise(base.workouts, alvo), { 1: 42.5 });
  assert.equal(core.bestSetForExercise(base.workouts[0], alvo).load, 45);

  assert.deepEqual(core.historyTarget(), { exerciseId: null, exerciseName: '' });
  assert.equal(core.historyTarget({ exerciseId: 'e1', exerciseName: 'Novo' }).exerciseId, 'e1');
});

test('base antiga: registros sem id e com id se encontram no mesmo historico', () => {
  const treinos = [
    { id: 'a', date: '2026-09-20', sets: [{ exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40 }] },
    { id: 'b', date: '2026-09-27', sets: [{ exerciseId: 'e1', exerciseName: 'Puxada frente supinada', number: 1, reps: 12, load: 42.5 }] }
  ];
  const alvo = core.historyTarget({ exerciseId: 'e1', exerciseName: 'Puxada frente' });

  assert.deepEqual(core.sessionsForExercise(treinos, alvo).map(function (w) { return w.id; }), ['b', 'a']);
  assert.deepEqual(core.lastLoadsForExercise(treinos, alvo), { 1: 42.5 });
});

test('base antiga: agrupamento preserva as series e o aquecimento do registro', () => {
  const base = baseAntiga();
  const grupos = core.groupSets(base.workouts[0].sets, base.workouts[0].warmups);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].sets.length, 2);
  assert.deepEqual(grupos[0].warmup, { reps: 15, load: 20, rir: 3 });
  assert.equal(grupos[1].sets[0].load, 30);
});
