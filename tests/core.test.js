'use strict';

/* Unit tests for Meu Treino.
   They run in Node with no dependencies:  node --test tests/
   They cover the pure logic (js/core.js) and data compatibility across versions. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

/* ---------- dates ---------- */

test('pad2 pads with a leading zero', () => {
  assert.equal(core.pad2(3), '03');
  assert.equal(core.pad2(12), '12');
});

test('fmtDate and parseDate round-trip', () => {
  assert.equal(core.fmtDate(new Date(2026, 9, 8)), '2026-10-08');
  assert.equal(core.fmtDate(core.parseDate('2026-10-08')), '2026-10-08');
  assert.equal(core.fmtDate(new Date(2027, 0, 1)), '2027-01-01');
});

test('addDaysISO crosses month and year ends', () => {
  assert.equal(core.addDaysISO('2026-10-08', 6), '2026-10-14');
  assert.equal(core.addDaysISO('2026-10-30', 3), '2026-11-02');
  assert.equal(core.addDaysISO('2026-12-30', 3), '2027-01-02');
});

test('fmtBR formats in the Brazilian style', () => {
  assert.equal(core.fmtBR('2026-10-08'), '08/10/2026');
  assert.equal(core.fmtBR(''), '—');
});

test('dateParts splits day, month and weekday for the Início list', () => {
  const p = core.dateParts('2026-11-11', '2026-11-20');
  assert.equal(p.day, '11');
  assert.equal(p.weekday, 'qua');
  assert.equal(p.month, 'nov');
  assert.equal(p.relative, '');
  assert.equal(p.monthKey, '2026-11');
  assert.equal(p.monthLabel, 'novembro de 2026');

  assert.equal(core.dateParts('2026-03-01').month, 'mar');
  assert.equal(core.dateParts('2026-03-01').weekday, 'dom');
  assert.equal(core.dateParts('2026-03-01').relative, '');
});

test('dateParts marks today and yesterday, including across New Year', () => {
  assert.equal(core.dateParts('2026-11-13', '2026-11-13').relative, 'hoje');
  assert.equal(core.dateParts('2026-11-12', '2026-11-13').relative, 'ontem');
  assert.equal(core.dateParts('2026-12-31', '2027-01-01').relative, 'ontem');
  assert.equal(core.dateParts('2026-11-11', '2026-11-13').relative, '');
});

test('dateParts returns null for an empty or invalid date', () => {
  assert.equal(core.dateParts(''), null);
  assert.equal(core.dateParts(null), null);
  assert.equal(core.dateParts('13/11/2026'), null);
});

/* ---------- text and numbers ---------- */

test('esc neutralizes HTML', () => {
  assert.equal(core.esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  assert.equal(core.esc(null), '');
  assert.equal(core.esc(undefined), '');
  assert.equal(core.esc(0), '0');
});

test('toNum and toNumOrNull', () => {
  assert.equal(core.toNum('12'), 12);
  assert.equal(core.toNum('12.5'), 12.5);
  assert.equal(core.toNum('abc'), 0);
  assert.equal(core.toNum(null), 0);
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('0'), 0);
  assert.equal(core.toNumOrNull('27.5'), 27.5);
});

test('normalizeText ignores accents, case and spaces', () => {
  assert.equal(core.normalizeText('Puxada Máquina'), 'puxada maquina');
  assert.equal(core.normalizeText('  ELEVAÇÃO Pélvica '), 'elevacao pelvica');
  assert.equal(core.normalizeText(null), '');
  assert.ok(core.normalizeText('Puxada Máquina').indexOf(core.normalizeText('puxada maquina')) === 0);
});

test('parseLocalNumber accepts comma and dot', () => {
  assert.equal(core.parseLocalNumber('27,5'), 27.5);
  assert.equal(core.parseLocalNumber('27.5'), 27.5);
  assert.equal(core.parseLocalNumber('1.100,50'), 1100.5);
  assert.equal(core.parseLocalNumber('12'), 12);
  assert.equal(core.parseLocalNumber(' 30 '), 30);
  assert.ok(Number.isNaN(core.parseLocalNumber('abc')));
  assert.ok(Number.isNaN(core.parseLocalNumber('')));
  assert.ok(Number.isNaN(core.parseLocalNumber(null)));
});

test('toNum and toNumOrNull accept a comma', () => {
  assert.equal(core.toNum('27,5'), 27.5);
  assert.equal(core.toNum('27,5') + core.toNum('2,5'), 30);
  assert.equal(core.toNumOrNull('27,5'), 27.5);
  assert.equal(core.toNumOrNull('0,5'), 0.5);
  assert.equal(core.toNumOrNull('0'), 0);
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('abc'), null);
});

test('formatDecimal shows a comma when the locale uses a comma', () => {
  assert.equal(core.formatDecimal(27.5, true), '27,5');
  assert.equal(core.formatDecimal(27.5, false), '27.5');
  assert.equal(core.formatDecimal(27, true), '27');
  assert.equal(core.formatDecimal('27,5', true), '27,5');
  assert.equal(core.formatDecimal('', true), '');
  assert.equal(core.formatDecimal(null, true), '');
});

