'use strict';

/* Tests for the v51 functions: last-session hint, repeating the sheet workout,
   draft of the workout in progress, rest timer, short Início list
   with a sheet filter, and weekly progress. */

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

/* ---------- last session of the exercise ---------- */

test('lastSessionForExercise brings the sets of the most recent session, in order', () => {
  const last = core.lastSessionForExercise(WORKOUTS, SUPINO);
  assert.equal(last.date, '2026-11-10');
  assert.deepEqual(last.sets.map((s) => s.number), [1, 2]);
  assert.deepEqual(last.sets[0], { number: 1, reps: 12, load: 22.5, rir: 1 });
});

test('lastSessionForExercise ignores the workout being edited', () => {
  assert.equal(core.lastSessionForExercise(WORKOUTS, SUPINO, 'c').date, '2026-11-07');
  assert.equal(core.lastSessionForExercise(WORKOUTS, SUPINO, null).date, '2026-11-10');
});

test('lastSessionForExercise with no history returns null', () => {
  assert.equal(core.lastSessionForExercise(WORKOUTS, { exerciseId: 99 }), null);
  assert.equal(core.lastSessionForExercise(null, SUPINO), null);
  assert.equal(core.lastSessionForExercise([{ id: 'x', date: '2026-01-01' }], SUPINO), null);
});

test('lastSessionLine sums up load, reps and RIR on one line', () => {
  const line = core.lastSessionLine(core.lastSessionForExercise(WORKOUTS, SUPINO), true);
  assert.equal(line, '22,5 kg × 12 (RIR 1) · 25 kg × 10');
  assert.equal(core.lastSessionLine({ sets: [{ reps: null, load: null, rir: 2 }] }, false), '— (RIR 2)');
  assert.equal(core.lastSessionLine({ sets: [{ reps: 8, load: '', rir: undefined }] }, false), '8');
  assert.equal(core.lastSessionLine(null), '');
});

/* ---------- repeat the last workout of the sheet ---------- */

test('lastWorkoutForSheet finds the last workout of the sheet (includes old typeId)', () => {
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's1').id, 'c');
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's1', 'c').id, 'd');
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, 's2').id, 'b');
});

test('lastWorkoutForSheet ignores a workout with no sets and returns null with no sheet', () => {
  const vazio = [{ id: 'e', date: '2026-11-12', sheetId: 's3', sets: [], cardioMinutes: 30 }];
  assert.equal(core.lastWorkoutForSheet(vazio, 's3'), null);
  assert.equal(core.lastWorkoutForSheet([{ id: 'f', date: '2026-11-12', sheetId: 's3', warmups: [{ exerciseId: 1 }] }], 's3').id, 'f');
  assert.equal(core.lastWorkoutForSheet([{ id: 'g', date: '2026-11-12', sets: [set(1, 1, 1, 1)] }], 's3'), null);
  assert.equal(core.lastWorkoutForSheet(WORKOUTS, ''), null);
  assert.equal(core.lastWorkoutForSheet(null, 's1'), null);
});

