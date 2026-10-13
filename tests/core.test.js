'use strict';

/* Testes de unidade do Meu Treino.
   Rodam em Node sem nenhuma dependência:  node --test tests/
   Cobrem a lógica pura (js/core.js) e a compatibilidade de dados entre versões. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

/* ---------- datas ---------- */

test('pad2 completa com zero a esquerda', () => {
  assert.equal(core.pad2(3), '03');
  assert.equal(core.pad2(12), '12');
});

test('fmtDate e parseDate fazem ida e volta', () => {
  assert.equal(core.fmtDate(new Date(2026, 9, 8)), '2026-10-08');
  assert.equal(core.fmtDate(core.parseDate('2026-10-08')), '2026-10-08');
  assert.equal(core.fmtDate(new Date(2027, 0, 1)), '2027-01-01');
});

test('addDaysISO atravessa fim de mes e de ano', () => {
  assert.equal(core.addDaysISO('2026-10-08', 6), '2026-10-14');
  assert.equal(core.addDaysISO('2026-10-30', 3), '2026-11-02');
  assert.equal(core.addDaysISO('2026-12-30', 3), '2027-01-02');
});

test('fmtBR formata no padrao brasileiro', () => {
  assert.equal(core.fmtBR('2026-10-08'), '08/10/2026');
  assert.equal(core.fmtBR(''), '—');
});

/* ---------- texto e numeros ---------- */

test('esc neutraliza HTML', () => {
  assert.equal(core.esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  assert.equal(core.esc(null), '');
  assert.equal(core.esc(undefined), '');
  assert.equal(core.esc(0), '0');
});

test('toNum e toNumOrNull', () => {
  assert.equal(core.toNum('12'), 12);
  assert.equal(core.toNum('12.5'), 12.5);
  assert.equal(core.toNum('abc'), 0);
  assert.equal(core.toNum(null), 0);
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('0'), 0);
  assert.equal(core.toNumOrNull('27.5'), 27.5);
});

test('normalizeText ignora acentos, caixa e espacos', () => {
  assert.equal(core.normalizeText('Puxada Máquina'), 'puxada maquina');
  assert.equal(core.normalizeText('  ELEVAÇÃO Pélvica '), 'elevacao pelvica');
  assert.equal(core.normalizeText(null), '');
  assert.ok(core.normalizeText('Puxada Máquina').indexOf(core.normalizeText('puxada maquina')) === 0);
});

test('parseLocalNumber aceita virgula e ponto', () => {
  assert.equal(core.parseLocalNumber('27,5'), 27.5);
  assert.equal(core.parseLocalNumber('27.5'), 27.5);
  assert.equal(core.parseLocalNumber('1.100,50'), 1100.5);
  assert.equal(core.parseLocalNumber('12'), 12);
  assert.equal(core.parseLocalNumber(' 30 '), 30);
  assert.ok(Number.isNaN(core.parseLocalNumber('abc')));
  assert.ok(Number.isNaN(core.parseLocalNumber('')));
  assert.ok(Number.isNaN(core.parseLocalNumber(null)));
});

test('toNum e toNumOrNull aceitam virgula', () => {
  assert.equal(core.toNum('27,5'), 27.5);
  assert.equal(core.toNum('27,5') + core.toNum('2,5'), 30);
  assert.equal(core.toNumOrNull('27,5'), 27.5);
  assert.equal(core.toNumOrNull('0,5'), 0.5);
  assert.equal(core.toNumOrNull('0'), 0);
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('abc'), null);
});

test('formatDecimal mostra virgula quando o idioma usa virgula', () => {
  assert.equal(core.formatDecimal(27.5, true), '27,5');
  assert.equal(core.formatDecimal(27.5, false), '27.5');
  assert.equal(core.formatDecimal(27, true), '27');
  assert.equal(core.formatDecimal('27,5', true), '27,5');
  assert.equal(core.formatDecimal('', true), '');
  assert.equal(core.formatDecimal(null, true), '');
});

test('regressao: carga digitada com virgula (iPhone) nao perde a parte decimal', () => {
  const digitado = { load: '27,5', reps: '12', rir: '2' };
  const salvo = {
    load: core.toNumOrNull(digitado.load),
    reps: core.toNumOrNull(digitado.reps),
    rir: core.toNumOrNull(digitado.rir)
  };

  assert.deepEqual(salvo, { load: 27.5, reps: 12, rir: 2 });
  assert.equal(core.formatDecimal(salvo.load, true), '27,5', 'volta ao campo com virgula');
});