test('regression: a load typed with a comma (iPhone) keeps its decimal part', () => {
  const digitado = { load: '27,5', reps: '12', rir: '2' };
  const salvo = {
    load: core.toNumOrNull(digitado.load),
    reps: core.toNumOrNull(digitado.reps),
    rir: core.toNumOrNull(digitado.rir)
  };

  assert.deepEqual(salvo, { load: 27.5, reps: 12, rir: 2 });
  assert.equal(core.formatDecimal(salvo.load, true), '27,5', 'goes back to the field with a comma');
});

/* ---------- settings and week ---------- */

test('defaultSettings uses default targets and a week starting today', () => {
  const s = core.defaultSettings();
  assert.equal(s.id, 'app');
  assert.equal(s.weeklyWorkoutTarget, 3);
  assert.equal(s.weeklyCardioTarget, 120);
  assert.equal(s.weekAnchor, core.todayISO());
});

test('weekWindow covers 7 days (inclusive)', () => {
  assert.deepEqual(core.weekWindow('2026-10-08'), { anchor: '2026-10-08', end: '2026-10-14' });
  assert.deepEqual(core.weekWindow('2026-12-30'), { anchor: '2026-12-30', end: '2027-01-05' });
});

test('isValidWorkout accepts sets or cardio', () => {
  assert.equal(core.isValidWorkout({ sets: [{ reps: 12, load: 0 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 27 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 30 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 0 }] }), false);
  assert.equal(core.isValidWorkout({}), false);
});

/* ---------- warm-up and sets ---------- */

test('warmupLine omits empty fields and keeps zero', () => {
  assert.equal(core.warmupLine({ reps: 15, load: 20, rir: 3 }), '15 reps · 20 kg · RIR 3');
  assert.equal(core.warmupLine({ reps: 15, load: '', rir: '' }), '15 reps');
  assert.equal(core.warmupLine({ reps: 0, load: 0, rir: 0 }), '0 reps · 0 kg · RIR 0');
  assert.equal(core.warmupLine(null), '');
});

test('warmupHasData detects a filled-in warm-up', () => {
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData({ reps: 15, load: '', rir: '' }), true);
  assert.equal(core.warmupHasData({ reps: '', load: 0, rir: '' }), true);
  assert.equal(core.warmupHasData(null), false);
});