test('formFromWorkout copies exercises, reps and loads and leaves RIR/notes blank', () => {
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

test('formFromWorkout turns null into empty and accepts a missing workout', () => {
  const form = core.formFromWorkout({ sets: [{ exerciseId: 1, number: 1, reps: null, load: null }] });
  assert.deepEqual(form[0].sets[0], { number: 1, reps: '', load: '', rir: '', note: '' });
  assert.deepEqual(core.formFromWorkout(null), []);
});

/* ---------- draft ---------- */

test('draftHasContent only counts a draft with something filled in', () => {
  assert.equal(core.draftHasContent(null), false);
  assert.equal(core.draftHasContent({}), false);
  assert.equal(core.draftHasContent({ formSets: [], cardio: '', notes: '  ' }), false);
  assert.equal(core.draftHasContent({ formSets: [{}] }), true);
  assert.equal(core.draftHasContent({ cardio: '20' }), true);
  assert.equal(core.draftHasContent({ notes: 'cansado' }), true);
});

/* ---------- rest ---------- */

test('restSecondsOf uses the user value or 90', () => {
  assert.equal(core.restSecondsOf({ restSeconds: 120 }), 120);
  assert.equal(core.restSecondsOf({ restSeconds: '60' }), 60);
  assert.equal(core.restSecondsOf({ restSeconds: 5 }), 90);
  assert.equal(core.restSecondsOf({ restSeconds: 5000 }), 90);
  assert.equal(core.restSecondsOf({}), 90);
  assert.equal(core.restSecondsOf(null), 90);
});

test('fmtClock formats m:ss and is never negative', () => {
  assert.equal(core.fmtClock(75), '1:15');
  assert.equal(core.fmtClock(9), '0:09');
  assert.equal(core.fmtClock(59.2), '1:00');
  assert.equal(core.fmtClock(-3), '0:00');
});

/* ---------- Início list ---------- */

test('recentCutoff goes back to the 1st of the previous month, including across New Year', () => {
  assert.equal(core.recentCutoff('2026-11-13'), '2026-10-01');
  assert.equal(core.recentCutoff('2027-01-05'), '2026-12-01');
});

test('visibleWorkoutCount shows the current and previous month, with a minimum', () => {
  const lista = [
    { date: '2026-11-12' }, { date: '2026-11-02' }, { date: '2026-10-20' },
    { date: '2026-09-30' }, { date: '2026-08-01' }, { date: '2026-07-01' }
  ];
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 2), 3);
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 5), 5);
  assert.equal(core.visibleWorkoutCount(lista, '2026-11-13', 50), 6);
  assert.equal(core.visibleWorkoutCount(null, '2026-11-13', 10), 0);
});

test('sheetFilterOptions lists the sheets used, without repeats and in order', () => {
  const sheets = [{ id: 's1', name: 'TREINO B' }, { id: 's2', name: 'TREINO A' }];
  const workouts = [{ sheetId: 's1' }, { sheetId: 's2' }, { sheetId: 's1' }, {}, { sheetName: 'Antiga' }];
  assert.deepEqual(core.sheetFilterOptions(workouts, sheets), ['Antiga', 'TREINO A', 'TREINO B']);
  assert.deepEqual(core.sheetFilterOptions(null, sheets), []);
});

/* ---------- personal records ---------- */

const HIST = [
  { id: 'r1', date: '2026-10-01', sets: [set(10, 1, 10, 40), set(11, 1, 12, 10)] },
  { id: 'r2', date: '2026-10-08', sets: [set(10, 1, 8, 45), set(10, 2, 8, 42.5)] },
  { id: 'r3', date: '2026-10-15', sets: [set(12, 1, 15, 20)] },
  { id: 'r4', date: '2026-10-22', sets: [set(10, 1, 6, 47.5), set(10, 2, 8, 47.5), set(11, 1, 12, 10), set(12, 1, 15, 20)] }
];

test('workoutRecords marks the exercise that beat the previous highest load', () => {
  assert.deepEqual(core.workoutRecords(HIST, HIST[3]), [
    { exerciseId: 10, exerciseName: 'Ex 10', load: 47.5, reps: 8, previous: 45 }
  ]);
  assert.deepEqual(core.workoutRecords(HIST, HIST[1]).map((r) => r.load), [45]);
});

test('workoutRecords: the first time is not a record, an equal load is not a record', () => {
  assert.deepEqual(core.workoutRecords(HIST, HIST[0]), []);
  assert.deepEqual(core.workoutRecords(HIST, HIST[2]), []);
  const igual = { id: 'r5', date: '2026-10-29', sets: [set(10, 1, 10, 47.5)] };
  assert.deepEqual(core.workoutRecords(HIST.concat([igual]), igual), []);
});

