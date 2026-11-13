'use strict';

/* Testes das funções do v51: dica da última sessão, repetir treino da ficha,
   rascunho do treino em andamento, timer de descanso, lista curta do Início
   com filtro por ficha e evolução semanal. */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

const SUPINO = { exerciseId: 10, exerciseName: 'Supino' };

function set(exerciseId, number, reps, load, rir) {
  return { exerciseId: exerciseId, exerciseName: 'Ex ' + exerciseId, number: number, reps: reps, load: load, rir: rir };
}

const WORKOUTS = [
  { id: 'a', date: '2026-11-01', sheetId: 's1', sets: [set(10, 1, 12, 20, 2)], warmups: [] },
  { id: 'c', date: '2026-11-10', sheetId: 's1', sets: [set(10, 2, 10, 25, null), set(10, 1, 12, 22.5, 1), set(11, 1, 15, 8, 2)], warmups: [{ exerciseId: 10, reps: 15, load: 10, rir: 3 }] },
  { id: 'b', date: '2026-11-05', sheetId: 's2', sets: [set(11, 1, 15, 6, 2)] },
  { id: 'd', date: '2026-11-07', typeId: 's1', sets: [set(10, 1, 8, 21, 0)] }
];

/* ---------- última sessão do exercício ---------- */

test('lastSessionForExercise traz as series da sessao mais recente, em ordem', () => {
  const last = core.lastSessionForExercise(WORKOUTS, SUPINO);
  assert.equal(last.date, '2026-11-10');
  assert.deepEqual(last.sets.map((s) => s.number), [1, 2]);
  assert.deepEqual(last.sets[0], { number: 1, reps: 12, load: 22.5, rir: 1 });
});

test('lastSessionForExercise ignora o treino em edicao', () => {
  assert.equal(core.lastSessionForExercise(WORKOUTS, SUPINO, 'c').date, '2026-11-07');
  assert.equal(core.lastSessionForExercise(WORKOUTS, SUPINO, null).date, '2026-11-10');
});

test('lastSessionForExercise sem historico devolve null', () => {
  assert.equal(core.lastSessionForExercise(WORKOUTS, { exerciseId: 99 }), null);
  assert.equal(core.lastSessionForExercise(null, SUPINO), null);
  assert.equal(core.lastSessionForExercise([{ id: 'x', date: '2026-01-01' }], SUPINO), null);
});

test('lastSessionLine resume carga, reps e RIR numa linha', () => {
  const line = core.lastSessionLine(core.lastSessionForExercise(WORKOUTS, SUPINO), true);
  assert.equal(line, '22,5 kg × 12 (RIR 1) · 25 kg × 10');
  assert.equal(core.lastSessionLine({ sets: [{ reps: null, load: null, rir: 2 }] }, false), '— (RIR 2)');
  assert.equal(core.lastSessionLine({ sets: [{ reps: 8, load: '', rir: undefined }] }, false), '8');
  assert.equal(core.lastSessionLine(null), '');
});

/* ---------- repetir o último treino da ficha ---------- */

test('lastWorkoutForSheet acha o ultimo treino da ficha (inclui typeId antigo)', () => {
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's1').id, 'c');
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's1', 'c').id, 'd');
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's2').id, 'b');
});

test('lastWorkoutForSheet ignora treino sem series e devolve null sem ficha', () => {
  const vazio = [{ id: 'e', date: '2026-11-12', sheetId: 's3', sets: [], cardioMinutes: 30 }];
  assert.equal(core.lastWorkoutForSheet(vazio, 's3'), null);
  assert.equal(core.lastWorkoutForSheet([{ id: 'f', date: '2026-11-12', sheetId: 's3', warmups: [{ exerciseId: 1 }] }], 's3').id, 'f');
  assert.equal(core.lastWorkoutForSheet([{ id: 'g', date: '2026-11-12', sets: [set(1, 1, 1, 1)] }], 's3'), null);
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, ''), null);
  assert.equal(core.lastWorkoutForSheet(null, 's1'), null);
});

test('formFromWorkout copia exercicios, reps e cargas e deixa RIR/obs em branco', () => {
  const form = core.formFromWorkout(WORKOUTS[1]);
  assert.equal(form.length, 2);
  assert.equal(form[0].exerciseId, 10);
  assert.deepEqual(form[0].sets, [
    { number: 1, reps: 12, load: 22.5, rir: '', note: '' },
    { number: 2, reps: 10, load: 25, rir: '', note: '' }
  ]);
  assert.deepEqual(form[0].warmup, { reps: 15, load: 10, rir: '' });
  assert.deepEqual(form[1].warmup, { reps: '', load: '', rir: '' });
});