test('setsSummaryLines returns a list ordered by set and escapes the note', () => {
  const html = core.setsSummaryLines([
    { number: 2, reps: 10, load: 27, rir: 1, note: '' },
    { number: 1, reps: 12, load: 27, rir: 2, note: '<b>forte</b>' }
  ]);

  assert.ok(html.indexOf('<ul') === 0, 'it is a list (ul)');
  assert.ok(html.indexOf('sheet-item-idx') !== -1, 'uses the same style as the sheet list');
  assert.ok(html.indexOf('12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(html.indexOf('10 reps · 27 kg · RIR 1') !== -1);
  assert.ok(html.indexOf('&lt;b&gt;forte&lt;/b&gt;') !== -1, 'note is escaped');
  assert.ok(html.indexOf('12 reps') < html.indexOf('10 reps'), 'set 1 comes before set 2');
});

test('setsSummaryLines of an empty list generates no markup', () => {
  assert.equal(core.setsSummaryLines([]), '');
});

test('groupSets groups by exercise, keeps the order and attaches the warm-up', () => {
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

/* ---------- history per exercise ---------- */

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

test('lastLoadsForExercise uses the most recent workout, by set number', () => {
  assert.deepEqual(core.lastLoadsForExercise(history, 'Puxada frente'), { 1: 45, 2: 50 });
  assert.deepEqual(core.lastLoadsForExercise(history, 'Inexistente'), {});
  assert.deepEqual(core.lastLoadsForExercise([], 'Puxada frente'), {});
});

test('previousWarmupFields brings the previous warm-up reps and weight (empty RIR)', () => {
  assert.deepEqual(core.previousWarmupFields(history, 'Puxada frente'), { reps: 15, load: 25, rir: '' });
  assert.deepEqual(core.previousWarmupFields(history, 'Inexistente'), { reps: '', load: '', rir: '' });
});

test('sessionsForExercise orders newest first and includes warm-up-only sessions', () => {
  const withWarmupOnly = history.concat([
    { id: 'd', date: '2026-10-09', sets: [], warmups: [{ exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }] }
  ]);
  assert.deepEqual(core.sessionsForExercise(withWarmupOnly, 'Puxada frente').map(function (w) { return w.id; }), ['d', 'b', 'a']);
});

test('bestSetForExercise picks the highest load and breaks ties by reps', () => {
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

/* ---------- export a workout as text ---------- */

test('workoutAsText builds the message with the warm-up inside each exercise', () => {
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

  assert.equal(lines[0], '*08/10/2026*');
  assert.equal(lines[1], 'Ficha: _TREINO A - inferiores_');
  assert.ok(text.indexOf('1. *Elevação pélvica*\n- Aquecimento:') !== -1, 'the exercise line is followed by its sets, no note line');
  assert.ok(text.indexOf('Obs.:') === -1, "the teacher's note line is left out");
  assert.ok(text.indexOf('pausa de 1s') === -1, "the teacher's note text is left out");
  assert.ok(text.indexOf('- Aquecimento: 15 reps · 20 kg · RIR 3') !== -1);
  assert.ok(text.indexOf('- Série 1: 12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(text.indexOf('- Série 2: 10 reps · 27 kg · RIR 1 _(caiu a força)_') !== -1);
  assert.ok(text.indexOf('2. *Esteira*') !== -1, 'an exercise with only a warm-up also appears');
  assert.ok(text.indexOf('*Cardio:* 30 min') !== -1);
  assert.ok(text.indexOf('*Observações:* treino leve') !== -1);
});

test('workoutAsText omits cardio, notes and sheet when empty', () => {
  const text = core.workoutAsText({
    date: '2026-10-08',
    sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20, rir: 2 }]
  });
  assert.equal(text.indexOf('Cardio'), -1);
  assert.equal(text.indexOf('Observações'), -1);
  assert.equal(text.indexOf('Ficha:'), -1);
  assert.ok(text.indexOf('1. *X*') !== -1);
});

/* ---------- reference by id (foreign key) ---------- */

test('linkSheetItemsToExercises links old sheets to the exercise by name', () => {
  const sheets = [{
    id: 's1', name: 'TREINO A',
    exercises: [
      { name: 'Elevação pélvica', sets: 3, reps: [12, 10, 8], note: '' },
      { name: 'Desconhecido', sets: 3, reps: [10], note: '' },
      { name: 'Leg press 45', exerciseId: 'ja-tinha', sets: 3, reps: [12], note: '' }
    ]
  }];
  const exercises = [{ id: 'e1', name: 'Elevação pélvica' }, { id: 'e2', name: 'Leg press 45' }];

  const result = core.linkSheetItemsToExercises(sheets, exercises);

  assert.equal(result.changed, 1);
  assert.equal(result.sheets[0].exercises[0].exerciseId, 'e1');
  assert.equal(result.sheets[0].exercises[1].exerciseId, undefined, 'an unknown name gets no id');
  assert.equal(result.sheets[0].exercises[2].exerciseId, 'ja-tinha', 'an existing id is preserved');
  assert.deepEqual(result.sheets[0].exercises[0].reps, [12, 10, 8], 'nothing else changes');
});

test('linkSheetItemsToExercises does not link when the name is ambiguous', () => {
  const sheets = [{ id: 's1', name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: [10], note: '' }] }];
  const exercises = [{ id: 'e1', name: 'Supino' }, { id: 'e2', name: 'supino' }];

  const result = core.linkSheetItemsToExercises(sheets, exercises);

  assert.equal(result.changed, 0);
  assert.equal(result.sheets[0].exercises[0].exerciseId, undefined);
});

test('renameInSheets updates by id and also old sheets by name', () => {
  const sheets = [{
    id: 's1', name: 'A',
    exercises: [
      { exerciseId: 'e1', name: 'Puxada frente', sets: 3, reps: [12], note: '' },
      { name: 'puxada frente', sets: 3, reps: [10], note: '' },
      { exerciseId: 'e2', name: 'Outro', sets: 3, reps: [10], note: '' }
    ]
  }];

  const result = core.renameInSheets(sheets, 'e1', 'Puxada frente', 'Puxada frente supinada');

  assert.equal(result.changed, 2);
  assert.equal(result.sheets[0].exercises[0].name, 'Puxada frente supinada');
  assert.equal(result.sheets[0].exercises[1].name, 'Puxada frente supinada');
  assert.equal(result.sheets[0].exercises[1].exerciseId, 'e1', 'an old item gets the reference');
  assert.equal(result.sheets[0].exercises[2].name, 'Outro', 'other exercises do not change');
});

test('renameInSheets is idempotent', () => {
  const sheets = [{ id: 's1', name: 'A', exercises: [{ exerciseId: 'e1', name: 'Antigo', sets: 3, reps: [12], note: '' }] }];

  const once = core.renameInSheets(sheets, 'e1', 'Antigo', 'Novo');
  const twice = core.renameInSheets(once.sheets, 'e1', 'Antigo', 'Novo');

  assert.equal(twice.changed, 0);
  assert.deepEqual(twice.sheets, once.sheets);
});

test('renameInWorkouts updates the history that points to the id', () => {
  const workouts = [
    {
      id: 'w1', date: '2026-10-01',
      sets: [{ exerciseId: 'e1', exerciseName: 'Puxada frente', number: 1, reps: 12, load: 40, rir: 2 }],
      warmups: [{ exerciseId: 'e1', exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }]
    },
    {
      id: 'w2', date: '2026-10-02',
      sets: [{ exerciseId: null, exerciseName: 'Puxada frente', number: 1, reps: 10, load: 45, rir: 2 }],
      warmups: []
    }
  ];

  const result = core.renameInWorkouts(workouts, 'e1', 'Puxada frente supinada');

  assert.equal(result.changed, 2);
  assert.equal(result.workouts[0].sets[0].exerciseName, 'Puxada frente supinada');
  assert.equal(result.workouts[0].warmups[0].exerciseName, 'Puxada frente supinada');
  assert.equal(result.workouts[1].sets[0].exerciseName, 'Puxada frente', 'an old record (no id) is not rewritten');
  assert.equal(result.workouts[1].sets[0].load, 45, 'no workout data changes');
});

test('renameInWorkouts without an id changes nothing', () => {
  const workouts = [{ id: 'w', date: '2026-10-01', sets: [{ exerciseId: null, exerciseName: 'X', number: 1, reps: 10, load: 20, rir: 2 }] }];

  const result = core.renameInWorkouts(workouts, null, 'Y');

  assert.equal(result.changed, 0);
  assert.deepEqual(result.workouts, workouts);
});

test('regression: renaming an exercise shows in the old sheet (existing data)', () => {
  const sheets = [{
    id: 's1', name: 'TREINO A - inferiores',
    exercises: [{ name: 'Elevação pelvica', sets: 3, reps: [12, 10, 8], note: 'pausa de 1s' }]
  }];
  const exercises = [{ id: 'e1', name: 'Elevação pelvica' }];

  const linked = core.linkSheetItemsToExercises(sheets, exercises);
  assert.equal(linked.sheets[0].exercises[0].exerciseId, 'e1', 'migration of the old sheet');

  const renamed = core.renameInSheets(linked.sheets, 'e1', 'Elevação pelvica', 'Elevação pélvica (glúteo)');

  assert.equal(renamed.sheets[0].exercises[0].name, 'Elevação pélvica (glúteo)');
  assert.equal(renamed.sheets[0].exercises[0].exerciseId, 'e1');
  assert.deepEqual(renamed.sheets[0].exercises[0].reps, [12, 10, 8]);
  assert.equal(renamed.sheets[0].exercises[0].note, 'pausa de 1s');
});

/* ---------- backup ---------- */

test('backupFileName includes date and time (tells same-day backups apart)', () => {
  const manha = core.backupFileName(new Date(2026, 9, 12, 9, 5, 7));
  const tarde = core.backupFileName(new Date(2026, 9, 12, 13, 35, 42));

  assert.equal(manha, 'meu-treino-backup-2026-10-12_09-05-07.json');
  assert.equal(tarde, 'meu-treino-backup-2026-10-12_13-35-42.json');
  assert.notEqual(manha, tarde);
  assert.ok(/^meu-treino-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(tarde), 'stable format');
  assert.ok(!/[:\/\\]/.test(tarde), 'a valid name on any file system');
});

test('backupFileName works with no argument (now)', () => {
  const nome = core.backupFileName();
  assert.ok(/^meu-treino-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(nome));
});

test('fmtDateTimeBR shows local date and time', () => {
  const local = new Date(2026, 9, 12, 13, 35, 0);

  assert.equal(core.fmtDateTimeBR(local.toISOString()), '12/10/2026 13:35');
  assert.equal(core.fmtDateTimeBR(''), '');
  assert.equal(core.fmtDateTimeBR('nao eh data'), '');
});

test('backupStatus: with no backup, warns', () => {
  const info = core.backupStatus({}, new Date(2026, 9, 12, 10, 0), 7);

  assert.equal(info.lastBackupAt, null);
  assert.equal(info.daysSince, null);
  assert.equal(info.overdue, true);
  assert.match(info.label, /nenhum backup/i);
});

test('backupStatus: counts the days and warns past the limit', () => {
  const now = new Date(2026, 9, 12, 10, 0);

  const hoje = core.backupStatus({ lastBackupAt: new Date(2026, 9, 12, 8, 0).toISOString() }, now, 7);
  assert.equal(hoje.daysSince, 0);
  assert.equal(hoje.overdue, false);
  assert.match(hoje.label, /\(hoje\)/);

  const ontem = core.backupStatus({ lastBackupAt: new Date(2026, 9, 11, 8, 0).toISOString() }, now, 7);
  assert.equal(ontem.daysSince, 1);
  assert.match(ontem.label, /\(ontem\)/);

  const semana = core.backupStatus({ lastBackupAt: new Date(2026, 9, 4, 8, 0).toISOString() }, now, 7);
  assert.equal(semana.daysSince, 8);
  assert.equal(semana.overdue, true);
  assert.match(semana.label, /h\u00e1 8 dias/);

  const noLimite = core.backupStatus({ lastBackupAt: new Date(2026, 9, 5, 10, 0).toISOString() }, now, 7);
  assert.equal(noLimite.daysSince, 7);
  assert.equal(noLimite.overdue, true, 'warns already on the limit day');
});

test('backupAction chooses between sharing and downloading (one action = one file)', () => {
  assert.equal(core.backupAction({ canShareFiles: true, touch: true }), 'share', 'a phone that can share');
  assert.equal(core.backupAction({ canShareFiles: true, touch: false }), 'download', 'a computer downloads directly');
  assert.equal(core.backupAction({ canShareFiles: false, touch: true }), 'download', 'no file support');
  assert.equal(core.backupAction({ canShareFiles: false, touch: false }), 'download');
  assert.equal(core.backupAction(), 'download');
  assert.equal(core.backupAction({}), 'download');
});

test('backupSharePayload sends only the file, no text or title (phantom .txt)', () => {
  const payload = core.backupSharePayload({ name: 'meu-treino-backup.json' });

  assert.deepEqual(Object.keys(payload), ['files'], 'only the file');
  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0].name, 'meu-treino-backup.json');
  assert.ok(!('text' in payload), 'no text: some devices save the text as a .txt');
  assert.ok(!('title' in payload), 'no title: the system names a .txt after the title');
});

test('isBackupPayload ignores the click event (backup button bug)', () => {
  assert.equal(core.isBackupPayload({ json: '{}', name: 'meu-treino-backup.json' }), true);
  assert.equal(core.isBackupPayload(null), false);
  assert.equal(core.isBackupPayload(undefined), false);
  assert.equal(core.isBackupPayload({}), false);
  assert.equal(core.isBackupPayload({ type: 'click', target: {} }), false, 'a click event is not a backup');
  assert.equal(core.isBackupPayload({ json: '{}' }), false, 'no file name');
  assert.equal(core.isBackupPayload({ name: 'x.json' }), false, 'no json');
});

test('backupHint explains what the Export button will do', () => {
  assert.match(core.backupHint('share'), /Drive/);
  assert.match(core.backupHint('share'), /WhatsApp/);
  assert.match(core.backupHint('download'), /Baixa o arquivo/);
  assert.equal(core.backupHint('qualquer'), core.backupHint('download'));
});

test('sheetLabel shows the CURRENT sheet name (renaming shows in the overview)', () => {
  const sheets = [{ id: 's1', name: 'Peito e triceps' }, { id: 's2', name: 'Pernas' }];

  assert.equal(core.sheetLabel({ sheetId: 's1', sheetName: 'Nome antigo' }, sheets), 'Peito e triceps');
  assert.equal(core.sheetLabel({ sheetId: 's2' }, sheets), 'Pernas');
  assert.equal(core.sheetLabel({ sheetId: 's9', sheetName: 'Ficha excluida' }, sheets), 'Ficha excluida', 'a deleted sheet keeps the record name');
  assert.equal(core.sheetLabel({ sheetName: 'Sem id (dados antigos)' }, sheets), 'Sem id (dados antigos)');
  assert.equal(core.sheetLabel({ typeName: 'Treino A (v1)' }, sheets), 'Treino A (v1)');
  assert.equal(core.sheetLabel({}, sheets), '');
  assert.equal(core.sheetLabel(null, null), '');
  assert.equal(core.sheetLabel({ sheetId: 's1' }, null), '', 'with no sheets loaded it does not invent a name');
});

test('workoutAsText uses the current sheet name', () => {
  const workout = { date: '2026-10-12', sheetId: 's1', sheetName: 'Nome antigo', sets: [], warmups: [] };
  const sheets = [{ id: 's1', name: 'Peito e triceps' }];

  const atual = core.workoutAsText(workout, sheets);
  assert.match(atual, /Ficha: _Peito e triceps_/);
  assert.ok(atual.indexOf('Nome antigo') === -1);

  assert.match(core.workoutAsText(workout), /Ficha: _Nome antigo_/, 'without the sheet list it uses the stored name');
});

/* ---------- reference by id (always the current name) ---------- */

test('exerciseLabel uses the current name by id and falls back to the stored name', () => {
  const lib = [{ id: 15, name: 'Remada baixa' }, { id: 'u1', name: 'Meu exercicio' }];

  assert.equal(core.exerciseLabel({ exerciseId: 15, exerciseName: 'Nome antigo' }, lib), 'Remada baixa');
  assert.equal(core.exerciseLabel({ exerciseId: 'u1' }, lib), 'Meu exercicio');
  assert.equal(core.exerciseLabel({ exerciseId: 99, exerciseName: 'Excluido' }, lib), 'Excluido', 'an id that no longer exists');
  assert.equal(core.exerciseLabel({ exerciseName: 'Antigo sem id' }, lib), 'Antigo sem id');
  assert.equal(core.exerciseLabel({ name: 'Campo name' }, lib), 'Campo name');
  assert.equal(core.exerciseLabel({}, lib), '');
  assert.equal(core.exerciseLabel(null, null), '');
});

test('exerciseTarget normalizes a string, an object and empty', () => {
  assert.deepEqual(core.exerciseTarget('Puxada'), { exerciseId: null, exerciseName: 'Puxada' });
  assert.deepEqual(core.exerciseTarget({ exerciseId: 3, exerciseName: 'X' }), { exerciseId: 3, exerciseName: 'X' });
  assert.deepEqual(core.exerciseTarget({ exerciseId: 3, name: 'Y' }), { exerciseId: 3, exerciseName: 'Y' });
  assert.deepEqual(core.exerciseTarget(), { exerciseId: null, exerciseName: '' });
  assert.deepEqual(core.exerciseTarget(null), { exerciseId: null, exerciseName: '' });
});

test('exerciseMatches compares by id when both have an id', () => {
  assert.equal(core.exerciseMatches({ exerciseId: 7, exerciseName: 'Antigo' }, { exerciseId: 7, exerciseName: 'Novo' }), true);
  assert.equal(core.exerciseMatches({ exerciseId: 7, exerciseName: 'Antigo' }, { exerciseId: 8, exerciseName: 'Antigo' }), false, 'same name, different ids');
  assert.equal(core.exerciseMatches({ exerciseName: 'Antigo' }, { exerciseId: 7, exerciseName: 'Antigo' }), true, 'an old record without an id falls back to the name');
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, 'X'), true);
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, 'Y'), false);
  assert.equal(core.exerciseMatches({}, {}), false, 'nothing to compare');
  assert.equal(core.exerciseMatches(null, null), false);
});