/* ---------- configuracoes e semana ---------- */

test('defaultSettings usa metas padrao e a semana comecando hoje', () => {
  const s = core.defaultSettings();
  assert.equal(s.id, 'app');
  assert.equal(s.weeklyWorkoutTarget, 3);
  assert.equal(s.weeklyCardioTarget, 120);
  assert.equal(s.weekAnchor, core.todayISO());
});

test('weekWindow cobre 7 dias (inclusive)', () => {
  assert.deepEqual(core.weekWindow('2026-10-08'), { anchor: '2026-10-08', end: '2026-10-14' });
  assert.deepEqual(core.weekWindow('2026-12-30'), { anchor: '2026-12-30', end: '2027-01-05' });
});

test('isValidWorkout aceita series ou cardio', () => {
  assert.equal(core.isValidWorkout({ sets: [{ reps: 12, load: 0 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 27 }] }), true);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 30 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 0, load: 0 }] }), false);
  assert.equal(core.isValidWorkout({}), false);
});

/* ---------- aquecimento e series ---------- */

test('warmupLine omite campos vazios e mantem zero', () => {
  assert.equal(core.warmupLine({ reps: 15, load: 20, rir: 3 }), '15 reps · 20 kg · RIR 3');
  assert.equal(core.warmupLine({ reps: 15, load: '', rir: '' }), '15 reps');
  assert.equal(core.warmupLine({ reps: 0, load: 0, rir: 0 }), '0 reps · 0 kg · RIR 0');
  assert.equal(core.warmupLine(null), '');
});

test('warmupHasData detecta aquecimento preenchido', () => {
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData({ reps: 15, load: '', rir: '' }), true);
  assert.equal(core.warmupHasData({ reps: '', load: 0, rir: '' }), true);
  assert.equal(core.warmupHasData(null), false);
});

test('warmupSummary conta os aquecimentos', () => {
  assert.equal(core.warmupSummary([]), '');
  assert.equal(core.warmupSummary(null), '');
  assert.equal(core.warmupSummary([{}]), '1 aquecimento');
  assert.equal(core.warmupSummary([{}, {}]), '2 aquecimentos');
});

