'use strict';

/* Testes de borda do core: cobrem os caminhos de fallback (dados ausentes ou invalidos).
   Mantem a cobertura de js/core.js em 100%: cada ramo defensivo tem um caso aqui. */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

test('formatDecimal devolve vazio quando nao e numero', () => {
  assert.equal(core.formatDecimal('abc'), '');
  assert.equal(core.formatDecimal(undefined), '');
  assert.equal(core.formatDecimal(''), '');
});

test('weekWindow sem argumento usa hoje como ancora', () => {
  const janela = core.weekWindow();

  assert.equal(janela.anchor, core.todayISO());
  assert.equal(janela.end, core.addDaysISO(janela.anchor, 6));
});

test('setLine mostra travessao quando nao ha reps', () => {
  assert.equal(core.setLine({ reps: null, load: null, rir: null }), '—');
  assert.equal(core.setLine({}), '—');
});

test('setsSummaryLines sem series nao gera markup e aceita serie sem numero', () => {
  assert.equal(core.setsSummaryLines(), '');
  assert.equal(core.setsSummaryLines([]), '');

  const html = core.setsSummaryLines([
    { number: 3, reps: 6 },
    { number: 1, reps: 12 },
    { reps: 10, note: 'subiu' }
  ]);

  assert.ok(html.indexOf('>?</span>') !== -1, 'serie sem numero usa ?');
  assert.ok(html.indexOf('12 reps') !== -1);
  assert.ok(html.indexOf('>?</span>') < html.indexOf('12 reps'), 'sem numero conta como 0 e vem primeiro');
  assert.ok(html.indexOf('12 reps') < html.indexOf('6 reps'), 'ordena por numero da serie');
});

test('groupSets sem series nem aquecimentos devolve lista vazia', () => {
  assert.deepEqual(core.groupSets(), []);
  assert.deepEqual(core.groupSets([], []), []);
});

test('groupSets usa "(sem nome)" quando o registro nao tem nome', () => {
  const grupos = core.groupSets([{ number: 1, reps: 10, load: 20 }], [{ exerciseName: 'Esteira', reps: 15, load: 10 }]);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].exerciseName, '(sem nome)');
  assert.equal(grupos[1].exerciseName, 'Esteira');

  const soAquecimento = core.groupSets([], [{ reps: 15 }]);
  assert.equal(soAquecimento.length, 1);
  assert.equal(soAquecimento[0].exerciseName, '(sem nome)', 'aquecimento sem nome tambem tem grupo');
});

test('groupSets guarda a observacao da primeira serie que tem observacao', () => {
  const grupos = core.groupSets([
    { exerciseName: 'Leg press 45', number: 1, reps: 10 },
    { exerciseName: 'Leg press 45', number: 2, reps: 8, exerciseNote: 'pausa de 1s' },
    { exerciseName: 'Leg press 45', number: 3, reps: 6, exerciseNote: 'outra observacao' }
  ], []);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].note, 'pausa de 1s');
});

test('groupSets acha o grupo pelo nome quando o aquecimento antigo nao tem id', () => {
  const grupos = core.groupSets(
    [{ exerciseId: 5, exerciseName: 'Remada baixa', number: 1, reps: 10 }],
    [{ exerciseName: 'Remada baixa', reps: 15, load: 10, rir: 3 }]
  );

  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].warmup, { reps: 15, load: 10, rir: 3 });
});

test('historico ignora treinos sem series ou sem aquecimento', () => {
  const treinos = [{ id: 'x', date: '2026-10-01' }, { id: 'y', date: '2026-10-02', sets: [], warmups: [] }];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'Nada'), {});
  assert.equal(core.lastWarmupForExercise(treinos, 'Nada'), null);
  assert.deepEqual(core.sessionsForExercise(treinos, 'Nada'), []);
  assert.equal(core.bestSetForExercise(null, 'Nada'), null);
  assert.equal(core.bestSetForExercise({}, 'Nada'), null);
});

