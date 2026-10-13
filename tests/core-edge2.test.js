'use strict';

/* Segunda leva de testes de borda: cobre os ramos que sobraram no mapa de cobertura
   (comparadores de ordenacao nas duas direcoes, fallbacks com argumento ausente,
   caminhos de normalizacao). */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

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
