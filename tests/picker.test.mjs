/* Busca de exercício: os três seletores (treino, ficha e cadastro de exercício) tinham cada um
   a sua cópia do mesmo HTML. Agora todos usam core.pickerHtml — estes testes travam o
   comportamento que as três cópias tinham. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as core from '../js/core.js';

const APP = fs.readFileSync(path.join(import.meta.dirname, '..', 'js', 'app.js'), 'utf8');

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

test('pickerHtml sem busca lista a Biblioteca do usuario e o catalogo, sem o botao Criar', () => {
  const html = core.pickerHtml('', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), [
    "pickLibraryExercise('3f2b8c1e-9a4d')",
    "pickCatalogExercise('1')", "pickCatalogExercise('2')", "pickCatalogExercise('3')"
  ]);
  assert.ok(html.indexOf('Biblioteca') < html.indexOf('Catálogo (pt-BR)'), 'Biblioteca antes do catalogo');
  assert.ok(html.indexOf('Puxada antiga') === -1, 'exercicio inativo fica de fora');
  assert.ok(html.indexOf('Puxada do catalogo') === -1, 'copia do catalogo nao aparece na Biblioteca');
  assert.ok(html.indexOf('Criar') === -1);
});

test('pickerHtml busca sem acento e sem diferenciar maiusculas, e oferece Criar', () => {
  const html = core.pickerHtml('  PUXADA maquina ', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), ['createExerciseFromPicker()', "pickCatalogExercise('2')"]);
  assert.ok(html.indexOf('Criar "PUXADA maquina"') !== -1, 'mostra o texto digitado, sem os espacos das pontas');
  assert.ok(html.indexOf('Biblioteca') === -1, 'sem resultado na Biblioteca o titulo some');
  assert.ok(html.indexOf('<span class="badge text-bg-light">Costas</span>') !== -1, 'grupo do exercicio');
});

test('pickerHtml avisa quando nada foi encontrado no catalogo (e ainda oferece Criar)', () => {
  const html = core.pickerHtml('xyz', LIBRARY, CATALOG, TREINO);
  assert.deepEqual(clicks(html), ['createExerciseFromPicker()']);
  assert.ok(html.indexOf('Nada encontrado.') !== -1);
});

test('pickerHtml sem fn.library mostra so o catalogo (cadastro de exercicio)', () => {
  const html = core.pickerHtml('puxada', LIBRARY, CATALOG, { create: 'createExerciseFromFichaSearch', catalog: 'pickCatalogForFicha' });
  assert.deepEqual(clicks(html), ['createExerciseFromFichaSearch()', "pickCatalogForFicha('2')"]);
  assert.ok(html.indexOf('Biblioteca') === -1);
});

test('pickerHtml limita os resultados (30 da Biblioteca, 50 do catalogo)', () => {
  const muitos = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: prefix + i, name: 'Exercicio ' + i, group: 'Outros' }));
  const html = core.pickerHtml('', muitos(40, 'lib'), muitos(80, 'cat'), TREINO);
  assert.equal(clicks(html).filter((c) => c.indexOf('pickLibraryExercise') === 0).length, 30);
  assert.equal(clicks(html).filter((c) => c.indexOf('pickCatalogExercise') === 0).length, 50);
});

test('pickerHtml aceita listas ausentes e escapa nome, grupo, busca e id', () => {
  assert.ok(core.pickerHtml(null, null, null, TREINO).indexOf('Nada encontrado.') !== -1);
  assert.ok(core.pickerHtml(undefined, undefined, undefined, { create: 'c', catalog: 'k' }).indexOf('Nada encontrado.') !== -1);

  const html = core.pickerHtml('<b>', [{ id: 'a"b', name: '<b>x</b>' }], [{ id: 9, name: 'y<b>', group: '<i>' }], TREINO);
  assert.ok(html.indexOf('<b>') === -1 && html.indexOf('<i>') === -1);
  assert.ok(html.indexOf('Criar "&lt;b&gt;"') !== -1);
  assert.ok(html.indexOf("pickLibraryExercise('a&quot;b')") !== -1);
  assert.ok(html.indexOf('<span class="badge text-bg-light"></span>') !== -1, 'sem grupo, etiqueta vazia');
});

test('os tres seletores do app.js usam pickerHtml e apontam para funcoes que existem', () => {
  const calls = APP.match(/pickerHtml\(query, [^;]+;/g) || [];
  assert.equal(calls.length, 3, 'treino, ficha e cadastro de exercicio');

  const handlers = [];
  calls.forEach((call) => (call.match(/(?:create|library|catalog): '(\w+)'/g) || []).forEach((h) => handlers.push(h.split("'")[1])));
  assert.equal(handlers.length, 8);
  handlers.forEach((name) => {
    assert.match(APP, new RegExp('(?:async )?function ' + name + '\\('), name + ' existe no app.js');
  });
});

test('as funcoes de escolha aceitam o id como texto (o onclick passa sempre entre aspas)', () => {
  // catalogo tem id numerico: a comparacao precisa ser por String()
  ['pickCatalogExercise', 'pickCatalogForFicha', 'pickSheetCatalogExercise'].forEach((name) => {
    const body = APP.slice(APP.indexOf('function ' + name + '('), APP.indexOf('\n}\n', APP.indexOf('function ' + name + '(')));
    assert.match(body, /String\(x\.id\) === String\(id\)/, name);
  });
});

test('codigo morto removido nao voltou', () => {
  ['warmupSummary', 'countExercises', 'exercisesNeedingRepair'].forEach((name) => {
    assert.equal(core[name], undefined, name);
  });
  assert.equal('tonnageVisible' in core.defaultSettings(), false);
  assert.doesNotMatch(APP, /function openExercisePicker\(/);
  assert.match(APP, /getElementById\('btnAddExercise'\)\.addEventListener\('click', guard\(openExercisePickerModal\)\)/);
});

test('configuracoes antigas com tonnageVisible continuam importando sem erro', () => {
  const s = core.normalizeBackup({ settings: { weekAnchor: '2026-10-05', weeklyWorkoutTarget: 4, tonnageVisible: true } }).settings;
  assert.equal(s.weeklyWorkoutTarget, 4);
  assert.equal(s.tonnageVisible, true, 'campo desconhecido e preservado, so nao e mais criado');
});
