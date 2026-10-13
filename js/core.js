'use strict';

/* Meu Treino — lógica pura, compartilhada entre o app e os testes.
   Nada aqui acessa o DOM nem o estado global: são funções puras.
   No navegador os nomes viram globais (usados pelo app.js); no Node são exportados
   para os testes (tests/core.test.js). */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;      // Node (testes)
  } else {
    Object.assign(root, api);  // Navegador
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------- datas ---------- */

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseDate(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function todayISO() {
    return fmtDate(new Date());
  }

  function addDaysISO(iso, n) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }

  function fmtBR(iso) {
    if (!iso) return '—';
    const p = String(iso).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /* ---------- texto e números ---------- */

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toNum(value) {
    const n = parseLocalNumber(value);
    return isNaN(n) ? 0 : n;
  }

  // Aceita virgula ou ponto como separador decimal (pt-BR usa virgula, e no iPhone o
  // teclado numerico oferece a virgula).
  // "27,5" -> 27.5 | "1.100,50" -> 1100.5 | "12" -> 12 | "abc" -> NaN
  function parseLocalNumber(value) {
    if (value === null || value === undefined) return NaN;

    let text = String(value).trim().replace(/\s/g, '');
    if (!text) return NaN;

    const hasComma = text.indexOf(',') !== -1;
    const hasDot = text.indexOf('.') !== -1;

    if (hasComma && hasDot) {
      text = text.replace(/\./g, '').replace(',', '.');   // 1.100,50
    } else if (hasComma) {
      text = text.replace(',', '.');                      // 27,5
    }

    return parseFloat(text);
  }

  function toNumOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = parseLocalNumber(value);
    return isNaN(n) ? null : n;
  }

  // Formata um numero para exibir em campo (virgula quando o idioma usa virgula).
  function formatDecimal(value, useComma) {
    if (value === '' || value === null || value === undefined) return '';
    const n = parseLocalNumber(value);
    if (isNaN(n)) return '';
    const text = String(n);
    return useComma ? text.replace('.', ',') : text;
  }

  // Busca sem acentos (ex.: "puxada maquina" encontra "Puxada máquina").
  function normalizeText(value) {
    return String(value === null || value === undefined ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /* ---------- configurações e semana ---------- */

  function defaultSettings() {
    return {
      id: 'app',
      weekAnchor: todayISO(),
      weeklyWorkoutTarget: 3,
      weeklyCardioTarget: 120,
      tonnageVisible: false
    };
  }

  // Janela de 7 dias a partir da data marcada (inclusive).
  function weekWindow(anchorISO) {
    const anchor = anchorISO || todayISO();
    return { anchor: anchor, end: addDaysISO(anchor, 6) };
  }

  function isValidWorkout(w) {
    const hasSet = (w.sets || []).some(function (s) {
      return toNum(s.reps) > 0 || toNum(s.load) > 0;
    });
    return hasSet || toNum(w.cardioMinutes) > 0;
  }

  /* ---------- aquecimento ---------- */

  function warmupHasData(warm) {
    if (!warm) return false;
    return [warm.reps, warm.load, warm.rir].some(function (v) {
      return v !== null && v !== undefined && v !== '';
    });
  }

  function warmupLine(warm) {
    if (!warm) return '';
    const parts = [];
    if (warm.reps !== null && warm.reps !== undefined && warm.reps !== '') parts.push(warm.reps + ' reps');
    if (warm.load !== null && warm.load !== undefined && warm.load !== '') parts.push(warm.load + ' kg');
    if (warm.rir !== null && warm.rir !== undefined && warm.rir !== '') parts.push('RIR ' + warm.rir);
    return parts.join(' · ');
  }

  function warmupSummary(warmups) {
    if (!warmups || !warmups.length) return '';
    return warmups.length === 1 ? '1 aquecimento' : warmups.length + ' aquecimentos';
  }

  /* ---------- séries ---------- */

  function setLine(s) {
    const parts = [];
    parts.push((s.reps === null || s.reps === undefined) ? '—' : s.reps + ' reps');
    if (s.load !== null && s.load !== undefined) parts.push(s.load + ' kg');
    if (s.rir !== null && s.rir !== undefined) parts.push('RIR ' + s.rir);
    return parts.join(' · ');
  }

  // Lista (ul) das séries, no mesmo estilo da lista de exercícios das fichas.
  function setsSummaryLines(sets) {
    const ordered = (sets || []).slice().sort(function (a, b) { return toNum(a.number) - toNum(b.number); });
    if (!ordered.length) return '';

    return '<ul class="list-unstyled sheet-items mb-0">' + ordered.map(function (s) {
      return '<li>' +
        '<span class="sheet-item-idx">' + esc(s.number || '?') + '</span>' +
        '<span class="sheet-item-detail">' + esc(setLine(s)) + '</span>' +
        (s.note ? '<span class="sheet-item-note text-truncate">' + esc(s.note) + '</span>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  // Agrupa as séries planas do treino por exercício (na ordem em que aparecem),
  // juntando a observação do exercício e o aquecimento salvo.
  function groupSets(flatSets, warmups) {
    const groups = [];
    const index = {};
    const warmupByName = {};

    (warmups || []).forEach(function (w) {
      warmupByName[w.exerciseName || '(sem nome)'] = w;
    });

    (flatSets || []).forEach(function (s) {
      const key = s.exerciseName || '(sem nome)';
      if (!Object.prototype.hasOwnProperty.call(index, key)) {
        index[key] = groups.length;
        const saved = warmupByName[key];
        groups.push({
          exerciseId: s.exerciseId || null,
          exerciseName: key,
          note: s.exerciseNote || '',
          warmup: saved
            ? { reps: saved.reps, load: saved.load, rir: saved.rir }
            : { reps: '', load: '', rir: '' },
          sets: []
        });
      }
      const group = groups[index[key]];
      if (!group.note && s.exerciseNote) group.note = s.exerciseNote;
      group.sets.push({ number: s.number, reps: s.reps, load: s.load, rir: s.rir, note: s.note || '' });
    });

    return groups;
  }

  /* ---------- histórico por exercício ---------- */

  function lastLoadsForExercise(workouts, name) {
    const sorted = (workouts || []).filter(function (w) {
      return (w.sets || []).some(function (s) { return s.exerciseName === name; });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!sorted.length) return {};
    const last = sorted[0];
    const map = {};
    last.sets.forEach(function (s) {
      if (s.exerciseName === name && toNum(s.load) > 0) map[s.number] = s.load;
    });
    return map;
  }

  function lastWarmupForExercise(workouts, name) {
    const sorted = (workouts || []).filter(function (w) {
      return (w.warmups || []).some(function (x) { return x.exerciseName === name; });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!sorted.length) return null;
    const last = sorted[0];
    return (last.warmups || []).find(function (x) { return x.exerciseName === name; }) || null;
  }

  function previousWarmupFields(workouts, name) {
    const last = lastWarmupForExercise(workouts, name);
    return {
      reps: (last && last.reps !== null && last.reps !== undefined) ? last.reps : '',
      load: (last && last.load !== null && last.load !== undefined) ? last.load : '',
      rir: ''
    };
  }

  function sessionsForExercise(workouts, name) {
    return (workouts || []).filter(function (w) {
      return (w.sets || []).some(function (s) { return s.exerciseName === name; }) ||
        (w.warmups || []).some(function (x) { return x.exerciseName === name; });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function bestSetForExercise(workout, name) {
    let best = null;
    (workout.sets || []).forEach(function (s) {
      if (s.exerciseName !== name) return;
      const load = toNum(s.load);
      const reps = toNum(s.reps);
      if (!best || load > best.load || (load === best.load && reps > best.reps)) {
        best = { load: load, reps: reps };
      }
    });
    return best;
  }

  /* ---------- exportar treino como texto ---------- */

  function workoutAsText(workout) {
    const lines = [];
    lines.push('MEU TREINO — ' + fmtBR(workout.date));

    const sheetName = workout.sheetName || workout.typeName;
    if (sheetName) lines.push('Ficha: ' + sheetName);
    lines.push('');

    const warmupByName = {};
    (workout.warmups || []).forEach(function (w) {
      warmupByName[w.exerciseName || '(sem nome)'] = w;
    });

    const groups = [];
    const index = {};
    (workout.sets || []).forEach(function (s) {
      const key = s.exerciseName || '(sem nome)';
      if (!Object.prototype.hasOwnProperty.call(index, key)) {
        index[key] = groups.length;
        groups.push({ name: key, note: s.exerciseNote || '', sets: [] });
      }
      if (!groups[index[key]].note && s.exerciseNote) groups[index[key]].note = s.exerciseNote;
      groups[index[key]].sets.push(s);
    });

    // Exercícios só com aquecimento também aparecem.
    (workout.warmups || []).forEach(function (w) {
      const key = w.exerciseName || '(sem nome)';
      if (Object.prototype.hasOwnProperty.call(index, key)) return;
      index[key] = groups.length;
      groups.push({ name: key, note: '', sets: [] });
    });

    groups.forEach(function (g, i) {
      lines.push((i + 1) + '. ' + g.name + (g.note ? ' (obs.: ' + g.note + ')' : ''));

      const warm = warmupByName[g.name];
      if (warm) {
        const warmParts = [];
        if (warm.reps !== null && warm.reps !== undefined) warmParts.push(warm.reps + ' reps');
        if (warm.load !== null && warm.load !== undefined) warmParts.push(warm.load + ' kg');
        if (warm.rir !== null && warm.rir !== undefined) warmParts.push('RIR ' + warm.rir);
        if (warmParts.length) lines.push('   Aquecimento: ' + warmParts.join(' · '));
      }

      g.sets.slice().sort(function (a, b) { return toNum(a.number) - toNum(b.number); }).forEach(function (s) {
        let line = '   Série ' + (s.number || '?') + ': ' + setLine(s);
        if (s.note) line += ' (' + s.note + ')';
        lines.push(line);
      });

      lines.push('');
    });

    const cardio = toNum(workout.cardioMinutes);
    if (cardio > 0) lines.push('Cardio: ' + cardio + ' min');
    if (workout.notes) lines.push('Observações: ' + workout.notes);

    return lines.join('\n').trim();
  }

  /* ---------- dados de exemplo ---------- */

  // Os dados de exemplo guardam as datas como deslocamento em dias (dayOffset),
  // para a demonstracao ficar sempre recente em relacao a hoje.
  function materializeSampleData(payload, today) {
    const base = today || todayISO();
    const data = payload && payload.data ? payload.data : payload;
    const copy = JSON.parse(JSON.stringify(data || {}));

    (copy.workouts || []).forEach(function (w) {
      if (typeof w.dayOffset === 'number') {
        w.date = addDaysISO(base, w.dayOffset);
        delete w.dayOffset;
      }
    });

    if (!copy.settings) copy.settings = {};
    copy.settings.id = 'app';
    copy.settings.weekAnchor = addDaysISO(base, -2);

    return copy;
  }

  // ---------- referência por id (chave estrangeira) ----------

  // Liga itens de ficha antigos (só com nome) ao exercício da Biblioteca, quando o nome casa
  // de forma inequívoca. É a migração que dá "chave estrangeira" às fichas já existentes.
  function linkSheetItemsToExercises(sheets, exercises) {
    const idsByName = {};
    (exercises || []).forEach(function (e) {
      const key = normalizeText(e.name);
      if (!key) return;
      idsByName[key] = idsByName[key] || [];
      idsByName[key].push(e.id);
    });

    let changed = 0;

    const updated = (sheets || []).map(function (sheet) {
      let sheetChanged = false;
      const items = (sheet.exercises || []).map(function (item) {
        if (item.exerciseId) return item;
        const ids = idsByName[normalizeText(item.name)] || [];
        if (ids.length !== 1) return item;   // nome ambíguo ou inexistente: não mexe
        changed++;
        sheetChanged = true;
        return Object.assign({}, item, { exerciseId: ids[0] });
      });
      return sheetChanged ? Object.assign({}, sheet, { exercises: items }) : sheet;
    });

    return { sheets: updated, changed: changed };
  }

  // Renomear um exercício precisa refletir nas fichas: por id (preferencial) e, para itens
  // antigos sem id, pelo nome anterior.
  function renameInSheets(sheets, exerciseId, oldName, newName) {
    const oldKey = normalizeText(oldName);
    let changed = 0;

    const updated = (sheets || []).map(function (sheet) {
      let sheetChanged = false;
      const items = (sheet.exercises || []).map(function (item) {
        const byId = item.exerciseId && exerciseId && item.exerciseId === exerciseId;
        const byName = !item.exerciseId && oldKey && normalizeText(item.name) === oldKey;
        if (!byId && !byName) return item;
        if (item.name === newName && item.exerciseId === exerciseId) return item;
        changed++;
        sheetChanged = true;
        return Object.assign({}, item, { name: newName, exerciseId: exerciseId });
      });
      return sheetChanged ? Object.assign({}, sheet, { exercises: items }) : sheet;
    });

    return { sheets: updated, changed: changed };
  }

  // No histórico só atualizamos registros que apontam para o id do exercício
  // (não reescrevemos lançamentos antigos que têm apenas o nome).
  function renameInWorkouts(workouts, exerciseId, newName) {
    if (!exerciseId) return { workouts: workouts || [], changed: 0 };

    let changed = 0;

    const updated = (workouts || []).map(function (workout) {
      let workoutChanged = false;

      const sets = (workout.sets || []).map(function (s) {
        if (s.exerciseId !== exerciseId || s.exerciseName === newName) return s;
        changed++;
        workoutChanged = true;
        return Object.assign({}, s, { exerciseName: newName });
      });

      const warmups = (workout.warmups || []).map(function (w) {
        if (w.exerciseId !== exerciseId || w.exerciseName === newName) return w;
        changed++;
        workoutChanged = true;
        return Object.assign({}, w, { exerciseName: newName });
      });

      return workoutChanged ? Object.assign({}, workout, { sets: sets, warmups: warmups }) : workout;
    });

    return { workouts: updated, changed: changed };
  }

  /* ---------- backup ---------- */

  // Nome do arquivo com data e hora, para diferenciar backups do mesmo dia.
  // Ex.: meu-treino-backup-2026-10-12_13-35-42.json
  function backupFileName(date) {
    const d = date || new Date();
    return 'meu-treino-backup-' + fmtDate(d) +
      '_' + pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds()) +
      '.json';
  }

  // Data e hora local no formato brasileiro: 12/10/2026 13:35
  function fmtDateTimeBR(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // Situação do backup: quando foi o último e se já é hora de lembrar o usuário.
  function backupStatus(settings, now, daysLimit) {    const limit = daysLimit || 7;
    const current = now || new Date();
    const last = settings && settings.lastBackupAt ? settings.lastBackupAt : null;
    const lastDate = last ? new Date(last) : null;

    if (!lastDate || isNaN(lastDate.getTime())) {
      return {
        lastBackupAt: null,
        daysSince: null,
        overdue: true,
        label: 'Você ainda não fez nenhum backup.'
      };
    }

    const daysSince = Math.max(0, Math.floor((current.getTime() - lastDate.getTime()) / 86400000));
    let when = 'hoje';
    if (daysSince === 1) when = 'ontem';
    else if (daysSince > 1) when = 'há ' + daysSince + ' dias';

    return {
      lastBackupAt: last,
      daysSince: daysSince,
      overdue: daysSince >= limit,
      label: 'Último backup: ' + fmtDateTimeBR(last) + ' (' + when + ')'
    };
  }

  // Decide o que fazer quando o usuário pede backup: abrir o menu de compartilhamento
  // (celular/tablet, que sabe compartilhar arquivos) ou baixar o arquivo (computador).
  // Assim uma ação gera UM arquivo só.
  function backupAction(options) {
    const opts = options || {};
    if (opts.canShareFiles && opts.touch) return 'share';
    return 'download';
  }

  /* ---------- biblioteca do usuário ---------- */

  // Um exercício aparece na Biblioteca a menos que seja comprovadamente do catálogo
  // (source 'catalog' COM catalogId). Nada é inferido pelo nome: adivinhar escondia
  // exercícios criados pelo usuário.
  function isUserExercise(exercise) {
    if (!exercise) return false;
    if (exercise.source === 'catalog' && exercise.catalogId) return false;
    return true;
  }

  function libraryExercises(exercises) {
    return (exercises || []).filter(function (e) {
      return e && e.active !== false && isUserExercise(e);
    });
  }

  // Marcações antigas de 'catalog' feitas sem comprovação (sem catalogId) precisam ser desfeitas.
  function exercisesNeedingRepair(exercises) {
    return (exercises || []).filter(function (e) {
      return e && e.source === 'catalog' && !e.catalogId;
    });
  }

  /* ---------- compatibilidade de backup entre versões ---------- */

  function normalizeSet(s, fallbackNumber) {
    if (!s) return null;
    return {
      exerciseId: s.exerciseId || null,
      exerciseName: s.exerciseName || '(sem nome)',
      number: toNum(s.number) || fallbackNumber,
      reps: toNumOrNull(s.reps),
      load: toNumOrNull(s.load),
      rir: toNumOrNull(s.rir),
      note: s.note || '',
      exerciseNote: s.exerciseNote || ''
    };
  }

  function normalizeWarmup(w) {
    if (!w) return null;
    return {
      exerciseId: w.exerciseId || null,
      exerciseName: w.exerciseName || '(sem nome)',
      reps: toNumOrNull(w.reps),
      load: toNumOrNull(w.load),
      rir: toNumOrNull(w.rir)
    };
  }

  function normalizeSheetItem(item) {
    const raw = item || {};
    const legacySingle = !Array.isArray(raw.reps) && raw.reps !== undefined && raw.reps !== null && raw.reps !== '';
    let reps = Array.isArray(raw.reps) ? raw.reps.slice() : [];

    const sets = Math.max(1, parseInt(raw.sets, 10) || reps.length || 3);

    if (legacySingle) {
      // v2: a ficha guardava um único valor de reps (ex.: 3x12) -> vale para todas as séries.
      reps = new Array(sets).fill(raw.reps);
    } else {
      while (reps.length < sets) reps.push(null);
    }

    return {
      exerciseId: raw.exerciseId || null,
      name: raw.name || '',
      sets: sets,
      reps: reps.map(toNumOrNull),
      note: raw.note || ''
    };
  }

  function normalizeSheet(s) {
    const raw = s || {};
    return {
      id: raw.id,
      name: raw.name || '',
      active: raw.active !== false,
      exercises: (raw.exercises || []).map(normalizeSheetItem),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    };
  }

  function normalizeWorkout(w) {
    const workout = Object.assign({}, w);

    // v1: as fichas eram "tipos de treino" (typeId/typeName).
    workout.sheetId = (w.sheetId === undefined || w.sheetId === null) ? (w.typeId || null) : w.sheetId;
    workout.sheetName = w.sheetName || w.typeName || '';
    delete workout.typeId;
    delete workout.typeName;

    workout.cardioMinutes = toNum(w.cardioMinutes);
    workout.notes = w.notes || '';
    workout.warmups = (w.warmups || []).map(normalizeWarmup).filter(Boolean);
    workout.sets = (w.sets || []).map(function (s, i) { return normalizeSet(s, i + 1); }).filter(Boolean);

    return workout;
  }

  function normalizeExercise(e) {
    const exercise = Object.assign({}, e);
    exercise.name = e.name || '';
    exercise.group = e.group || 'Outros';
    exercise.correction = e.correction || '';
    exercise.active = e.active !== false;
    return exercise;
  }

  function normalizeSettings(s) {
    const settings = Object.assign({ id: 'app' }, s || {});
    settings.weekAnchor = settings.weekAnchor || todayISO();
    settings.weeklyWorkoutTarget = toNum(settings.weeklyWorkoutTarget) || 3;
    settings.weeklyCardioTarget = (settings.weeklyCardioTarget === undefined || settings.weeklyCardioTarget === null)
      ? 120
      : toNum(settings.weeklyCardioTarget);
    return settings;
  }

  // Converte qualquer backup (v1 ou atual) para o formato atual, sem perder dados.
  function normalizeBackup(data) {
    const source = data || {};

    // v1: as fichas eram "tipos de treino" (só nome, sem exercícios).
    const rawSheets = source.sheets || (source.workoutTypes || []).map(function (t) {
      return {
        id: t.id,
        name: t.name,
        active: t.active !== false,
        exercises: [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });

    return {
      workouts: (source.workouts || []).filter(function (w) { return w && w.id; }).map(normalizeWorkout),
      sheets: (rawSheets || []).filter(function (s) { return s && s.id; }).map(normalizeSheet),
      exercises: (source.exercises || []).filter(function (e) { return e && e.id; }).map(normalizeExercise),
      settings: normalizeSettings(source.settings),
      colinha: (source.colinha || []).filter(function (c) { return c && c.id; })
    };
  }

  return {
    // datas
    pad2: pad2,
    fmtDate: fmtDate,
    parseDate: parseDate,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    fmtBR: fmtBR,
    // texto e números
    esc: esc,
    toNum: toNum,
    toNumOrNull: toNumOrNull,
    parseLocalNumber: parseLocalNumber,
    formatDecimal: formatDecimal,
    normalizeText: normalizeText,
    // configurações e semana
    defaultSettings: defaultSettings,
    weekWindow: weekWindow,
    isValidWorkout: isValidWorkout,
    // dados de exemplo
    materializeSampleData: materializeSampleData,
    // referência por id
    linkSheetItemsToExercises: linkSheetItemsToExercises,
    renameInSheets: renameInSheets,
    renameInWorkouts: renameInWorkouts,
    // backup
    backupFileName: backupFileName,
    fmtDateTimeBR: fmtDateTimeBR,
    backupStatus: backupStatus,
    backupAction: backupAction,
    // biblioteca
    isUserExercise: isUserExercise,
    libraryExercises: libraryExercises,
    exercisesNeedingRepair: exercisesNeedingRepair,
    // aquecimento e séries
    warmupHasData: warmupHasData,
    warmupLine: warmupLine,
    warmupSummary: warmupSummary,
    setLine: setLine,
    setsSummaryLines: setsSummaryLines,
    groupSets: groupSets,
    // histórico
    lastLoadsForExercise: lastLoadsForExercise,
    lastWarmupForExercise: lastWarmupForExercise,
    previousWarmupFields: previousWarmupFields,
    sessionsForExercise: sessionsForExercise,
    bestSetForExercise: bestSetForExercise,
    // exportação
    workoutAsText: workoutAsText,
    // compatibilidade de dados
    normalizeBackup: normalizeBackup
  };
});