test('exerciseKey uses the id when present and the name as a fallback', () => {
  assert.equal(core.exerciseKey({ exerciseId: 5, exerciseName: 'X' }), 'id:5');
  assert.equal(core.exerciseKey({ exerciseName: 'X' }), 'nome:X');
  assert.equal(core.exerciseKey({}), 'nome:(sem nome)');
});

test('groupSets separates different exercises with the same name (by id)', () => {
  const groups = core.groupSets([
    { exerciseId: 1, exerciseName: 'Rosca', number: 1, reps: 10, load: 10 },
    { exerciseId: 2, exerciseName: 'Rosca', number: 1, reps: 10, load: 20 }
  ], []);

  assert.equal(groups.length, 2, 'does not merge different exercises just because the name matches');
  assert.equal(groups[0].exerciseId, 1);
  assert.equal(groups[1].exerciseId, 2);
});

test('groupSets matches the warm-up by id (even with an old name)', () => {
  const groups = core.groupSets(
    [{ exerciseId: 5, exerciseName: 'Nome antigo', number: 1, reps: 10, load: 30 }],
    [{ exerciseId: 5, exerciseName: 'Nome novo', reps: 15, load: 10, rir: 3 }]
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].warmup, { reps: 15, load: 10, rir: 3 });
});

test('groupSets creates a group for a warm-up-only exercise (not lost when editing)', () => {
  const groups = core.groupSets([], [{ exerciseId: 9, exerciseName: 'Esteira', reps: 5, load: 0, rir: 4 }]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].exerciseName, 'Esteira');
  assert.equal(groups[0].sets.length, 0);
  assert.deepEqual(groups[0].warmup, { reps: 5, load: 0, rir: 4 });
});

