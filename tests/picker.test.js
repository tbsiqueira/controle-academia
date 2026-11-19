'use strict';

/* Exercise search: the three pickers (workout, sheet and exercise registration) each had
   their own copy of the same HTML. Now all of them use core.pickerHtml — these tests lock the
   behaviour the three copies had. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

const LIBRARY = [
  { id: '3f2b8c1e-9a4d', name: 'Puxada na barra W', group: 'Costas', source: 'custom' },
  { id: 'e-inativo', name: 'Puxada antiga', group: 'Costas', active: false },
  { id: 'e-catalogo', name: 'Puxada do catalogo', group: 'Costas', source: 'catalog', catalogId: 7 }
];
const CATALOG = [
  { id: 1, name: 'Supino reto', group: 'Peito' },
  { id: 2, name: 'Puxada máquina', group: 'Costas' },
  { id: 3, name: 'Agachamento livre', group: 'Pernas' }
];
const TREINO = { create: 'createExerciseFromPicker', library: 'pickLibraryExercise', catalog: 'pickCatalogExercise' };

function clicks(html) {
  return (html.match(/onclick="[^"]+"/g) || []).map((c) => c.slice(9, -1));
}

test('pickerHtml with no search lists the user Library and the catalog, without the Criar button', () => {
  const html = core.pickerHtml('', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), [
    "pickLibraryExercise('3f2b8c1e-9a4d')",
    "pickCatalogExercise('1')", "pickCatalogExercise('2')", "pickCatalogExercise('3')"
  ]);
  assert.ok(html.indexOf('Biblioteca') < html.indexOf('Catálogo (pt-BR)'), 'Library before the catalog');
  assert.ok(html.indexOf('Puxada antiga') === -1, 'an inactive exercise is left out');
  assert.ok(html.indexOf('Puxada do catalogo') === -1, 'a catalog copy does not appear in the Library');
  assert.ok(html.indexOf('Criar') === -1);
});

test('pickerHtml search ignores accents and case, and offers Criar', () => {
  const html = core.pickerHtml('  PUXADA maquina ', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), ['createExerciseFromPicker()', "pickCatalogExercise('2')"]);
  assert.ok(html.indexOf('Criar "PUXADA maquina"') !== -1, 'shows the typed text, without the leading/trailing spaces');
  assert.ok(html.indexOf('Biblioteca') === -1, 'with no Library result the heading disappears');
  assert.ok(html.indexOf('<span class="badge text-bg-light">Costas</span>') !== -1, 'the exercise group');
});

test('pickerHtml says so when nothing was found in the catalog (and still offers Criar)', () => {
  const html = core.pickerHtml('xyz', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), ['createExerciseFromPicker()']);
  assert.ok(html.indexOf('Nada encontrado.') !== -1);
});

test('pickerHtml without fn.library shows only the catalog (exercise registration)', () => {
  const html = core.pickerHtml('puxada', LIBRARY, CATALOG, { create: 'createExerciseFromFichaSearch', catalog: 'pickCatalogForFicha' });
  assert.deepEqual(clicks(html), ['createExerciseFromFichaSearch()', "pickCatalogForFicha('2')"]);
  assert.ok(html.indexOf('Biblioteca') === -1);
});

test('pickerHtml limits the results (30 from the Library, 50 from the catalog)', () => {
  const muitos = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: prefix + i, name: 'Exercicio ' + i, group: 'Outros' }));
  const html = core.pickerHtml('', muitos(40, 'lib'), muitos(80, 'cat'), TREINO);
  assert.equal(clicks(html).filter((c) => c.indexOf('pickLibraryExercise') === 0).length, 30);
  assert.equal(clicks(html).filter((c) => c.indexOf('pickCatalogExercise') === 0).length, 50);
});

test('pickerHtml accepts missing lists and escapes name, group, search and id', () => {
  assert.ok(core.pickerHtml(null, null, null, TREINO).indexOf('Nada encontrado.') !== -1);
  assert.ok(core.pickerHtml(undefined, undefined, undefined, { create: 'c', catalog: 'k' }).indexOf('Nada encontrado.') !== -1);

  const html = core.pickerHtml('<b>', [{ id: 'a"b', name: '<b>x</b>' }], [{ id: 9, name: 'y<b>', group: '<i>' }], TREINO);
  assert.ok(html.indexOf('<b>') === -1 && html.indexOf('<i>') === -1);
  assert.ok(html.indexOf('Criar "&lt;b&gt;"') !== -1);
  assert.ok(html.indexOf("pickLibraryExercise('a&quot;b')") !== -1);
  assert.ok(html.indexOf('<span class="badge text-bg-light"></span>') !== -1, 'no group, empty badge');
});

test('the three pickers in app.js use pickerHtml and point to functions that exist', () => {
  const calls = APP.match(/pickerHtml\(query, [^;]+;/g) || [];
  assert.equal(calls.length, 3, 'workout, sheet and exercise registration');

  const handlers = [];
  calls.forEach((call) => (call.match(/(?:create|library|catalog): '(\w+)'/g) || []).forEach((h) => handlers.push(h.split("'")[1])));
  assert.equal(handlers.length, 8);
  handlers.forEach((name) => {
    assert.match(APP, new RegExp('(?:async )?function ' + name + '\\('), name + ' exists in app.js');
  });
});

test('the pick functions accept the id as text (the onclick always passes it quoted)', () => {
  // the catalog has a numeric id: the comparison must go through String()
  ['pickCatalogExercise', 'pickCatalogForFicha', 'pickSheetCatalogExercise'].forEach((name) => {
    const body = APP.slice(APP.indexOf('function ' + name + '('), APP.indexOf('\n}\n', APP.indexOf('function ' + name + '(')));
    assert.match(body, /String\(x\.id\) === String\(id\)/, name);
  });
});

test('removed dead code did not come back', () => {
  ['warmupSummary', 'countExercises', 'exercisesNeedingRepair'].forEach((name) => {
    assert.equal(core[name], undefined, name);
  });
  assert.equal('tonnageVisible' in core.defaultSettings(), false);
  assert.doesNotMatch(APP, /function openExercisePicker\(/);
  assert.match(APP, /getElementById\('btnAddExercise'\)\.addEventListener\('click', guard\(openExercisePickerModal\)\)/);
});

test('old settings with tonnageVisible still import without an error', () => {
  const s = core.normalizeBackup({ settings: { weekAnchor: '2026-10-05', weeklyWorkoutTarget: 4, tonnageVisible: true } }).settings;
  assert.equal(s.weeklyWorkoutTarget, 4);
  assert.equal(s.tonnageVisible, true, 'an unknown field is preserved, it is just no longer created');
});
