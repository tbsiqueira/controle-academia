'use strict';

/* Tests for the usability improvements (Início, Treinar, Calendário, progress) and the screen improvements.
   The logic lives in core.js; what is only markup (index.html, css, app.js) is checked by reading the file. */

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

/* ---------- summary on the Início card ---------- */

test('fmtThousands separates thousands with a dot, regardless of the device language', () => {
  assert.equal(core.fmtThousands(12400), '12.400');
  assert.equal(core.fmtThousands(999), '999');
  assert.equal(core.fmtThousands(1000), '1.000');
  assert.equal(core.fmtThousands(1234567.6), '1.234.568');
  assert.equal(core.fmtThousands(0), '0');
  assert.equal(core.fmtThousands(null), '0');
});

test('workoutSummary: exercises, volume and cardio on one line', () => {
  const treino = {
    cardioMinutes: 30,
    sets: [
      { exerciseId: 'e1', exerciseName: 'Supino', number: 1, reps: 10, load: 400 },
      { exerciseId: 'e1', exerciseName: 'Supino', number: 2, reps: 10, load: 400 },
      { exerciseId: 'e2', exerciseName: 'Remada', number: 1, reps: 10, load: 440 }
    ],
    warmups: [{ exerciseId: 'e1', exerciseName: 'Supino', reps: 15, load: 100 }, { exerciseId: 'e3', exerciseName: 'Rosca', reps: 15, load: 10 }]
  };
  assert.equal(core.workoutSummary(treino), '3 exercícios · 12.400 kg · 30 min cardio', 'a warm-up counts as an exercise but not as volume');
});

test('workoutSummary leaves out what is zero and uses the singular', () => {
  assert.equal(core.workoutSummary({ sets: [{ exerciseName: 'Flexao', number: 1, reps: 20, load: null }] }), '1 exercício', 'body weight: no volume');
  assert.equal(core.workoutSummary({ cardioMinutes: 45, sets: [] }), '45 min cardio', 'cardio-only workout');
  assert.equal(core.workoutSummary({ sets: [], warmups: [] }), '');
  assert.equal(core.workoutSummary({}), '');
  assert.equal(core.workoutSummary(null), '');
});

test('workoutSummary matches the sample data (same volume as the weekly progress)', () => {
  const sample = JSON.parse(read('data/sample-data.json')).data;
  sample.workouts.forEach((w) => {
    const texto = core.workoutSummary(w);
    assert.ok(texto.indexOf(core.groupSets(w.sets, w.warmups).length + ' exercícios') === 0, w.id);
    assert.ok(texto.indexOf(core.fmtThousands(core.workoutVolume(w)) + ' kg') !== -1, w.id);
  });
});

test('the Início card shows the summary and the record count (app.js)', () => {
  const body = APP.slice(APP.indexOf('function renderWorkoutList'), APP.indexOf('/* ---------- references by id'));
  assert.match(body, /workoutSummary\(w\)/);
  assert.match(body, /recordCounts\(state\.workouts\)/, 'records in a single pass, not per card');
  assert.match(body, /esc\(summary\)/, 'the summary is escaped');
  assert.match(CSS, /\.pr-count \{/);
});

/* ---------- start today's workout in one tap ---------- */

const FICHAS = [
  { id: 'sc', name: 'TREINO C - corpo inteiro', active: true },
  { id: 'sa', name: 'TREINO A - inferiores', active: true },
  { id: 'sb', name: 'TREINO B - superiores', active: true }
];

test('nextSheet suggests the sheet after the last one used, in alphabetical order, and wraps around', () => {
  const treino = (sheetId, date) => ({ id: sheetId + date, date: date, sheetId: sheetId });
  assert.equal(core.nextSheet([treino('sa', '2026-10-01')], FICHAS).id, 'sb');
  assert.equal(core.nextSheet([treino('sa', '2026-10-01'), treino('sb', '2026-10-03')], FICHAS).id, 'sc');
  assert.equal(core.nextSheet([treino('sc', '2026-10-05'), treino('sb', '2026-10-03')], FICHAS).id, 'sa', 'after the last one it goes back to the first');
  assert.equal(core.nextSheet([treino('sb', '2026-10-03'), treino('sc', '2026-10-01')], FICHAS).id, 'sc', 'the date counts, not the list order');
});

test('nextSheet with no history (or with the last sheet deleted/deactivated) starts with the first', () => {
  assert.equal(core.nextSheet([], FICHAS).id, 'sa');
  assert.equal(core.nextSheet(null, FICHAS).id, 'sa');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'apagada' }], FICHAS).id, 'sa');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: null }], FICHAS).id, 'sa', 'a workout with no sheet does not count');

  const comInativa = FICHAS.map((f) => (f.id === 'sb' ? Object.assign({}, f, { active: false }) : f));
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'sa' }], comInativa).id, 'sc', 'skips the deactivated one');
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 'sb' }], comInativa).id, 'sa');
});

