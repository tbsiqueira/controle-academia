'use strict';

/* Tests for the sample data (data/sample-data.json).
   The SAME file is used by the app (Mais → Dados → Carregar dados de exemplo) and here,
   as a cross-version compatibility fixture: if the format changes, it shows up in CI. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sample-data.json'), 'utf8'));

test('fixture: 3 sheets, 4 workouts for each and 2 custom exercises per sheet', () => {
  const data = sample.data;

  assert.equal(sample.sample, true, 'marked as sample data');
  assert.equal(data.sheets.length, 3);
  assert.equal(data.workouts.length, 12);
  assert.equal(data.exercises.length, 6, 'custom exercises in the library');

  data.sheets.forEach(function (sheet) {
    const fromCatalog = sheet.exercises.filter(function (i) { return !i.exerciseId; });
    const custom = sheet.exercises.filter(function (i) { return i.exerciseId; });
    const workouts = data.workouts.filter(function (w) { return w.sheetId === sheet.id; });

    assert.ok(fromCatalog.length >= 5, sheet.name + ': at least 5 catalog exercises');
    assert.equal(custom.length, 2, sheet.name + ': 2 custom exercises');
    assert.equal(workouts.length, 4, sheet.name + ': 4 workouts');
  });
});

test('fixture: workouts on different days (4 per sheet)', () => {
  const offsets = sample.data.workouts.map(function (w) { return w.dayOffset; });

  offsets.forEach(function (o) { assert.equal(typeof o, 'number'); });
  assert.equal(new Set(offsets).size, offsets.length, 'each workout on a different day');
  assert.ok(Math.min.apply(null, offsets) <= -18, 'there are workouts from weeks ago');
  assert.ok(Math.max.apply(null, offsets) >= 0, 'there is a workout from today');
});

test('fixture: referential integrity between sheets, workouts and library', () => {
  const data = sample.data;
  const exerciseIds = new Set(data.exercises.map(function (e) { return e.id; }));
  const sheetById = {};
  data.sheets.forEach(function (s) { sheetById[s.id] = s; });

  data.sheets.forEach(function (sheet) {
    sheet.exercises.forEach(function (item) {
      if (item.exerciseId) {
        assert.ok(exerciseIds.has(item.exerciseId), 'exerciseId exists in the library: ' + item.exerciseId);
      }
      assert.ok(item.name, 'item has a name');
      assert.ok(Array.isArray(item.reps), 'reps is a list');
      assert.equal(item.reps.length, item.sets, 'one rep per set');
    });
  });

  data.workouts.forEach(function (w) {
    const sheet = sheetById[w.sheetId];
    assert.ok(sheet, 'workout points to an existing sheet');

    const names = new Set(sheet.exercises.map(function (i) { return i.name; }));

    w.sets.forEach(function (s) {
      assert.ok(names.has(s.exerciseName), 'set belongs to the sheet: ' + s.exerciseName);
      assert.ok(s.exerciseId === null || exerciseIds.has(s.exerciseId), 'valid or null exerciseId');
      assert.ok(s.load > 0, 'set with a load');
      assert.ok(s.reps > 0, 'set with reps');
    });

    (w.warmups || []).forEach(function (warm) {
      assert.ok(names.has(warm.exerciseName), 'warm-up belongs to the sheet');
    });
  });
});

test('fixture: the loads progress across sessions (charts show progress)', () => {
  const data = sample.data;
  const sheet = data.sheets[0];
  const workouts = data.workouts
    .filter(function (w) { return w.sheetId === sheet.id; })
    .slice()
    .sort(function (a, b) { return a.dayOffset - b.dayOffset; });

  const best = workouts.map(function (w) {
    return core.bestSetForExercise(w, sheet.exercises[0].name).load;
  });

  for (let i = 1; i < best.length; i++) {
    assert.ok(best[i] >= best[i - 1], 'the load does not regress between sessions');
  }
});

test('materializeSampleData turns offsets into dates relative to today', () => {
  const data = core.materializeSampleData(sample, '2026-10-12');
  const offsets = sample.data.workouts.map(function (w) { return w.dayOffset; });

  assert.equal(data.workouts.length, 12);
  data.workouts.forEach(function (w) {
    assert.equal(w.dayOffset, undefined, 'dayOffset removed');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(w.date), 'valid ISO date');
  });

  assert.equal(data.workouts[0].date, core.addDaysISO('2026-10-12', offsets[0]));
  assert.equal(data.settings.weekAnchor, core.addDaysISO('2026-10-12', -2), 'week starting 2 days ago');
  assert.equal(sample.data.workouts[0].dayOffset, offsets[0], 'does not change the original file');
});

test('sample data goes through backup normalization without losing anything', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');
  const normalized = core.normalizeBackup(materialized);

  assert.equal(normalized.workouts.length, 12);
  assert.equal(normalized.sheets.length, 3);
  assert.equal(normalized.exercises.length, 6);
  assert.equal(normalized.colinha.length, 3);

  const setsBefore = materialized.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  const setsAfter = normalized.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  assert.equal(setsAfter, setsBefore, 'no set lost');

  assert.deepEqual(core.normalizeBackup(normalized), normalized, 'stable normalization (idempotent)');
});

test('regression: a fixture in the old format (sheets without exerciseId) is relinked by the migration', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');

  // simulates data from old versions: sheet items with only the name
  const legacySheets = materialized.sheets.map(function (s) {
    return Object.assign({}, s, {
      exercises: s.exercises.map(function (i) { return Object.assign({}, i, { exerciseId: null }); })
    });
  });

  const linked = core.linkSheetItemsToExercises(legacySheets, materialized.exercises);

  assert.equal(linked.changed, 6, 'the 6 custom items are relinked by name');
  assert.deepEqual(
    core.normalizeBackup({ sheets: linked.sheets }).sheets,
    core.normalizeBackup({ sheets: materialized.sheets }).sheets,
    'same result as the current data'
  );
});

test('regression: renaming a custom exercise of the fixture only updates the sheet that uses it', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');
  const custom = materialized.exercises[0];   // used only in sheet A
  const novoNome = custom.name + ' (novo)';

  const result = core.renameInSheets(materialized.sheets, custom.id, custom.name, novoNome);

  assert.equal(result.changed, 1, 'only one item is updated');

  const alteradas = result.sheets.filter(function (s) { return s !== materialized.sheets[result.sheets.indexOf(s)]; });
  assert.equal(alteradas.length, 1, 'only one sheet is changed');

  const itens = alteradas[0].exercises.filter(function (i) { return i.exerciseId === custom.id; });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].name, novoNome);
  assert.deepEqual(itens[0].reps, [12, 10, 10], 'nothing else changed');
});

test('fixture: the card counter counts exercises (not sets)', () => {
  const data = sample.data;

  data.workouts.forEach(function (w) {
    const exercicios = core.groupSets(w.sets, w.warmups).length;
    const series = (w.sets || []).length;

    assert.ok(exercicios >= 5, w.id + ': at least 5 exercises in the workout');
    assert.ok(exercicios < series, w.id + ': exercises (' + exercicios + ') != sets (' + series + ')');
  });
});