test('groupSets merges old records without an id by name', () => {
  const groups = core.groupSets([
    { exerciseName: 'Leg', number: 1, reps: 10, load: 100 },
    { exerciseName: 'Leg', number: 2, reps: 8, load: 110 }
  ], [{ exerciseName: 'Leg', reps: 15, load: 50, rir: 3 }]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].exerciseId, null);
  assert.equal(groups[0].sets.length, 2);
  assert.deepEqual(groups[0].warmup, { reps: 15, load: 50, rir: 3 });
});

test('history by id: renaming the exercise neither loses nor splits the history', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseId: 5, exerciseName: 'Nome antigo', number: 1, reps: 10, load: 40 }] },
    { id: 'b', date: '2026-10-08', sets: [{ exerciseId: 5, exerciseName: 'Nome novo', number: 1, reps: 10, load: 45 }] }
  ];
  const target = { exerciseId: 5, exerciseName: 'Nome novo' };

  assert.deepEqual(core.lastLoadsForExercise(workouts, target), { 1: 45 });
  assert.deepEqual(core.sessionsForExercise(workouts, target).map(function (w) { return w.id; }), ['b', 'a']);
  assert.deepEqual(core.bestSetForExercise(workouts[0], target), { load: 40, reps: 10 });
});

test('history does not mix different exercises with the same name', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseId: 1, exerciseName: 'Rosca', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-08', sets: [{ exerciseId: 2, exerciseName: 'Rosca', number: 1, reps: 10, load: 99 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(workouts, { exerciseId: 1, exerciseName: 'Rosca' }), { 1: 10 });
  assert.equal(core.sessionsForExercise(workouts, { exerciseId: 1, exerciseName: 'Rosca' }).length, 1);
});