test('historico ordena dos dois lados (mais recente primeiro)', () => {
  const crescente = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] }
  ];
  const decrescente = [crescente[1], crescente[0]];

  assert.equal(core.sessionsForExercise(crescente, 'X')[0].id, 'b');
  assert.equal(core.sessionsForExercise(decrescente, 'X')[0].id, 'b');
  assert.equal(core.lastWarmupForExercise(crescente, 'X'), null, 'treino sem aquecimento');
});

test('workoutAsText mostra serie sem numero', () => {
  const texto = core.workoutAsText({
    date: '2026-10-12',
    sets: [{ exerciseName: 'Leg press 45', reps: 10, load: 100, note: 'subiu' }]
  });

  assert.ok(texto.indexOf('Série ?: 10 reps · 100 kg (subiu)') !== -1);
});

test('materializeSampleData cria settings e aceita a data informada', () => {
  const dados = core.materializeSampleData({
    workouts: [{ id: 'w1', dayOffset: -2 }, { id: 'w2' }]
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-10');
  assert.equal(dados.workouts[0].dayOffset, undefined);
  assert.equal(dados.workouts[1].date, undefined, 'treino sem dayOffset nao muda');
  assert.equal(dados.settings.id, 'app');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('materializeSampleData sem argumentos nao quebra', () => {
  const dados = core.materializeSampleData();

  assert.equal(dados.settings.id, 'app');
  assert.deepEqual(dados.workouts || [], []);
});

test('linkSheetItemsToExercises ignora exercicio sem nome e ficha sem itens', () => {
  const exercicios = [{ id: 'e1', name: '' }, { id: 'e2' }, { id: 'e3', name: 'Supino' }];
  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [{ name: 'Supino' }] }];

  const resultado = core.linkSheetItemsToExercises(fichas, exercicios);

  assert.equal(resultado.changed, 1);
  assert.equal(resultado.sheets[1].exercises[0].exerciseId, 'e3');
  assert.equal(resultado.sheets[0].exercises, undefined, 'ficha sem itens passa direto');

  assert.deepEqual(core.linkSheetItemsToExercises(), { sheets: [], changed: 0 });
});

test('renameInSheets sem fichas ou sem nome antigo nao muda nada', () => {
  assert.deepEqual(core.renameInSheets(), { sheets: [], changed: 0 });

  const fichas = [{ id: 's1', name: 'A' }, { id: 's2', name: 'B', exercises: [] }];
  assert.deepEqual(core.renameInSheets(fichas, 'e1', 'Antigo', 'Novo'), { sheets: fichas, changed: 0 });
});

test('renameInWorkouts ignora treinos sem series e ids diferentes', () => {
  const treinos = [
    { id: 'w1' },
    { id: 'w2', sets: [{ exerciseId: 9, exerciseName: 'Outro' }], warmups: [{ exerciseId: 9, exerciseName: 'Outro' }] }
  ];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
  assert.equal(core.renameInWorkouts().changed, 0);
});

test('backupStatus sem argumentos usa hoje e o limite padrao', () => {
  const info = core.backupStatus();

  assert.equal(info.lastBackupAt, null);
  assert.equal(info.overdue, true);
  assert.match(info.label, /nenhum backup/i);
});

test('backupStatus respeita limite e data informados', () => {
  const agora = new Date(2026, 9, 12, 10, 0);
  const info = core.backupStatus({ lastBackupAt: new Date(2026, 9, 11, 10, 0).toISOString() }, agora, 1);

  assert.equal(info.daysSince, 1);
  assert.equal(info.overdue, true, 'limite de 1 dia');
});

test('libraryExercises e exercisesNeedingRepair aceitam lista ausente', () => {
  assert.deepEqual(core.libraryExercises(), []);
  assert.deepEqual(core.exercisesNeedingRepair(), []);
  assert.deepEqual(core.libraryExercises([null, { id: 'e1', name: 'X', source: 'catalog', catalogId: 3 }]), []);
  assert.deepEqual(core.exercisesNeedingRepair([null, { id: 'e1', name: 'X' }]), []);
});

test('normalizacao descarta itens invalidos e completa campos ausentes', () => {
  const backup = core.normalizeBackup({
    workouts: [null, { id: 'w1', sets: [null, { reps: 10 }], warmups: [null, { reps: 15 }] }],
    sheets: [null, { id: 's1', exercises: [{ sets: 2 }, null] }],
    exercises: [null, { id: 'e1' }],
    colinha: [null]
  });

  assert.equal(backup.workouts.length, 1);
  assert.equal(backup.workouts[0].sets.length, 1);
  assert.equal(backup.workouts[0].sets[0].exerciseName, '(sem nome)');
  assert.equal(backup.workouts[0].sets[0].number, 2, 'numero cai na posicao do registro');
  assert.equal(backup.workouts[0].warmups.length, 1);
  assert.equal(backup.workouts[0].warmups[0].exerciseName, '(sem nome)');

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].exercises.length, 1);
  assert.deepEqual(backup.sheets[0].exercises[0].reps, [null, null], 'completa as series sem reps');
  assert.equal(backup.sheets[0].exercises[0].name, '');

  assert.equal(backup.exercises.length, 1);
  assert.equal(backup.exercises[0].name, '');
  assert.equal(backup.exercises[0].group, 'Outros');
  assert.deepEqual(backup.colinha, []);
});

