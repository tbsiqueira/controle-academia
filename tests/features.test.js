'use strict';

/* Testes das melhorias de uso (Início, Treinar, Calendário, evolução) e das melhorias de tela.
   A lógica fica no core.js; o que é só marcação (index.html, css, app.js) é conferido lendo o arquivo. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}
const APP = read('js/app.js');
const HTML = read('index.html');
const CSS = read('css/styles.css');

/* ---------- resumo no card do Início ---------- */

test('fmtThousands separa o milhar com ponto, sem depender do idioma do aparelho', () => {
  assert.equal(core.fmtThousands(12400), '12.400');
  assert.equal(core.fmtThousands(999), '999');
  assert.equal(core.fmtThousands(1000), '1.000');
  assert.equal(core.fmtThousands(1234567.6), '1.234.568');
  assert.equal(core.fmtThousands(0), '0');
  assert.equal(core.fmtThousands(null), '0');
});

test('workoutSummary: exercicios, volume e cardio numa linha', () => {
  const treino = {
    cardioMinutes: 30,
    sets: [
      { exerciseId: 'e1', exerciseName: 'Supino', number: 1, reps: 10, load: 400 },
      { exerciseId: 'e1', exerciseName: 'Supino', number: 2, reps: 10, load: 400 },
      { exerciseId: 'e2', exerciseName: 'Remada', number: 1, reps: 10, load: 440 }
    ],
    warmups: [{ exerciseId: 'e1', exerciseName: 'Supino', reps: 15, load: 100 }, { exerciseId: 'e3', exerciseName: 'Rosca', reps: 15, load: 10 }]
  };
  assert.equal(core.workoutSummary(treino), '3 exercícios · 12.400 kg · 30 min cardio', 'aquecimento conta exercicio mas nao volume');
});

test('workoutSummary deixa de fora o que e zero e usa o singular', () => {
  assert.equal(core.workoutSummary({ sets: [{ exerciseName: 'Flexao', number: 1, reps: 20, load: null }] }), '1 exercício', 'peso do corpo: sem volume');
  assert.equal(core.workoutSummary({ cardioMinutes: 45, sets: [] }), '45 min cardio', 'treino so de cardio');
  assert.equal(core.workoutSummary({ sets: [], warmups: [] }), '');
  assert.equal(core.workoutSummary({}), '');
  assert.equal(core.workoutSummary(null), '');
});

test('workoutSummary bate com os dados de exemplo (mesmo volume da evolucao semanal)', () => {
  const sample = JSON.parse(read('data/sample-data.json')).data;
  sample.workouts.forEach((w) => {
    const texto = core.workoutSummary(w);
    assert.ok(texto.indexOf(core.groupSets(w.sets, w.warmups).length + ' exercícios') === 0, w.id);
    assert.ok(texto.indexOf(core.fmtThousands(core.workoutVolume(w)) + ' kg') !== -1, w.id);
  });
});

test('card do Inicio mostra o resumo e a contagem de recordes (app.js)', () => {
  const body = APP.slice(APP.indexOf('function renderWorkoutList'), APP.indexOf('/* ---------- referências por id'));
  assert.match(body, /workoutSummary\(w\)/);
  assert.match(body, /workoutRecords\(state\.workouts, w\)\.length/);
  assert.match(body, /esc\(summary\)/, 'o resumo e escapado');
  assert.match(CSS, /\.pr-count \{/);
});