test('workoutRecords ignores workouts on the same day or later, and the workout itself', () => {
  const mesmoDia = { id: 'x', date: '2026-10-22', sets: [set(10, 1, 1, 100)] };
  assert.deepEqual(core.workoutRecords(HIST.concat([mesmoDia]), HIST[3]).length, 1);
  assert.deepEqual(core.workoutRecords(HIST, HIST[0]), []);
  const editado = Object.assign({}, HIST[1], { date: '2026-10-30', sets: [set(10, 1, 8, 50)] });
  assert.deepEqual(core.workoutRecords(HIST, editado)[0].previous, 47.5);
  // the highest previous load counts even when it appears earlier in the list
  const novo = { id: 'n', date: '2026-11-01', sets: [set(10, 1, 5, 50)] };
  assert.equal(core.workoutRecords([HIST[3], HIST[0]], novo)[0].previous, 47.5);
});

test('recordCounts gives the same as workoutRecords for each workout (mixed ids and names)', () => {
  // fixed generator (no Math.random) so the test is repeatable
  let seed = 7;
  const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const ex = [
    { exerciseId: 1, exerciseName: 'Supino' }, { exerciseId: null, exerciseName: 'Supino' },
    { exerciseId: 2, exerciseName: 'Remada' }, { exerciseId: null, exerciseName: 'Remada' },
    { exerciseId: 3, exerciseName: 'Supino' }, { exerciseId: null, exerciseName: '' }
  ];
  const lista = [];
  for (let i = 0; i < 120; i++) {
    const sets = [];
    for (let k = rnd(4); k >= 0; k--) {
      const e = ex[rnd(ex.length)];
      sets.push({ exerciseId: e.exerciseId, exerciseName: e.exerciseName, number: k + 1, reps: rnd(12), load: rnd(5) ? rnd(30) * 2.5 : '' });
    }
    lista.push({ id: 'w' + i, date: '2026-0' + (1 + rnd(9)) + '-1' + rnd(10), sets: rnd(15) ? sets : undefined });
  }
  lista.push({ id: 'semData', sets: [{ exerciseId: 1, exerciseName: 'Supino', load: 500 }] });
  const counts = core.recordCounts(lista);
  lista.forEach((w) => assert.equal(counts[w.id], core.workoutRecords(lista, w).length, w.id));
  assert.ok(Object.values(counts).some((n) => n > 0), 'the test needs real records');
  assert.deepEqual(core.recordCounts(null), {});
  assert.deepEqual(core.recordCounts([null, HIST[0]]), { r1: 0 });
});

test('workoutRecords accepts a missing list or workout', () => {
  assert.deepEqual(core.workoutRecords(null, HIST[3]), []);
  assert.deepEqual(core.workoutRecords(HIST, null), []);
});

/* ---------- weekly progress ---------- */

test('workoutVolume sums reps x load and ignores the warm-up', () => {
  assert.equal(core.workoutVolume(WORKOUTS[1]), 12 * 22.5 + 10 * 25 + 15 * 8);
  assert.equal(core.workoutVolume({}), 0);
  assert.equal(core.workoutVolume(null), 0);
});