test('normalizeBackup cobre ficha v2 (reps unico) e metas ausentes', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', exercises: [{ reps: 12, sets: 3 }] }],
    settings: { weeklyCardioTarget: 0 }
  });

  assert.deepEqual(backup.sheets[0].exercises[0].reps, [12, 12, 12]);
  assert.equal(backup.settings.weeklyWorkoutTarget, 3);
  assert.equal(backup.settings.weeklyCardioTarget, 0, 'zero e um alvo valido');
  assert.equal(backup.settings.weekAnchor, core.todayISO());
});

test('exerciseKey e exerciseMatches aceitam registro vazio', () => {
  assert.equal(core.exerciseKey(), 'nome:(sem nome)');
  assert.equal(core.exerciseMatches({ exerciseId: 1, exerciseName: '' }, { exerciseName: 'X' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: '' }), false);
});

test('aquecimento sem nenhum campo nao conta como preenchido', () => {
  assert.equal(core.warmupHasData({ reps: null, load: null, rir: null }), false);
  assert.equal(core.warmupHasData({ reps: '', load: '', rir: '' }), false);
  assert.equal(core.warmupHasData(undefined), false);
  assert.equal(core.warmupHasData({ reps: 0 }), true, 'zero e um valor preenchido');
});

test('renameInWorkouts com lista ausente devolve lista vazia', () => {
  assert.deepEqual(core.renameInWorkouts(null, 5, 'Novo'), { workouts: [], changed: 0 });
  assert.deepEqual(core.renameInWorkouts(undefined, 5, 'Novo'), { workouts: [], changed: 0 });
});

test('materializeSampleData aceita payload com data e settings prontos', () => {
  const dados = core.materializeSampleData({
    data: {
      workouts: [{ id: 'w1', dayOffset: 0 }],
      settings: { id: 'app', weeklyWorkoutTarget: 4 }
    }
  }, '2026-10-12');

  assert.equal(dados.workouts[0].date, '2026-10-12');
  assert.equal(dados.settings.weeklyWorkoutTarget, 4, 'settings existentes sao preservados');
  assert.equal(dados.settings.weekAnchor, '2026-10-10');
});

test('historico ordena listas maiores nas duas direcoes', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-03', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] },
    { id: 'c', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 30 }] }
  ];

  assert.deepEqual(core.sessionsForExercise(treinos, 'X').map(function (w) { return w.id; }), ['c', 'b', 'a']);
  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), { 1: 30 });

  const comAquecimento = treinos.map(function (w) {
    return Object.assign({}, w, { warmups: [{ exerciseName: 'X', reps: 15, load: 10, rir: 3 }] });
  });

  assert.deepEqual(core.lastWarmupForExercise(comAquecimento, 'X').load, 10);
  assert.deepEqual(core.lastWarmupForExercise(comAquecimento.slice().reverse(), 'X').load, 10);
});

test('ultima carga ignora series com carga zero', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] },
    { id: 'b', date: '2026-10-02', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 0 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), {}, 'carga zero nao vira sugestao');
});