test('lastWarmupForExercise looks up by id (record with an old name)', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', warmups: [{ exerciseId: 5, exerciseName: 'Antigo', reps: 15, load: 20, rir: 3 }] },
    { id: 'b', date: '2026-10-08', warmups: [{ exerciseId: 6, exerciseName: 'Outro', reps: 12, load: 30, rir: 2 }] }
  ];

  assert.deepEqual(
    core.lastWarmupForExercise(workouts, { exerciseId: 5, exerciseName: 'Novo' }),
    { exerciseId: 5, exerciseName: 'Antigo', reps: 15, load: 20, rir: 3 }
  );
  assert.equal(core.lastWarmupForExercise(workouts, { exerciseId: 99, exerciseName: 'Nada' }), null);
  assert.equal(core.lastWarmupForExercise([], { exerciseId: 5 }), null);
});

test('workoutAsText uses the current exercise name and groups by id', () => {
  const workout = {
    date: '2026-10-08',
    sets: [
      { exerciseId: 5, exerciseName: 'Antigo', number: 1, reps: 10, load: 30 },
      { exerciseId: 5, exerciseName: 'Antigo', number: 2, reps: 8, load: 35 }
    ]
  };

  const text = core.workoutAsText(workout, [], [{ id: 5, name: 'Remada baixa' }]);

  assert.ok(text.indexOf('1. *Remada baixa*') !== -1);
  assert.equal(text.indexOf('Antigo'), -1, 'the frozen name does not appear');
  assert.ok(text.indexOf('2. ') === -1, 'sets grouped by id into a single exercise');
  assert.ok(text.indexOf('8 reps') !== -1);
});