test('setsSummaryLines devolve lista ordenada por serie e escapa a observacao', () => {
  const html = core.setsSummaryLines([
    { number: 2, reps: 10, load: 27, rir: 1, note: '' },
    { number: 1, reps: 12, load: 27, rir: 2, note: '<b>forte</b>' }
  ]);

  assert.ok(html.indexOf('<ul') === 0, 'e uma lista (ul)');
  assert.ok(html.indexOf('sheet-item-idx') !== -1, 'usa o mesmo estilo da lista de fichas');
  assert.ok(html.indexOf('12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(html.indexOf('10 reps · 27 kg · RIR 1') !== -1);
  assert.ok(html.indexOf('&lt;b&gt;forte&lt;/b&gt;') !== -1, 'observacao escapada');
  assert.ok(html.indexOf('12 reps') < html.indexOf('10 reps'), 'serie 1 antes da 2');
});

test('setsSummaryLines de lista vazia nao gera markup', () => {
  assert.equal(core.setsSummaryLines([]), '');
});

test('groupSets agrupa por exercicio, preserva a ordem e junta o aquecimento', () => {
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

/* ---------- historico por exercicio ---------- */

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

test('lastLoadsForExercise usa o treino mais recente, por numero de serie', () => {
  assert.deepEqual(core.lastLoadsForExercise(history, 'Puxada frente'), { 1: 45, 2: 50 });
  assert.deepEqual(core.lastLoadsForExercise(history, 'Inexistente'), {});
  assert.deepEqual(core.lastLoadsForExercise([], 'Puxada frente'), {});
});

test('previousWarmupFields traz reps e peso do aquecimento anterior (RIR vazio)', () => {
  assert.deepEqual(core.previousWarmupFields(history, 'Puxada frente'), { reps: 15, load: 25, rir: '' });
  assert.deepEqual(core.previousWarmupFields(history, 'Inexistente'), { reps: '', load: '', rir: '' });
});

test('sessionsForExercise ordena do mais recente e inclui sessoes so de aquecimento', () => {
  const withWarmupOnly = history.concat([
    { id: 'd', date: '2026-10-09', sets: [], warmups: [{ exerciseName: 'Puxada frente', reps: 15, load: 20, rir: 3 }] }
  ]);
  assert.deepEqual(core.sessionsForExercise(withWarmupOnly, 'Puxada frente').map(function (w) { return w.id; }), ['d', 'b', 'a']);
});

test('bestSetForExercise escolhe a maior carga e desempata por reps', () => {
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

/* ---------- exportar treino como texto ---------- */

test('workoutAsText monta a mensagem com o aquecimento dentro de cada exercicio', () => {
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

  assert.equal(lines[0], 'MEU TREINO — 08/10/2026');
  assert.equal(lines[1], 'Ficha: TREINO A - inferiores');
  assert.ok(text.indexOf('1. Elevação pélvica (obs.: pausa de 1s)') !== -1);
  assert.ok(text.indexOf('   Aquecimento: 15 reps · 20 kg · RIR 3') !== -1);
  assert.ok(text.indexOf('   Série 1: 12 reps · 27 kg · RIR 2') !== -1);
  assert.ok(text.indexOf('   Série 2: 10 reps · 27 kg · RIR 1 (caiu a força)') !== -1);
  assert.ok(text.indexOf('2. Esteira') !== -1, 'exercicio so com aquecimento tambem aparece');
  assert.ok(text.indexOf('Cardio: 30 min') !== -1);
  assert.ok(text.indexOf('Observações: treino leve') !== -1);
});

test('workoutAsText omite cardio, observacoes e ficha quando vazios', () => {
  const text = core.workoutAsText({
    date: '2026-10-08',
    sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20, rir: 2 }]
  });
  assert.equal(text.indexOf('Cardio'), -1);
  assert.equal(text.indexOf('Observações'), -1);
  assert.equal(text.indexOf('Ficha:'), -1);
  assert.ok(text.indexOf('1. X') !== -1);
});

/* ---------- referência por id (chave estrangeira) ---------- */

test('linkSheetItemsToExercises liga fichas antigas ao exercicio pelo nome', () => {
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
  assert.equal(result.sheets[0].exercises[1].exerciseId, undefined, 'nome desconhecido nao recebe id');
  assert.equal(result.sheets[0].exercises[2].exerciseId, 'ja-tinha', 'id existente e preservado');
  assert.deepEqual(result.sheets[0].exercises[0].reps, [12, 10, 8], 'nada mais muda');
});

test('linkSheetItemsToExercises nao liga quando o nome e ambiguo', () => {
  const sheets = [{ id: 's1', name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: [10], note: '' }] }];
  const exercises = [{ id: 'e1', name: 'Supino' }, { id: 'e2', name: 'supino' }];

  const result = core.linkSheetItemsToExercises(sheets, exercises);

  assert.equal(result.changed, 0);
  assert.equal(result.sheets[0].exercises[0].exerciseId, undefined);
});

test('renameInSheets atualiza por id e tambem fichas antigas pelo nome', () => {
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
  assert.equal(result.sheets[0].exercises[1].exerciseId, 'e1', 'item antigo ganha a referencia');
  assert.equal(result.sheets[0].exercises[2].name, 'Outro', 'outros exercicios nao mudam');
});

test('renameInSheets e idempotente', () => {
  const sheets = [{ id: 's1', name: 'A', exercises: [{ exerciseId: 'e1', name: 'Antigo', sets: 3, reps: [12], note: '' }] }];

  const once = core.renameInSheets(sheets, 'e1', 'Antigo', 'Novo');
  const twice = core.renameInSheets(once.sheets, 'e1', 'Antigo', 'Novo');

  assert.equal(twice.changed, 0);
  assert.deepEqual(twice.sheets, once.sheets);
});

test('renameInWorkouts atualiza o historico que aponta para o id', () => {
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
  assert.equal(result.workouts[1].sets[0].exerciseName, 'Puxada frente', 'registro antigo (sem id) nao e reescrito');
  assert.equal(result.workouts[1].sets[0].load, 45, 'nenhum dado do treino muda');
});

test('renameInWorkouts sem id nao altera nada', () => {
  const workouts = [{ id: 'w', date: '2026-10-01', sets: [{ exerciseId: null, exerciseName: 'X', number: 1, reps: 10, load: 20, rir: 2 }] }];

  const result = core.renameInWorkouts(workouts, null, 'Y');

  assert.equal(result.changed, 0);
  assert.deepEqual(result.workouts, workouts);
});

test('regressao: renomear exercicio reflete na ficha antiga (dados ja existentes)', () => {
  const sheets = [{
    id: 's1', name: 'TREINO A - inferiores',
    exercises: [{ name: 'Elevação pelvica', sets: 3, reps: [12, 10, 8], note: 'pausa de 1s' }]
  }];
  const exercises = [{ id: 'e1', name: 'Elevação pelvica' }];

  const linked = core.linkSheetItemsToExercises(sheets, exercises);
  assert.equal(linked.sheets[0].exercises[0].exerciseId, 'e1', 'migracao da ficha antiga');

  const renamed = core.renameInSheets(linked.sheets, 'e1', 'Elevação pelvica', 'Elevação pélvica (glúteo)');

  assert.equal(renamed.sheets[0].exercises[0].name, 'Elevação pélvica (glúteo)');
  assert.equal(renamed.sheets[0].exercises[0].exerciseId, 'e1');
  assert.deepEqual(renamed.sheets[0].exercises[0].reps, [12, 10, 8]);
  assert.equal(renamed.sheets[0].exercises[0].note, 'pausa de 1s');
});

/* ---------- backup ---------- */

/* ---------- backup ---------- */

test('backupFileName inclui data e hora (diferencia backups do mesmo dia)', () => {
  const manha = core.backupFileName(new Date(2026, 9, 12, 9, 5, 7));
  const tarde = core.backupFileName(new Date(2026, 9, 12, 13, 35, 42));

  assert.equal(manha, 'meu-treino-backup-2026-10-12_09-05-07.json');
  assert.equal(tarde, 'meu-treino-backup-2026-10-12_13-35-42.json');
  assert.notEqual(manha, tarde);
  assert.ok(/^meu-treino-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(tarde), 'formato estavel');
  assert.ok(!/[:\/\\]/.test(tarde), 'nome valido em qualquer sistema de arquivos');
});

test('backupFileName funciona sem argumento (agora)', () => {
  const nome = core.backupFileName();
  assert.ok(/^meu-treino-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(nome));
});

test('fmtDateTimeBR mostra data e hora locais', () => {
  const local = new Date(2026, 9, 12, 13, 35, 0);

  assert.equal(core.fmtDateTimeBR(local.toISOString()), '12/10/2026 13:35');
  assert.equal(core.fmtDateTimeBR(''), '');
  assert.equal(core.fmtDateTimeBR('nao eh data'), '');
});

test('backupStatus: sem backup, avisa', () => {
  const info = core.backupStatus({}, new Date(2026, 9, 12, 10, 0), 7);

  assert.equal(info.lastBackupAt, null);
  assert.equal(info.daysSince, null);
  assert.equal(info.overdue, true);
  assert.match(info.label, /nenhum backup/i);
});

test('backupStatus: conta os dias e avisa depois do limite', () => {
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
  assert.equal(noLimite.overdue, true, 'no dia do limite ja avisa');
});

test('backupAction decide entre compartilhar e baixar (uma acao = um arquivo)', () => {
  assert.equal(core.backupAction({ canShareFiles: true, touch: true }), 'share', 'celular que sabe compartilhar');
  assert.equal(core.backupAction({ canShareFiles: true, touch: false }), 'download', 'computador baixa direto');
  assert.equal(core.backupAction({ canShareFiles: false, touch: true }), 'download', 'sem suporte a arquivos');
  assert.equal(core.backupAction({ canShareFiles: false, touch: false }), 'download');
  assert.equal(core.backupAction(), 'download');
  assert.equal(core.backupAction({}), 'download');
});

test('backupSharePayload manda so o arquivo, sem text nem title (.txt fantasma)', () => {
  const payload = core.backupSharePayload({ name: 'meu-treino-backup.json' });

  assert.deepEqual(Object.keys(payload), ['files'], 'apenas o arquivo');
  assert.equal(payload.files.length, 1);
  assert.equal(payload.files[0].name, 'meu-treino-backup.json');
  assert.ok(!('text' in payload), 'sem text: alguns aparelhos salvam o texto como .txt');
  assert.ok(!('title' in payload), 'sem title: o sistema nomeia um .txt a partir do titulo');
});

test('isBackupPayload ignora o evento de clique (bug do botao de backup)', () => {
  assert.equal(core.isBackupPayload({ json: '{}', name: 'meu-treino-backup.json' }), true);
  assert.equal(core.isBackupPayload(null), false);
  assert.equal(core.isBackupPayload(undefined), false);
  assert.equal(core.isBackupPayload({}), false);
  assert.equal(core.isBackupPayload({ type: 'click', target: {} }), false, 'evento de clique nao e um backup');
  assert.equal(core.isBackupPayload({ json: '{}' }), false, 'sem nome de arquivo');
  assert.equal(core.isBackupPayload({ name: 'x.json' }), false, 'sem json');
});

test('backupHint explica o que o botao Exportar vai fazer', () => {
  assert.match(core.backupHint('share'), /Drive/);
  assert.match(core.backupHint('share'), /WhatsApp/);
  assert.match(core.backupHint('download'), /Baixa o arquivo/);
  assert.equal(core.backupHint('qualquer'), core.backupHint('download'));
});

test('sheetLabel mostra o nome ATUAL da ficha (renomear reflete na visao geral)', () => {
  const sheets = [{ id: 's1', name: 'Peito e triceps' }, { id: 's2', name: 'Pernas' }];

  assert.equal(core.sheetLabel({ sheetId: 's1', sheetName: 'Nome antigo' }, sheets), 'Peito e triceps');
  assert.equal(core.sheetLabel({ sheetId: 's2' }, sheets), 'Pernas');
  assert.equal(core.sheetLabel({ sheetId: 's9', sheetName: 'Ficha excluida' }, sheets), 'Ficha excluida', 'ficha excluida mantem o nome do registro');
  assert.equal(core.sheetLabel({ sheetName: 'Sem id (dados antigos)' }, sheets), 'Sem id (dados antigos)');
  assert.equal(core.sheetLabel({ typeName: 'Treino A (v1)' }, sheets), 'Treino A (v1)');
  assert.equal(core.sheetLabel({}, sheets), '');
  assert.equal(core.sheetLabel(null, null), '');
  assert.equal(core.sheetLabel({ sheetId: 's1' }, null), '', 'sem fichas carregadas nao inventa nome');
});

test('workoutAsText usa o nome atual da ficha', () => {
  const workout = { date: '2026-10-12', sheetId: 's1', sheetName: 'Nome antigo', sets: [], warmups: [] };
  const sheets = [{ id: 's1', name: 'Peito e triceps' }];

  const atual = core.workoutAsText(workout, sheets);
  assert.match(atual, /Ficha: Peito e triceps/);
  assert.ok(atual.indexOf('Nome antigo') === -1);

  assert.match(core.workoutAsText(workout), /Ficha: Nome antigo/, 'sem a lista de fichas usa o nome guardado');
});

/* ---------- referência por id (nome sempre atual) ---------- */

test('exerciseLabel usa o nome atual pelo id e cai no nome guardado', () => {
  const lib = [{ id: 15, name: 'Remada baixa' }, { id: 'u1', name: 'Meu exercicio' }];

  assert.equal(core.exerciseLabel({ exerciseId: 15, exerciseName: 'Nome antigo' }, lib), 'Remada baixa');
  assert.equal(core.exerciseLabel({ exerciseId: 'u1' }, lib), 'Meu exercicio');
  assert.equal(core.exerciseLabel({ exerciseId: 99, exerciseName: 'Excluido' }, lib), 'Excluido', 'id que nao existe mais');
  assert.equal(core.exerciseLabel({ exerciseName: 'Antigo sem id' }, lib), 'Antigo sem id');
  assert.equal(core.exerciseLabel({ name: 'Campo name' }, lib), 'Campo name');
  assert.equal(core.exerciseLabel({}, lib), '');
  assert.equal(core.exerciseLabel(null, null), '');
});

test('exerciseTarget normaliza string, objeto e vazio', () => {
  assert.deepEqual(core.exerciseTarget('Puxada'), { exerciseId: null, exerciseName: 'Puxada' });
  assert.deepEqual(core.exerciseTarget({ exerciseId: 3, exerciseName: 'X' }), { exerciseId: 3, exerciseName: 'X' });
  assert.deepEqual(core.exerciseTarget({ exerciseId: 3, name: 'Y' }), { exerciseId: 3, exerciseName: 'Y' });
  assert.deepEqual(core.exerciseTarget(), { exerciseId: null, exerciseName: '' });
  assert.deepEqual(core.exerciseTarget(null), { exerciseId: null, exerciseName: '' });
});

test('exerciseMatches compara por id quando os dois tem id', () => {
  assert.equal(core.exerciseMatches({ exerciseId: 7, exerciseName: 'Antigo' }, { exerciseId: 7, exerciseName: 'Novo' }), true);
  assert.equal(core.exerciseMatches({ exerciseId: 7, exerciseName: 'Antigo' }, { exerciseId: 8, exerciseName: 'Antigo' }), false, 'mesmo nome, ids diferentes');
  assert.equal(core.exerciseMatches({ exerciseName: 'Antigo' }, { exerciseId: 7, exerciseName: 'Antigo' }), true, 'registro antigo sem id cai no nome');
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, 'X'), true);
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, 'Y'), false);
  assert.equal(core.exerciseMatches({}, {}), false, 'nada para comparar');
  assert.equal(core.exerciseMatches(null, null), false);
});