test('workoutAsText sem series nem aquecimento mostra so o cabecalho', () => {
  const texto = core.workoutAsText({ date: '2026-10-12', sets: [], warmups: [] });

  assert.equal(texto, 'MEU TREINO — 12/10/2026');
});

test('normalizeBackup converte tipos de treino (v1) e mantem datas', () => {
  const backup = core.normalizeBackup({
    workoutTypes: [{ id: 't1', name: 'TREINO A', active: false, createdAt: '2026-01-01' }],
    workouts: [{ id: 'w1', typeId: 't1', typeName: 'TREINO A', date: '2026-10-01' }]
  });

  assert.equal(backup.sheets.length, 1);
  assert.equal(backup.sheets[0].id, 't1');
  assert.equal(backup.sheets[0].active, false);
  assert.deepEqual(backup.sheets[0].exercises, []);
  assert.equal(backup.workouts[0].sheetId, 't1', 'typeId vira sheetId');
  assert.equal(backup.workouts[0].sheetName, 'TREINO A');
  assert.equal(backup.workouts[0].typeId, undefined);
});

test('normalizeBackup aceita ficha inativa e exercicio inativo', () => {
  const backup = core.normalizeBackup({
    sheets: [{ id: 's1', name: 'A', active: false }],
    exercises: [{ id: 'e1', name: 'X', active: false }]
  });

  assert.equal(backup.sheets[0].active, false);
  assert.equal(backup.exercises[0].active, false);
  assert.equal(core.libraryExercises(backup.exercises).length, 0, 'inativo nao aparece na biblioteca');
});

test('parseLocalNumber e toNumOrNull com valores vazios ou invalidos', () => {
  assert.equal(core.parseLocalNumber(''), Number.NaN);
  assert.equal(core.parseLocalNumber('   '), Number.NaN);
  assert.equal(core.parseLocalNumber(null), Number.NaN);
  assert.equal(core.parseLocalNumber(undefined), Number.NaN);
  assert.equal(core.parseLocalNumber('12,5'), 12.5);
  assert.equal(core.parseLocalNumber('1.234,5'), 1234.5, 'formato brasileiro');
  assert.equal(core.parseLocalNumber('1,234.5'), 1.2345, 'entrada ambigua segue a leitura pt-BR (ponto = milhar)');
  assert.equal(core.toNumOrNull(''), null);
  assert.equal(core.toNumOrNull('abc'), null);
  assert.equal(core.toNumOrNull(0), 0);
  assert.equal(core.formatDecimal(0), '0');
  assert.equal(core.formatDecimal(2.5, true), '2,5');
});

test('renameInWorkouts nao mexe quando o nome ja esta atualizado', () => {
  const treinos = [{
    id: 'w1',
    sets: [{ exerciseId: 5, exerciseName: 'Novo', number: 1, reps: 10, load: 30 }],
    warmups: [{ exerciseId: 5, exerciseName: 'Novo', reps: 15, load: 10, rir: 3 }]
  }];

  const resultado = core.renameInWorkouts(treinos, 5, 'Novo');

  assert.equal(resultado.changed, 0);
  assert.deepEqual(resultado.workouts, treinos);
});

test('isValidWorkout distingue treino vazio de treino so com cardio', () => {
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 0 }), false);
  assert.equal(core.isValidWorkout({ sets: [], cardioMinutes: 20 }), true);
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10 }] }), true, 'serie vazia nao conta');
  assert.equal(core.isValidWorkout({ sets: [{ reps: 10, load: 20 }] }), true);
});

test('exerciseMatches cobre os dois lados do fallback "(sem nome)"', () => {
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: 'X' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: 'X' }, { exerciseName: '' }), false);
  assert.equal(core.exerciseMatches({ exerciseName: '' }, { exerciseName: '' }), false);
  assert.equal(core.exerciseMatches({ exerciseId: 3 }, { exerciseId: 3, exerciseName: '' }), true, 'id manda');
});

