'use strict';

/* Meu Treino — pure logic, shared between the app and the tests.
   Nothing here touches the DOM or global state: these are pure functions.
   In the browser the names become globals (used by app.js); in Node they are exported
   for the tests (tests/core.test.js). */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;      // Node (tests)
  } else {
    Object.assign(root, api);  // Browser
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------- dates ---------- */

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

  // First day of the month `delta` months after (or before) the date.
  // Always starts from day 1: setMonth() on the 31st skips or repeats a month.
  function shiftMonth(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }

  function fmtBR(iso) {
    if (!iso) return '—';
    const p = String(iso).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // Parts of a date for the workout list on Início: a block with a big day,
  // month and weekday ("hoje"/"ontem" when it applies) and the month key for grouping.
  function dateParts(iso, todayIso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const d = parseDate(iso);
    let relative = '';
    if (todayIso) {
      if (iso === todayIso) relative = 'hoje';
      else if (iso === addDaysISO(todayIso, -1)) relative = 'ontem';
    }
    return {
      day: pad2(d.getDate()),
      weekday: WEEKDAYS_SHORT[d.getDay()],
      month: MONTHS[d.getMonth()].slice(0, 3),
      relative: relative,
      monthKey: String(iso).slice(0, 7),
      monthLabel: MONTHS[d.getMonth()] + ' de ' + d.getFullYear()
    };
  }

  /* ---------- navigation ---------- */

  // "#/detail/abc" -> { view: 'detail', id: 'abc' }. With the id in the address, the open workout
  // survives a page reload (the id used to live only in memory).
  function parseRoute(hash) {
    const parts = String(hash || '').replace(/^#\/?/, '').split('/');
    return { view: parts[0] || 'dashboard', id: parts[1] || '' };
  }

  // Text of the "Instalar o app" card: already installed, browser button, iPhone (Safari only) or browser menu.
  function installHint(standalone, canPrompt, ios) {
    if (standalone) return 'O app já está instalado neste aparelho.';
    if (canPrompt) return 'Toque em Instalar: o Meu Treino ganha um ícone próprio e abre em tela cheia, sem a barra do navegador.';
    if (ios) return 'No iPhone, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". ' +
      'O app instalado começa vazio: antes, use Exportar no card Dados e depois Importar dentro do app.';
    return 'Abra o menu do navegador (⋮ ou ⋯) e escolha "Instalar app" ou "Adicionar à tela inicial".';
  }

  /* ---------- text and numbers ---------- */

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

  // Accepts a comma or a dot as the decimal separator (pt-BR uses the comma, and the
  // iPhone numeric keypad offers the comma).
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

  // Formats a number for display in a field (comma when the language uses a comma).
  function formatDecimal(value, useComma) {
    if (value === '' || value === null || value === undefined) return '';
    const n = parseLocalNumber(value);
    if (isNaN(n)) return '';
    const text = String(n);
    return useComma ? text.replace('.', ',') : text;
  }

  // Accent-insensitive search (e.g. "puxada maquina" finds "Puxada máquina").
  function normalizeText(value) {
    return String(value === null || value === undefined ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /* ---------- settings and week ---------- */

  function defaultSettings() {
    return {
      id: 'app',
      weekAnchor: todayISO(),
      weeklyWorkoutTarget: 3,
      weeklyCardioTarget: 120
    };
  }

  // 7-day window starting at the anchor date (inclusive).
  function weekWindow(anchorISO) {
    const anchor = anchorISO || todayISO();
    return { anchor: anchor, end: addDaysISO(anchor, 6) };
  }

  // Start of the next goal week: moves forward 7 days at a time (always at least once)
  // until the window reaches today. Someone who didn't open the app for 3 weeks doesn't need to tap 3 times.
  function nextWeekAnchor(anchorISO, todayIso) {
    let anchor = addDaysISO(anchorISO, 7);
    while (addDaysISO(anchor, 6) < todayIso) anchor = addDaysISO(anchor, 7);
    return anchor;
  }

  function isValidWorkout(w) {
    const hasSet = (w.sets || []).some(function (s) {
      return toNum(s.reps) > 0 || toNum(s.load) > 0;
    });
    return hasSet || toNum(w.cardioMinutes) > 0;
  }

  /* ---------- warm-up ---------- */

  function warmupHasData(warm) {
    if (!warm) return false;
    return [warm.reps, warm.load, warm.rir].some(function (v) {
      return v !== null && v !== undefined && v !== '';
    });
  }

  // useComma: shows the load with a comma (pt-BR), like the form field.
  function warmupLine(warm, useComma) {
    if (!warm) return '';
    const parts = [];
    if (warm.reps !== null && warm.reps !== undefined && warm.reps !== '') parts.push(warm.reps + ' reps');
    if (warm.load !== null && warm.load !== undefined && warm.load !== '') parts.push(formatDecimal(warm.load, useComma) + ' kg');
    if (warm.rir !== null && warm.rir !== undefined && warm.rir !== '') parts.push('RIR ' + warm.rir);
    return parts.join(' · ');
  }

  /* ---------- sets ---------- */

  function setLine(s, useComma) {
    const parts = [];
    parts.push((s.reps === null || s.reps === undefined) ? '—' : s.reps + ' reps');
    if (s.load !== null && s.load !== undefined) parts.push(formatDecimal(s.load, useComma) + ' kg');
    if (s.rir !== null && s.rir !== undefined) parts.push('RIR ' + s.rir);
    return parts.join(' · ');
  }

  // List (ul) of the sets, in the same style as the sheets' exercise list.
  function setsSummaryLines(sets, useComma) {
    const ordered = (sets || []).slice().sort(function (a, b) { return toNum(a.number) - toNum(b.number); });
    if (!ordered.length) return '';

    return '<ul class="list-unstyled sheet-items mb-0">' + ordered.map(function (s) {
      return '<li>' +
        '<span class="sheet-item-idx">' + esc(s.number || '?') + '</span>' +
        '<span class="sheet-item-detail">' + esc(setLine(s, useComma)) + '</span>' +
        (s.note ? '<span class="sheet-item-note text-truncate">' + esc(s.note) + '</span>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  /* ---------- Treinar form: one set row ---------- */

  // Widths (Bootstrap 12-column grid). The load gets col-3: "102,5" didn't fit in col-2.
  // The set number is a button (marks the set as done), so it needs col-2 for a finger.
  const SET_COLS = { number: 'col-2', reps: 'col-2', load: 'col-3', rir: 'col-2', note: 'col-3' };

  function setHeaderHtml() {
    return '<div class="row g-1 text-center fw-semibold small text-muted mb-1">' +
      '<div class="' + SET_COLS.number + '">série</div><div class="' + SET_COLS.reps + '">reps</div>' +
      '<div class="' + SET_COLS.load + '">carga</div><div class="' + SET_COLS.rir + '">RIR</div>' +
      '<div class="' + SET_COLS.note + '">obs</div>' +
      '</div>';
  }

  // The fields call setField(exercise, set, field, value), defined in app.js.
  // The number button calls toggleSetDone(exercise, set): marks the set as done and starts the rest timer.
  // A done set only changes color (no sound, vibration or animation).
  function setRowHtml(exIdx, setIdx, s, useComma) {
    function field(name) {
      return ' oninput="setField(' + exIdx + ',' + setIdx + ",'" + name + "',this.value)\"";
    }
    return '<div class="row g-1 mb-1 align-items-center">' +
      '<div class="' + SET_COLS.number + '"><button type="button" class="btn set-done w-100 ' + (s.done ? 'btn-success' : 'btn-outline-secondary') + '"' +
      ' aria-pressed="' + (s.done ? 'true' : 'false') + '" aria-label="Série ' + esc(s.number) + (s.done ? ' feita (toque para desmarcar)' : ': marcar como feita e iniciar o descanso') + '"' +
      ' onclick="toggleSetDone(' + exIdx + ',' + setIdx + ')">' + esc(s.number) + (s.done ? ' <i class="bi bi-check-lg"></i>' : '') + '</button></div>' +
      '<div class="' + SET_COLS.reps + '"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.reps) + '" aria-label="Reps da série ' + esc(s.number) + '"' + field('reps') + '></div>' +
      '<div class="' + SET_COLS.load + '"><input type="text" inputmode="decimal" autocomplete="off" class="form-control form-control-sm" value="' + esc(formatDecimal(s.load, useComma)) + '" aria-label="Carga da série ' + esc(s.number) + '"' + field('load') + '></div>' +
      '<div class="' + SET_COLS.rir + '"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.rir) + '" aria-label="RIR da série ' + esc(s.number) + '"' + field('rir') + '></div>' +
      '<div class="' + SET_COLS.note + '"><input type="text" class="form-control form-control-sm" value="' + esc(s.note) + '" aria-label="Observação da série ' + esc(s.number) + '"' + field('note') + '></div>' +
      '</div>';
  }

  /* ---------- reference by id (avoids a frozen name) ---------- */

  // Normalizes an exercise reference. Accepts { exerciseId, exerciseName }
  // or just the name (old callers).
  function exerciseTarget(target) {
    if (!target) return { exerciseId: null, exerciseName: '' };
    if (typeof target === 'string') return { exerciseId: null, exerciseName: target };
    return {
      exerciseId: target.exerciseId || null,
      exerciseName: target.exerciseName || target.name || ''
    };
  }

  // CURRENT name of the exercise: resolved by id in the list (library + catalog); falls back
  // to the stored name only when there's no id (old data) or the exercise was deleted.
  function exerciseLabel(item, exercises) {
    const ref = item || {};
    const list = exercises || [];

    if (ref.exerciseId) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === String(ref.exerciseId) && list[i].name) return list[i].name;
      }
    }

    return ref.exerciseName || ref.name || '';
  }

  // Same exercise? Compares by id when the reference has an id; otherwise by name.
  // The id is compared as TEXT: the same id can arrive as a number (record) or
  // text (HTML data-* attribute), and the two must match.
  function exerciseMatches(entry, target) {
    const e = entry || {};
    const t = exerciseTarget(target);

    if (t.exerciseId && e.exerciseId) return String(e.exerciseId) === String(t.exerciseId);
    if (!t.exerciseName && !e.exerciseName) return false;   // nothing to compare
    return (e.exerciseName || '(sem nome)') === (t.exerciseName || '(sem nome)');
  }

  // Is the exercise already in the list? Works for the workout form (exerciseName) and for the
  // sheet items (name). The same exercise twice in a workout becomes a single group on save
  // (shuffled sets and a lost warm-up), so the app doesn't allow repeats.
  function hasExercise(list, ref) {
    const target = exerciseTarget(ref);
    return (list || []).some(function (item) { return exerciseMatches(exerciseTarget(item), target); });
  }

  // Grouping key: the id when there is one, the name as a fallback (old data).
  // Normalized as text for the same reason as exerciseMatches.
  function exerciseKey(entry) {
    const e = entry || {};
    return e.exerciseId ? 'id:' + String(e.exerciseId) : 'nome:' + (e.exerciseName || '(sem nome)');
  }

  // Search target for an exercise's history: uses the id when the record has one;
  // without an id, uses the STORED name (old data only has that name to match on).
  function historyTarget(group) {
    return {
      exerciseId: (group && group.exerciseId) || null,
      exerciseName: (group && group.exerciseName) || ''
    };
  }

  // Groups the workout's flat sets by exercise (id-first, in the order they appear),
  // adding the exercise note and the saved warm-up.
  // Exercises with only a warm-up also become a group (otherwise the warm-up would be lost
  // when editing the workout).
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
        // Warm-up of an exercise with no working sets (or an old record).
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

  // History per exercise: always by id when the record has one, with the name
  // as a fallback (old data without an id).
  function lastLoadsForExercise(workouts, target) {
    const sorted = (workouts || []).filter(function (w) {
      return (w.sets || []).some(function (s) { return exerciseMatches(s, target); });
    }).sort(byDateDesc);

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
    }).sort(byDateDesc);

    if (!sorted.length) return null;
    const last = sorted[0];
    // The list was already filtered by this exercise's warm-up, so find always finds one.
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
    }).sort(byDateDesc);
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

  // Highest load ever logged for the exercise; 0 when it never had a load (bodyweight).
  function maxBestLoad(workouts, target) {
    return (workouts || []).reduce(function (max, w) {
      const best = bestSetForExercise(w, target);
      return (best && best.load > max) ? best.load : max;
    }, 0);
  }

  // Estimated 1RM (the load you could lift once), Epley formula: load × (1 + reps/30).
  // One rep is the load itself; without a load or reps there's no estimate (0).
  // shortcut: Epley loses precision above ~12 reps; it's for comparing workouts, not a target load.
  function estimate1RM(load, reps) {
    const kg = toNum(load);
    const n = toNum(reps);
    if (kg <= 0 || n <= 0) return 0;
    return n === 1 ? kg : Math.round(kg * (1 + n / 30) * 10) / 10;
  }

  // Highest estimated 1RM of the exercise in a workout: shows progress even when the load didn't go up
  // (more reps with the same load).
  function best1RMForExercise(workout, target) {
    let best = 0;
    ((workout && workout.sets) || []).forEach(function (s) {
      if (exerciseMatches(s, target)) best = Math.max(best, estimate1RM(s.load, s.reps));
    });
    return best;
  }

  /* ---------- personal records ---------- */

  // Exercises where this workout beat the load record, compared only with workouts on
  // EARLIER dates. The first time an exercise is done doesn't count as a record.
  // Computed on the fly (nothing is stored), so it works for the whole history.
  function workoutRecords(workouts, workout) {
    const w = workout || {};
    const earlier = (workouts || []).filter(function (x) {
      return x.date < w.date && String(x.id) !== String(w.id);
    });
    const records = [];

    groupSets(w.sets, []).forEach(function (g) {
      const today = bestSetForExercise(w, g);
      let previous = 0;
      earlier.forEach(function (x) {
        const best = bestSetForExercise(x, g);
        if (best && best.load > previous) previous = best.load;
      });
      if (previous > 0 && today.load > previous) {
        records.push({
          exerciseId: g.exerciseId,
          exerciseName: g.exerciseName,
          load: today.load,
          reps: today.reps,
          previous: previous
        });
      }
    });

    return records;
  }

  // How many records each workout beat ({ id: n }), in a single pass over the history.
  // Same result as workoutRecords(workouts, w).length for each w (unique ids), but without
  // scanning the whole history per workout: with hundreds of workouts Início froze.
  // Keeps the exerciseMatches rule: id against id; with no id on one side, compare the name.
  function recordCounts(workouts) {
    const list = (workouts || []).filter(function (w) { return w && w.date != null; })
      .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    const byId = Object.create(null);        // highest load per id
    const noIdByName = Object.create(null);  // highest load of the sets without an id, per name
    const byName = Object.create(null);      // highest load of all sets, per name
    const counts = {};
    (workouts || []).forEach(function (w) { if (w) counts[w.id] = 0; });

    let i = 0;
    while (i < list.length) {
      let j = i;
      while (j < list.length && list[j].date === list[i].date) j++;
      // workouts on the same day compare only with earlier days: count them all before adding the day
      for (let k = i; k < j; k++) {
        const w = list[k];
        groupSets(w.sets, []).forEach(function (g) {
          const today = bestSetForExercise(w, g);
          const previous = g.exerciseId
            ? Math.max(byId[String(g.exerciseId)] || 0, noIdByName[g.exerciseName] || 0)
            : (byName[g.exerciseName] || 0);
          if (previous > 0 && today.load > previous) counts[w.id]++;
        });
      }
      for (let k = i; k < j; k++) {
        (list[k].sets || []).forEach(function (s) {
          const load = toNum(s.load);
          const name = s.exerciseName || '(sem nome)';
          if (s.exerciseId) byId[String(s.exerciseId)] = Math.max(byId[String(s.exerciseId)] || 0, load);
          else noIdByName[name] = Math.max(noIdByName[name] || 0, load);
          byName[name] = Math.max(byName[name] || 0, load);
        });
      }
      i = j;
    }
    return counts;
  }

  /* ---------- form: last session, repeat workout, draft ---------- */

  // Most recent first. On the same day, ties are broken by the time the workout was created:
  // without that, with two workouts in a day, "Última vez" could pick either one.
  function byDateDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ca = a.createdAt || '';
    const cb = b.createdAt || '';
    return ca < cb ? 1 : (ca > cb ? -1 : 0);
  }

  function blankIfNull(v) {
    return (v === null || v === undefined) ? '' : v;
  }

  // Sets from the last time this exercise was done (ignoring the workout being edited),
  // for the "última vez" hint in the form.
  function lastSessionForExercise(workouts, target, excludeId) {
    const sorted = (workouts || []).filter(function (w) {
      if (excludeId && String(w.id) === String(excludeId)) return false;
      return (w.sets || []).some(function (s) { return exerciseMatches(s, target); });
    }).sort(byDateDesc);

    if (!sorted.length) return null;
    const sets = sorted[0].sets.filter(function (s) { return exerciseMatches(s, target); })
      .sort(function (a, b) { return toNum(a.number) - toNum(b.number); })
      .map(function (s) { return { number: s.number, reps: s.reps, load: s.load, rir: s.rir }; });
    return { date: sorted[0].date, sets: sets };
  }

  // "27 kg × 12 (RIR 2) · 27 kg × 10" — compact, to fit on one line on a phone.
  function lastSessionLine(session, useComma) {
    if (!session) return '';
    return session.sets.map(function (s) {
      const load = formatDecimal(s.load, useComma);
      const reps = blankIfNull(s.reps) === '' ? '—' : s.reps;
      return (load ? load + ' kg × ' : '') + reps + (blankIfNull(s.rir) === '' ? '' : ' (RIR ' + s.rir + ')');
    }).join(' · ');
  }

  // Last workout logged with this sheet (ignoring the workout being edited).
  function lastWorkoutForSheet(workouts, sheetId, excludeId) {
    if (!sheetId) return null;
    const sorted = (workouts || []).filter(function (w) {
      if (excludeId && String(w.id) === String(excludeId)) return false;
      const id = w.sheetId || w.typeId;
      return !!id && String(id) === String(sheetId) && ((w.sets || []).length + (w.warmups || []).length) > 0;
    }).sort(byDateDesc);
    return sorted[0] || null;
  }

  // Suggested sheet for the next workout: the one after the last one used, in alphabetical order
  // (TREINO A -> B -> C -> A). With no history, or if the last sheet is no longer active, the first one.
  function nextSheet(workouts, sheets) {
    const active = (sheets || []).filter(function (s) { return s && s.active !== false; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'pt-BR'); });
    if (!active.length) return null;

    const last = (workouts || []).filter(function (w) { return w.sheetId || w.typeId; }).sort(byDateDesc)[0];
    const lastId = last ? String(last.sheetId || last.typeId) : '';
    let index = -1;
    active.forEach(function (s, i) { if (String(s.id) === lastId) index = i; });
    return active[(index + 1) % active.length];
  }

  // Form from an earlier workout: same exercises, reps and loads.
  // RIR and notes stay blank (they belong to today's workout).
  function formFromWorkout(workout) {
    const w = workout || {};
    return groupSets(w.sets, w.warmups).map(function (g) {
      const sets = g.sets.slice().sort(function (a, b) { return toNum(a.number) - toNum(b.number); });
      return {
        exerciseId: g.exerciseId,
        exerciseName: g.exerciseName,
        note: g.note,
        warmup: { reps: blankIfNull(g.warmup.reps), load: blankIfNull(g.warmup.load), rir: '' },
        sets: sets.map(function (s, i) {
          return { number: i + 1, reps: blankIfNull(s.reps), load: blankIfNull(s.load), rir: '', note: '' };
        })
      };
    });
  }

  // Does the form set have anything filled in (reps, load, RIR or note)?
  function setHasData(s) {
    return [s.reps, s.load, s.rir, s.note].some(function (v) { return blankIfNull(v) !== ''; });
  }

  // Does the form exercise have anything that would be lost on removal (a filled-in set or warm-up)?
  function groupHasData(group) {
    const g = group || {};
    return warmupHasData(g.warmup) || (g.sets || []).some(setHasData);
  }

  // Draft of the workout in progress: worth saving/offering only if something is filled in.
  function draftHasContent(draft) {
    if (!draft) return false;
    return (draft.formSets || []).length > 0 || toNum(draft.cardio) > 0 || String(draft.notes || '').trim() !== '';
  }

  /* ---------- rest ---------- */

  // Default rest time (seconds): the user's if it's reasonable, otherwise 90.
  function restSecondsOf(settings) {
    const n = Math.round(toNum(settings && settings.restSeconds));
    return (n >= 10 && n <= 900) ? n : 90;
  }

  // 75 -> "1:15"; negative becomes 0:00.
  function fmtClock(seconds) {
    const s = Math.max(0, Math.ceil(toNum(seconds)));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }

  /* ---------- Início list ---------- */

  // First day of the previous month: Início shows the current month and the previous one.
  function recentCutoff(todayIso) {
    const d = parseDate(todayIso);
    return fmtDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  // How many workouts (from a list in descending date order) to show without expanding:
  // those of the current and previous month, and at least `minCount` (for someone who took a break).
  function visibleWorkoutCount(sortedDesc, todayIso, minCount) {
    const list = sortedDesc || [];
    const cutoff = recentCutoff(todayIso);
    const recent = list.filter(function (w) { return w.date >= cutoff; }).length;
    return Math.min(list.length, Math.max(recent, minCount));
  }

  // Sheet names found in the workouts (for the Início filter), in alphabetical order.
  function sheetFilterOptions(workouts, sheets) {
    const seen = {};
    (workouts || []).forEach(function (w) {
      const label = sheetLabel(w, sheets);
      if (label) seen[label] = true;
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  /* ---------- calendar ---------- */

  // Workouts per day: { "2026-10-08": [most recent, ...] }. A workout without a valid date is left out.
  function workoutsByDate(workouts) {
    const map = {};
    (workouts || []).slice().sort(byDateDesc).forEach(function (w) {
      if (!ISO_DATE.test(String(w.date))) return;
      (map[w.date] = map[w.date] || []).push(w);
    });
    return map;
  }

  /* ---------- weekly progress ---------- */

  // Volume (tonnage) of a workout: sum of reps × load of the working sets.
  // The warm-up doesn't count (app rule).
  function workoutVolume(workout) {
    return ((workout && workout.sets) || []).reduce(function (sum, s) {
      return sum + toNum(s.reps) * toNum(s.load);
    }, 0);
  }

  // 12400 -> "12.400" (thousands with a dot, pt-BR). Done by hand so it doesn't depend on the device language.
  function fmtThousands(n) {
    return String(Math.round(toNum(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Summary of a workout for the Início card: "5 exercícios · 12.400 kg · 30 min cardio".
  // Zero parts are left out; an empty workout returns ''.
  function workoutSummary(workout) {
    const w = workout || {};
    const parts = [];
    const exercises = groupSets(w.sets, w.warmups).length;
    const volume = workoutVolume(w);
    const cardio = toNum(w.cardioMinutes);
    if (exercises) parts.push(exercises + (exercises === 1 ? ' exercício' : ' exercícios'));
    if (volume > 0) parts.push(fmtThousands(volume) + ' kg');
    if (cardio > 0) parts.push(cardio + ' min cardio');
    return parts.join(' · ');
  }

  // Totals of the last `count` weeks (7-day windows like the goals), from the oldest to the current one.
  function weeklyTotals(workouts, anchorIso, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = addDaysISO(anchorIso, -7 * i);
      const end = addDaysISO(start, 6);
      const week = { start: start, end: end, workouts: 0, volume: 0, cardio: 0 };
      (workouts || []).forEach(function (w) {
        if (w.date < start || w.date > end || !isValidWorkout(w)) return;
        week.workouts++;
        week.volume += workoutVolume(w);
        week.cardio += toNum(w.cardioMinutes);
      });
      week.volume = Math.round(week.volume);
      out.push(week);
    }
    return out;
  }

/* ---------- current sheet name ---------- */

  // The workout stores the sheet name as it was on the day it was logged (snapshot).
  // To DISPLAY it, we resolve by id: that way renaming the sheet shows across the app.
  // If the sheet was deleted (or the record is old, without an id), we use the stored name.
  function sheetLabel(workout, sheets) {
    const w = workout || {};
    const list = sheets || [];

    if (w.sheetId) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === String(w.sheetId) && list[i].name) return list[i].name;
      }
    }

    return w.sheetName || w.typeName || '';
  }

  /* ---------- export workout as text ---------- */

  // Formatted for WhatsApp: *bold*, _italic_, "1." and "- " become lists there.
  function workoutAsText(workout, sheets, exercises, useComma) {
    const lines = [];
    lines.push('*' + fmtBR(workout.date) + '*');

    const sheetName = sheetLabel(workout, sheets);
    if (sheetName) lines.push('Ficha: _' + sheetName + '_');
    lines.push('');

    const groups = groupSets(workout.sets, workout.warmups);

    groups.forEach(function (g, i) {
      // The teacher's note (g.note) is left out: it is her own text, so sending it back is noise.
      lines.push((i + 1) + '. *' + exerciseLabel(g, exercises) + '*');

      if (warmupHasData(g.warmup)) lines.push('- Aquecimento: ' + warmupLine(g.warmup, useComma));

      g.sets.slice().sort(function (a, b) { return toNum(a.number) - toNum(b.number); }).forEach(function (s) {
        let line = '- Série ' + (s.number || '?') + ': ' + setLine(s, useComma);
        if (s.note) line += ' _(' + s.note + ')_';
        lines.push(line);
      });

      lines.push('');
    });

    const cardio = toNum(workout.cardioMinutes);
    if (cardio > 0) lines.push('*Cardio:* ' + cardio + ' min');
    if (workout.notes) lines.push('*Observações:* ' + workout.notes);

    return lines.join('\n').trim();
  }

/* ---------- sample data ---------- */

  // The sample data stores dates as an offset in days (dayOffset),
  // so the demo always stays recent relative to today.
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

  // ---------- reference by id (foreign key) ----------

  // Links old sheet items (name only) to the Biblioteca exercise when the name matches
  // unambiguously. It's the migration that gives existing sheets a "foreign key".
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
        if (ids.length !== 1) return item;   // ambiguous or unknown name: leave it alone
        changed++;
        sheetChanged = true;
        return Object.assign({}, item, { exerciseId: ids[0] });
      });
      return sheetChanged ? Object.assign({}, sheet, { exercises: items }) : sheet;
    });

    return { sheets: updated, changed: changed };
  }

  // Renaming an exercise must carry over to the sheets: by id (preferred) and, for old
  // items without an id, by the previous name.
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

  // In the history we only update records that point to the exercise id
  // (we don't rewrite old entries that only have the name).
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

  /* ---------- exercise search (picker for the workout, the sheet and the exercise form) ---------- */

  // Search result list: "Criar …", Biblioteca (when asked for and with results) and Catálogo.
  // fn = names of the app.js functions called on tap: { create, library, catalog }.
  // Without fn.library the Biblioteca is left out (exercise form: only the catalog matters).
  function pickerHtml(query, library, catalog, fn) {
    const q = String(query || '').trim();
    const lower = normalizeText(q);

    function matches(list, limit) {
      return (list || []).filter(function (e) {
        return !lower || normalizeText(e.name).indexOf(lower) !== -1;
      }).slice(0, limit);
    }

    function row(e, handler) {
      return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="' + handler + "('" + esc(e.id) + "')\">" +
        '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
    }

    const lib = fn.library ? matches(libraryExercises(library), 30) : [];
    const cat = matches(catalog, 50);

    return (q ? '<button type="button" class="list-group-item list-group-item-action text-primary fw-semibold" onclick="' + fn.create + '()">' +
        '<i class="bi bi-plus-circle"></i> Criar "' + esc(q) + '"</button>' : '') +
      (lib.length ? '<div class="px-2 py-1 small text-muted fw-semibold">Biblioteca</div>' +
        lib.map(function (e) { return row(e, fn.library); }).join('') : '') +
      '<div class="px-2 py-1 small text-muted fw-semibold">Catálogo (pt-BR)</div>' +
      (cat.length ? cat.map(function (e) { return row(e, fn.catalog); }).join('')
        : '<div class="list-group-item small text-muted">Nada encontrado.</div>');
  }

  /* ---------- backup ---------- */

  // File name with date and time, to tell apart backups from the same day.
  // E.g. meu-treino-backup-2026-10-12_13-35-42.json
  function backupFileName(date) {
    const d = date || new Date();
    return 'meu-treino-backup-' + fmtDate(d) +
      '_' + pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds()) +
      '.json';
  }

  // Local date and time in Brazilian format: 12/10/2026 13:35
  function fmtDateTimeBR(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // Backup status: when the last one was and whether it's time to remind the user.
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

  // Decides what to do when the user asks for a backup: open the share menu
  // (phone/tablet, which can share files) or download the file (computer).
  // That way one action produces only ONE file.
  function backupAction(options) {
    const opts = options || {};
    if (opts.canShareFiles && opts.touch) return 'share';
    return 'download';
  }

  // Content sent to the share menu: ONLY the file, nothing else.
  // No "text" and no "title": some devices treat the title/text as a second
  // item and save a .txt file along with the JSON.
  function backupSharePayload(file) {
    return { files: [file] };
  }

  // A real backup has the JSON and the file name. Any other value
  // (for example, the click event the handler receives) is ignored.
  function isBackupPayload(value) {
    return !!(value && typeof value.json === 'string' && typeof value.name === 'string' && value.name);
  }

  // Hint shown under the Exportar button: says where the file goes on this device.
  function backupHint(action) {
    return action === 'share'
      ? 'Abre o menu do celular para salvar no Drive, WhatsApp ou Arquivos.'
      : 'Baixa o arquivo .json do backup para guardar onde quiser.';
  }

  /* ---------- user library ---------- */

  // An exercise shows in the Biblioteca unless it's provably from the catalog
  // (source 'catalog' WITH a catalogId). Nothing is inferred from the name: guessing hid
  // exercises the user created.
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

  // Pure decision of the source repair: anything marked "catalog" without a catalogId
  // goes back to "custom" (the old guessing hid exercises the user created).
  function fixLibrarySources(exercises) {
    let changed = 0;

    const updated = (exercises || []).map(function (e) {
      if (!e || !(e.source === 'catalog' && !e.catalogId)) return e;
      changed++;
      return Object.assign({}, e, { source: 'custom' });
    });

    return { exercises: updated, changed: changed };
  }

  /* ---------- backup compatibility across versions ---------- */

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

  // Same limit as the sheet editor (which draws at most 20 reps fields).
  const MAX_SETS = 20;

  function normalizeSheetItem(item) {
    if (!item) return null;

    const raw = item;
    const legacySingle = !Array.isArray(raw.reps) && raw.reps !== undefined && raw.reps !== null && raw.reps !== '';
    let reps = Array.isArray(raw.reps) ? raw.reps.slice(0, MAX_SETS) : [];

    const sets = Math.min(MAX_SETS, Math.max(1, parseInt(raw.sets, 10) || reps.length || 3));

    if (legacySingle) {
      // v2: the sheet stored a single reps value (e.g. 3x12) -> it applies to every set.
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

  // Sheet imported as JSON (format in FICHA-JSON.md): an object { name, exercises }, a list
  // of them, or { fichas: [...] }. Returns [{ name, exercises }] already normalized or throws an Error with the reason.
  function parseSheetImport(payload) {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.fichas) ? payload.fichas : [payload]);
    if (!list.length) throw new Error('Nenhuma ficha no arquivo.');
    return list.map(function (s, i) {
      const where = 'Ficha ' + (i + 1);
      if (!s || typeof s !== 'object') throw new Error(where + ': formato inválido.');
      const name = typeof s.name === 'string' ? s.name.trim() : '';
      if (!name) throw new Error(where + ': falta o "name".');
      if (!Array.isArray(s.exercises) || !s.exercises.length) throw new Error('"' + name + '": falta a lista "exercises".');
      const exercises = s.exercises.map(function (item, j) {
        const exName = item && typeof item.name === 'string' ? item.name.trim() : '';
        if (!exName) throw new Error('"' + name + '", exercício ' + (j + 1) + ': falta o "name".');
        const normalized = normalizeSheetItem({ name: exName, sets: item.sets, reps: item.reps, note: typeof item.note === 'string' ? item.note.trim() : '' });
        normalized.reps = normalized.reps.slice(0, normalized.sets);
        return normalized;
      });
      return { name: name, exercises: exercises };
    });
  }

  // Pasted text (the AI's answer) -> sheets. The AI often fences the JSON with ```json ... ```: we strip the fence.
  // Broken JSON throws SyntaxError; valid JSON outside the contract throws an Error with the reason.
  function parseSheetImportText(text) {
    return parseSheetImport(parseAiJson(text));
  }

  function parseAiJson(text) {
    return JSON.parse(String(text).replace(/^\s*```(?:json)?|```\s*$/g, ''));
  }

  /* ---------- import old workouts + recreated sheets (TREINO-JSON.md) ---------- */

  // JSON date: YYYY-MM-DD or DD/MM/YYYY, and it must exist in the calendar (31/02 doesn't pass).
  function importDate(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    const iso = br ? br[3] + '-' + pad2(br[2]) + '-' + pad2(br[1]) : text;
    return ISO_DATE.test(iso) && fmtDate(parseDate(iso)) === iso ? iso : '';
  }

  // Optional number: missing becomes null; text that isn't a number (or is negative) is an error, never a guess.
  function importNumber(value, where) {
    if (value === undefined || value === null || value === '') return null;
    const n = parseLocalNumber(value);
    if (isNaN(n) || n < 0) throw new Error(where + ': "' + value + '" não é um número válido.');
    return n;
  }

  function importText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function importSetFields(raw, where) {
    return {
      reps: importNumber(raw.reps, where),
      load: importNumber(raw.load, where),
      rir: importNumber(raw.rir, where)
    };
  }

  // List of workouts done -> [{ date, sheetName, cardioMinutes, notes, exercises: [{ name, note, warmup, sets }] }]
  // in date order, or an Error naming the workout and the field. Dates after `today` are rejected.
  function parseWorkoutList(list, today) {
    return list.map(function (w, i) {
      if (!w || typeof w !== 'object') throw new Error('Treino ' + (i + 1) + ': formato inválido.');
      const date = importDate(w.date);
      if (!date) throw new Error('Treino ' + (i + 1) + ': "date" ausente ou inválida (use AAAA-MM-DD).');
      const where = 'Treino de ' + fmtBR(date);
      if (date > today) throw new Error(where + ': a data está no futuro.');
      if (w.exercises !== undefined && !Array.isArray(w.exercises)) throw new Error(where + ': "exercises" precisa ser uma lista.');
      const cardioMinutes = importNumber(w.cardioMinutes, where + ', cardioMinutes') || 0;

      const exercises = (w.exercises || []).map(function (ex, j) {
        const name = ex && typeof ex === 'object' ? importText(ex.name) : '';
        if (!name) throw new Error(where + ', exercício ' + (j + 1) + ': falta o "name".');
        const label = where + ', ' + name;
        if (!Array.isArray(ex.sets) || !ex.sets.length) throw new Error(label + ': falta a lista "sets".');
        const sets = ex.sets.map(function (s, k) {
          const setWhere = label + ', série ' + (k + 1);
          if (!s || typeof s !== 'object') throw new Error(setWhere + ': formato inválido.');
          return Object.assign(importSetFields(s, setWhere), { note: importText(s.note) });
        }).filter(function (s) { return s.reps !== null || s.load !== null; });
        if (!sets.length) throw new Error(label + ': nenhuma série com "reps" ou "load".');
        const warmup = ex.warmup && typeof ex.warmup === 'object' ? importSetFields(ex.warmup, label + ', aquecimento') : null;
        return { name: name, note: importText(ex.note), warmup: warmupHasData(warmup) ? warmup : null, sets: sets };
      });

      if (!exercises.length && !cardioMinutes) throw new Error(where + ': sem exercícios nem cardio.');
      return { date: date, sheetName: importText(w.ficha), cardioMinutes: cardioMinutes, notes: importText(w.notes), exercises: exercises };
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  // TREINO-JSON.md format: { "fichas": [...], "treinos": [...] }. The sheets follow FICHA-JSON.md
  // and are optional; a bare list counts as workouts only. Returns { sheets, workouts } or throws an Error.
  function parseHistoryImport(payload, today) {
    const data = Array.isArray(payload) ? { treinos: payload } : (payload || {});
    if (!Array.isArray(data.treinos) || !data.treinos.length) throw new Error('Falta a lista "treinos" (com pelo menos um treino).');
    if (data.fichas !== undefined && !Array.isArray(data.fichas)) throw new Error('"fichas" precisa ser uma lista.');
    const sheets = data.fichas && data.fichas.length ? parseSheetImport(data.fichas) : [];
    sheets.forEach(function (s, i) {
      const twin = sheets.findIndex(function (o) { return normalizeText(o.name) === normalizeText(s.name); });
      if (twin !== i) throw new Error('Ficha "' + s.name + '" aparece duas vezes em "fichas".');
    });
    return { sheets: sheets, workouts: parseWorkoutList(data.treinos, today || todayISO()) };
  }

  function parseHistoryImportText(text, today) {
    return parseHistoryImport(parseAiJson(text), today);
  }

  // App sheet with the same name (ignoring case and accents), active ones first.
  function sheetByName(sheets, name) {
    const key = normalizeText(name);
    const same = key ? (sheets || []).filter(function (s) { return normalizeText(s.name) === key; }) : [];
    return same.find(function (s) { return s.active !== false; }) || same[0] || null;
  }

  // Sheets from the JSON: those already in the app (same name) are reused, not duplicated.
  function splitImportedSheets(sheets, existing) {
    const fresh = [];
    const reused = [];
    sheets.forEach(function (s) {
      (sheetByName(existing, s.name) ? reused : fresh).push(s);
    });
    return { fresh: fresh, reused: reused };
  }

  // Imported workout -> database record (without id and creation dates). The sheet is linked by name;
  // with no match, the workout keeps just the name. exerciseFor(name) returns { id, name }.
  function importedWorkout(item, sheets, exerciseFor) {
    const sheet = sheetByName(sheets, item.sheetName);
    const sets = [];
    const warmups = [];
    item.exercises.forEach(function (ex) {
      const found = exerciseFor(ex.name);
      if (ex.warmup) {
        warmups.push({ exerciseId: found.id, exerciseName: found.name, reps: ex.warmup.reps, load: ex.warmup.load, rir: ex.warmup.rir });
      }
      ex.sets.forEach(function (s, k) {
        sets.push({
          exerciseId: found.id,
          exerciseName: found.name,
          number: k + 1,
          reps: s.reps,
          load: s.load,
          rir: s.rir,
          note: s.note,
          exerciseNote: ex.note
        });
      });
    });
    return {
      date: item.date,
      sheetId: sheet ? sheet.id : null,
      sheetName: sheet ? sheet.name : item.sheetName,
      cardioMinutes: item.cardioMinutes,
      notes: item.notes,
      warmups: warmups,
      sets: sets
    };
  }

  // "Fingerprint" of a workout: date, cardio and reps×load of each set, in order.
  // Uses no names: renaming an exercise or sheet doesn't make a reimported workout look new.
  function workoutFingerprint(w) {
    const sets = w.exercises
      ? w.exercises.reduce(function (all, ex) { return all.concat(ex.sets); }, [])
      : (w.sets || []);
    return [w.date, toNum(w.cardioMinutes)].concat(sets.map(function (s) {
      return toNum(s.reps) + 'x' + toNum(s.load);
    })).join('|');
  }

  // Splits the JSON's workouts into new and repeated (already in the app, or twice in the same JSON).
  function splitImportedWorkouts(items, existing) {
    const seen = {};
    (existing || []).forEach(function (w) { seen[workoutFingerprint(w)] = true; });
    const fresh = [];
    const repeated = [];
    items.forEach(function (item) {
      const key = workoutFingerprint(item);
      (seen[key] ? repeated : fresh).push(item);
      seen[key] = true;
    });
    return { fresh: fresh, repeated: repeated };
  }

  // Exercise names used in the JSON (sheets + workouts), without repeats, in the order they appear.
  function historyExerciseNames(parsed) {
    const seen = {};
    const names = [];
    parsed.sheets.concat(parsed.workouts).forEach(function (item) {
      item.exercises.forEach(function (ex) {
        const key = normalizeText(ex.name);
        if (seen[key]) return;
        seen[key] = true;
        names.push(ex.name);
      });
    });
    return names;
  }

  function countLabel(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  // Review summary: new workouts (with the date range), repeated ones that will be skipped and new/reused sheets.
  // workouts = splitImportedWorkouts(...), sheets = splitImportedSheets(...).
  function historyImportSummaryHtml(workouts, sheets) {
    const fresh = workouts.fresh;
    const rows = sheets.fresh.map(function (s) {
      return '<li><span class="sheet-item-name">' + esc(s.name) + '</span><span class="sheet-item-detail ms-auto">nova · ' +
        countLabel(s.exercises.length, 'exercício', 'exercícios') + '</span></li>';
    }).concat(sheets.reused.map(function (s) {
      return '<li><span class="sheet-item-name">' + esc(s.name) + '</span><span class="sheet-item-detail ms-auto">já existe, será usada</span></li>';
    }));
    return '<p class="fw-bold mb-2">' + countLabel(fresh.length, 'treino novo', 'treinos novos') +
        (fresh.length ? ' <span class="fw-normal text-muted">(' + fmtBR(fresh[0].date) + ' a ' + fmtBR(fresh[fresh.length - 1].date) + ')</span>' : '') + '</p>' +
      (workouts.repeated.length
        ? '<p class="small text-muted mb-2">' + countLabel(workouts.repeated.length, 'treino já estava', 'treinos já estavam') + ' no app e não será importado de novo.</p>'
        : '') +
      (rows.length
        ? '<p class="fw-bold mb-2">Fichas</p><div class="card mb-3"><div class="card-body py-2"><ul class="list-unstyled sheet-items mb-0">' + rows.join('') + '</ul></div></div>'
        : '<p class="small text-muted mb-3">Nenhuma ficha no JSON: os treinos ficam ligados às fichas de mesmo nome que já existem.</p>');
  }

  // Notice after importing: "3 treinos importados e 2 fichas criadas." (each part only when there is one).
  function historyImportToast(workoutCount, sheetCount) {
    const parts = [];
    if (workoutCount) parts.push(countLabel(workoutCount, 'treino importado', 'treinos importados'));
    if (sheetCount) parts.push(countLabel(sheetCount, 'ficha criada', 'fichas criadas'));
    return parts.join(' e ') + '.';
  }

  // List of the app's sheets to paste into the AI along with TREINO-JSON.md.
  function sheetNamesText(sheets) {
    const lines = (sheets || []).filter(function (s) { return s && s.name; }).map(function (s) {
      return '- ' + s.name + (s.active === false ? ' (desativada)' : '');
    });
    return '## Fichas que já existem no app\n\n' +
      'Quando um treino for uma destas fichas, use o nome EXATAMENTE como está aqui, sem "(desativada)", ' +
      'e não a coloque em "fichas" de novo.\n\n' +
      (lines.length ? lines.join('\n') : '(nenhuma)') + '\n';
  }

  const NAME_STOPWORDS =['a', 'o', 'e', 'ao', 'de', 'da', 'do', 'das', 'dos', 'com', 'no', 'na', 'em'];
  function nameWords(value) {
    return normalizeText(value).split(/[^a-z0-9]+/).filter(function (w) {
      return w && NAME_STOPWORDS.indexOf(w) === -1;
    });
  }

  // Exercises similar to a name (words in common / length of the longer name).
  // Ties keep the list order: pass the Biblioteca before the catalog. minScore (0..1) drops the weak ones.
  function suggestExercises(name, list, limit, minScore) {
    const query = nameWords(name);
    return (list || []).map(function (e, i) {
      const words = nameWords(e.name);
      const hits = query.filter(function (w) { return words.indexOf(w) !== -1; }).length;
      return { e: e, i: i, score: hits ? hits / Math.max(query.length, words.length) : 0 };
    }).filter(function (r) { return r.score > 0 && r.score >= (minScore || 0); })
      .sort(function (a, b) { return (b.score - a.score) || (a.i - b.i); })
      .slice(0, limit || 5)
      .map(function (r) { return r.e; });
  }

  // List of names (Biblioteca + catalog, no repeats) to paste into the AI along with FICHA-JSON.md.
  function exerciseNamesText(library, catalog) {
    const seen = {};
    function lines(list) {
      return (list || []).filter(function (e) {
        const key = normalizeText(e && e.name);
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      }).map(function (e) { return '- ' + e.name + (e.group ? ' (' + e.group + ')' : ''); });
    }
    const lib = lines(library);
    const cat = lines(catalog);
    return '## Exercícios que já existem no app\n\n' +
      'Quando um exercício do plano for um destes, use o nome EXATAMENTE como está aqui, sem o grupo entre parênteses.\n\n' +
      '### Minha biblioteca\n' + (lib.length ? lib.join('\n') : '(vazia)') + '\n\n' +
      '### Catálogo do app\n' + cat.join('\n') + '\n';
  }

  function normalizeWorkout(w) {
    const workout = Object.assign({}, w);

    // v1: sheets were "workout types" (typeId/typeName).
    workout.sheetId = (w.sheetId === undefined || w.sheetId === null) ? (w.typeId || null) : w.sheetId;
    workout.sheetName = w.sheetName || w.typeName || '';
    delete workout.typeId;
    delete workout.typeName;

    // A date in the wrong format becomes "no date" (the workout isn't lost, it just leaves the calendar).
    workout.date = ISO_DATE.test(String(w.date)) ? w.date : '';
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
    settings.weekAnchor = ISO_DATE.test(String(settings.weekAnchor)) ? settings.weekAnchor : todayISO();
    settings.weeklyWorkoutTarget = toNum(settings.weeklyWorkoutTarget) || 3;
    settings.weeklyCardioTarget = (settings.weeklyCardioTarget === undefined || settings.weeklyCardioTarget === null)
      ? 120
      : toNum(settings.weeklyCardioTarget);
    return settings;
  }

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  // The backup file may have been edited by hand or come from someone else, and the id ends up
  // in HTML onclick attributes. Only ids with letters, digits, "-" and "_" get in
  // (that's everything the app has ever generated: UUID, "id-123-abc", "w1", catalog integer).
  function hasSafeId(record) {
    return !!record && !!record.id && /^[\w-]+$/.test(String(record.id));
  }

  // Converts any backup (v1 or current) to the current format, without losing data.
  function normalizeBackup(data) {
    const source = data || {};

    // v1: sheets were "workout types" (name only, no exercises).
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
      workouts: (source.workouts || []).filter(hasSafeId).map(normalizeWorkout),
      sheets: rawSheets.filter(hasSafeId).map(normalizeSheet),
      exercises: (source.exercises || []).filter(hasSafeId).map(normalizeExercise),
      settings: normalizeSettings(source.settings),
      colinha: (source.colinha || []).filter(hasSafeId)
    };
  }

  return {
    // dates
    pad2: pad2,
    fmtDate: fmtDate,
    parseDate: parseDate,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    fmtBR: fmtBR,
    shiftMonth: shiftMonth,
    parseRoute: parseRoute,
    installHint: installHint,
    dateParts: dateParts,
    // text and numbers
    esc: esc,
    toNum: toNum,
    toNumOrNull: toNumOrNull,
    parseLocalNumber: parseLocalNumber,
    formatDecimal: formatDecimal,
    normalizeText: normalizeText,
    // settings and week
    defaultSettings: defaultSettings,
    weekWindow: weekWindow,
    nextWeekAnchor: nextWeekAnchor,
    isValidWorkout: isValidWorkout,
    // sample data
    materializeSampleData: materializeSampleData,
    // reference by id
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
    // library
    isUserExercise: isUserExercise,
    libraryExercises: libraryExercises,
    pickerHtml: pickerHtml,
    fixLibrarySources: fixLibrarySources,
    // warm-up and sets
    warmupHasData: warmupHasData,
    warmupLine: warmupLine,
    setLine: setLine,
    setsSummaryLines: setsSummaryLines,
    setHeaderHtml: setHeaderHtml,
    setRowHtml: setRowHtml,
    groupSets: groupSets,
    // history
    lastLoadsForExercise: lastLoadsForExercise,
    lastWarmupForExercise: lastWarmupForExercise,
    previousWarmupFields: previousWarmupFields,
    sessionsForExercise: sessionsForExercise,
    bestSetForExercise: bestSetForExercise,
    maxBestLoad: maxBestLoad,
    estimate1RM: estimate1RM,
    best1RMForExercise: best1RMForExercise,
    // records
    workoutRecords: workoutRecords,
    recordCounts: recordCounts,
    // form, rest, Início and progress
    byDateDesc: byDateDesc,
    lastSessionForExercise: lastSessionForExercise,
    lastSessionLine: lastSessionLine,
    lastWorkoutForSheet: lastWorkoutForSheet,
    nextSheet: nextSheet,
    formFromWorkout: formFromWorkout,
    draftHasContent: draftHasContent,
    groupHasData: groupHasData,
    setHasData: setHasData,
    restSecondsOf: restSecondsOf,
    fmtClock: fmtClock,
    recentCutoff: recentCutoff,
    visibleWorkoutCount: visibleWorkoutCount,
    sheetFilterOptions: sheetFilterOptions,
    workoutsByDate: workoutsByDate,
    workoutVolume: workoutVolume,
    fmtThousands: fmtThousands,
    workoutSummary: workoutSummary,
    weeklyTotals: weeklyTotals,
    // export
    workoutAsText: workoutAsText,
    sheetLabel: sheetLabel,
    exerciseTarget: exerciseTarget,
    exerciseLabel: exerciseLabel,
    exerciseMatches: exerciseMatches,
    exerciseKey: exerciseKey,
    hasExercise: hasExercise,
    historyTarget: historyTarget,
    // data compatibility
    normalizeBackup: normalizeBackup,
    normalizeSheetItem: normalizeSheetItem,
    parseSheetImport: parseSheetImport,
    parseSheetImportText: parseSheetImportText,
    suggestExercises: suggestExercises,
    exerciseNamesText: exerciseNamesText,
    // import old workouts + recreated sheets (TREINO-JSON.md)
    parseHistoryImport: parseHistoryImport,
    parseHistoryImportText: parseHistoryImportText,
    sheetByName: sheetByName,
    splitImportedSheets: splitImportedSheets,
    importedWorkout: importedWorkout,
    workoutFingerprint: workoutFingerprint,
    splitImportedWorkouts: splitImportedWorkouts,
    historyExerciseNames: historyExerciseNames,
    historyImportSummaryHtml: historyImportSummaryHtml,
    historyImportToast: historyImportToast,
    sheetNamesText: sheetNamesText
  };
});