test('exerciseKey usa id quando existe e nome como fallback', () => {
  assert.equal(core.exerciseKey({ exerciseId: 5, exerciseName: 'X' }), 'id:5');
  assert.equal(core.exerciseKey({ exerciseName: 'X' }), 'nome:X');
  assert.equal(core.exerciseKey({}), 'nome:(sem nome)');
});

test('groupSets separa exercicios diferentes com o mesmo nome (por id)', () => {
  const groups = core.groupSets([
    { exerciseId: 1, exerciseName: 'Rosca', number: 1, reps: 10, load: 10 },
    { exerciseId: 2, exerciseName: 'Rosca', number: 1, reps: 10, load: 20 }
  ], []);

  assert.equal(groups.length, 2, 'nao junta exercicios diferentes so porque o nome e igual');
  assert.equal(groups[0].exerciseId, 1);
  assert.equal(groups[1].exerciseId, 2);
});

test('groupSets casa o aquecimento pelo id (mesmo com nome antigo)', () => {
  const groups = core.groupSets(
    [{ exerciseId: 5, exerciseName: 'Nome antigo', number: 1, reps: 10, load: 30 }],
    [{ exerciseId: 5, exerciseName: 'Nome novo', reps: 15, load: 10, rir: 3 }]
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].warmup, { reps: 15, load: 10, rir: 3 });
});