test('lastWarmupForExercise devolve null quando o treino tem aquecimento de outro exercicio', () => {
  const treinos = [{
    id: 'a',
    date: '2026-10-01',
    warmups: [{ exerciseId: 1, exerciseName: 'Esteira', reps: 5, load: 0, rir: 4 }]
  }];

  assert.equal(core.lastWarmupForExercise(treinos, { exerciseId: 2, exerciseName: 'Leg press' }), null);
  assert.equal(core.lastWarmupForExercise(treinos, 'Leg press'), null, 'busca por nome tambem');
});

test('groupSets usa o aquecimento do grupo certo quando ha varios exercicios', () => {
  const grupos = core.groupSets(
    [
      { exerciseId: 1, exerciseName: 'Leg press', number: 1, reps: 12, load: 100 },
      { exerciseId: 2, exerciseName: 'Cadeira flexora', number: 1, reps: 12, load: 40 }
    ],
    [
      { exerciseId: 2, exerciseName: 'Cadeira flexora', reps: 15, load: 20, rir: 3 },
      { exerciseId: 1, exerciseName: 'Leg press', reps: 20, load: 40, rir: 4 }
    ]
  );

  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos[0].warmup, { reps: 20, load: 40, rir: 4 });
  assert.deepEqual(grupos[1].warmup, { reps: 15, load: 20, rir: 3 });
});

test('exerciseLabel e sheetLabel pulam entradas invalidas da lista', () => {
  const exercicios = [null, { id: 7 }, { id: 7, name: 'Remada baixa' }];
  assert.equal(core.exerciseLabel({ exerciseId: 7, exerciseName: 'Antigo' }, exercicios), 'Remada baixa');

  const fichas = [null, { id: 's1' }, { id: 's1', name: 'Ficha A' }];
  assert.equal(core.sheetLabel({ sheetId: 's1', sheetName: 'Antiga' }, fichas), 'Ficha A');
});

test('normalizeSheetItem deduz as series de outras fontes quando falta sets', () => {
  const backup = core.normalizeBackup({
    sheets: [{
      id: 's1',
      exercises: [
        { name: 'A', reps: [12, 10] },
        { name: 'B', reps: '' },
        { name: 'C', reps: [], sets: 1 }
      ]
    }]
  });

  const itens = backup.sheets[0].exercises;
  assert.deepEqual(itens[0].reps, [12, 10], 'sem sets, vale a quantidade de reps');
  assert.equal(itens[0].sets, 2);
  assert.deepEqual(itens[1].reps, [null, null, null], 'reps vazio cai no padrao de 3 series');
  assert.deepEqual(itens[2].reps, [null], 'sets informado ganha da lista de reps');
});

test('normalizeWorkout completa ficha e nome ausentes', () => {
  const backup = core.normalizeBackup({
    workouts: [
      { id: 'w1', sets: [] },
      { id: 'w2', sheetId: 's9', typeName: 'Antigo', sets: [] }
    ]
  });

  assert.equal(backup.workouts[0].sheetId, null, 'sem typeId fica null');
  assert.equal(backup.workouts[0].sheetName, '');
  assert.equal(backup.workouts[1].sheetId, 's9', 'sheetId informado e mantido');
  assert.equal(backup.workouts[1].sheetName, 'Antigo', 'typeName vira sheetName');
});

test('normalizeText e toNumOrNull aceitam undefined', () => {
  assert.equal(core.normalizeText(undefined), '');
  assert.equal(core.normalizeText(0), '0');
  assert.equal(core.toNumOrNull(undefined), null);
});

test('historico e normalizacao aceitam argumentos ausentes', () => {
  assert.deepEqual(core.lastLoadsForExercise(), {});
  assert.equal(core.lastWarmupForExercise(), null);
  assert.deepEqual(core.sessionsForExercise(), []);
  assert.deepEqual(core.lastLoadsForExercise(null, 'X'), {});
  assert.equal(core.lastWarmupForExercise(null, 'X'), null);
  assert.deepEqual(core.sessionsForExercise(null, 'X'), []);

  const vazio = core.normalizeBackup();
  assert.deepEqual(vazio.workouts, []);
  assert.deepEqual(vazio.sheets, []);
  assert.deepEqual(vazio.exercises, []);

  const semListas = core.normalizeBackup({ settings: {} });
  assert.deepEqual(semListas.sheets, []);
  assert.deepEqual(semListas.exercises, []);
});