test('weeklyTotals sums workouts, volume and cardio per 7-day window', () => {
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

/* ---------- Treinar form: one set row ---------- */

function colSizes(html) {
  return (html.match(/class="col-(\d+)/g) || []).map((c) => Number(c.replace(/\D/g, '')));
}

test('setRowHtml gives the load more width than the set number', () => {
  const html = core.setRowHtml(0, 0, { number: 1, reps: 12, load: 102.5, rir: 2, note: '' }, true);
  // regression: number and load were col-2 each; "102,5" was cut off on 375px screens
  assert.doesNotMatch(html, /readonly/, 'the set number is not a text field');
  assert.match(html, /<div class="col-3"><input type="text" inputmode="decimal" autocomplete="off"[^>]*value="102,5"/);
  assert.deepEqual(colSizes(html), [2, 2, 3, 2, 3]);
  assert.equal(colSizes(html).reduce((a, b) => a + b, 0), 12, 'the row fills the whole grid');
});

test('setHeaderHtml uses the same columns as the row', () => {
  const header = core.setHeaderHtml();
  assert.deepEqual(colSizes(header), colSizes(core.setRowHtml(0, 0, { number: 1 }, false)));
  ['reps', 'carga', 'RIR', 'obs'].forEach((label) => assert.ok(header.indexOf('>' + label + '<') !== -1, label));
});

test('setRowHtml wires each field to the right setField and keeps the numeric keyboards', () => {
  const html = core.setRowHtml(2, 1, { number: 2, reps: 10, load: 27.5, rir: 1, note: 'ok' }, false);
  ['reps', 'load', 'rir', 'note'].forEach((campo) => {
    assert.ok(html.indexOf('oninput="setField(2,1,\'' + campo + '\',this.value)"') !== -1, campo);
  });
  assert.equal((html.match(/<input /g) || []).length, 4);
  assert.match(html, /type="number" inputmode="numeric"[^>]*value="10"[^>]*aria-label="Reps da série 2"/);
  assert.match(html, /value="27.5"[^>]*aria-label="Carga da série 2"/);
  assert.match(html, /value="1"[^>]*aria-label="RIR da série 2"/);
  assert.match(html, /value="ok"[^>]*aria-label="Observação da série 2"/);
});

test('setRowHtml escapes what the user typed and accepts empty fields', () => {
  const html = core.setRowHtml(0, 0, { number: 1, reps: '', load: '', rir: '', note: '"><b>x' }, true);
  assert.ok(html.indexOf('<b>') === -1);
  assert.ok(html.indexOf('&quot;&gt;&lt;b&gt;x') !== -1);
  assert.equal((html.match(/value=""/g) || []).length, 3);
});

/* ---------- remove an exercise from the form ---------- */

test('groupHasData: an exercise with anything filled in asks for confirmation before removal', () => {
  const vazio = { reps: '', load: '', rir: '', note: '' };
  assert.equal(core.groupHasData({ sets: [vazio, Object.assign({}, vazio, { reps: '12' })] }), true);
  assert.equal(core.groupHasData({ sets: [Object.assign({}, vazio, { load: '27,5' })] }), true);
  assert.equal(core.groupHasData({ sets: [Object.assign({}, vazio, { rir: 0 })] }), true, 'RIR 0 is data');
  assert.equal(core.groupHasData({ sets: [Object.assign({}, vazio, { note: 'caiu' })] }), true);
  assert.equal(core.groupHasData({ warmup: { reps: 15, load: '', rir: '' }, sets: [vazio] }), true, 'warm-up only');
  // loaded from the sheet (planned reps) or from the last workout (loads) counts too
  assert.equal(core.groupHasData({ warmup: { reps: '', load: '', rir: '' }, sets: [{ number: 1, reps: 12, load: 40, rir: '', note: '' }] }), true);
});

test('groupHasData: a blank exercise goes without asking', () => {
  assert.equal(core.groupHasData({ warmup: { reps: '', load: '', rir: '' }, sets: [{ number: 1, reps: '', load: '', rir: '', note: '' }] }), false);
  assert.equal(core.groupHasData({ sets: [{ number: 1, reps: null, load: undefined }] }), false);
  assert.equal(core.groupHasData({ sets: [] }), false);
  assert.equal(core.groupHasData({}), false);
  assert.equal(core.groupHasData(null), false);
});

test('removeFormExercise (app.js) confirms before deleting an exercise with data', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const body = app.slice(app.indexOf('function removeFormExercise'), app.indexOf('/* ---------- rest timer'));
  assert.match(body, /groupHasData\(group\) && !confirm\(/);
  assert.ok(body.indexOf('confirm(') < body.indexOf('splice('), 'asks before removing');
});