test('groupSets cria grupo para exercicio so com aquecimento (nao perde ao editar)', () => {
  const groups = core.groupSets([], [{ exerciseId: 9, exerciseName: 'Esteira', reps: 5, load: 0, rir: 4 }]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].exerciseName, 'Esteira');
  assert.equal(groups[0].sets.length, 0);
  assert.deepEqual(groups[0].warmup, { reps: 5, load: 0, rir: 4 });
});

test('groupSets junta registros antigos sem id pelo nome', () => {
  const groups = core.groupSets([
    { exerciseName: 'Leg', number: 1, reps: 10, load: 100 },
    { exerciseName: 'Leg', number: 2, reps: 8, load: 110 }
  ], [{ exerciseName: 'Leg', reps: 15, load: 50, rir: 3 }]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].exerciseId, null);
  assert.equal(groups[0].sets.length, 2);
  assert.deepEqual(groups[0].warmup, { reps: 15, load: 50, rir: 3 });
});

test('historico por id: renomear o exercicio nao perde nem separa o historico', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseId: 5, exerciseName: 'Nome antigo', number: 1, reps: 10, load: 40 }] },
    { id: 'b', date: '2026-10-08', sets: [{ exerciseId: 5, exerciseName: 'Nome novo', number: 1, reps: 10, load: 45 }] }
  ];
  const target = { exerciseId: 5, exerciseName: 'Nome novo' };

  assert.deepEqual(core.lastLoadsForExercise(workouts, target), { 1: 45 });
  assert.deepEqual(core.sessionsForExercise(workouts, target).map(function (w) { return w.id; }), ['b', 'a']);
  assert.deepEqual(core.bestSetForExercise(workouts[0], target), { load: 40, reps: 10 });
});