test('linkSheetItemsToExercises also finds in the catalog (and does not link when ambiguous)', () => {
  const fichas = [{
    id: 's1',
    name: 'A',
    exercises: [
      { exerciseId: null, name: 'Puxada frente supinada', sets: 3, reps: [], note: '' },
      { exerciseId: null, name: 'Leg Press', sets: 4, reps: [], note: '' },
      { exerciseId: null, name: 'Remada maquina', sets: 3, reps: [], note: '' }
    ]
  }];

  const biblioteca = [{ id: 'e1', name: 'Bike', group: 'Outros', source: 'custom' }];
  const catalogo = [
    { id: 887, name: 'Puxada frente supinada', group: 'Costas' },
    { id: 719, name: 'Leg Press', group: 'Pernas' }
  ];

  const resultado = core.linkSheetItemsToExercises(fichas, biblioteca.concat(catalogo));

  assert.equal(resultado.changed, 2, 'only the two names that exist in the catalog');
  assert.equal(resultado.sheets[0].exercises[0].exerciseId, 887, 'stores the numeric catalog id');
  assert.equal(resultado.sheets[0].exercises[1].exerciseId, 719);
  assert.equal(resultado.sheets[0].exercises[2].exerciseId, null, 'a hand-typed name stays without an id');

  const ambiguo = core.linkSheetItemsToExercises(
    [{ id: 's2', exercises: [{ exerciseId: null, name: 'Bike', sets: 1, reps: [], note: '' }] }],
    biblioteca.concat([{ id: 999, name: 'Bike', group: 'Outros' }])
  );

  assert.equal(ambiguo.changed, 0, 'same name in the library and the catalog: does not guess');
  assert.equal(ambiguo.sheets[0].exercises[0].exerciseId, null);
});

/* ---------- user library ---------- */

test('isUserExercise does not hide a user-created exercise', () => {
  assert.equal(core.isUserExercise({ id: 'e1', name: 'Puxada frente supinada' }), true, 'no source = created by the user');
  assert.equal(core.isUserExercise({ id: 'e2', name: 'X', source: 'custom' }), true);
  assert.equal(core.isUserExercise({ id: 'e3', name: 'X', source: 'catalog' }), true, 'marked without a catalogId must not hide');
  assert.equal(core.isUserExercise({ id: 'e4', name: 'X', source: 'catalog', catalogId: 887 }), false, 'from the catalog, with proof');
  assert.equal(core.isUserExercise(null), false);
});

test('libraryExercises lists the user exercises and ignores inactive ones', () => {
  const list = core.libraryExercises([
    { id: 'a', name: 'Elevação pélvica' },
    { id: 'b', name: 'Puxada frente supinada', source: 'catalog' },
    { id: 'c', name: 'Do catálogo', source: 'catalog', catalogId: 1 },
    { id: 'd', name: 'Inativo', active: false },
    null
  ]);
  assert.deepEqual(list.map(function (e) { return e.id; }), ['a', 'b']);
});

test('regression: a user exercise with the same name as a catalog one stays visible', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const nomeDoCatalogo = catalog.exercises[0].name;
  const meu = { id: 'meu', name: nomeDoCatalogo, correction: '' };

  assert.equal(core.isUserExercise(meu), true);
  assert.equal(core.libraryExercises([meu]).length, 1);
  assert.equal(core.fixLibrarySources([meu]).changed, 0);
});

/* ---------- data compatibility across versions ---------- */

