'use strict';

/* Importar treinos antigos + fichas recriadas (contrato TREINO-JSON.md). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const TODAY = '2026-11-17';
const CONTRACT = fs.readFileSync(path.join(__dirname, '..', 'TREINO-JSON.md'), 'utf8');

function treino(extra) {
  return Object.assign({ date: '2025-03-14', exercises: [{ name: 'Supino reto', sets: [{ reps: 10, load: 30 }] }] }, extra);
}

function parse(treinos, fichas) {
  return core.parseHistoryImport({ fichas: fichas, treinos: treinos }, TODAY);
}

test('o exemplo do contrato TREINO-JSON.md é aceito pelo app', () => {
  const start = CONTRACT.indexOf('```json', CONTRACT.indexOf('## Formato'));
  const json = CONTRACT.slice(start, CONTRACT.indexOf('```', start + 7) + 3);
  const parsed = core.parseHistoryImportText(json, TODAY);
  assert.deepEqual(parsed.sheets.map((s) => s.name), ['TREINO A - inferiores', 'TREINO B - superiores']);
  assert.equal(parsed.workouts.length, 2);
  assert.deepEqual(parsed.sheets[0].exercises[0].reps, [12, 10, 8]);
  const agachamento = parsed.workouts[0].exercises[0];
  assert.deepEqual(agachamento.warmup, { reps: 15, load: 20, rir: null });
  assert.deepEqual(agachamento.sets[2], { reps: 8, load: 50, rir: 0, note: 'falhou na 8ª' });
  assert.equal(parsed.workouts[0].cardioMinutes, 15);
  assert.equal(parsed.workouts[1].exercises[1].sets[0].load, null, 'barra fixa sem carga');
});

test('parseHistoryImport: lista solta = só treinos; fichas vazias ou ausentes', () => {
  assert.deepEqual(core.parseHistoryImport([treino()], TODAY).sheets, []);
  assert.deepEqual(parse([treino()], []).sheets, []);
  assert.deepEqual(parse([treino()]).sheets, []);
  assert.equal(core.parseHistoryImport([treino()]).workouts.length, 1, 'sem today usa a data de hoje');
});

test('parseHistoryImport recusa sem treinos, fichas fora de lista e ficha repetida', () => {
  assert.throws(() => core.parseHistoryImport(null, TODAY), /treinos/);
  assert.throws(() => core.parseHistoryImport({ fichas: [] }, TODAY), /treinos/);
  assert.throws(() => core.parseHistoryImport([], TODAY), /treinos/);
  assert.throws(() => parse([treino()], { name: 'A' }), /"fichas" precisa ser uma lista/);
  const ficha = { name: 'Treino A', exercises: [{ name: 'Supino reto' }] };
  assert.throws(() => parse([treino()], [ficha, Object.assign({}, ficha, { name: 'TREINO Á' })]), /duas vezes/);
});

test('treinos: datas AAAA-MM-DD ou DD/MM/AAAA, em ordem; inválida ou no futuro é recusada', () => {
  const parsed = parse([treino({ date: '20/03/2025' }), treino({ date: ' 2025-03-01 ' })]);
  assert.deepEqual(parsed.workouts.map((w) => w.date), ['2025-03-01', '2025-03-20']);
  assert.equal(parse([treino({ date: '5/3/2025' })]).workouts[0].date, '2025-03-05');
  assert.throws(() => parse([treino({ date: '2025-02-30' })]), /Treino 1: "date"/);
  assert.throws(() => parse([treino({ date: undefined })]), /"date"/);
  assert.throws(() => parse([treino({ date: null })]), /"date"/);
  assert.throws(() => parse([treino({ date: 'março' })]), /"date"/);
  assert.throws(() => parse([treino({ date: '2026-11-18' })]), /18\/11\/2026: a data está no futuro/);
  assert.equal(parse([treino({ date: TODAY })]).workouts.length, 1, 'hoje pode');
});

test('treinos: números com vírgula; texto ou negativo é erro com o lugar exato', () => {
  const [w] = parse([treino({ cardioMinutes: '20', exercises: [{ name: 'Leg press', sets: [{ reps: '12', load: '27,5', rir: '' }] }] })]).workouts;
  assert.deepEqual(w.exercises[0].sets[0], { reps: 12, load: 27.5, rir: null, note: '' });
  assert.equal(w.cardioMinutes, 20);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Leg press', sets: [{ reps: 'doze' }] }] })]),
    /Treino de 14\/03\/2025, Leg press, série 1: "doze" não é um número válido/);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Leg press', sets: [{ reps: 10, load: -5 }] }] })]), /"-5"/);
  assert.throws(() => parse([treino({ cardioMinutes: 'muito' })]), /cardioMinutes/);
});

test('treinos: séries vazias saem; aquecimento só com dados; textos limpos', () => {
  const [w] = parse([treino({
    ficha: '  TREINO A ',
    notes: ' cansado ',
    exercises: [
      { name: ' Remada ', note: ' pegada aberta ', warmup: { reps: 15 }, sets: [{ reps: 10, note: 7 }, { rir: 2 }, {}] },
      { name: 'Rosca', warmup: {}, sets: [{ load: 12 }] },
      { name: 'Tríceps', warmup: 'leve', sets: [{ reps: 12 }] }
    ]
  })]).workouts;
  assert.equal(w.sheetName, 'TREINO A');
  assert.equal(w.notes, 'cansado');
  assert.deepEqual(w.exercises[0], { name: 'Remada', note: 'pegada aberta', warmup: { reps: 15, load: null, rir: null }, sets: [{ reps: 10, load: null, rir: null, note: '' }] });
  assert.equal(w.exercises[1].warmup, null, 'aquecimento vazio');
  assert.equal(w.exercises[2].warmup, null, 'aquecimento que não é objeto');
  assert.equal(parse([treino({ ficha: 3, notes: null })]).workouts[0].sheetName, '');
  assert.throws(() => parse([treino({ exercises: [{ name: 'Rosca', warmup: { load: 'x' }, sets: [{ reps: 1 }] }] })]), /Rosca, aquecimento/);
});

test('treinos: só cardio vale; formato e campos obrigatórios dizem onde está o erro', () => {
  const [w] = parse([{ date: '2025-03-14', cardioMinutes: 30 }]).workouts;
  assert.deepEqual(w, { date: '2025-03-14', sheetName: '', cardioMinutes: 30, notes: '', exercises: [] });
  assert.throws(() => parse([treino(), 'x']), /Treino 2: formato inválido/);
  assert.throws(() => parse([null]), /Treino 1: formato inválido/);
  assert.throws(() => parse([treino({ exercises: {} })]), /"exercises" precisa ser uma lista/);
  assert.throws(() => parse([treino({ exercises: [] })]), /sem exercícios nem cardio/);
  assert.throws(() => parse([treino({ exercises: [null] })]), /exercício 1: falta o "name"/);
  assert.throws(() => parse([treino({ exercises: [{ name: '  ', sets: [{ reps: 1 }] }] })]), /exercício 1: falta o "name"/);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Rosca' }] })]), /Rosca: falta a lista "sets"/);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Rosca', sets: [] }] })]), /Rosca: falta a lista "sets"/);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Rosca', sets: [null] }] })]), /Rosca, série 1: formato inválido/);
  assert.throws(() => parse([treino({ exercises: [{ name: 'Rosca', sets: [{ rir: 1 }] }] })]), /Rosca: nenhuma série/);
});

test('parseHistoryImportText aceita cerca ```json e recusa texto que não é JSON', () => {
  const json = JSON.stringify({ treinos: [treino()] });
  assert.equal(core.parseHistoryImportText('```json\n' + json + '\n```', TODAY).workouts.length, 1);
  assert.throws(() => core.parseHistoryImportText('Aqui está: ' + json, TODAY), SyntaxError);
});

test('sheetByName: sem acento/maiúscula, ativa primeiro, desativada se for a única', () => {
  const sheets = [{ id: 'off', name: 'Treino A', active: false }, { id: 'on', name: 'TREINO Á' }, { id: 'b', name: 'B', active: false }];
  assert.equal(core.sheetByName(sheets, 'treino a').id, 'on');
  assert.equal(core.sheetByName(sheets, 'b').id, 'b');
  assert.equal(core.sheetByName(sheets, 'C'), null);
  assert.equal(core.sheetByName(sheets, ''), null, 'treino sem ficha não liga a nada');
  assert.equal(core.sheetByName(null, 'A'), null);
});

test('splitImportedSheets: ficha com nome que já existe é reaproveitada, não duplicada', () => {
  const imported = [{ name: 'Treino A', exercises: [] }, { name: 'Treino C', exercises: [] }];
  const split = core.splitImportedSheets(imported, [{ id: 's1', name: 'TREINO A' }]);
  assert.deepEqual(split.fresh.map((s) => s.name), ['Treino C']);
  assert.deepEqual(split.reused.map((s) => s.name), ['Treino A']);
});

test('importedWorkout: liga ficha e exercícios por id, numera as séries, guarda aquecimento', () => {
  const [item] = parse([treino({
    ficha: 'treino a',
    cardioMinutes: 10,
    notes: 'ok',
    exercises: [
      { name: 'agachamento', note: 'fundo', warmup: { reps: 15, load: 20 }, sets: [{ reps: 12, load: 40, rir: 2 }, { reps: 10, load: 45, note: 'falhou' }] },
      { name: 'Novo exercício', sets: [{ reps: 8 }] }
    ]
  })]).workouts;
  const ids = { agachamento: { id: 1, name: 'Agachamento livre' }, 'Novo exercício': { id: 'u1', name: 'Novo exercício' } };
  const w = core.importedWorkout(item, [{ id: 's1', name: 'TREINO A' }], (name) => ids[name]);
  assert.equal(w.sheetId, 's1');
  assert.equal(w.sheetName, 'TREINO A', 'nome atual da ficha');
  assert.equal(w.cardioMinutes, 10);
  assert.equal(w.notes, 'ok');
  assert.deepEqual(w.warmups, [{ exerciseId: 1, exerciseName: 'Agachamento livre', reps: 15, load: 20, rir: null }]);
  assert.deepEqual(w.sets[1], { exerciseId: 1, exerciseName: 'Agachamento livre', number: 2, reps: 10, load: 45, rir: null, note: 'falhou', exerciseNote: 'fundo' });
  assert.deepEqual(w.sets[2], { exerciseId: 'u1', exerciseName: 'Novo exercício', number: 1, reps: 8, load: null, rir: null, note: '', exerciseNote: '' });
  assert.ok(core.isValidWorkout(w));

  const loose = core.importedWorkout(Object.assign({}, item, { sheetName: 'Rotina antiga' }), [], (name) => ids[name]);
  assert.equal(loose.sheetId, null);
  assert.equal(loose.sheetName, 'Rotina antiga', 'sem ficha, guarda só o nome');
});

test('importado vira histórico: a ficha recriada acha a carga da última vez', () => {
  const parsed = parse([
    treino({ date: '2025-03-01', ficha: 'A', exercises: [{ name: 'Supino reto', sets: [{ reps: 10, load: 30 }] }] }),
    treino({ date: '2025-03-08', ficha: 'A', exercises: [{ name: 'Supino reto', sets: [{ reps: 10, load: 32.5 }, { reps: 8, load: 35 }] }] })
  ], [{ name: 'A', exercises: [{ name: 'Supino reto', sets: 2, reps: [10, 8] }] }]);
  const exercise = { id: 7, name: 'Supino reto' };
  const sheets = [{ id: 'sA', name: 'A', exercises: parsed.sheets[0].exercises.map((e) => Object.assign({}, e, { exerciseId: 7 })) }];
  const workouts = parsed.workouts.map((item, i) => Object.assign({ id: 'w' + i }, core.importedWorkout(item, sheets, () => exercise)));
  assert.deepEqual(core.lastLoadsForExercise(workouts, { exerciseId: 7, exerciseName: 'Supino reto' }), { 1: 32.5, 2: 35 }, 'carga por série da última vez');
  assert.equal(core.nextSheet(workouts, sheets).id, 'sA');
});

test('splitImportedWorkouts: pula o que já está no app e o repetido no próprio JSON', () => {
  const parsed = parse([treino(), treino({ date: '2025-03-15' }), treino({ date: '2025-03-15' }), treino({ date: '2025-03-16', cardioMinutes: 5 })]);
  const existing = [Object.assign({ id: 'x' }, core.importedWorkout(parsed.workouts[0], [], (n) => ({ id: 'e', name: n + ' renomeado' })))];
  const split = core.splitImportedWorkouts(parsed.workouts, existing);
  assert.deepEqual(split.fresh.map((w) => w.date), ['2025-03-15', '2025-03-16']);
  assert.deepEqual(split.repeated.map((w) => w.date), ['2025-03-14', '2025-03-15']);
  assert.equal(core.splitImportedWorkouts(parsed.workouts, null).fresh.length, 3);
  assert.equal(core.workoutFingerprint({ date: '2025-01-01' }), '2025-01-01|0', 'treino antigo sem séries');
});

test('historyExerciseNames: fichas e treinos, sem repetir (maiúscula/acento)', () => {
  const parsed = parse(
    [treino({ exercises: [{ name: 'Supino Reto', sets: [{ reps: 1 }] }, { name: 'Remada', sets: [{ reps: 1 }] }] })],
    [{ name: 'A', exercises: [{ name: 'Supino reto' }, { name: 'Elevação lateral' }] }]
  );
  assert.deepEqual(core.historyExerciseNames(parsed), ['Supino reto', 'Elevação lateral', 'Remada']);
});

test('sheetNamesText lista as fichas do app para a IA, marcando as desativadas', () => {
  const text = core.sheetNamesText([{ name: 'TREINO A' }, { name: 'Antiga', active: false }, { name: '' }, null]);
  assert.match(text, /## Fichas que já existem no app/);
  assert.match(text, /- TREINO A\n- Antiga \(desativada\)\n$/);
  assert.match(core.sheetNamesText(null), /\(nenhuma\)/);
});

test('historyImportSummaryHtml: treinos novos com período, repetidos e fichas novas/reaproveitadas', () => {
  const parsed = parse([treino(), treino({ date: '2025-03-20' })], [
    { name: 'A <b>', exercises: [{ name: 'Supino reto' }] },
    { name: 'B', exercises: [{ name: 'Remada' }, { name: 'Rosca' }] }
  ]);
  const sheets = core.splitImportedSheets(parsed.sheets, [{ id: 's', name: 'b' }]);
  const html = core.historyImportSummaryHtml(core.splitImportedWorkouts(parsed.workouts, []), sheets);
  assert.match(html, />2 treinos novos <span class="fw-normal text-muted">\(14\/03\/2025 a 20\/03\/2025\)</);
  assert.match(html, /A &lt;b&gt;<\/span><span class="sheet-item-detail ms-auto">nova · 1 exercício</, 'nome escapado, singular');
  assert.match(html, />B<\/span><span class="sheet-item-detail ms-auto">já existe, será usada</);
  assert.doesNotMatch(html, /já estava/, 'sem repetidos, sem aviso');

  const one = core.historyImportSummaryHtml(core.splitImportedWorkouts(parsed.workouts.slice(0, 1), []), { fresh: [], reused: [] });
  assert.match(one, />1 treino novo <span class="fw-normal text-muted">\(14\/03\/2025 a 14\/03\/2025\)</);
  assert.match(one, /Nenhuma ficha no JSON/);

  const again = core.splitImportedWorkouts(parsed.workouts, parsed.workouts);
  const none = core.historyImportSummaryHtml(again, { fresh: [{ name: 'C', exercises: [{}, {}] }], reused: [] });
  assert.match(none, />0 treinos novos<\/p>/, 'só fichas: sem período');
  assert.match(none, />2 treinos já estavam no app e não será importado de novo/);
  assert.match(none, /nova · 2 exercícios/);
  const oneRepeated = core.splitImportedWorkouts(parsed.workouts.slice(0, 1), parsed.workouts);
  assert.match(core.historyImportSummaryHtml(oneRepeated, { fresh: [], reused: [] }), />1 treino já estava no app/);
});

test('historyImportToast: só fala do que entrou, com singular e plural', () => {
  assert.equal(core.historyImportToast(3, 2), '3 treinos importados e 2 fichas criadas.');
  assert.equal(core.historyImportToast(1, 1), '1 treino importado e 1 ficha criada.');
  assert.equal(core.historyImportToast(5, 0), '5 treinos importados.');
  assert.equal(core.historyImportToast(0, 2), '2 fichas criadas.', 'nada de "0 treinos importados"');
});