test('historico nao mistura exercicios diferentes com o mesmo nome', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseId: 1, exerciseName: 'Rosca', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-08', sets: [{ exerciseId: 2, exerciseName: 'Rosca', number: 1, reps: 10, load: 99 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(workouts, { exerciseId: 1, exerciseName: 'Rosca' }), { 1: 10 });
  assert.equal(core.sessionsForExercise(workouts, { exerciseId: 1, exerciseName: 'Rosca' }).length, 1);
});

test('lastWarmupForExercise busca pelo id (registro com nome antigo)', () => {
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

test('workoutAsText usa o nome atual do exercicio e agrupa por id', () => {
  const workout = {
    date: '2026-10-08',
    sets: [
      { exerciseId: 5, exerciseName: 'Antigo', number: 1, reps: 10, load: 30 },
      { exerciseId: 5, exerciseName: 'Antigo', number: 2, reps: 8, load: 35 }
    ]
  };

  const text = core.workoutAsText(workout, [], [{ id: 5, name: 'Remada baixa' }]);

  assert.ok(text.indexOf('1. Remada baixa') !== -1);
  assert.equal(text.indexOf('Antigo'), -1, 'nome congelado nao aparece');
  assert.ok(text.indexOf('2. ') === -1, 'series agrupadas por id em um unico exercicio');
  assert.ok(text.indexOf('8 reps') !== -1);
});

test('linkSheetItemsToExercises acha tambem no catalogo (e nao liga quando e ambiguo)', () => {
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

  assert.equal(resultado.changed, 2, 'so os dois nomes que existem no catalogo');
  assert.equal(resultado.sheets[0].exercises[0].exerciseId, 887, 'grava o id numerico do catalogo');
  assert.equal(resultado.sheets[0].exercises[1].exerciseId, 719);
  assert.equal(resultado.sheets[0].exercises[2].exerciseId, null, 'nome digitado a mao continua sem id');

  const ambiguo = core.linkSheetItemsToExercises(
    [{ id: 's2', exercises: [{ exerciseId: null, name: 'Bike', sets: 1, reps: [], note: '' }] }],
    biblioteca.concat([{ id: 999, name: 'Bike', group: 'Outros' }])
  );

  assert.equal(ambiguo.changed, 0, 'mesmo nome na biblioteca e no catalogo: nao adivinha');
  assert.equal(ambiguo.sheets[0].exercises[0].exerciseId, null);
});

/* ---------- biblioteca do usuario ---------- */

test('isUserExercise nao esconde exercicio criado pelo usuario', () => {
  assert.equal(core.isUserExercise({ id: 'e1', name: 'Puxada frente supinada' }), true, 'sem source = criado pelo usuario');
  assert.equal(core.isUserExercise({ id: 'e2', name: 'X', source: 'custom' }), true);
  assert.equal(core.isUserExercise({ id: 'e3', name: 'X', source: 'catalog' }), true, 'marcado sem catalogId nao pode esconder');
  assert.equal(core.isUserExercise({ id: 'e4', name: 'X', source: 'catalog', catalogId: 887 }), false, 'do catalogo com comprovacao');
  assert.equal(core.isUserExercise(null), false);
});

test('libraryExercises lista os exercicios do usuario e ignora inativos', () => {
  const list = core.libraryExercises([
    { id: 'a', name: 'Elevação pélvica' },
    { id: 'b', name: 'Puxada frente supinada', source: 'catalog' },
    { id: 'c', name: 'Do catálogo', source: 'catalog', catalogId: 1 },
    { id: 'd', name: 'Inativo', active: false },
    null
  ]);
  assert.deepEqual(list.map(function (e) { return e.id; }), ['a', 'b']);
});

test('exercisesNeedingRepair aponta so as marcacoes sem comprovacao', () => {
  const need = core.exercisesNeedingRepair([
    { id: 'a', source: 'catalog' },
    { id: 'b', source: 'catalog', catalogId: 5 },
    { id: 'c', source: 'custom' },
    { id: 'd' }
  ]);
  assert.deepEqual(need.map(function (e) { return e.id; }), ['a']);
});

test('regressao: exercicio do usuario com nome igual ao do catalogo continua visivel', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const nomeDoCatalogo = catalog.exercises[0].name;
  const meu = { id: 'meu', name: nomeDoCatalogo, correction: '' };

  assert.equal(core.isUserExercise(meu), true);
  assert.equal(core.libraryExercises([meu]).length, 1);
  assert.deepEqual(core.exercisesNeedingRepair([meu]), []);
});

/* ---------- compatibilidade de dados entre versoes ---------- */

test('backup v1 (tipos de treino) migra para fichas sem perder dados', () => {
  const data = loadFixture('backup-v1.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 2, 'tipos de treino viram fichas');
  assert.equal(normalized.sheets[0].name, 'TREINO A - inferiores');
  assert.deepEqual(normalized.sheets[0].exercises, []);

  assert.equal(normalized.workouts.length, 2);
  const w = normalized.workouts[0];
  assert.equal(w.sheetId, 't1');
  assert.equal(w.sheetName, 'TREINO A - inferiores');
  assert.equal(w.typeId, undefined, 'campo antigo removido');
  assert.equal(w.typeName, undefined, 'campo antigo removido');
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

test('backup v1 nao perde nenhuma serie', () => {
  const data = loadFixture('backup-v1.json').data;
  const before = data.workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  const after = core.normalizeBackup(data).workouts.reduce(function (acc, w) { return acc + w.sets.length; }, 0);
  assert.equal(after, before);
});

test('backup v2 (ficha com reps unico) normaliza reps por serie', () => {
  const data = loadFixture('backup-v2-sheets.json').data;
  const normalized = core.normalizeBackup(data);

  assert.equal(normalized.sheets.length, 1);
  const items = normalized.sheets[0].exercises;

  assert.equal(items[0].name, 'Elevação pélvica');
  assert.equal(items[0].sets, 3);
  assert.deepEqual(items[0].reps, [12, 12, 12], 'reps unico vale para todas as series');
  assert.equal(items[0].load, undefined, 'carga saiu da ficha');
  assert.equal(items[0].rir, undefined, 'RIR saiu da ficha');
  assert.equal(items[0].note, 'pausa de 1s');

  assert.deepEqual(items[1].reps, [12, 10, 8], 'reps por serie preservadas');

  assert.equal(normalized.workouts[0].sheetName, 'TREINO A - inferiores');
  assert.equal(normalized.workouts[0].sets[0].load, 30);
});

test('normalizeBackup e idempotente (normalizar duas vezes nao muda nada)', () => {
  ['backup-v1.json', 'backup-v2-sheets.json'].forEach(function (name) {
    const data = loadFixture(name).data;
    const once = core.normalizeBackup(data);
    const twice = core.normalizeBackup(once);
    assert.deepEqual(twice, once, name + ' nao ficou estavel');
  });
});

test('backup no formato atual faz ida e volta sem perder dados', () => {
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

test('normalizeBackup lida com backup vazio ou invalido sem quebrar', () => {
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

test('itens invalidos (sem id) sao descartados', () => {
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

/* ---------- catalogo embutido ---------- */

test('catalogo mantem ids unicos, contiguos e estaveis entre versoes', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exercises.json'), 'utf8'));
  const items = catalog.exercises;

  assert.equal(items.length, 927);
  assert.equal(catalog.meta.nextId, 928, 'proximo id livre para novos exercicios');

  const ids = items.map(function (i) { return i.id; });
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados no catalogo');
  const sorted = ids.slice().sort(function (a, b) { return a - b; });
  assert.equal(sorted[0], 1);
  assert.equal(sorted[sorted.length - 1], 927);

  // Trava de compatibilidade: estes ids nao podem ser renumerados entre versoes.
  const byId = {};
  items.forEach(function (i) { byId[i.id] = i.name; });
  assert.equal(byId[1], 'Abdominais');
  assert.equal(byId[870], 'Abdominal infra');
  assert.equal(byId[887], 'Puxada frente supinada');
  assert.equal(byId[927], 'Tríceps testa');

  items.forEach(function (i) {
    assert.ok(i.name, 'todo exercicio tem nome');
    assert.ok(i.group, 'todo exercicio tem grupo');
    assert.ok(i.sourceId, 'todo exercicio guarda o sourceId de origem');
  });
});