test('nextSheet: with no active sheet it suggests nothing; a single sheet is always that one; accepts old data', () => {
  assert.equal(core.nextSheet([], []), null);
  assert.equal(core.nextSheet([], null), null);
  assert.equal(core.nextSheet([], [null, { id: 's1', name: 'A', active: false }]), null);
  const uma = [{ id: 's1', name: 'Unica' }];
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', sheetId: 's1' }], uma).id, 's1');
  // v1: a workout stored typeId; numeric id vs text
  assert.equal(core.nextSheet([{ id: 'w1', date: '2026-10-01', typeId: 1 }], [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]).id, '2');
});

test('Início has the "Treinar: <ficha>" button and Treinar loads the chosen sheet', () => {
  assert.match(HTML, /<div id="quickStart"><\/div>/);
  const quick = APP.slice(APP.indexOf('function renderQuickStart'), APP.indexOf('function renderWeek()'));
  assert.match(quick, /draftHasContent\(state\.draft\) \? null : nextSheet\(state\.workouts, state\.sheets\)/, 'it disappears while a workout is in progress');
  assert.match(quick, /esc\(sheet\.name\)/);
  const form = APP.slice(APP.indexOf('function renderWorkoutForm'), APP.indexOf('function renderFormSets'));
  assert.match(form, /if \(quickSheet && !draft && !editing\)/, 'never on top of a draft or an edit');
  assert.match(form, /state\.pendingSheetId = null;/, 'valid for a single opening');
});

/* ---------- remove a set ---------- */

test('setHasData: a set with any field filled in has data; a blank one does not', () => {
  const vazio = { number: 3, reps: '', load: '', rir: '', note: '' };
  assert.equal(core.setHasData(vazio), false, 'the set number does not count as data');
  assert.equal(core.setHasData({ number: 3, reps: null, load: undefined }), false);
  assert.equal(core.setHasData(Object.assign({}, vazio, { reps: 12 })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { load: '27,5' })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { rir: 0 })), true);
  assert.equal(core.setHasData(Object.assign({}, vazio, { note: 'caiu' })), true);
});

test('groupHasData stays the same after reusing setHasData', () => {
  assert.equal(core.groupHasData({ sets: [{ reps: '', load: '' }, { reps: '', load: 40 }] }), true);
  assert.equal(core.groupHasData({ warmup: { reps: '', load: '', rir: '' }, sets: [{ reps: '', load: '' }] }), false);
  assert.equal(core.groupHasData({ warmup: { reps: 15 }, sets: [] }), true);
});