test('lastLoadsForExercise ordena tres treinos (comparador nos dois sentidos)', () => {
  const treinos = [
    { id: 'a', date: '2026-10-01', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 10 }] },
    { id: 'b', date: '2026-10-05', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 20 }] },
    { id: 'c', date: '2026-10-03', sets: [{ exerciseName: 'X', number: 1, reps: 10, load: 15 }] }
  ];

  assert.deepEqual(core.lastLoadsForExercise(treinos, 'X'), { 1: 20 }, 'pega o treino mais recente');
  assert.deepEqual(core.lastLoadsForExercise(treinos.slice().reverse(), 'X'), { 1: 20 });
});

test('countExercises conta cada exercicio uma vez (series + aquecimento)', () => {
  assert.equal(core.countExercises(), 0);
  assert.equal(core.countExercises({}), 0);

  const treino = {
    sets: [
      { exerciseId: 5, exerciseName: 'Remada baixa', number: 1, reps: 10, load: 30 },
      { exerciseId: 5, exerciseName: 'Nome antigo', number: 2, reps: 8, load: 35 },
      { exerciseId: 6, exerciseName: 'Leg press 45', number: 1, reps: 12, load: 100 },
      { exerciseName: 'Esteira inclinada', number: 1, reps: 1, load: 0 }
    ],
    warmups: [
      { exerciseId: 5, exerciseName: 'Remada baixa', reps: 15, load: 20, rir: 3 },
      { exerciseId: 7, exerciseName: 'So aquecimento', reps: 10, load: 10, rir: 2 }
    ]
  };

  assert.equal(core.countExercises(treino), 4, 'Remada (2 series + aquecimento) conta 1 vez');
  assert.equal(core.countExercises({ sets: treino.sets }), 3, 'sem aquecimentos, sobram 3 exercicios');

  assert.equal(core.countExercises({ sets: [
    { exerciseId: 1, exerciseName: 'Rosca', reps: 10 },
    { exerciseId: 2, exerciseName: 'Rosca', reps: 10 }
  ] }), 2, 'mesmo nome com ids diferentes = exercicios diferentes');

  assert.equal(core.countExercises({ sets: [
    { exerciseName: 'Rosca', reps: 10 },
    { exerciseName: 'Rosca', reps: 8 }
  ] }), 1, 'registros antigos sem id com o mesmo nome contam uma vez');

  assert.equal(core.countExercises({ sets: [{ reps: 10 }] }), 1, 'exercicio sem nome conta como um');
});

test('id em texto e numero sao o mesmo exercicio (data-* devolve texto)', () => {
  assert.equal(core.exerciseMatches({ exerciseId: 887, exerciseName: 'Puxada' }, { exerciseId: '887', exerciseName: 'Puxada' }), true);
  assert.equal(core.exerciseMatches({ exerciseId: '887' }, { exerciseId: 887 }), true);
  assert.equal(core.exerciseMatches({ exerciseId: 887 }, { exerciseId: 888 }), false);
  assert.equal(core.exerciseKey({ exerciseId: 887 }), core.exerciseKey({ exerciseId: '887' }));

  assert.equal(core.exerciseLabel({ exerciseId: '887' }, [{ id: 887, name: 'Puxada frente supinada' }]), 'Puxada frente supinada');
  assert.equal(core.sheetLabel({ sheetId: 3 }, [{ id: '3', name: 'Ficha antiga' }]), 'Ficha antiga');
});