test('formFromWorkout troca null por vazio e aceita treino ausente', () => {
  const form = core.formFromWorkout({ sets: [{ exerciseId: 1, number: 1, reps: null, load: null }] });
  assert.deepEqual(form[0].sets[0], { number: 1, reps: '', load: '', rir: '', note: '' });
  assert.deepEqual(core.formFromWorkout(null), []);
});

/* ---------- rascunho ---------- */

test('draftHasContent so considera rascunho com algo preenchido', () => {
  assert.equal(core.draftHasContent(null), false);
  assert.equal(core.draftHasContent({}), false);
  assert.equal(core.draftHasContent({ formSets: [], cardio: '', notes: '  ' }), false);
  assert.equal(core.draftHasContent({ formSets: [{}] }), true);
  assert.equal(core.draftHasContent({ cardio: '20' }), true);
  assert.equal(core.draftHasContent({ notes: 'cansado' }), true);
});

/* ---------- descanso ---------- */

test('restSecondsOf usa o valor do usuario ou 90', () => {
  assert.equal(core.restSecondsOf({ restSeconds: 120 }), 120);
  assert.equal(core.restSecondsOf({ restSeconds: '60' }), 60);
  assert.equal(core.restSecondsOf({ restSeconds: 5 }), 90);
  assert.equal(core.restSecondsOf({ restSeconds: 5000 }), 90);
  assert.equal(core.restSecondsOf({}), 90);
  assert.equal(core.restSecondsOf(null), 90);
});

test('fmtClock formata m:ss e nunca fica negativo', () => {
  assert.equal(core.fmtClock(75), '1:15');
  assert.equal(core.fmtClock(9), '0:09');
  assert.equal(core.fmtClock(59.2), '1:00');
  assert.equal(core.fmtClock(-3), '0:00');
});

/* ---------- lista do Início ---------- */

test('recentCutoff volta para o dia 1 do mes anterior, inclusive na virada do ano', () => {
  assert.equal(core.recentCutoff('2026-11-13'), '2026-10-01');
  assert.equal(core.recentCutoff('2027-01-05'), '2026-12-01');
});

test('visibleWorkoutCount mostra mes atual e anterior, com um minimo', () => {
  const lista = [
    { date: '2026-11-12' }, { date: '2026-11-02' }, { date: '2026-10-20' },
    { date: '2026-09-30' }, { date: '2026-08-01' }, { date: '2026-07-01' }
  ];
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 2), 3);
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 5), 5);
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 50), 6);
  assert.equal(core.visibleWorkoutCount(null, '2026-11-13', 10), 0);
});

test('sheetFilterOptions lista as fichas usadas, sem repetir e em ordem', () => {
  const sheets = [{ id: 's1', name: 'TREINO B' }, { id: 's2', name: 'TREINO A' }];
  const workouts = [{ sheetId: 's1' }, { sheetId: 's2' }, { sheetId: 's1' }, {}, { sheetName: 'Antiga' }];
  assert.deepEqual(core.sheetFilterOptions(workouts, sheets), ['Antiga', 'TREINO A', 'TREINO B']);
  assert.deepEqual(core.sheetFilterOptions(null, sheets), []);
});

/* ---------- evolução semanal ---------- */

test('workoutVolume soma reps x carga e ignora o aquecimento', () => {
  assert.equal(core.workoutVolume(WORKOUTS[1]), 12 * 22.5 + 10 * 25 + 15 * 8);
  assert.equal(core.workoutVolume({}), 0);
  assert.equal(core.workoutVolume(null), 0);
});

test('weeklyTotals soma treinos, volume e cardio por janela de 7 dias', () => {
  const workouts = [
    { date: '2026-11-01', sets: [{ reps: 10, load: 20 }], cardioMinutes: 10 },
    { date: '2026-11-03', sets: [{ reps: 10, load: 10.04 }] },
    { date: '2026-11-08', sets: [], cardioMinutes: 30 },
    { date: '2026-11-09', sets: [] },
    { date: '2026-10-01', sets: [{ reps: 1, load: 1 }] },
    { date: '2026-11-20', sets: [{ reps: 1, load: 1 }] }
  ];
  const weeks = core.weeklyTotals(workouts, '2026-11-08', 2);
  assert.deepEqual(weeks, [
    { start: '2026-11-01', end: '2026-11-07', workouts: 2, volume: 300, cardio: 10 },
    { start: '2026-11-08', end: '2026-11-14', workouts: 1, volume: 0, cardio: 30 }
  ]);
  assert.deepEqual(core.weeklyTotals(null, '2026-11-08', 1), [
    { start: '2026-11-08', end: '2026-11-14', workouts: 0, volume: 0, cardio: 0 }
  ]);
});