test('backup v1 (workout types) migrates to sheets without losing data', () => {
  const data = loadFixture('backup-v1.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 2, 'workout types become sheets');
  assert.equal(normalized.sheets[0].name, 'TREINO A - inferiores');
  assert.deepEqual(normalized.sheets[0].exercises, []);

  assert.equal(normalized.workouts.length, 2);
  const w = normalized.workouts[0];
  assert.equal(w.sheetId, 't1');
  assert.equal(w.sheetName, 'TREINO A - inferiores');
  assert.equal(w.typeId, undefined, 'old field removed');
  assert.equal(w.typeName, undefined, 'old field removed');
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

test('backup v1 loses no set', () => {
  const data = loadFixture('backup-v1.json').data;
  const before = data.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  const after = core.normalizeBackup(data).workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  assert.equal(after, before);
});

test('backup v2 (sheet with a single reps value) normalizes reps per set', () => {
  const data = loadFixture('backup-v2-sheets.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 1);
  const items = normalized.sheets[0].exercises;

  assert.equal(items[0].name, 'Elevação pélvica');
  assert.equal(items[0].sets, 3);
  assert.deepEqual(items[0].reps, [12, 12, 12], 'a single reps value applies to all sets');
  assert.equal(items[0].load, undefined, 'load left the sheet');
  assert.equal(items[0].rir, undefined, 'RIR left the sheet');
  assert.equal(items[0].note, 'pausa de 1s');

  assert.deepEqual(items[1].reps, [12, 10, 8], 'per-set reps preserved');

  assert.equal(normalized.workouts[0].sheetName, 'TREINO A - inferiores');
  assert.equal(normalized.workouts[0].sets[0].load, 30);
});

test('normalizeBackup is idempotent (normalizing twice changes nothing)', () => {
  ['backup-v1.json', 'backup-v2-sheets.json'].forEach(function (name) {
    const data = loadFixture(name).data;
    const once = core.normalizeBackup(data);
    const twice = core.normalizeBackup(once);
    assert.deepEqual(twice, once, name + ' did not stay stable');
  });
});

test('a backup in the current format round-trips without losing data', () => {
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

test('normalizeBackup handles an empty or invalid backup without breaking', () => {
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

test('invalid items (no id) are discarded', () => {
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

/* ---------- built-in catalog ---------- */

test('the catalog keeps ids unique, contiguous and stable across versions', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const items = catalog.exercises;

  assert.equal(items.length, 927);
  assert.equal(catalog.meta.nextId, 928, 'next free id for new exercises');

  const ids = items.map(function (i) { return i.id; });
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids in the catalog');
  const sorted = ids.slice().sort(function (a, b) { return a - b; });
  assert.equal(sorted[0], 1);
  assert.equal(sorted[sorted.length - 1], 927);

  // Compatibility lock: these ids must not be renumbered between versions.
  const byId = {};
  items.forEach(function (i) { byId[i.id] = i.name; });
  assert.equal(byId[1], 'Abdominais');
  assert.equal(byId[870], 'Abdominal infra');
  assert.equal(byId[887], 'Puxada frente supinada');
  assert.equal(byId[927], 'Tríceps testa');

  items.forEach(function (i) {
    assert.ok(i.name, 'every exercise has a name');
    assert.ok(i.group, 'every exercise has a group');
    assert.ok(i.sourceId, 'every exercise keeps its origin sourceId');
  });
});

/* ---------- import a sheet (FICHA-JSON.md) ---------- */

test('parseSheetImport accepts one sheet, a list or { fichas }', () => {
  const one = { name: ' TREINO A ', exercises: [{ name: 'Agachamento livre', sets: 4, reps: [12, 10, 8, 8], note: 'desce devagar' }] };
  const parsed = core.parseSheetImport(one);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'TREINO A');
  assert.deepEqual(parsed[0].exercises[0], { exerciseId: null, name: 'Agachamento livre', sets: 4, reps: [12, 10, 8, 8], note: 'desce devagar' });
  assert.equal(core.parseSheetImport([one, one]).length, 2);
  assert.equal(core.parseSheetImport({ fichas: [one] }).length, 1);
});

test('parseSheetImport: a single reps value applies to all sets; extras are cut', () => {
  const [s] = core.parseSheetImport({ name: 'B', exercises: [{ name: 'Remada', sets: 3, reps: 12 }, { name: 'Supino', sets: 2, reps: [10, 8, 6] }] });
  assert.deepEqual(s.exercises[0].reps, [12, 12, 12]);
  assert.deepEqual(s.exercises[1].reps, [10, 8]);
});

test('parseSheetImport rejects a sheet with no name, no exercises or an unnamed exercise', () => {
  assert.throws(() => core.parseSheetImport({ exercises: [{ name: 'x' }] }), /name/);
  assert.throws(() => core.parseSheetImport({ name: 'A', exercises: [] }), /exercises/);
  assert.throws(() => core.parseSheetImport({ name: 'A', exercises: [{ sets: 3 }] }), /exercício 1/);
  assert.throws(() => core.parseSheetImport([]), /Nenhuma/);
});

test('parseSheetImport rejects empty input or a null exercise', () => {
  assert.throws(() => core.parseSheetImport(null), /formato/);
  assert.throws(() => core.parseSheetImport({ name: 'A', exercises: [null] }), /exercício 1/);
});

/* ---------- similar-exercise suggestion (sheet import) ---------- */

test('suggestExercises orders by best match and, on a tie, by list order', () => {
  const list = [
    { id: 'lib1', name: 'Leg Press Unilateral Horizontal' },
    { id: 'lib2', name: 'Leg Press 45°' },
    { id: 9, name: 'Leg Press 45º' },
    { id: 8, name: 'Supino reto' }
  ];
  assert.deepEqual(core.suggestExercises('Leg press 45', list).map(e => e.id), ['lib2', 9, 'lib1']);
  assert.deepEqual(core.suggestExercises('leg press', list, 1).map(e => e.id), ['lib2']);
  assert.deepEqual(core.suggestExercises('Remada de cavalinho', list), []);
  assert.deepEqual(core.suggestExercises('de com', list), []);
  assert.deepEqual(core.suggestExercises('x', undefined), []);
  assert.deepEqual(core.suggestExercises('leg press', list, 5, 0.6).map(e => e.id), ['lib2', 9]);
});

test('exerciseNamesText lists Library and catalog without repeats', () => {
  const text = core.exerciseNamesText(
    [{ name: 'Agachamento livre', group: 'Pernas' }, { name: 'Remada X' }, null, { name: '  ' }],
    [{ name: 'agachamento LIVRE', group: 'Pernas' }, { name: 'Supino reto', group: 'Peito' }]
  );
  assert.match(text, /### Minha biblioteca\n- Agachamento livre \(Pernas\)\n- Remada X\n/);
  assert.match(text, /### Catálogo do app\n- Supino reto \(Peito\)\n$/);
  assert.match(core.exerciseNamesText(undefined, []), /### Minha biblioteca\n\(vazia\)/);
});

test('parseSheetImportText accepts the AI reply with or without a ```json fence', () => {
  const json = '[{"name":"A","exercises":[{"name":"Remada","sets":3,"reps":12}]}]';
  assert.equal(core.parseSheetImportText(json)[0].name, 'A');
  assert.equal(core.parseSheetImportText('```json\n' + json + '\n```\n')[0].exercises[0].name, 'Remada');
  assert.equal(core.parseSheetImportText('  ```\n' + json + '```')[0].name, 'A');
  assert.throws(() => core.parseSheetImportText('Aqui está o JSON: ' + json), SyntaxError);
  assert.throws(() => core.parseSheetImportText(''), SyntaxError);
  assert.throws(() => core.parseSheetImportText('{"exercises":[{"name":"x"}]}'), /name/);
});