test('regressao: historico de exercicio do catalogo aberto pelo clique', () => {
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 887, exerciseName: 'Puxada frente supinada', number: 1, reps: 12, load: 40 }] },
    { id: 'w2', date: '2026-10-08', sets: [{ exerciseId: 887, exerciseName: 'Puxada frente supinada', number: 1, reps: 10, load: 45 }] }
  ];

  // o clique no detalhe do treino manda o id como TEXTO (atributo data-*)
  const alvo = { exerciseId: '887', exerciseName: 'Puxada frente supinada' };

  assert.equal(core.sessionsForExercise(treinos, alvo).length, 2, 'achava zero antes da correcao');
  assert.deepEqual(core.lastLoadsForExercise(treinos, alvo), { 1: 45 });
  assert.equal(core.bestSetForExercise(treinos[0], alvo).load, 40);
  assert.equal(core.previousWarmupFields(treinos, alvo).reps, '', 'sem aquecimento registrado');
  assert.equal(core.countExercises({ sets: [{ exerciseId: '887' }, { exerciseId: 887 }] }), 1, 'texto e numero contam como o mesmo exercicio');
});
/* ---------- calendário: trocar de mês ---------- */

test('shiftMonth nao pula nem repete mes quando hoje e dia 29, 30 ou 31', () => {
  // regressao: setMonth() em 31/out voltava para outubro; em 31/jan pulava para marco
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 9, 31), -1)), '2026-09-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2027, 0, 31), 1)), '2027-02-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2027, 0, 29), 1)), '2027-02-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 4, 31), 1)), '2026-06-01');
});

test('shiftMonth atravessa o ano e nao altera a data recebida', () => {
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 11, 15), 1)), '2027-01-01');
  assert.equal(core.fmtDate(core.shiftMonth(new Date(2026, 0, 15), -1)), '2025-12-01');
  const cursor = new Date(2026, 9, 31);
  core.shiftMonth(cursor, -1);
  assert.equal(core.fmtDate(cursor), '2026-10-31');
});

/* ---------- PR na tela de evolução ---------- */

test('maxBestLoad e 0 para exercicio sem carga (nao inventa "PR 1 kg")', () => {
  const flexao = { exerciseId: 'e1', exerciseName: 'Flexao' };
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 'e1', exerciseName: 'Flexao', number: 1, reps: 20, load: null }] },
    { id: 'w2', date: '2026-10-03', sets: [{ exerciseId: 'e1', exerciseName: 'Flexao', number: 1, reps: 22, load: 0 }] },
    { id: 'w3', date: '2026-10-05', sets: [], warmups: [{ exerciseId: 'e1', exerciseName: 'Flexao', reps: 10 }] }
  ];
  assert.equal(core.maxBestLoad(treinos, flexao), 0);
  assert.equal(core.maxBestLoad([], flexao), 0);
  assert.equal(core.maxBestLoad(null, flexao), 0);
});

test('maxBestLoad devolve a maior carga entre os treinos do exercicio', () => {
  const alvo = { exerciseId: 'e1', exerciseName: 'Supino' };
  const treinos = [
    { id: 'w1', date: '2026-10-01', sets: [{ exerciseId: 'e1', number: 1, reps: 10, load: 40 }, { exerciseId: 'e1', number: 2, reps: 8, load: 42.5 }] },
    { id: 'w2', date: '2026-10-03', sets: [{ exerciseId: 'e1', number: 1, reps: 10, load: 0.5 }, { exerciseId: 'e2', number: 1, reps: 10, load: 200 }] }
  ];
  assert.equal(core.maxBestLoad(treinos, alvo), 42.5);
  assert.equal(core.maxBestLoad([treinos[1]], alvo), 0.5, 'carga menor que 1 kg nao vira 1');
});

/* ---------- backup importado: ids e datas vindos de fora ---------- */

test('normalizeBackup descarta registros com id que quebraria o HTML (aspas, espacos, tags)', () => {
  const ruim = "x');alert(1);//";
  const b = core.normalizeBackup({
    workouts: [{ id: 'w1', date: '2026-10-01' }, { id: ruim, date: '2026-10-02' }, null, { date: '2026-10-03' }],
    sheets: [{ id: 's1', name: 'A' }, { id: 'a b', name: 'B' }],
    exercises: [{ id: 'e1', name: 'Supino' }, { id: '<img src=x>', name: 'X' }],
    colinha: [{ id: 'c1', title: 'RIR' }, { id: 'c"2', title: 'Y' }]
  });
  assert.deepEqual(b.workouts.map((w) => w.id), ['w1']);
  assert.deepEqual(b.sheets.map((s) => s.id), ['s1']);
  assert.deepEqual(b.exercises.map((e) => e.id), ['e1']);
  assert.deepEqual(b.colinha.map((c) => c.id), ['c1']);
});

