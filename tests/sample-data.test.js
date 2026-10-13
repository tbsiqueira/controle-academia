'use strict';

/* Testes dos dados de exemplo (data/sample-data.json).
   O MESMO arquivo é usado pelo app (Mais → Dados → Carregar dados de exemplo) e aqui,
   como fixture de compatibilidade entre versões: se o formato mudar, isso aparece no CI. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sample-data.json'), 'utf8'));

test('fixture: 3 fichas, 4 treinos para cada e 2 exercicios custom por ficha', () => {
  const data = sample.data;

  assert.equal(sample.sample, true, 'marcada como dados de exemplo');
  assert.equal(data.sheets.length, 3);
  assert.equal(data.workouts.length, 12);
  assert.equal(data.exercises.length, 6, 'exercicios custom na biblioteca');

  data.sheets.forEach(function (sheet) {
    const fromCatalog = sheet.exercises.filter(function (i) { return !i.exerciseId; });
    const custom = sheet.exercises.filter(function (i) { return i.exerciseId; });
    const workouts = data.workouts.filter(function (w) { return w.sheetId === sheet.id; });

    assert.ok(fromCatalog.length >= 5, sheet.name + ': pelo menos 5 exercicios do catalogo');
    assert.equal(custom.length, 2, sheet.name + ': 2 exercicios custom');
    assert.equal(workouts.length, 4, sheet.name + ': 4 treinos');
  });
});

test('fixture: treinos em dias diferentes (4 por ficha)', () => {
  const offsets = sample.data.workouts.map(function (w) { return w.dayOffset; });

  offsets.forEach(function (o) { assert.equal(typeof o, 'number'); });
  assert.equal(new Set(offsets).size, offsets.length, 'cada treino em um dia diferente');
  assert.ok(Math.min.apply(null, offsets) <= -18, 'ha treinos de semanas atras');
  assert.ok(Math.max.apply(null, offsets) >= 0, 'ha treino de hoje');
});

test('fixture: integridade referencial entre fichas, treinos e biblioteca', () => {
  const data = sample.data;
  const exerciseIds = new Set(data.exercises.map(function (e) { return e.id; }));
  const sheetById = {};
  data.sheets.forEach(function (s) { sheetById[s.id] = s; });

  data.sheets.forEach(function (sheet) {
    sheet.exercises.forEach(function (item) {
      if (item.exerciseId) {
        assert.ok(exerciseIds.has(item.exerciseId), 'exerciseId existe na biblioteca: ' + item.exerciseId);
      }
      assert.ok(item.name, 'item tem nome');
      assert.ok(Array.isArray(item.reps), 'reps e uma lista');
      assert.equal(item.reps.length, item.sets, 'uma rep por serie');
    });
  });

  data.workouts.forEach(function (w) {
    const sheet = sheetById[w.sheetId];
    assert.ok(sheet, 'treino aponta para uma ficha existente');

    const names = new Set(sheet.exercises.map(function (i) { return i.name; }));

    w.sets.forEach(function (s) {
      assert.ok(names.has(s.exerciseName), 'serie pertence a ficha: ' + s.exerciseName);
      assert.ok(s.exerciseId === null || exerciseIds.has(s.exerciseId), 'exerciseId valido ou nulo');
      assert.ok(s.load > 0, 'serie com carga');
      assert.ok(s.reps > 0, 'serie com reps');
    });

    (w.warmups || []).forEach(function (warm) {
      assert.ok(names.has(warm.exerciseName), 'aquecimento pertence a ficha');
    });
  });
});

test('fixture: as cargas progridem entre as sessoes (graficos mostram evolucao)', () => {
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
    assert.ok(best[i] >= best[i - 1], 'a carga nao regride entre sessoes');
  }
});

test('materializeSampleData transforma offsets em datas relativas a hoje', () => {
  const data = core.materializeSampleData(sample, '2026-10-12');
  const offsets = sample.data.workouts.map(function (w) { return w.dayOffset; });

  assert.equal(data.workouts.length, 12);
  data.workouts.forEach(function (w) {
    assert.equal(w.dayOffset, undefined, 'dayOffset removido');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(w.date), 'data ISO valida');
  });

  assert.equal(data.workouts[0].date, core.addDaysISO('2026-10-12', offsets[0]));
  assert.equal(data.settings.weekAnchor, core.addDaysISO('2026-10-12', -2), 'semana comecando 2 dias atras');
  assert.equal(sample.data.workouts[0].dayOffset, offsets[0], 'nao altera o arquivo original');
});

test('dados de exemplo passam pela normalizacao de backup sem perder nada', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');
  const normalized = core.normalizeBackup(materialized);

  assert.equal(normalized.workouts.length, 12);
  assert.equal(normalized.sheets.length, 3);
  assert.equal(normalized.exercises.length, 6);
  assert.equal(normalized.colinha.length, 3);

  const setsBefore = materialized.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  const setsAfter = normalized.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  assert.equal(setsAfter, setsBefore, 'nenhuma serie perdida');

  assert.deepEqual(core.normalizeBackup(normalized), normalized, 'normalizacao estavel (idempotente)');
});

test('regressao: fixture no formato antigo (fichas sem exerciseId) e religada pela migracao', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');

  // simula dados de versoes antigas: itens de ficha só com o nome
  const legacySheets = materialized.sheets.map(function (s) {
    return Object.assign({}, s, {
      exercises: s.exercises.map(function (i) { return Object.assign({}, i, { exerciseId: null }); })
    });
  });

  const linked = core.linkSheetItemsToExercises(legacySheets, materialized.exercises);

  assert.equal(linked.changed, 6, 'os 6 itens custom sao religados pelo nome');
  assert.deepEqual(
    core.normalizeBackup({ sheets: linked.sheets }).sheets,
    core.normalizeBackup({ sheets: materialized.sheets }).sheets,
    'resultado igual ao dos dados atuais'
  );
});

test('regressao: renomear um exercicio custom da fixture atualiza só a ficha que o usa', () => {
  const materialized = core.materializeSampleData(sample, '2026-10-12');
  const custom = materialized.exercises[0];   // usado apenas na ficha A
  const novoNome = custom.name + ' (novo)';

  const result = core.renameInSheets(materialized.sheets, custom.id, custom.name, novoNome);

  assert.equal(result.changed, 1, 'apenas um item e atualizado');

  const alteradas = result.sheets.filter(function (s) { return s !== materialized.sheets[result.sheets.indexOf(s)]; });
  assert.equal(alteradas.length, 1, 'apenas uma ficha e alterada');

  const itens = alteradas[0].exercises.filter(function (i) { return i.exerciseId === custom.id; });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].name, novoNome);
  assert.deepEqual(itens[0].reps, [12, 10, 10], 'nada mais mudou');
});
