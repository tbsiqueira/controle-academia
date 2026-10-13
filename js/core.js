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

  /* ---------- referência por id (evita nome congelado) ---------- */

  // Normaliza a referência de um exercício. Aceita { exerciseId, exerciseName }
  // ou só o nome (chamadas antigas).
  function exerciseTarget(target) {
    if (!target) return { exerciseId: null, exerciseName: '' };
    if (typeof target === 'string') return { exerciseId: null, exerciseName: target };
    return {
      exerciseId: target.exerciseId || null,
      exerciseName: target.exerciseName || target.name || ''
    };
  }

  // Nome ATUAL do exercício: resolve pelo id na lista (biblioteca + catálogo) e só cai
  // no nome guardado quando não existe id (dados antigos) ou o exercício foi excluído.
  function exerciseLabel(item, exercises) {
    const ref = item || {};
    const list = exercises || [];

    if (ref.exerciseId) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === ref.exerciseId && list[i].name) return list[i].name;
      }
    }

    return ref.exerciseName || ref.name || '';
  }

  // Mesmo exercício? Compara pelo id quando a referência tem id; senão, pelo nome.
  function exerciseMatches(entry, target) {
    const e = entry || {};
    const t = exerciseTarget(target);

    if (t.exerciseId && e.exerciseId) return e.exerciseId === t.exerciseId;
    if (!t.exerciseName && !e.exerciseName) return false;   // nada para comparar
    return (e.exerciseName || '(sem nome)') === (t.exerciseName || '(sem nome)');
  }

  // Chave de agrupamento: id quando existe, nome como fallback (dados antigos).
  function exerciseKey(entry) {
    const e = entry || {};
    return e.exerciseId ? 'id:' + e.exerciseId : 'nome:' + (e.exerciseName || '(sem nome)');
  }

  // Alvo de busca para o histórico de um exercício: usa o id quando o registro tem id;
  // sem id, usa o nome GUARDADO (dados antigos só têm esse nome para casar).
  function historyTarget(group) {
    return {
      exerciseId: (group && group.exerciseId) || null,
      exerciseName: (group && group.exerciseName) || ''
    };
  }

  // Agrupa as séries planas do treino por exercício (id-first, na ordem em que aparecem),
  // juntando a observação do exercício e o aquecimento salvo.
  // Exercícios que só têm aquecimento também viram grupo (senão o aquecimento se perderia
  // ao editar o treino).
  function groupSets(flatSets, warmups) {
    const groups = [];
    const index = {};

    (flatSets || []).forEach(function (s) {
      const key = exerciseKey(s);
      if (!Object.prototype.hasOwnProperty.call(index, key)) {
        index[key] = groups.length;
        groups.push({
          exerciseId: s.exerciseId || null,
          exerciseName: s.exerciseName || '(sem nome)',
          note: s.exerciseNote || '',
          warmup: { reps: '', load: '', rir: '' },
          sets: []
        });
      }
      const group = groups[index[key]];
      if (!group.note && s.exerciseNote) group.note = s.exerciseNote;
      group.sets.push({ number: s.number, reps: s.reps, load: s.load, rir: s.rir, note: s.note || '' });
    });

    (warmups || []).forEach(function (w) {
      const key = exerciseKey(w);
      let group = null;

      if (Object.prototype.hasOwnProperty.call(index, key)) {
        group = groups[index[key]];
      } else {
        // Aquecimento de um exercício sem séries de trabalho (ou registro antigo).
        for (let i = 0; i < groups.length; i++) {
          if (exerciseMatches(w, groups[i])) { group = groups[i]; break; }
        }
      }

      if (!group) {
        index[key] = groups.length;
        group = {
          exerciseId: w.exerciseId || null,
          exerciseName: w.exerciseName || '(sem nome)',
          note: '',
          warmup: { reps: '', load: '', rir: '' },
          sets: []
        };
        groups.push(group);
      }

      group.warmup = { reps: w.reps, load: w.load, rir: w.rir };
    });

    return groups;
  }

  // Histórico por exercício: sempre pelo id quando o registro tem id, com o nome
  // como fallback (dados antigos sem id).
  function lastLoadsForExercise(workouts, target) {
    const sorted = (workouts || []).filter(function (w) {
      return (w.sets || []).some(function (s) { return exerciseMatches(s, target); });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!sorted.length) return {};
    const last = sorted[0];
    const map = {};
    last.sets.forEach(function (s) {
      if (exerciseMatches(s, target) && toNum(s.load) > 0) map[s.number] = s.load;
    });
    return map;
  }

  function lastWarmupForExercise(workouts, target) {
    const sorted = (workouts || []).filter(function (w) {
      return (w.warmups || []).some(function (x) { return exerciseMatches(x, target); });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!sorted.length) return null;
    const last = sorted[0];
    // A lista ja foi filtrada por aquecimento deste exercicio, entao o find sempre acha.
    return last.warmups.find(function (x) { return exerciseMatches(x, target); });
  }

  function previousWarmupFields(workouts, target) {
    const last = lastWarmupForExercise(workouts, target);
    return {
      reps: (last && last.reps !== null && last.reps !== undefined) ? last.reps : '',
      load: (last && last.load !== null && last.load !== undefined) ? last.load : '',
      rir: ''
    };
  }

  function sessionsForExercise(workouts, target) {
    return (workouts || []).filter(function (w) {
      return (w.sets || []).some(function (s) { return exerciseMatches(s, target); }) ||
        (w.warmups || []).some(function (x) { return exerciseMatches(x, target); });
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function bestSetForExercise(workout, target) {
    let best = null;
    ((workout && workout.sets) || []).forEach(function (s) {
      if (!exerciseMatches(s, target)) return;
      const load = toNum(s.load);
      const reps = toNum(s.reps);
      if (!best || load > best.load || (load === best.load && reps > best.reps)) {
        best = { load: load, reps: reps };
      }
    });
    return best;
  }

/* ---------- nome atual da ficha ---------- */

  // O treino guarda o nome da ficha como estava no dia em que foi registrado (snapshot).
  // Para MOSTRAR, resolvemos pelo id: assim renomear a ficha aparece em todo o app.
  // Se a ficha foi excluída (ou o registro é antigo, sem id), usamos o nome guardado.
  function sheetLabel(workout, sheets) {
    const w = workout || {};
    const list = sheets || [];

    if (w.sheetId) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === w.sheetId && list[i].name) return list[i].name;
      }
    }

    return w.sheetName || w.typeName || '';
  }

  /* ---------- exportar treino como texto ---------- */

  function workoutAsText(workout, sheets, exercises) {
    const lines = [];
    lines.push('MEU TREINO — ' + fmtBR(workout.date));

    const sheetName = sheetLabel(workout, sheets);
    if (sheetName) lines.push('Ficha: ' + sheetName);
    lines.push('');

    const groups = groupSets(workout.sets, workout.warmups);

    groups.forEach(function (g, i) {
      lines.push((i + 1) + '. ' + exerciseLabel(g, exercises) + (g.note ? ' (obs.: ' + g.note + ')' : ''));

      if (warmupHasData(g.warmup)) lines.push('   Aquecimento: ' + warmupLine(g.warmup));

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
  function backupStatus(settings, now, daysLimit) {
    const limit = daysLimit || 7;
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

  // Conteúdo enviado ao menu de compartilhamento: SÓ o arquivo, nada mais.
  // Sem "text" e sem "title": alguns aparelhos tratam título/texto como um segundo
  // item e salvam um arquivo .txt junto com o JSON.
  function backupSharePayload(file) {
    return { files: [file] };
  }

  // Um backup montado de verdade tem o JSON e o nome do arquivo. Qualquer outro valor
  // (por exemplo, o evento de clique que o handler recebe) é ignorado.
  function isBackupPayload(value) {
    return !!(value && typeof value.json === 'string' && typeof value.name === 'string' && value.name);
  }

  // Dica mostrada embaixo do botão Exportar: diz para onde o arquivo vai neste aparelho.
  function backupHint(action) {
    return action === 'share'
      ? 'Abre o menu do celular para salvar no Drive, WhatsApp ou Arquivos.'
      : 'Baixa o arquivo .json do backup para guardar onde quiser.';
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

  // Decisão pura do reparo de sources: o que está marcado como "catalog" sem catalogId
  // volta a ser "custom" (a adivinhação antiga escondia exercícios criados pelo usuário).
  function fixLibrarySources(exercises) {
    let changed = 0;

    const updated = (exercises || []).map(function (e) {
      if (!e || !(e.source === 'catalog' && !e.catalogId)) return e;
      changed++;
      return Object.assign({}, e, { source: 'custom' });
    });

    return { exercises: updated, changed: changed };
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
    if (!item) return null;

    const raw = item;
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
    return {
      id: s.id,
      name: s.name || '',
      active: s.active !== false,
      exercises: (s.exercises || []).map(normalizeSheetItem).filter(Boolean),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
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
      sheets: rawSheets.filter(function (s) { return s && s.id; }).map(normalizeSheet),
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
    backupSharePayload: backupSharePayload,
    isBackupPayload: isBackupPayload,
    backupHint: backupHint,
    // biblioteca
    isUserExercise: isUserExercise,
    libraryExercises: libraryExercises,
    exercisesNeedingRepair: exercisesNeedingRepair,
    fixLibrarySources: fixLibrarySources,
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
    sheetLabel: sheetLabel,
    exerciseTarget: exerciseTarget,
    exerciseLabel: exerciseLabel,
    exerciseMatches: exerciseMatches,
    exerciseKey: exerciseKey,
    historyTarget: historyTarget,
    // compatibilidade de dados
    normalizeBackup: normalizeBackup
  };
});