test('normalizeBackup mantem todos os formatos de id que o app ja gerou', () => {
  const ids = ['3f2b8c1e-9a4d-4e7b-8c21-0a1b2c3d4e5f', 'id-1760000000000-a3f9c2', 'w1', 'sample_sheet_a', 12];
  const b = core.normalizeBackup({
    workouts: ids.map((id) => ({ id: id, date: '2026-10-01' })),
    exercises: ids.map((id) => ({ id: id, name: 'E' })),
    workoutTypes: ids.map((id) => ({ id: id, name: 'T' }))   // v1
  });
  assert.deepEqual(b.workouts.map((w) => w.id), ids);
  assert.deepEqual(b.exercises.map((e) => e.id), ids);
  assert.deepEqual(b.sheets.map((s) => s.id), ids);
});

test('normalizeBackup: treino com data invalida fica "sem data" em vez de quebrar o calendario', () => {
  const b = core.normalizeBackup({
    workouts: [
      { id: 'w1', date: '2026-10-01', sets: [{ exerciseName: 'Supino', reps: 10, load: 40 }] },
      { id: 'w2', sets: [{ exerciseName: 'Supino', reps: 8, load: 45 }] },
      { id: 'w3', date: '<b>01/10/2026</b>' },
      { id: 'w4', date: 20261001 }
    ]
  });
  assert.deepEqual(b.workouts.map((w) => w.date), ['2026-10-01', '', '', '']);
  assert.equal(b.workouts[1].sets[0].load, 45, 'o treino sem data continua com as series');
  assert.equal(core.dateParts(b.workouts[1].date), null);
  assert.equal(core.fmtBR(b.workouts[1].date), '—');
});

test('normalizeBackup: inicio da semana invalido volta para hoje; valido e preservado', () => {
  assert.equal(core.normalizeBackup({ settings: { weekAnchor: '<img src=x onerror=alert(1)>' } }).settings.weekAnchor, core.todayISO());
  assert.equal(core.normalizeBackup({ settings: {} }).settings.weekAnchor, core.todayISO());
  assert.equal(core.normalizeBackup({ settings: { weekAnchor: '2026-10-05' } }).settings.weekAnchor, '2026-10-05');
});

test('normalizeBackup continua idempotente depois da validacao de ids e datas', () => {
  const uma = core.normalizeBackup({
    workouts: [{ id: 'w1', date: '2026-10-01' }, { id: 'w2' }],
    sheets: [{ id: 's1', name: 'A', exercises: [{ name: 'Supino', sets: 3, reps: [12, 10, 8] }] }],
    settings: { weekAnchor: '2026-10-05' }
  });
  assert.deepEqual(core.normalizeBackup(uma), uma);
});

/* ---------- semana de metas: iniciar a próxima ---------- */

test('nextWeekAnchor avanca uma semana quando a anterior acabou de encerrar', () => {
  // janela 01–07/out; hoje 08/out -> proxima janela 08–14/out
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-08'), '2026-10-08');
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-14'), '2026-10-08');
});

test('nextWeekAnchor pula as semanas perdidas de uma vez, mantendo o dia da semana', () => {
  // regressao: depois de 3 semanas parado era preciso tocar 3 vezes no botao
  const anchor = core.nextWeekAnchor('2026-10-01', '2026-10-25');
  assert.equal(anchor, '2026-10-22');
  const janela = core.weekWindow(anchor);
  assert.ok(janela.anchor <= '2026-10-25' && '2026-10-25' <= janela.end, 'hoje cai dentro da nova janela');
  assert.equal(core.parseDate(anchor).getDay(), core.parseDate('2026-10-01').getDay());
  assert.equal(core.nextWeekAnchor('2026-12-20', '2027-01-15'), '2027-01-10', 'atravessa o ano');
});

test('nextWeekAnchor sempre avanca pelo menos 7 dias', () => {
  assert.equal(core.nextWeekAnchor('2026-10-01', '2026-10-03'), '2026-10-08');
});