test('Treinar has the "- serie" button: removes the last, never the only one, and confirms if it has data', () => {
  const body = APP.slice(APP.indexOf('function removeFormSet'), APP.indexOf('function removeFormExercise'));
  assert.match(body, /group\.sets\.length <= 1\) return;/, 'one set always remains');
  assert.match(body, /setHasData\(last\) && !confirm\(/);
  assert.ok(body.indexOf('confirm(') < body.indexOf('.pop()'), 'asks before removing');
  assert.match(body, /scheduleDraftSave\(\)/, 'the draft follows along');
  assert.match(APP, /onclick="removeFormSet\(' \+ exIdx \+ '\)"' \+ \(group\.sets\.length <= 1 \? ' disabled' : ''\)/);
});

/* ---------- done set: starts the rest from its own row ---------- */

test('setRowHtml: the set number is a button that calls toggleSetDone', () => {
  const html = core.setRowHtml(2, 1, { number: 2, reps: 10, load: 40, rir: '', note: '' }, true);
  assert.match(html, /<button type="button" class="btn set-done w-100 btn-outline-secondary"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-label="Série 2: marcar como feita e iniciar o descanso"/);
  assert.match(html, /onclick="toggleSetDone\(2,1\)">2<\/button>/);
  assert.equal((html.match(/<input /g) || []).length, 4, 'the four fields are still there');
});

test('setRowHtml: a done set turns green, with a check mark, and tells the screen reader', () => {
  const html = core.setRowHtml(0, 0, { number: 1, reps: 10, load: 40, done: true }, true);
  assert.match(html, /class="btn set-done w-100 btn-success"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="Série 1 feita \(toque para desmarcar\)"/);
  assert.match(html, />1 <i class="bi bi-check-lg"><\/i><\/button>/);
});

test('the load keeps the wide column and the row fills the 12-column grid', () => {
  const html = core.setRowHtml(0, 0, { number: 1, load: 102.5 }, true);
  assert.match(html, /<div class="col-3"><input type="text" inputmode="decimal"[^>]*value="102,5"/);
  const cols = (html.match(/class="col-(\d+)/g) || []).map((c) => Number(c.replace(/\D/g, '')));
  assert.equal(cols.reduce((a, b) => a + b, 0), 12);
});

test('toggleSetDone marks, starts the rest only when marking and does not leak into the saved workout', () => {
  const body = APP.slice(APP.indexOf('function toggleSetDone'), APP.indexOf('function removeFormSet'));
  assert.match(body, /if \(group\.sets\[setIdx\]\.done\) startRest\(\);/, 'unmarking does not restart the timer');
  assert.match(body, /scheduleDraftSave\(\)/, 'the draft keeps what is already done');

  const save = APP.slice(APP.indexOf('async function saveWorkout'), APP.indexOf('async function deleteWorkout'));
  assert.doesNotMatch(save, /done/, 'the saved workout gets no new field (database format intact)');

  // repeating/editing a workout builds the form without "done"
  const form = core.formFromWorkout({ sets: [{ exerciseName: 'Supino', number: 1, reps: 10, load: 40, done: true }] });
  assert.equal('done' in form[0].sets[0], false);
  assert.equal('done' in core.groupSets([{ exerciseName: 'Supino', number: 1, done: true }], [])[0].sets[0], false);
});

test('the end of the rest still has no sound, vibration or animation (color only)', () => {
  assert.doesNotMatch(APP, /vibrate\(|new Audio|AudioContext|\.play\(\)/);
  const rule = CSS.slice(CSS.indexOf('.set-done {'), CSS.indexOf('}', CSS.indexOf('.set-done {')));
  assert.doesNotMatch(rule, /animation|transition/);
});

/* ---------- calendar: tapping a day opens the workout ---------- */

test('workoutsByDate groups by day, with the most recent workout of the day first', () => {
  const manha = { id: 'manha', date: '2026-10-08', createdAt: '2026-10-08T08:00:00.000Z' };
  const noite = { id: 'noite', date: '2026-10-08', createdAt: '2026-10-08T20:00:00.000Z' };
  const outro = { id: 'outro', date: '2026-10-10' };
  const original = [manha, outro, noite];
  const mapa = core.workoutsByDate(original);

  assert.deepEqual(Object.keys(mapa).sort(), ['2026-10-08', '2026-10-10']);
  assert.deepEqual(mapa['2026-10-08'].map((w) => w.id), ['noite', 'manha'], 'the day link opens the most recent one');
  assert.deepEqual(mapa['2026-10-10'].map((w) => w.id), ['outro']);
  assert.deepEqual(original.map((w) => w.id), ['manha', 'outro', 'noite'], 'does not reorder the app list');
});

test('workoutsByDate ignores a workout with no valid date and accepts an empty list', () => {
  const mapa = core.workoutsByDate([{ id: 'a', date: '' }, { id: 'b' }, { id: 'c', date: '08/10/2026' }, { id: 'd', date: '2026-10-08' }]);
  assert.deepEqual(Object.keys(mapa), ['2026-10-08']);
  assert.deepEqual(core.workoutsByDate([]), {});
  assert.deepEqual(core.workoutsByDate(null), {});
});

test('calendar: a day with a workout becomes a link to #/detail/<id>; an empty day stays without a link', () => {
  const body = APP.slice(APP.indexOf('function renderCalendar'), APP.indexOf('/* ---------- weekly progress (volume'));
  assert.match(body, /workoutsByDate\(state\.workouts\)/);
  assert.match(body, /href="#\/detail\/' \+ esc\(dayWorkouts\[0\]\.id\)/);
  assert.match(body, /aria-label="' \+ esc\('Abrir treino de '/);
  assert.match(body, /: '<div class="' \+ classes \+ '">' \+ day \+ '<\/div>'/);
  assert.doesNotMatch(body, /w\.date\.indexOf/, 'no longer breaks with a workout that has no date');
  assert.match(CSS, /a\.cal-cell \{/);
});

/* ---------- estimated 1RM ---------- */

test('estimate1RM uses Epley: load x (1 + reps/30), with one decimal place', () => {
  assert.equal(core.estimate1RM(100, 10), 133.3);
  assert.equal(core.estimate1RM(60, 5), 70);
  assert.equal(core.estimate1RM(40, 30), 80);
  assert.equal(core.estimate1RM(100, 1), 100, 'one rep is the load itself');
  assert.equal(core.estimate1RM('27,5', '12'), 38.5, 'accepts the form text');
});

test('estimate1RM with no load or no reps estimates nothing', () => {
  assert.equal(core.estimate1RM(0, 10), 0, 'body weight');
  assert.equal(core.estimate1RM(null, 10), 0);
  assert.equal(core.estimate1RM(100, 0), 0);
  assert.equal(core.estimate1RM(100, null), 0);
  assert.equal(core.estimate1RM(-20, 10), 0);
});

test('best1RMForExercise: more reps at the same load is also progress', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const serie = (reps, load, id) => ({ exerciseId: id || 'e1', exerciseName: 'Supino', number: 1, reps: reps, load: load });
  const semana1 = { id: 'w1', date: '2026-10-01', sets: [serie(8, 60)] };
  const semana2 = { id: 'w2', date: '2026-10-08', sets: [serie(10, 60)] };

  assert.equal(core.bestSetForExercise(semana1, alvo).load, core.bestSetForExercise(semana2, alvo).load, 'the load did not change');
  assert.ok(core.best1RMForExercise(semana2, alvo) > core.best1RMForExercise(semana1, alvo));
  assert.equal(core.best1RMForExercise(semana1, alvo), 76);
  assert.equal(core.best1RMForExercise(semana2, alvo), 80);
});

test('best1RMForExercise takes the best set of the exercise and ignores the others', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const treino = { sets: [
    { exerciseId: 'e1', number: 1, reps: 12, load: 50 },   // 70
    { exerciseId: 'e1', number: 2, reps: 6, load: 60 },    // 72
    { exerciseId: 'e2', number: 1, reps: 10, load: 200 }
  ] };
  assert.equal(core.best1RMForExercise(treino, alvo), 72, 'it is not always the heaviest set nor the one with the most reps');
  assert.equal(core.best1RMForExercise({ sets: [{ exerciseId: 'e1', reps: 20, load: null }] }, alvo), 0);
  assert.equal(core.best1RMForExercise({ sets: [] }, alvo), 0);
  assert.equal(core.best1RMForExercise({}, alvo), 0);
  assert.equal(core.best1RMForExercise(null, alvo), 0);
});

test('the exercise progress shows the estimated 1RM only when it exists (app.js)', () => {
  const body = APP.slice(APP.indexOf('function renderExerciseHistory'), APP.indexOf('/* ---------- workout draft'));
  assert.match(body, /rm: best1RMForExercise\(w, target\)/);
  assert.match(body, /topRM > 0 \?/, 'an exercise with no load does not get "1RM 0 kg"');
  assert.match(body, /r\.rm > 0 \?/);
  assert.match(body, /prLoad > 0 \?/, 'the PR badge is still conditional on a real load');
});

/* ---------- success notices with no extra tap (toast) ---------- */

test('index.html has the self-dismissing notice, announced to screen readers', () => {
  assert.match(HTML, /<div id="appToast" class="toast[^"]*" role="status" aria-live="polite"/);
  assert.match(HTML, /id="appToastBody"/);
});

test('success messages use showToast and no longer ask for an extra tap on OK', () => {
  ['Metas salvas.', 'Semana iniciada hoje (', 'Texto copiado!', 'Backup importado', 'Dados anteriores restaurados.'].forEach((msg) => {
    assert.ok(APP.indexOf("showToast('" + msg) !== -1, msg + ' became a toast');
    assert.ok(APP.indexOf("alert('" + msg) === -1, msg + ' is no longer an alert');
  });
  assert.match(APP, /getElementById\('appToastBody'\)\.textContent = message;/, 'plain text (no HTML)');
});

test('errors, validations and confirmations still block (alert/confirm)', () => {
  ['Arquivo JSON inválido.', 'Informe o nome da ficha.', 'Preencha pelo menos uma série', "Erro: '"].forEach((msg) => {
    assert.ok(APP.indexOf("alert('" + msg) !== -1, msg);
  });
  assert.ok((APP.match(/confirm\(/g) || []).length >= 10, 'questions before deleting/replacing remain');
});

/* ---------- touch area of icon buttons ---------- */

test('small icon-only buttons have at least 44px of touch area', () => {
  const rule = CSS.slice(CSS.indexOf('.btn-sm[aria-label] {'), CSS.indexOf('}', CSS.indexOf('.btn-sm[aria-label] {')));
  assert.match(rule, /min-width: 44px;/);
  assert.match(rule, /min-height: 44px;/);
});

test('every small icon-only button has an aria-label (that is how the 44px rule catches it)', () => {
  const fontes = APP + read('js/core.js') + HTML;
  const botoes = fontes.match(/<button[^>]*class="btn btn-sm[^>]*>(?:' \+\s*)?<i class="bi [^"]*"><\/i><\/button>/g) || [];
  assert.ok(botoes.length >= 8, 'found the icon buttons (' + botoes.length + ')');
  botoes.forEach((b) => assert.match(b, /aria-label="/, b.slice(0, 120)));
});

/* ---------- Debug card always visible at the end of Mais (v74) ---------- */

// Start of the Debug card, on the Mais screen.
const DEBUG = HTML.indexOf('bi-bug"></i> Debug', HTML.indexOf('id="view-more"'));

test('Debug (update, erase all, sample data) stays in view at the end of Mais, not collapsed', () => {
  const more = HTML.slice(HTML.indexOf('id="view-more"'), HTML.indexOf('</section>', HTML.indexOf('id="view-more"')));
  assert.doesNotMatch(more, /<details|Opções avançadas/, 'nothing collapsed in Mais');
  const fim = HTML.indexOf('id="appVersion"');
  assert.ok(DEBUG > 0 && fim > DEBUG, 'Debug is the last card, before the version');
  const dentro = HTML.slice(DEBUG, fim);
  ['btnForceUpdate', 'btnEraseAll', 'btnLoadSample', 'sampleStatus', 'storageInfo'].forEach((id) => {
    assert.ok(dentro.indexOf('id="' + id + '"') !== -1, id + ' inside the Debug card');
  });
});

test('backup (Exportar/Importar/Desfazer) stays in view, before Debug', () => {
  const antes = HTML.slice(HTML.indexOf('id="view-more"'), DEBUG);
  ['btnExport', 'btnImport', 'btnUndoImport', 'backupStatus'].forEach((id) => {
    assert.ok(antes.indexOf('id="' + id + '"') !== -1, id);
  });
});

/* ---------- warm-up fields with a name for screen readers ---------- */

test('the three warm-up fields have an aria-label (the placeholder disappears when the field is filled)', () => {
  const body = APP.slice(APP.indexOf('function renderFormSets'), APP.indexOf('function setWarmupField'));
  ['Reps do aquecimento', 'Peso do aquecimento', 'RIR do aquecimento'].forEach((label) => {
    assert.ok(body.indexOf('aria-label="' + label + '"') !== -1, label);
  });
  assert.equal((body.match(/oninput="setWarmupField\(/g) || []).length, 3, 'all three are still wired to setWarmupField');
});

/* ---------- Criar com IA: text for the AI and the reply in the same window ---------- */

test('Criar com IA joins asking and importing in a single button and a single window', () => {
  assert.match(HTML, /id="btnImportSheet"><i class="bi bi-stars"><\/i> Criar com IA</, 'single button on the Fichas tab');
  const modal = HTML.slice(HTML.indexOf('id="sheetImportModal"'), HTML.indexOf('id="exportModal"'));
  assert.match(modal, /class="btn btn-primary w-100 mb-2" id="iaCopy"/, 'green Copiar texto, inside the window');
  assert.match(modal, /id="iaText" rows="2" readonly/, 'text for the AI with 2 rows');
  assert.ok(modal.indexOf('id="iaText"') < modal.indexOf('id="sheetImportText"'), 'first copy, then paste the reply');
  assert.match(CSS, /\.steps\[start="3"\] \{\s*counter-reset: step 2;/, 'the second list continues at step 3');
  assert.match(APP, /function openSheetImport\(\) \{[\s\S]*?guard\(renderIa\)\(\);[\s\S]*?\.show\(\);/, 'opening the window loads the text');
  assert.doesNotMatch(HTML + APP, /view-ia|#\/ia|iaShare|Pedir uma ficha/, 'the #/ia screen and Compartilhar removed');
});

/* ---------- Mais -> Instalar o app (PWA) ---------- */

test('installHint: installed, browser button, iPhone or browser menu', () => {
  assert.match(core.installHint(true, true, true), /já está instalado/, 'installed wins over everything');
  assert.match(core.installHint(false, true, false), /Toque em Instalar/);
  assert.match(core.installHint(false, false, true), /Safari.*Adicionar à Tela de Início.*Exportar/);
  assert.match(core.installHint(false, false, false), /menu do navegador/);
});

test('the Instalar o app card sits between Dados and Debug', () => {
  const dados = HTML.indexOf('bi-database"></i> Dados');
  const install = HTML.indexOf('bi-download"></i> Instalar o app');
  assert.ok(dados > 0 && install > dados && install < DEBUG);
  assert.match(HTML, /id="btnInstall"/);
  assert.match(APP, /addEventListener\('beforeinstallprompt', function \(e\) \{\s*e\.preventDefault\(\);\s*installPrompt = e;/);
  assert.match(APP, /getElementById\('btnInstall'\)\.addEventListener\('click', guard\(installApp\)\)/);
});

/* ---------- Mais -> Importar treinos antigos (TREINO-JSON.md) ---------- */

test('Importar treinos antigos: card in Mais and a window with the same flow as Criar com IA', () => {
  const more = HTML.slice(HTML.indexOf('id="view-more"'), HTML.indexOf('</section>', HTML.indexOf('id="view-more"')));
  assert.match(more, /Importar treinos antigos[\s\S]*?id="btnHistoryImport"/, 'its own card in Mais');
  const modal = HTML.slice(HTML.indexOf('id="historyImportModal"'), HTML.indexOf('id="exportModal"'));
  assert.ok(modal.indexOf('id="historyIaText"') < modal.indexOf('id="historyImportText"'), 'first copy, then paste the reply');
  assert.match(APP, /fetch\('TREINO-JSON\.md'\)/, 'the text for the AI comes from the contract');
  assert.match(APP, /sheetNamesText\(state\.sheets\)[\s\S]*?exerciseNamesText\(/, 'joins the sheets and exercises that already exist');
  assert.match(APP, /state\.pendingHistory = null;   \/\/ before the awaits/, 'a double tap does not import twice');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), /'\.\/TREINO-JSON\.md'/, 'the contract works offline');
});

test('Importar treinos antigos: review validates, skips repeats and only asks for a choice on new names', () => {
  const review = APP.slice(APP.indexOf('async function reviewHistoryImport('), APP.indexOf('async function confirmHistoryImport('));
  assert.match(review, /parseHistoryImportText\(document\.getElementById\('historyImportText'\)\.value, todayISO\(\)\)/, 'future dates blocked by today\'s date');
  assert.match(review, /e instanceof SyntaxError \? 'O texto não é um JSON válido/, 'error always visible, with the reason');
  assert.match(review, /splitImportedWorkouts\(parsed\.workouts, state\.workouts\)/, 'repeats compared with what already exists');
  assert.match(review, /splitImportedSheets\(parsed\.sheets, state\.sheets\)/, 'a same-name sheet is reused');
  assert.match(review, /Nada novo para importar/, 're-importing the same JSON warns and does not save');
  assert.match(review, /historyExerciseNames\(\{ sheets: sheets\.fresh, workouts: workouts\.fresh \}\)/, 'only names of what will come in');
  assert.match(review, /historyImportSummaryHtml\(workouts, sheets\) \+ exerciseChoicesHtml\(unmatched, 'imph-'\)/);
  assert.match(review, /setHistoryButton\('Importar'\)/, 'the button becomes Importar after the review');
});

test('Importar treinos antigos: saves sheets before workouts and links everything to the same exercises', () => {
  const confirm = APP.slice(APP.indexOf('async function confirmHistoryImport('), APP.indexOf('/* ---------- contract for the AI'));
  const sheetsAt = confirm.indexOf('createImportedSheet(');
  const workoutsAt = confirm.indexOf("dbPut('workouts'");
  assert.ok(sheetsAt > 0 && sheetsAt < workoutsAt, 'sheets first: the workouts need their id');
  assert.match(confirm, /chosenExercises\(pending\.unmatched, 'imph-'\)/, 'uses what the person chose in the review');
  assert.match(confirm, /resolved\[normalizeText\(names\[i\]\)\] = await resolveImportedExercise\(names\[i\], chosen\)/, 'each name resolved once');
  assert.match(confirm, /importedWorkout\(pending\.workouts\[i\], state\.sheets, exerciseFor\)/, 'links the newly created sheet');
  assert.match(confirm, /Object\.assign\(\{ id: uid\(\) \}, record, \{ createdAt: now, updatedAt: now \}\)/);
  assert.match(confirm, /showToast\(historyImportToast\(pending\.workouts\.length, pending\.sheets\.length\)\)/, 'success disappears on its own');
  assert.match(APP, /'historyImportConfirm'\)\.addEventListener\('click', function \(\) \{\s*guard\(state\.pendingHistory \? confirmHistoryImport : reviewHistoryImport\)\(\);/, 'one button: review, then import');
  assert.match(APP, /'historyIaCopy'\)\.addEventListener\('click', function \(\) \{ guard\(copyExportText\)\('historyIaText'\); \}\)/);
});

test('Sheets and old workouts use the same exercise review (no duplicated code)', () => {
  const sheetReview = APP.slice(APP.indexOf('async function reviewSheetImport('), APP.indexOf('async function confirmSheetImport('));
  assert.match(sheetReview, /exerciseChoicesHtml\(unmatched, 'imp-'\)/);
  const sheetConfirm = APP.slice(APP.indexOf('async function confirmSheetImport('), APP.indexOf('function unmatchedExerciseNames('));
  assert.match(sheetConfirm, /chosenExercises\(pending\.unmatched, 'imp-'\)/);
  assert.match(sheetConfirm, /while \(sheetNameExists\(name, null\)\) name \+= ' \(importada\)';[\s\S]*?createImportedSheet\(name, s\.exercises, chosen\)/, 'Criar com IA still renames the repeated sheet');
  assert.match(APP, /function resolveImportedExercise\(name, chosen\) \{\s*return exactExercise\(name\) \|\| chosen\[normalizeText\(name\)\] \|\| await findOrCreateExercise\(name\);/,
    'exact name, then the choice, then Criar novo');
  assert.match(APP, /function exerciseChoicesHtml\(unmatched, prefix\)[\s\S]*?suggestExercises\(name, candidates, 1, 0\.5\)[\s\S]*?➕ Criar novo/);
});

test('Mais: card order and no Fichas de treino card (the Fichas tab already does that)', () => {
  const more = HTML.slice(HTML.indexOf('id="view-more"'), HTML.indexOf('</section>', HTML.indexOf('id="view-more"')));
  const titles = [...more.matchAll(/class="card-header fw-semibold"><i class="bi [^"]+"><\/i> ([^<]+)</g)].map((m) => m[1].trim());
  assert.deepEqual(titles, ['Metas da semana', 'Colinha', 'Importar treinos antigos', 'Dados', 'Instalar o app', 'Debug']);
  assert.doesNotMatch(more, /Gerenciar fichas|Fichas de treino/);
});
