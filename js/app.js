'use strict';

/* Meu Treino — main app logic (UI text in pt-BR, code in English). */

const APP_SETTINGS_ID = 'app';
const GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraços', 'Abdômen', 'Pernas', 'Glúteos', 'Panturrilhas', 'Pescoço', 'Cardio', 'Outros'];

const state = {
  workouts: [],
  exercises: [],
  sheets: [],
  settings: null,
  colinha: [],
  catalog: null,
  editingWorkoutId: null,
  editingSheetId: null,
  formSets: [],
  sheetExercises: [],
  pickerQuery: '',
  fichaQuery: '',
  sheetPickerQuery: '',
  libraryGroup: '',
  libraryQuery: '',
  viewingWorkoutId: null,
  viewingExerciseId: null,
  viewingExerciseName: '',
  eraseDone: false,
  lastImportSnapshot: null,
  dismissBackupReminder: false,
  calendarCursor: null,
  draft: null,
  showAllWorkouts: false,
  workoutFilter: ''
};

// Rascunho do treino em andamento: um registro extra no store "settings" (id próprio).
// Não muda o formato do banco nem entra no backup (o backup exporta só o registro "app").
const DRAFT_ID = 'workoutDraft';
const HOME_MIN_WORKOUTS = 10;

/* ---------- helpers ----------
   As funções puras (datas, esc/toNum, semana, agrupamento, exportação) vivem em js/core.js,
   carregado antes deste arquivo. Aqui ficam só as que dependem do estado do app. */

// Em pt-BR o separador decimal e a virgula: mostramos e aceitamos os dois.
const commaDecimal = (navigator.language || '').toLowerCase().indexOf('pt') === 0;

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function weekRange() {
  return weekWindow(state.settings.weekAnchor || todayISO());
}
/* ---------- data loading ---------- */

async function loadState() {
  state.workouts = await dbAll('workouts');
  state.exercises = await dbAll('exercises');
  state.sheets = await dbAll('sheets');
  state.colinha = await dbAll('colinha');

  let settings = await dbGet('settings', APP_SETTINGS_ID);
  if (!settings) {
    settings = defaultSettings();
    await dbPut('settings', settings);
  }
  state.settings = settings;

  try {
    state.draft = (await dbGet('settings', DRAFT_ID)) || null;
  } catch (e) {
    state.draft = null;
  }
}

async function loadCatalog() {
  if (state.catalog) return state.catalog;
  const response = await fetch('data/exercises.json');
  const data = await response.json();
  state.catalog = data.exercises || [];
  return state.catalog;
}

/* ---------- navigation ---------- */

function navigate() {
  const hash = location.hash || '#/dashboard';
  const route = parseRoute(hash);
  const viewName = route.view;
  // #/detail/<id>: o id vem do endereço, então recarregar a página mantém o treino aberto.
  if (viewName === 'detail' && route.id) state.viewingWorkoutId = route.id;

  flushDraft();   // grava o que foi digitado agora há pouco antes de sair do formulário
  if (viewName !== 'workout') state.editingWorkoutId = null;

  document.querySelectorAll('.view').forEach(function (v) {
    v.classList.add('d-none');
  });

  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.remove('d-none');

  document.querySelectorAll('.bottom-nav a').forEach(function (a) {
    const activeHash = (viewName === 'detail' || viewName === 'exercise') ? '#/dashboard' : viewName === 'ia' ? '#/exercises' : (viewName === 'erase' ? '#/more' : hash);
    a.classList.toggle('active', a.getAttribute('href') === activeHash);
  });

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'workout') renderWorkoutForm();
  if (viewName === 'detail') renderWorkoutDetail();
  if (viewName === 'exercise') renderExerciseHistory();
  if (viewName === 'erase') renderErase();
  if (viewName === 'exercises') renderSheetsAndExercises();
  if (viewName === 'calendar') renderCalendar();
  if (viewName === 'more') renderMore();
  if (viewName === 'ia') guard(renderIa)();
}

/* ---------- week logic ---------- */


function weekStats() {
  const range = weekRange();
  let workouts = 0;
  let cardio = 0;
  state.workouts.forEach(function (w) {
    if (w.date >= range.anchor && w.date <= range.end && isValidWorkout(w)) {
      workouts++;
      cardio += toNum(w.cardioMinutes);
    }
  });
  return { workouts: workouts, cardio: cardio };
}

async function confirmNextWeek() {
  state.settings.weekAnchor = nextWeekAnchor(state.settings.weekAnchor, todayISO());
  await dbPut('settings', state.settings);
  renderDashboard();
}

/* ---------- dashboard ---------- */

function renderDashboard() {
  renderDraftBanner();
  renderWeek();
  renderQuickStart();
  renderBackupReminder();
  renderWorkoutList();
}

// Botão "Treinar: <ficha>" no Início: abre o Treinar já com a próxima ficha carregada.
// Com um treino em andamento ele some (o aviso do rascunho já tem o "Continuar").
function renderQuickStart() {
  const el = document.getElementById('quickStart');
  const sheet = draftHasContent(state.draft) ? null : nextSheet(state.workouts, state.sheets);
  if (!sheet) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<button type="button" class="btn btn-primary w-100 mb-3"><i class="bi bi-play-fill"></i> Treinar: ' + esc(sheet.name) + '</button>';
  el.querySelector('button').addEventListener('click', function () {
    state.pendingSheetId = sheet.id;
    location.hash = '#/workout';
  });
}

function renderWeek() {
  const range = weekRange();
  const today = todayISO();
  const banner = document.getElementById('weekBanner');

  if (today > range.end) {
    banner.innerHTML =
      '<div class="alert alert-warning py-2">' +
      '<strong>Semana encerrada!</strong> ' + fmtBR(range.anchor) + ' – ' + fmtBR(range.end) + '.' +
      '<button type="button" class="btn btn-sm btn-primary ms-2" id="btnConfirmWeek">Iniciar próxima semana</button>' +
      '</div>';
  } else if (today < range.anchor) {
    banner.innerHTML = '<div class="alert alert-info py-2">A semana começa em <strong>' + fmtBR(range.anchor) + '</strong>.</div>';
  } else {
    banner.innerHTML = '<div class="alert alert-success py-2">Semana ativa: <strong>' + fmtBR(range.anchor) + ' – ' + fmtBR(range.end) + '</strong></div>';
  }

  const btn = document.getElementById('btnConfirmWeek');
  if (btn) btn.addEventListener('click', confirmNextWeek);

  const stats = weekStats();
  const workoutPct = Math.min(100, Math.round((stats.workouts / Math.max(1, state.settings.weeklyWorkoutTarget)) * 100));
  const cardioPct = Math.min(100, Math.round((stats.cardio / Math.max(1, state.settings.weeklyCardioTarget)) * 100));

  document.getElementById('weekProgress').innerHTML =
    '<div class="card mb-3">' +
    '<div class="card-body py-3">' +
    '<div class="d-flex justify-content-around text-center mb-2">' +
    '<div><div class="display-6 fw-bold">' + stats.workouts + '/' + state.settings.weeklyWorkoutTarget + '</div><small class="text-muted"><i class="bi bi-check2-circle"></i> treinos</small></div>' +
    '<div><div class="display-6 fw-bold">' + stats.cardio + '/' + state.settings.weeklyCardioTarget + '</div><small class="text-muted"><i class="bi bi-heart-pulse"></i> min cardio</small></div>' +
    '</div>' +
    '<div class="progress mb-1" style="height: 8px" role="progressbar" aria-label="Meta de treinos" aria-valuenow="' + workoutPct + '" aria-valuemin="0" aria-valuemax="100">' +
    '<div class="progress-bar" style="width: ' + workoutPct + '%"></div></div>' +
    '<div class="progress" style="height: 8px" role="progressbar" aria-label="Meta de cardio" aria-valuenow="' + cardioPct + '" aria-valuemin="0" aria-valuemax="100">' +
    '<div class="progress-bar bg-info" style="width: ' + cardioPct + '%"></div></div>' +
    '</div></div>';
}


function renderWorkoutList() {
  const el = document.getElementById('recentWorkouts');
  const workouts = state.workouts.slice().sort(byDateDesc);

  if (!workouts.length) {
    el.innerHTML = '<p class="text-muted"><i class="bi bi-emoji-smile"></i> Nenhum treino registrado ainda. Toque em <strong>Treinar</strong> para começar.</p>';
    return;
  }

  // Filtro por ficha (só aparece com 2+ fichas usadas).
  const options = sheetFilterOptions(workouts, state.sheets);
  if (state.workoutFilter && options.indexOf(state.workoutFilter) === -1) state.workoutFilter = '';
  const filtered = state.workoutFilter
    ? workouts.filter(function (w) { return sheetLabel(w, state.sheets) === state.workoutFilter; })
    : workouts;

  // Lista curta: mês atual e anterior (mínimo de 10); o resto em "Ver meses anteriores".
  const today = todayISO();
  const defaultCount = visibleWorkoutCount(filtered, today, HOME_MIN_WORKOUTS);
  const shown = state.showAllWorkouts ? filtered : filtered.slice(0, defaultCount);
  const hiddenCount = filtered.length - shown.length;

  // Agrupa por mês (cabeçalho com a contagem) e mostra a data como um bloco à esquerda,
  // para dar para achar um treino rápido mesmo com muitos registros.
  const monthCounts = {};
  filtered.forEach(function (w) {
    const p = dateParts(w.date);
    const key = p ? p.monthKey : '';
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });

  const filterHtml = options.length > 1
    ? '<select class="form-select form-select-sm mb-2" id="workoutFilter" aria-label="Filtrar treinos por ficha">' +
      '<option value="">Todas as fichas</option>' +
      options.map(function (o) {
        return '<option value="' + esc(o) + '"' + (o === state.workoutFilter ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') +
      '</select>'
    : '';

  let moreHtml = '';
  if (hiddenCount > 0) {
    moreHtml = '<button type="button" class="btn btn-outline-primary w-100 mb-2" id="btnShowAllWorkouts">' +
      '<i class="bi bi-chevron-down"></i> Ver meses anteriores (' + hiddenCount + (hiddenCount === 1 ? ' treino' : ' treinos') + ')</button>';
  } else if (state.showAllWorkouts && filtered.length > defaultCount) {
    moreHtml = '<button type="button" class="btn btn-outline-secondary w-100 mb-2" id="btnShowLessWorkouts">' +
      '<i class="bi bi-chevron-up"></i> Mostrar só os recentes</button>';
  }

  let currentMonth = null;
  el.innerHTML = '<h6 class="mt-2"><i class="bi bi-clock-history text-primary"></i> ' +
    (state.workoutFilter ? 'Treinos da ficha' : 'Todos os treinos') + ' ' +
    '<span class="badge text-bg-secondary">' + filtered.length + '</span></h6>' +
    filterHtml +
    shown.map(function (w) {
      const name = sheetLabel(w, state.sheets) || 'Treino';
      // shortcut: recordes calculados por card mostrado (cada um varre o histórico); trocar por uma
      // passada única se a lista com "Ver meses anteriores" ficar lenta com milhares de treinos.
      const records = workoutRecords(state.workouts, w).length;
      const summary = workoutSummary(w);
      const p = dateParts(w.date, today);
      const monthKey = p ? p.monthKey : '';

      let header = '';
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        const count = monthCounts[monthKey];
        header = '<div class="workout-month">' + esc(p ? p.monthLabel : 'Sem data') +
          ' <span class="text-muted">· ' + count + (count === 1 ? ' treino' : ' treinos') + '</span></div>';
      }

      const dateBlock = p
        ? '<div class="workout-date' + (p.relative === 'hoje' ? ' is-today' : '') + '" aria-hidden="true">' +
          '<span class="workout-date-weekday">' + esc(p.relative || p.weekday) + '</span>' +
          '<span class="workout-date-day">' + esc(p.day) + '</span>' +
          '<span class="workout-date-month">' + esc(p.month) + '</span>' +
          '</div>'
        : '<div class="workout-date" aria-hidden="true"><span class="workout-date-day">—</span></div>';

      return header +
        '<div class="card mb-2' + (p && p.relative === 'hoje' ? ' workout-today' : '') + '"><div class="card-body py-2 d-flex align-items-center gap-2">' +
        dateBlock +
        '<button type="button" class="btn btn-link p-0 text-start text-decoration-none flex-grow-1 min-w-0" data-view-workout="' + esc(w.id) + '" aria-label="' + esc(name + ', ' + fmtBR(w.date) + (summary ? ', ' + summary : '') + (records ? ', ' + records + (records === 1 ? ' recorde' : ' recordes') : '')) + '">' +
        '<strong>' + esc(name) + '</strong>' +
        ((summary || records) ? '<span class="d-block small text-muted">' + esc(summary) +
          (records ? (summary ? ' · ' : '') + '<span class="pr-count"><i class="bi bi-trophy-fill"></i> ' + records + '</span>' : '') +
          '</span>' : '') +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" data-share-workout="' + esc(w.id) + '" title="Exportar como texto" aria-label="Exportar como texto"><i class="bi bi-share"></i></button>' +
        '</div></div>';
    }).join('') +
    moreHtml;

  const filterSel = document.getElementById('workoutFilter');
  if (filterSel) {
    filterSel.addEventListener('change', function () {
      state.workoutFilter = this.value;
      state.showAllWorkouts = false;
      renderWorkoutList();
    });
  }
  const showAll = document.getElementById('btnShowAllWorkouts');
  if (showAll) showAll.addEventListener('click', function () { state.showAllWorkouts = true; renderWorkoutList(); });
  const showLess = document.getElementById('btnShowLessWorkouts');
  if (showLess) showLess.addEventListener('click', function () { state.showAllWorkouts = false; renderWorkoutList(); });

  el.querySelectorAll('[data-view-workout]').forEach(function (b) {
    b.addEventListener('click', function () {
      location.hash = '#/detail/' + b.getAttribute('data-view-workout');
    });
  });

  el.querySelectorAll('[data-share-workout]').forEach(function (b) {
    b.addEventListener('click', function () {
      exportWorkoutText(b.getAttribute('data-share-workout'));
    });
  });
}

/* ---------- referências por id (nome sempre atual) ---------- */

// Biblioteca do usuário + catálogo: usado para resolver o nome ATUAL pelo id.
function allExercises() {
  return (state.exercises || []).concat(state.catalog || []);
}

// Nome atual de um exercício guardado em um registro (resolve pelo id).
function labelOf(item) {
  return exerciseLabel(item, allExercises());
}

// Referência (id + nome atual) usada nas buscas de histórico e ao gravar.
function refOf(item) {
  return { exerciseId: (item && item.exerciseId) || null, exerciseName: labelOf(item) };
}

/* ---------- read-only workout detail ---------- */

// Linha "Recorde" no resumo do treino, para o exercício que bateu a maior carga anterior.
function prLine(records, group) {
  const rec = (records || []).find(function (r) { return exerciseMatches(r, group); });
  if (!rec) return '';
  return '<div class="small pr-line"><i class="bi bi-trophy-fill"></i> <strong>Recorde:</strong> ' +
    esc(formatDecimal(rec.load, commaDecimal)) + ' kg × ' + esc(rec.reps) +
    ' <span class="text-muted">(antes: ' + esc(formatDecimal(rec.previous, commaDecimal)) + ' kg)</span></div>';
}

function renderWorkoutDetail() {
  const el = document.getElementById('detailBody');
  const workout = state.viewingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.viewingWorkoutId; })
    : null;

  if (!workout) {
    el.innerHTML = '<p class="text-muted">Treino não encontrado.</p>';
    return;
  }

  const sheetName = sheetLabel(workout, state.sheets);
  let html = '<div class="card mb-3"><div class="card-body py-2">' +
    '<div class="d-flex justify-content-between align-items-center">' +
    '<strong><i class="bi bi-calendar-event text-primary"></i> ' + fmtBR(workout.date) + '</strong>' +
    (sheetName ? '<span class="badge text-bg-light">' + esc(sheetName) + '</span>' : '') +
    '</div>' +
    (toNum(workout.cardioMinutes) > 0 ? '<div class="small text-muted mt-1"><i class="bi bi-heart-pulse"></i> Cardio: ' + toNum(workout.cardioMinutes) + ' min</div>' : '') +
    (workout.notes ? '<div class="small text-muted mt-1"><i class="bi bi-journal-text"></i> ' + esc(workout.notes) + '</div>' : '') +
    '</div></div>';

  const groups = groupSets(workout.sets, workout.warmups);
  const records = workoutRecords(state.workouts, workout);

  if (!groups.length) {
    html += '<p class="text-muted">Este treino não tem exercícios registrados.</p>';
  }

  html += groups.map(function (g, i) {
    const alvo = historyTarget(g);
    return '<div class="card mb-2"><div class="card-body p-2">' +
      '<button type="button" class="btn btn-link p-0 text-decoration-none d-flex justify-content-between align-items-center w-100" data-open-exercise="' + esc(alvo.exerciseId || '') + '" data-open-exercise-name="' + esc(alvo.exerciseName) + '">' +
      '<strong><span class="badge text-bg-primary me-1">' + (i + 1) + '</span> ' + esc(labelOf(g)) + '</strong>' +
      '<i class="bi bi-chevron-right text-muted"></i>' +
      '</button>' +
      (g.note ? '<div class="small text-muted"><i class="bi bi-info-circle"></i> ' + esc(g.note) + '</div>' : '') +
      prLine(records, g) +
      (warmupHasData(g.warmup) ? '<div class="small text-muted"><i class="bi bi-fire"></i> Aquecimento: ' + esc(warmupLine(g.warmup, commaDecimal)) + '</div>' : '') +
      (g.sets.length ? setsSummaryLines(g.sets, commaDecimal) : '<div class="small text-muted mt-1">Sem séries de trabalho.</div>') +
      '</div></div>';
  }).join('');

  el.innerHTML = html;

  el.querySelectorAll('[data-open-exercise]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.viewingExerciseId = b.getAttribute('data-open-exercise') || null;
      state.viewingExerciseName = b.getAttribute('data-open-exercise-name') || '';
      location.hash = '#/exercise';
    });
  });
}

/* ---------- exercise history ---------- */



function renderExerciseHistory() {
  const target = { exerciseId: state.viewingExerciseId || null, exerciseName: state.viewingExerciseName || '' };
  const name = labelOf(target);
  document.getElementById('exerciseHistoryTitle').innerHTML = '<i class="bi bi-graph-up text-primary"></i> ' + esc(name);

  const el = document.getElementById('exerciseHistory');
  const sessions = sessionsForExercise(state.workouts, target);

  if (!sessions.length) {
    el.innerHTML = '<p class="text-muted">Nenhum registro deste exercício ainda.</p>';
    return;
  }

  const rows = sessions.map(function (w) {
    return { workout: w, best: bestSetForExercise(w, target) };
  });

  const prLoad = maxBestLoad(sessions, target);
  const maxLoad = prLoad || 1;   // só para a largura das barras (evita dividir por zero)

  const withLoad = rows.filter(function (r) { return r.best; });
  let trendIcon = '<i class="bi bi-dash text-muted"></i>';
  if (withLoad.length >= 2) {
    const last = withLoad[0].best.load;
    const prev = withLoad[1].best.load;
    trendIcon = last > prev ? '<i class="bi bi-arrow-up-right text-success"></i>'
      : (last < prev ? '<i class="bi bi-arrow-down-right text-danger"></i>' : '<i class="bi bi-dash text-muted"></i>');
  }

  let html = '<div class="card mb-3"><div class="card-body py-2 d-flex justify-content-between align-items-center">' +
    '<span class="small text-muted">' + trendIcon + ' ' + sessions.length + (sessions.length === 1 ? ' treino' : ' treinos') + ' com este exercício</span>' +
    (prLoad > 0 ? '<span class="badge text-bg-warning"><i class="bi bi-trophy"></i> PR ' + formatDecimal(prLoad, commaDecimal) + ' kg</span>' : '') +
    '</div></div>';

  html += '<h6 class="text-muted"><i class="bi bi-bar-chart-line"></i> Melhor série por dia</h6>';
  html += rows.slice(0, 12).map(function (r) {
    const load = r.best ? r.best.load : 0;
    const reps = r.best ? r.best.reps : 0;
    const pct = Math.max(4, Math.round((load / maxLoad) * 100));
    return '<div class="mb-2">' +
      '<div class="d-flex justify-content-between small"><span>' + fmtBR(r.workout.date) + '</span><strong>' + formatDecimal(load, commaDecimal) + ' kg × ' + reps + '</strong></div>' +
      '<div class="progress" style="height: 10px"><div class="progress-bar" style="width: ' + pct + '%"></div></div>' +
      '</div>';
  }).join('');

  html += '<h6 class="text-muted mt-3"><i class="bi bi-clock-history"></i> Histórico</h6>';
  html += rows.slice(0, 20).map(function (r) {
    const w = r.workout;
    const warm = (w.warmups || []).find(function (x) { return exerciseMatches(x, target); });
    const sets = (w.sets || []).filter(function (s) { return exerciseMatches(s, target); });
    const sheetName = sheetLabel(w, state.sheets);
    return '<div class="card mb-2"><div class="card-body py-2">' +
      '<div class="d-flex justify-content-between align-items-center">' +
      '<strong>' + fmtBR(w.date) + '</strong>' +
      (sheetName ? '<span class="badge text-bg-light">' + esc(sheetName) + '</span>' : '') +
      '</div>' +
      (warmupHasData(warm) ? '<div class="small text-muted"><i class="bi bi-fire"></i> Aquecimento: ' + esc(warmupLine(warm, commaDecimal)) + '</div>' : '') +
      (sets.length ? setsSummaryLines(sets, commaDecimal) : '<div class="small text-muted mt-1">Sem séries de trabalho.</div>') +
      '</div></div>';
  }).join('');

  el.innerHTML = html;
}
/* ---------- workout draft (treino em andamento) ---------- */

let draftTimer = null;

function isWorkoutFormOpen() {
  return location.hash === '#/workout';
}

function currentDraft() {
  return {
    id: DRAFT_ID,
    editingWorkoutId: state.editingWorkoutId || null,
    date: document.getElementById('workoutDate').value,
    sheetId: document.getElementById('workoutSheet').value,
    cardio: document.getElementById('workoutCardio').value,
    notes: document.getElementById('workoutNotes').value,
    formSets: JSON.parse(JSON.stringify(state.formSets)),
    savedAt: new Date().toISOString()
  };
}

// Chamado a cada alteração no formulário: grava o rascunho logo depois (sem travar a digitação).
function scheduleDraftSave() {
  if (!isWorkoutFormOpen()) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftNow, 500);
}

// Monta o rascunho de forma síncrona (antes de qualquer await), então dá para chamar
// no começo do navigate(), antes de a troca de tela limpar o treino em edição.
async function saveDraftNow() {
  clearTimeout(draftTimer);
  draftTimer = null;

  const draft = currentDraft();
  try {
    if (draftHasContent(draft)) {
      state.draft = draft;
      await dbPut('settings', draft);
    } else if (state.draft) {
      state.draft = null;
      await dbDelete('settings', DRAFT_ID);
    }
  } catch (e) {
    // sem rascunho o app continua funcionando como antes
  }
}

// Ao sair do app (trocar de app, bloquear a tela), grava na hora o que estiver pendente.
function flushDraft() {
  if (draftTimer) saveDraftNow();
}

async function clearDraft() {
  clearTimeout(draftTimer);
  draftTimer = null;
  state.draft = null;
  try {
    await dbDelete('settings', DRAFT_ID);
  } catch (e) {
    // nada a fazer
  }
}

function draftDescription(draft) {
  const editing = draft.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === draft.editingWorkoutId; })
    : null;
  const sheet = draft.sheetId ? findSheet(draft.sheetId) : null;
  const name = sheet ? sheet.name : (editing ? sheetLabel(editing, state.sheets) : '');
  const saved = draft.savedAt ? new Date(draft.savedAt) : null;
  const when = saved && !isNaN(saved.getTime())
    ? ' · salvo ' + (fmtDate(saved) === todayISO() ? 'hoje' : 'em ' + fmtBR(fmtDate(saved))) + ' às ' + pad2(saved.getHours()) + ':' + pad2(saved.getMinutes())
    : '';
  return (editing ? 'Edição do treino de ' + fmtBR(editing.date) : 'Treino novo') + (name ? ' · ' + name : '') + when;
}

function renderDraftBanner() {
  const el = document.getElementById('draftBanner');
  if (!el) return;
  if (!draftHasContent(state.draft)) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<div class="alert alert-primary py-2 draft-banner">' +
    '<div><i class="bi bi-pencil-square"></i> <strong>Treino em andamento</strong> (não salvo)</div>' +
    '<div class="small mb-2">' + esc(draftDescription(state.draft)) + '</div>' +
    '<div class="d-flex gap-2">' +
    '<button type="button" class="btn btn-sm btn-primary flex-fill" id="btnResumeDraft"><i class="bi bi-play-fill"></i> Continuar</button>' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" id="btnDiscardDraft">Descartar</button>' +
    '</div></div>';
  document.getElementById('btnResumeDraft').addEventListener('click', resumeDraft);
  document.getElementById('btnDiscardDraft').addEventListener('click', discardDraft);
}

function resumeDraft() {
  if (!state.draft) return;
  state.editingWorkoutId = state.draft.editingWorkoutId || null;
  if (isWorkoutFormOpen()) navigate();
  else location.hash = '#/workout';
}

async function discardDraft() {
  if (!confirm('Descartar o treino em andamento? O que foi digitado e não salvo será perdido.')) return;
  await clearDraft();
  renderDashboard();
}

// Decide se o formulário abre a partir do rascunho. Se o rascunho é de OUTRO treino
// (ex.: começou um treino novo e agora abriu "Editar" de um antigo), pergunta antes,
// para nunca sobrescrever um rascunho sem querer.
function draftForForm() {
  const draft = state.draft;
  if (!draftHasContent(draft)) return null;
  if ((draft.editingWorkoutId || null) === (state.editingWorkoutId || null)) return draft;

  if (confirm('Você tem um treino em andamento que não foi salvo:\n' + draftDescription(draft) +
    '\n\nOK: continuar esse treino\nCancelar: descartar o rascunho e seguir')) {
    return draft;
  }
  clearDraft();
  return null;
}

/* ---------- workout form ---------- */

function activeSheets() {
  return state.sheets.filter(function (s) { return s.active !== false; });
}

function findSheet(id) {
  return state.sheets.find(function (s) { return String(s.id) === String(id); }) || null;
}

function sameId(a, b) {
  return a !== null && a !== undefined && a !== '' && String(a) === String(b);
}

// fallbackName: nome guardado no treino em edição, usado quando a ficha foi excluída.
function renderSheetOptions(selectedId, fallbackName) {
  const sel = document.getElementById('workoutSheet');
  let html = '<option value="">— Selecione a ficha —</option>';
  let found = false;
  activeSheets().forEach(function (s) {
    const selected = sameId(selectedId, s.id);
    if (selected) found = true;
    html += '<option value="' + esc(s.id) + '"' + (selected ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  });

  // Ficha excluída ou inativa: mantém a opção, para não perder o nome ao salvar a edição.
  if (selectedId && !found) {
    const sheet = findSheet(selectedId);
    const label = sheet ? sheet.name + ' (inativa)' : (fallbackName || 'Ficha') + ' (excluída)';
    html += '<option value="' + esc(selectedId) + '" selected>' + esc(label) + '</option>';
  }

  sel.innerHTML = html;
  renderSheetHint(selectedId);
}

function renderSheetHint(sheetId) {
  const hint = document.getElementById('sheetHint');
  const sheet = sheetId ? findSheet(sheetId) : null;
  renderRepeatLast(sheetId);
  if (!sheet) {
    hint.innerHTML = sheetId
      ? 'Esta ficha foi excluída — o nome dela continua guardado neste treino.'
      : (activeSheets().length
        ? 'Selecione a ficha do treino de hoje.'
        : 'Você ainda não tem fichas. Crie a sua na aba <a href="#/exercises">Fichas</a>.');
    return;
  }
  const count = (sheet.exercises || []).length;
  hint.textContent = count
    ? (count === 1 ? '1 exercício na ficha — carregado no treino.' : count + ' exercícios na ficha — carregados no treino.')
    : 'Esta ficha ainda não tem exercícios. Adicione na aba Fichas.';
}

// Botão "Repetir último treino desta ficha": preenche com os mesmos exercícios, reps e cargas.
function renderRepeatLast(sheetId) {
  const el = document.getElementById('repeatLast');
  if (!el) return;
  const last = lastWorkoutForSheet(state.workouts, sheetId, state.editingWorkoutId);
  if (!last) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<button type="button" class="btn btn-sm btn-outline-primary mt-2 w-100" id="btnRepeatLast">' +
    '<i class="bi bi-arrow-repeat"></i> Repetir o último treino desta ficha (' + fmtBR(last.date) + ')</button>';
  document.getElementById('btnRepeatLast').addEventListener('click', function () {
    repeatLastWorkout(last);
  });
}

function repeatLastWorkout(last) {
  if (state.formSets.length && !confirm('Substituir os exercícios do formulário pelo treino de ' + fmtBR(last.date) + '?\n\nReps e cargas vêm daquele treino; RIR e observações ficam em branco.')) {
    return;
  }
  state.formSets = formFromWorkout(last);
  renderFormSets();
  scheduleDraftSave();
}

function loadSheetIntoForm(sheet) {
  state.formSets = [];

  (sheet.exercises || []).forEach(function (item) {
    const rawReps = item.reps;
    const repsArray = Array.isArray(rawReps) ? rawReps : [];
    const fallbackRep = Array.isArray(rawReps) ? '' : ((rawReps === undefined || rawReps === null) ? '' : rawReps);
    const setCount = Math.max(1, parseInt(item.sets, 10) || repsArray.length || 3);
    const ref = refOf(item);
    const lastLoads = lastLoadsForExercise(state.workouts, ref);
    const sets = [];

    for (let i = 1; i <= setCount; i++) {
      const value = repsArray[i - 1];
      const lastLoad = Object.prototype.hasOwnProperty.call(lastLoads, i) ? lastLoads[i] : '';
      sets.push({
        number: i,
        reps: (value === undefined || value === null) ? fallbackRep : value,
        load: lastLoad,
        rir: '',
        note: ''
      });
    }

    state.formSets.push({
      exerciseId: item.exerciseId || null,
      exerciseName: ref.exerciseName,
      note: item.note || '',
      warmup: previousWarmupFields(state.workouts, ref),
      sets: sets
    });
  });

  renderFormSets();
  scheduleDraftSave();
}

function onSheetChange() {
  const sheetId = document.getElementById('workoutSheet').value;
  renderSheetHint(sheetId);
  scheduleDraftSave();

  const sheet = sheetId ? findSheet(sheetId) : null;
  if (!sheet) return;
  if (!(sheet.exercises || []).length) return;

  if (state.formSets.length && !confirm('Substituir os exercícios já no formulário pelos da ficha "' + sheet.name + '"?')) {
    return;
  }
  loadSheetIntoForm(sheet);
}


function renderWorkoutForm() {
  const draft = draftForForm();
  if (draft) {
    // o treino do rascunho pode ter sido excluído nesse meio-tempo: aí vira treino novo
    const exists = draft.editingWorkoutId && state.workouts.some(function (w) { return w.id === draft.editingWorkoutId; });
    state.editingWorkoutId = exists ? draft.editingWorkoutId : null;
  }

  const editing = state.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.editingWorkoutId; })
    : null;

  document.getElementById('workoutTitle').innerHTML = editing
    ? '<i class="bi bi-pencil-square text-primary"></i> Editar treino'
    : '<i class="bi bi-plus-circle text-primary"></i> Treinar';

  const editingSheetName = editing ? (editing.sheetName || editing.typeName || '') : '';

  if (draft) {
    document.getElementById('workoutDate').value = draft.date || todayISO();
    renderSheetOptions(draft.sheetId || null, editingSheetName);
    document.getElementById('workoutCardio').value = draft.cardio || '';
    document.getElementById('workoutNotes').value = draft.notes || '';
    state.formSets = JSON.parse(JSON.stringify(draft.formSets || []));
  } else {
    document.getElementById('workoutDate').value = editing ? editing.date : todayISO();
    renderSheetOptions(editing ? (editing.sheetId || editing.typeId) : null, editingSheetName);
    document.getElementById('workoutCardio').value = editing ? (editing.cardioMinutes || '') : '';
    document.getElementById('workoutNotes').value = editing ? (editing.notes || '') : '';
    state.formSets = editing ? groupSets(editing.sets, editing.warmups) : [];
  }

  const notice = document.getElementById('draftNotice');
  notice.innerHTML = draft
    ? '<div class="alert alert-info py-1 px-2 small mb-2"><i class="bi bi-cloud-check"></i> Rascunho recuperado — continue de onde parou.</div>'
    : '';

  document.getElementById('workoutDelete').classList.toggle('d-none', !editing);
  document.getElementById('workoutExport').classList.toggle('d-none', !editing);
  renderFormSets();

  // Veio do botão "Treinar: <ficha>" do Início: seleciona a ficha e carrega os exercícios dela.
  const quickSheet = state.pendingSheetId ? findSheet(state.pendingSheetId) : null;
  state.pendingSheetId = null;
  if (quickSheet && !draft && !editing) {
    renderSheetOptions(quickSheet.id);
    loadSheetIntoForm(quickSheet);
  }
}

function renderFormSets() {
  const el = document.getElementById('workoutExercises');
  if (!state.formSets.length) {
    el.innerHTML = '<p class="text-muted">Adicione exercícios ao treino.</p>';
    return;
  }

  el.innerHTML = state.formSets.map(function (group, exIdx) {
    const warm = group.warmup || {};
    const last = lastSessionForExercise(state.workouts, refOf(group), state.editingWorkoutId);
    return '<div class="card mb-2"><div class="card-body p-2">' +
      '<div class="d-flex justify-content-between align-items-center mb-1">' +
      '<strong><i class="bi bi-activity text-primary"></i> ' + esc(labelOf(group)) + '</strong>' +
      '<div class="d-flex align-items-center gap-1">' +
      '<span class="badge text-bg-light">' + group.sets.length + (group.sets.length === 1 ? ' série' : ' séries') + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFormExercise(' + exIdx + ')" aria-label="Remover exercício"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '</div>' +
      (group.note ? '<div class="small text-muted mb-1"><i class="bi bi-info-circle"></i> ' + esc(group.note) + '</div>' : '') +
      (last ? '<div class="small last-session mb-1"><i class="bi bi-clock-history"></i> <span class="fw-semibold">Última vez (' + fmtBR(last.date) + '):</span> ' + esc(lastSessionLine(last, commaDecimal)) + '</div>' : '') +
      '<div class="border rounded bg-light p-1 mb-1">' +
      '<div class="small text-muted mb-1"><i class="bi bi-fire"></i> Aquecimento</div>' +
      '<div class="row g-1">' +
      '<div class="col-4"><input type="number" min="0" inputmode="numeric" class="form-control form-control-sm" value="' + esc(warm.reps) + '" placeholder="reps" oninput="setWarmupField(' + exIdx + ",'reps',this.value)\"></div>" +
      '<div class="col-4"><input type="text" inputmode="decimal" autocomplete="off" min="0" class="form-control form-control-sm" value="' + esc(formatDecimal(warm.load, commaDecimal)) + '" placeholder="peso" aria-label="Peso do aquecimento" oninput="setWarmupField(' + exIdx + ",'load',this.value)\"></div>" +
      '<div class="col-4"><input type="number" min="0" inputmode="numeric" class="form-control form-control-sm" value="' + esc(warm.rir) + '" placeholder="RIR" oninput="setWarmupField(' + exIdx + ",'rir',this.value)\"></div>" +
      '</div>' +
      '</div>' +
      setHeaderHtml() +
      group.sets.map(function (s, setIdx) { return setRowHtml(exIdx, setIdx, s, commaDecimal); }).join('') +
      '<div class="d-flex gap-1 mt-1">' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="addFormSet(' + exIdx + ')"><i class="bi bi-plus"></i> série</button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="removeFormSet(' + exIdx + ')"' + (group.sets.length <= 1 ? ' disabled' : '') + '><i class="bi bi-dash"></i> série</button>' +
      '<button type="button" class="btn btn-sm btn-outline-success ms-auto" onclick="startRest()"><i class="bi bi-stopwatch"></i> Descanso ' + fmtClock(restSecondsOf(state.settings)) + '</button>' +
      '</div>' +
      '</div></div>';
  }).join('');
}

function setWarmupField(exIdx, field, value) {
  const group = state.formSets[exIdx];
  if (!group) return;
  if (!group.warmup) group.warmup = { reps: '', load: '', rir: '' };
  group.warmup[field] = value;
  scheduleDraftSave();
}

function setField(exIdx, setIdx, field, value) {
  const group = state.formSets[exIdx];
  if (!group || !group.sets[setIdx]) return;
  group.sets[setIdx][field] = value;
  scheduleDraftSave();
}

function addFormSet(exIdx) {
  const group = state.formSets[exIdx];
  if (!group) return;
  group.sets.push({ number: group.sets.length + 1, reps: '', load: '', rir: '', note: '' });
  renderFormSets();
  scheduleDraftSave();
}

// Toque no número da série: marca como feita e já inicia o descanso. Tocar de novo só desmarca.
// "done" vive no formulário e no rascunho; não é gravado no treino salvo.
function toggleSetDone(exIdx, setIdx) {
  const group = state.formSets[exIdx];
  if (!group || !group.sets[setIdx]) return;
  group.sets[setIdx].done = !group.sets[setIdx].done;
  if (group.sets[setIdx].done) startRest();
  renderFormSets();
  scheduleDraftSave();
}

// Tira a ÚLTIMA série do exercício (a ficha pede 4 e hoje só deu para fazer 3, ou um toque a mais
// no "+ série"). Sempre sobra pelo menos uma; pergunta antes se ela tem algo preenchido.
function removeFormSet(exIdx) {
  const group = state.formSets[exIdx];
  if (!group || group.sets.length <= 1) return;
  const last = group.sets[group.sets.length - 1];
  if (setHasData(last) && !confirm('Remover a série ' + last.number + ' de "' + labelOf(group) + '"?')) return;
  group.sets.pop();
  renderFormSets();
  scheduleDraftSave();
}

function removeFormExercise(exIdx) {
  const group = state.formSets[exIdx];
  if (!group) return;
  // Um toque errado na lixeira apagava o exercício inteiro, sem volta.
  if (groupHasData(group) && !confirm('Remover "' + labelOf(group) + '" do treino?\n\nO que foi preenchido neste exercício será perdido.')) return;
  state.formSets.splice(exIdx, 1);
  renderFormSets();
  scheduleDraftSave();
}

/* ---------- rest timer ---------- */

// De propósito: sem som, sem vibração, sem piscar. No fim do descanso o contador
// só fica laranja e permanece assim até tocar no ✕ (ou iniciar outro descanso).
const rest = { end: 0, total: 0, interval: null };

function startRest(seconds) {
  const secs = seconds || restSecondsOf(state.settings);
  rest.total = secs;
  rest.end = Date.now() + secs * 1000;
  clearInterval(rest.interval);
  const bar = document.getElementById('restBar');
  bar.classList.remove('d-none', 'is-done');
  rest.interval = setInterval(tickRest, 250);
  tickRest();
}

function addRest(seconds) {
  if (!rest.interval) return;
  rest.end += seconds * 1000;
  rest.total += seconds;
  tickRest();
}

function stopRest() {
  clearInterval(rest.interval);
  rest.interval = null;
  document.getElementById('restBar').classList.add('d-none');
}

// Conta pelo horário de término (e não por "ticks"), então continua certo mesmo se o
// celular pausar o app em segundo plano.
function tickRest() {
  const left = (rest.end - Date.now()) / 1000;
  const bar = document.getElementById('restBar');
  if (left <= 0) {
    clearInterval(rest.interval);
    rest.interval = null;
    bar.classList.add('is-done');
    document.getElementById('restClock').textContent = '0:00';
    document.getElementById('restProgress').style.width = '100%';
    return;
  }
  document.getElementById('restClock').textContent = fmtClock(left);
  document.getElementById('restProgress').style.width = Math.min(100, Math.round((1 - left / rest.total) * 100)) + '%';
}




function addExerciseToForm(opts) {
  const ref = { exerciseId: opts.exerciseId || null, exerciseName: opts.exerciseName || 'Exercício' };
  if (hasExercise(state.formSets, ref)) {
    alert('"' + (labelOf(ref) || ref.exerciseName) + '" já está neste treino. Use o botão "+ série" dele para fazer mais séries.');
    return;
  }
  const lastLoads = lastLoadsForExercise(state.workouts, ref);
  const setCount = Math.max(1, parseInt(opts.sets, 10) || 3);
  const sets = [];

  for (let i = 1; i <= setCount; i++) {
    const lastLoad = Object.prototype.hasOwnProperty.call(lastLoads, i) ? lastLoads[i] : '';
    sets.push({ number: i, reps: '', load: lastLoad, rir: '', note: '' });
  }

  state.formSets.push({
    exerciseId: ref.exerciseId,
    exerciseName: labelOf(ref) || 'Exercício',
    note: opts.note || '',
    warmup: previousWarmupFields(state.workouts, ref),
    sets: sets
  });
  renderFormSets();
  scheduleDraftSave();
}

function cleanWarmup(warm) {
  if (!warm) return null;
  const reps = toNumOrNull(warm.reps);
  const load = toNumOrNull(warm.load);
  const rir = toNumOrNull(warm.rir);
  if (reps === null && load === null && rir === null) return null;
  return { reps: reps, load: load, rir: rir };
}

async function saveWorkout() {
  const date = document.getElementById('workoutDate').value || todayISO();
  const sheetId = document.getElementById('workoutSheet').value;
  const sheet = sheetId ? findSheet(sheetId) : null;
  const cardioMinutes = toNum(document.getElementById('workoutCardio').value);
  const notes = document.getElementById('workoutNotes').value.trim();

  const sets = [];
  state.formSets.forEach(function (group) {
    group.sets.forEach(function (s) {
      const reps = toNumOrNull(s.reps);
      const load = toNumOrNull(s.load);
      const rir = toNumOrNull(s.rir);
      const note = (s.note || '').trim();

      // Skip empty lines (e.g. prefilled sets the user did not perform).
      if (reps === null && load === null && rir === null && !note) return;

      sets.push({
        exerciseId: group.exerciseId || null,
        exerciseName: labelOf(group),
        number: s.number,
        reps: reps,
        load: load,
        rir: rir,
        note: note,
        exerciseNote: group.note || ''
      });
    });
  });

  const warmups = [];
  state.formSets.forEach(function (group) {
    const clean = cleanWarmup(group.warmup);
    if (!clean) return;
    warmups.push({
      exerciseId: group.exerciseId || null,
      exerciseName: labelOf(group),
      reps: clean.reps,
      load: clean.load,
      rir: clean.rir
    });
  });

  if (!sets.length && !warmups.length && !cardioMinutes) {
    alert('Preencha pelo menos uma série (reps ou carga), um aquecimento ou os minutos de cardio.');
    return;
  }

  const editing = state.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.editingWorkoutId; })
    : null;

  // Ficha excluída: mantém o id e o nome guardados no treino em edição (antes eles se perdiam).
  const editingSheetId = editing ? (editing.sheetId || editing.typeId) : null;
  const keepsOldSheet = !sheet && sameId(editingSheetId, sheetId);

  const workout = {
    id: editing ? editing.id : uid(),
    date: date,
    sheetId: keepsOldSheet ? editingSheetId : (sheetId || null),
    sheetName: sheet ? sheet.name : (keepsOldSheet ? (editing.sheetName || editing.typeName || '') : ''),
    cardioMinutes: cardioMinutes,
    notes: notes,
    warmups: warmups,
    sets: sets,
    createdAt: editing ? editing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('workouts', workout);
  await clearDraft();
  state.workouts = await dbAll('workouts');
  state.editingWorkoutId = null;
  location.hash = '#/dashboard';
}

async function deleteWorkout() {
  if (!state.editingWorkoutId) return;
  if (!confirm('Excluir este treino?')) return;
  await clearDraft();
  await dbDelete('workouts', state.editingWorkoutId);
  state.workouts = await dbAll('workouts');
  state.editingWorkoutId = null;
  location.hash = '#/dashboard';
}
function cancelWorkout() {
  const editingId = state.editingWorkoutId;

  const hasContent = state.formSets.length > 0 ||
    toNum(document.getElementById('workoutCardio').value) > 0 ||
    document.getElementById('workoutNotes').value.trim() !== '';

  if (hasContent && !confirm('Descartar as alterações deste treino?')) return;

  clearDraft();
  state.formSets = [];
  state.editingWorkoutId = null;

  if (editingId) {
    location.hash = '#/detail/' + editingId;
  } else {
    location.hash = '#/dashboard';
  }
}

async function deleteViewedWorkout() {
  if (!state.viewingWorkoutId) return;
  if (!confirm('Excluir este treino?')) return;
  await dbDelete('workouts', state.viewingWorkoutId);
  state.workouts = await dbAll('workouts');
  state.viewingWorkoutId = null;
  location.hash = '#/dashboard';
}

/* ---------- exercise picker ---------- */

async function openExercisePickerModal() {
  await loadCatalog().catch(function () {});
  document.getElementById('pickerTitle').textContent = 'Escolher exercício';
  document.getElementById('pickerSearch').value = '';
  state.pickerQuery = '';
  renderPickerResults('');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('exercisePickerModal')).show();
}

function hideExercisePicker() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('exercisePickerModal'));
  if (modal) modal.hide();
}

function renderPickerResults(query) {
  state.pickerQuery = (query || '').trim();
  document.getElementById('pickerResults').innerHTML = pickerHtml(query, state.exercises, state.catalog, { create: 'createExerciseFromPicker', library: 'pickLibraryExercise', catalog: 'pickCatalogExercise' });
}

function pickLibraryExercise(id) {
  const e = state.exercises.find(function (x) { return x.id === id; });
  if (!e) return;

  addExerciseToForm({
    exerciseId: e.id,
    exerciseName: e.name,
    note: e.correction || ''
  });

  hideExercisePicker();
}

function pickCatalogExercise(id) {
  const item = (state.catalog || []).find(function (x) { return String(x.id) === String(id); });
  if (!item) return;

  // Catalog exercises are not copied into the library (they are already in the catalog).
  addExerciseToForm({ exerciseId: item.id, exerciseName: item.name });
  hideExercisePicker();
}

function pickCatalogForFicha(id) {
  const e = (state.catalog || []).find(function (x) { return String(x.id) === String(id); });
  if (!e) return;
  document.getElementById('fichaName').value = e.name;
  const groupSelect = document.getElementById('fichaGroup');
  const match = Array.prototype.some.call(groupSelect.options, function (o) { return o.value === e.group; });
  if (e.group && match) groupSelect.value = e.group;
  document.getElementById('fichaCatalogBox').classList.add('d-none');
}

function toggleFichaCatalog() {
  const box = document.getElementById('fichaCatalogBox');
  const willShow = box.classList.contains('d-none');
  box.classList.toggle('d-none', !willShow);
  if (willShow) {
    document.getElementById('fichaCatalogSearch').value = '';
    state.fichaQuery = '';
    renderFichaCatalogResults('');
    document.getElementById('fichaCatalogSearch').focus();
  }
}

function renderFichaCatalogResults(query) {
  state.fichaQuery = (query || '').trim();
  document.getElementById('fichaCatalogResults').innerHTML = pickerHtml(query, null, state.catalog, { create: 'createExerciseFromFichaSearch', catalog: 'pickCatalogForFicha' });
}

async function ensureLibraryExercise(name, group, source) {
  const clean = (name || '').trim();
  const existing = state.exercises.find(function (e) {
    return e.name.toLowerCase() === clean.toLowerCase();
  });
  if (existing) return existing;

  const exercise = {
    id: uid(),
    name: clean,
    group: group || 'Outros',
    source: source || 'custom',
    correction: '',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('exercises', exercise);
  state.exercises.push(exercise);
  return exercise;
}

function findOrCreateExercise(name) {
  return ensureLibraryExercise(name, 'Outros', 'custom');
}

async function createExerciseFromPicker() {
  try {
    const name = state.pickerQuery;
    if (!name) return;
    const exercise = await findOrCreateExercise(name);

    addExerciseToForm({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      note: exercise.correction || ''
    });

    hideExercisePicker();
  } catch (err) {
    alert('Erro ao criar exercício: ' + ((err && err.message) ? err.message : err));
  }
}

async function createExerciseFromFichaSearch() {
  const name = state.fichaQuery;
  if (!name) return;
  try {
    const exercise = await findOrCreateExercise(name);
    document.getElementById('fichaName').value = exercise.name;
    const groupSelect = document.getElementById('fichaGroup');
    const match = Array.prototype.some.call(groupSelect.options, function (o) { return o.value === exercise.group; });
    if (exercise.group && match) groupSelect.value = exercise.group;
    document.getElementById('fichaCatalogBox').classList.add('d-none');
  } catch (err) {
    alert('Erro ao criar exercício: ' + ((err && err.message) ? err.message : err));
  }
}

/* ---------- exercises (fichas) ---------- */

function sheetsUsingExercise(exercise) {
  const name = (exercise.name || '').toLowerCase();
  return state.sheets.filter(function (s) {
    return (s.exercises || []).some(function (item) {
      if (item.exerciseId && item.exerciseId === exercise.id) return true;
      return (item.name || '').toLowerCase() === name;
    });
  }).map(function (s) { return s.name; });
}

function fillLibraryGroupFilter() {
  const sel = document.getElementById('libraryGroupFilter');
  const groups = [];

  state.exercises.forEach(function (e) {
    if (e.active === false) return;
    if (!isUserExercise(e)) return;
    if (e.group && groups.indexOf(e.group) === -1) groups.push(e.group);
  });
  groups.sort(function (a, b) { return a.localeCompare(b, 'pt'); });

  let html = '<option value="">Todos os grupos</option>';
  groups.forEach(function (g) {
    html += '<option value="' + esc(g) + '"' + (state.libraryGroup === g ? ' selected' : '') + '>' + esc(g) + '</option>';
  });
  sel.innerHTML = html;
}

function renderExercises() {
  const el = document.getElementById('exercisesList');
  fillLibraryGroupFilter();

  const query = normalizeText(state.libraryQuery);
  const list = state.exercises.filter(function (e) {
    if (e.active === false) return false;
    if (!isUserExercise(e)) return false;
    if (state.libraryGroup && e.group !== state.libraryGroup) return false;
    if (query && normalizeText(e.name).indexOf(query) === -1) return false;
    return true;
  });

  if (!list.length) {
    el.innerHTML = '<p class="text-muted"><i class="bi bi-search"></i> Nenhum exercício aqui. Crie um novo — os exercícios do catálogo não entram nesta lista.</p>';
    return;
  }

  el.innerHTML = list.map(function (e) {
    const note = (e.correction || '').trim();
    const used = sheetsUsingExercise(e);
    const usage = used.length
      ? '<div class="small text-muted mt-1"><i class="bi bi-clipboard2-pulse"></i> usada em: ' +
        used.slice(0, 3).map(esc).join(', ') + (used.length > 3 ? ' +' + (used.length - 3) : '') + '</div>'
      : '<div class="small text-muted mt-1"><i class="bi bi-dash-circle"></i> não usada em nenhuma ficha</div>';

    return '<div class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-start">' +
      '<div class="me-2"><strong>' + esc(e.name) + '</strong> <span class="badge text-bg-light">' + esc(e.group || '') + '</span>' +
      (note ? '<div class="small text-muted"><i class="bi bi-info-circle"></i> ' + esc(note) + '</div>' : '') +
      usage +
      '</div>' +
      '<div class="d-flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-outline-primary" onclick="openExerciseForm(\'' + e.id + '\')" aria-label="Editar exercício"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteExercise(\'' + e.id + '\')" aria-label="Excluir exercício"><i class="bi bi-trash"></i></button>' +
      '</div></div></div>';
  }).join('');
}

function fillGroupSelect(selectId, selected) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = GROUPS.map(function (g) {
    return '<option value="' + esc(g) + '"' + (g === selected ? ' selected' : '') + '>' + esc(g) + '</option>';
  }).join('');
}

function openExerciseForm(id) {
  const e = id ? state.exercises.find(function (x) { return x.id === id; }) : null;

  document.getElementById('fichaId').value = e ? e.id : '';
  document.getElementById('fichaName').value = e ? e.name : '';
  fillGroupSelect('fichaGroup', e ? e.group : 'Peito');
  document.getElementById('fichaCorrection').value = e ? (e.correction || '') : '';
  document.getElementById('fichaCatalogSearch').value = '';
  document.getElementById('fichaCatalogBox').classList.add('d-none');
  document.getElementById('exerciseFormTitle').textContent = e ? 'Editar exercício' : 'Novo exercício';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('exerciseFormModal')).show();
}

async function saveExerciseForm() {
  const id = document.getElementById('fichaId').value;
  const name = document.getElementById('fichaName').value.trim();
  if (!name) {
    alert('Informe o nome do exercício.');
    return;
  }

  const existing = id ? state.exercises.find(function (x) { return x.id === id; }) : null;

  const exercise = {
    id: id || uid(),
    name: name,
    group: document.getElementById('fichaGroup').value,
    source: (existing && existing.source) ? existing.source : 'custom',
    correction: document.getElementById('fichaCorrection').value.trim(),
    active: true,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('exercises', exercise);
  state.exercises = await dbAll('exercises');

  if (existing && existing.name !== exercise.name) {
    await applyExerciseRename(exercise.id, existing.name, exercise.name);
  }

  bootstrap.Modal.getInstance(document.getElementById('exerciseFormModal')).hide();
  renderExercises();
}

// Ao renomear um exercício, mantém fichas e histórico coerentes (referência por id).
async function applyExerciseRename(exerciseId, oldName, newName) {
  const sheetResult = renameInSheets(state.sheets, exerciseId, oldName, newName);
  if (sheetResult.changed) {
    for (let i = 0; i < sheetResult.sheets.length; i++) {
      if (sheetResult.sheets[i] !== state.sheets[i]) await dbPut('sheets', sheetResult.sheets[i]);
    }
    state.sheets = await dbAll('sheets');
  }

  const workoutResult = renameInWorkouts(state.workouts, exerciseId, newName);
  if (workoutResult.changed) {
    for (let i = 0; i < workoutResult.workouts.length; i++) {
      if (workoutResult.workouts[i] !== state.workouts[i]) await dbPut('workouts', workoutResult.workouts[i]);
    }
    state.workouts = await dbAll('workouts');
  }

  return sheetResult.changed + workoutResult.changed;
}

async function deleteExercise(id) {
  if (!confirm('Excluir este exercício?')) return;
  await dbDelete('exercises', id);
  state.exercises = await dbAll('exercises');
  renderExercises();
}

/* ---------- workout sheets (fichas) ---------- */

function renderSheetsAndExercises() {
  renderSheets();
  renderExercises();
}

function renderSheets() {
  const el = document.getElementById('sheetsList');
  const list = activeSheets();
  const inactive = state.sheets.filter(function (s) { return s.active === false; });

  el.innerHTML = (list.length
    ? list.map(sheetCard).join('')
    : '<p class="text-muted"><i class="bi bi-clipboard2-plus"></i> Nenhuma ficha ativa. Crie uma ficha (ex.: TREINO A - inferiores) e adicione os exercícios dela.</p>') +
    (inactive.length
      ? '<h6 class="text-muted mt-3"><i class="bi bi-eye-slash"></i> Desativadas (não aparecem no Treinar)</h6>' +
        '<div class="opacity-50">' + inactive.map(sheetCard).join('') + '</div>'
      : '');
}

function sheetCard(s) {
  const off = s.active === false;
  const items = s.exercises || [];

  const exercisesHtml = items.length
    ? '<ul class="list-unstyled sheet-items mb-0">' + items.map(function (item, i) {
        const reps = Array.isArray(item.reps)
          ? item.reps.filter(function (r) { return r !== null && r !== undefined && r !== ''; }).join('-')
          : '';
        const setCount = parseInt(item.sets, 10) || (reps ? reps.split('-').length : 0);
        const detail = reps ? (setCount + '×' + reps) : (setCount ? setCount + ' séries' : '');

        return '<li>' +
          '<span class="sheet-item-idx">' + (i + 1) + '</span>' +
          '<span class="sheet-item-name">' + esc(labelOf(item)) + '</span>' +
          (detail ? '<span class="sheet-item-detail">' + esc(detail) + '</span>' : '') +
          (item.note ? '<span class="sheet-item-note text-truncate">' + esc(item.note) + '</span>' : '') +
          '</li>';
      }).join('') + '</ul>'
    : '<p class="text-muted small mb-0 mt-1">sem exercícios ainda — toque em ✏️ para adicionar</p>';

  return '<div class="card mb-2"><div class="card-body py-2">' +
    '<div class="d-flex justify-content-between align-items-start">' +
    '<div class="me-2">' +
    '<strong><i class="bi bi-clipboard2-pulse text-primary"></i> ' + esc(s.name) + '</strong> ' +
    '<span class="badge text-bg-light">' + items.length + (items.length === 1 ? ' exercício' : ' exercícios') + '</span>' +
    '</div>' +
    '<div class="d-flex gap-1">' +
    '<button type="button" class="btn btn-sm btn-outline-primary" onclick="openSheetEditor(\'' + s.id + '\')" aria-label="Editar ficha"><i class="bi bi-pencil"></i></button>' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="toggleSheetActive(\'' + s.id + '\')" aria-label="' + (off ? 'Reativar' : 'Desativar') + ' ficha" title="' + (off ? 'Reativar' : 'Desativar') + '"><i class="bi ' + (off ? 'bi-eye' : 'bi-eye-slash') + '"></i></button>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteSheet(\'' + s.id + '\')" aria-label="Excluir ficha"><i class="bi bi-trash"></i></button>' +
    '</div>' +
    '</div>' +
    exercisesHtml +
    '</div></div>';
}

function sheetNameExists(name, ignoreId) {
  return state.sheets.some(function (s) {
    return s.active !== false && s.id !== ignoreId && s.name.toLowerCase() === name.toLowerCase();
  });
}


function openSheetEditor(id) {
  const sheet = id ? findSheet(id) : null;
  state.editingSheetId = sheet ? sheet.id : null;
  state.sheetExercises = sheet
    ? (sheet.exercises || []).map(function (item) { return Object.assign({}, item); })
    : [];

  document.getElementById('sheetId').value = sheet ? sheet.id : '';
  document.getElementById('sheetName').value = sheet ? sheet.name : '';
  document.getElementById('sheetEditorTitle').textContent = sheet ? 'Editar ficha' : 'Nova ficha';
  document.getElementById('sheetPickerSearch').value = '';
  document.getElementById('sheetPickerBox').classList.add('d-none');
  state.sheetPickerQuery = '';
  renderSheetExerciseList();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('sheetEditorModal')).show();
}

function sheetRepsRow(item, idx) {
  const count = Math.min(Math.max(parseInt(item.sets, 10) || 1, 1), 20);
  const reps = Array.isArray(item.reps) ? item.reps : [];
  let html = '<div class="row g-2">';

  for (let i = 0; i < count; i++) {
    const value = (reps[i] === undefined || reps[i] === null) ? '' : reps[i];
    html += '<div class="col-4">' +
      '<input type="number" min="1" class="form-control form-control-sm" id="sheet-rep-' + idx + '-' + i + '"' +
      ' value="' + esc(value) + '" placeholder="' + (i + 1) + 'ª série"' +
      ' aria-label="Reps da ' + (i + 1) + 'ª série"' +
      ' oninput="setSheetReps(' + idx + ',' + i + ',this.value)">' +
      '</div>';
  }

  html += '</div>';
  return html;
}

function sheetExerciseRow(item, idx) {
  const note = item.note || '';

  return '<li class="sheet-edit-item">' +
    '<div class="d-flex justify-content-between align-items-start mb-2">' +
    '<strong><span class="badge text-bg-primary me-1">' + (idx + 1) + '</span>' + esc(labelOf(item)) + '</strong>' +
    '<div class="d-flex gap-1">' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="moveSheetExercise(' + idx + ',-1)" title="Subir" aria-label="Subir exercício"><i class="bi bi-arrow-up"></i></button>' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="moveSheetExercise(' + idx + ',1)" title="Descer" aria-label="Descer exercício"><i class="bi bi-arrow-down"></i></button>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeSheetExercise(' + idx + ')" title="Remover" aria-label="Remover exercício"><i class="bi bi-trash"></i></button>' +
    '</div>' +
    '</div>' +
    '<div class="row g-2">' +
    '<div class="col-4">' +
    '<label class="form-label small text-muted mb-1" for="sheet-sets-' + idx + '">Séries</label>' +
    '<input type="number" min="1" max="20" class="form-control form-control-sm" id="sheet-sets-' + idx + '" value="' + esc(item.sets) + '" placeholder="3" onchange="setSheetSets(' + idx + ',this.value)">' +
    '</div>' +
    '<div class="col-8">' +
    '<label class="form-label small text-muted mb-1" for="sheet-note-' + idx + '">Observação da professora</label>' +
    '<input type="text" class="form-control form-control-sm" id="sheet-note-' + idx + '" value="' + esc(note) + '" placeholder="ex.: pausa de 1s embaixo" oninput="setSheetField(' + idx + ",'note',this.value)\">" +
    '</div>' +
    '</div>' +
    '<div class="mt-2">' +
    '<label class="form-label small text-muted mb-1">Reps por série</label>' +
    sheetRepsRow(item, idx) +
    '</div>' +
    '</li>';
}

function renderSheetExerciseList() {
  const el = document.getElementById('sheetExerciseList');

  if (!state.sheetExercises.length) {
    el.innerHTML = '<p class="text-muted small mb-0">Nenhum exercício na ficha ainda. Use "Adicionar exercício".</p>';
    return;
  }

  el.innerHTML = '<ul class="list-unstyled mb-0">' + state.sheetExercises.map(function (item, idx) {
    return sheetExerciseRow(item, idx);
  }).join('') + '</ul>';
}




function setSheetField(idx, field, value) {
  if (!state.sheetExercises[idx]) return;
  state.sheetExercises[idx][field] = value;
}

function setSheetSets(idx, value) {
  const item = state.sheetExercises[idx];
  if (!item) return;
  item.sets = value;
  renderSheetExerciseList();
}

function setSheetReps(idx, repIdx, value) {
  const item = state.sheetExercises[idx];
  if (!item) return;
  if (!Array.isArray(item.reps)) item.reps = [];
  item.reps[repIdx] = value;
}

function moveSheetExercise(idx, delta) {
  const target = idx + delta;
  if (target < 0 || target >= state.sheetExercises.length) return;
  const tmp = state.sheetExercises[idx];
  state.sheetExercises[idx] = state.sheetExercises[target];
  state.sheetExercises[target] = tmp;
  renderSheetExerciseList();
}

function removeSheetExercise(idx) {
  state.sheetExercises.splice(idx, 1);
  renderSheetExerciseList();
}

function addSheetExercise(opts) {
  if (hasExercise(state.sheetExercises, opts)) {
    alert('"' + opts.name + '" já está nesta ficha. Aumente o número de séries dele.');
    return;
  }
  state.sheetExercises.push({
    exerciseId: opts.exerciseId || null,
    name: opts.name,
    sets: (opts.sets === undefined || opts.sets === null || opts.sets === '') ? 3 : opts.sets,
    reps: Array.isArray(opts.reps) ? opts.reps.slice() : [],
    note: opts.note || ''
  });
  renderSheetExerciseList();
}

/* Inline exercise picker inside the sheet editor (avoids stacking modals). */

async function toggleSheetPicker() {
  const box = document.getElementById('sheetPickerBox');
  const willShow = box.classList.contains('d-none');
  box.classList.toggle('d-none', !willShow);

  if (!willShow) return;

  await loadCatalog().catch(function () {});
  document.getElementById('sheetPickerSearch').value = '';
  state.sheetPickerQuery = '';
  renderSheetPickerResults('');
  document.getElementById('sheetPickerSearch').focus();
}

function renderSheetPickerResults(query) {
  state.sheetPickerQuery = (query || '').trim();
  document.getElementById('sheetPickerResults').innerHTML = pickerHtml(query, state.exercises, state.catalog, { create: 'createExerciseFromSheetPicker', library: 'pickSheetLibraryExercise', catalog: 'pickSheetCatalogExercise' });
}

function pickSheetLibraryExercise(id) {
  const e = state.exercises.find(function (x) { return x.id === id; });
  if (!e) return;
  addSheetExercise({
    exerciseId: e.id,
    name: e.name,
    sets: 3,
    reps: [],
    note: e.correction || ''
  });
  renderSheetPickerResults(state.sheetPickerQuery);
}

function pickSheetCatalogExercise(id) {
  const item = (state.catalog || []).find(function (x) { return String(x.id) === String(id); });
  if (!item) return;

  addSheetExercise({ exerciseId: item.id, name: item.name, sets: 3, reps: [], note: '' });
  renderSheetPickerResults(state.sheetPickerQuery);
}

async function createExerciseFromSheetPicker() {
  const name = state.sheetPickerQuery;
  if (!name) return;
  const exercise = await findOrCreateExercise(name);
  addSheetExercise({
    exerciseId: exercise.id,
    name: exercise.name,
    sets: 3,
    reps: [],
    note: exercise.correction || ''
  });
  renderSheetPickerResults(state.sheetPickerQuery);
}

// Depois de renomear/excluir uma ficha, atualiza tudo que mostra o nome dela:
// a lista de fichas, o seletor do treino, os últimos treinos (Início) e o calendário.
function refreshAfterSheetChange() {
  renderSheets();
  renderSheetOptions(document.getElementById('workoutSheet').value || null);
  renderWorkoutList();
  renderCalendar();
}

async function saveSheetEditor() {
  const name = document.getElementById('sheetName').value.trim();
  if (!name) {
    alert('Informe o nome da ficha.');
    return;
  }

  const id = document.getElementById('sheetId').value;
  const existing = id ? findSheet(id) : null;
  // Nome único só entre as ativas: uma desativada pode ter o mesmo nome de uma ativa.
  if ((!existing || existing.active !== false) && sheetNameExists(name, id)) {
    alert('Já existe uma ficha com esse nome.');
    return;
  }

  const sheet = {
    id: id || uid(),
    name: name,
    active: existing ? existing.active !== false : true,
    exercises: state.sheetExercises.map(function (item) {
      // Mesma normalização da importação: séries entre 1 e 20, uma rep (ou null) por série.
      const clean = normalizeSheetItem({
        exerciseId: item.exerciseId,
        name: labelOf(item),
        sets: item.sets,
        reps: Array.isArray(item.reps) ? Array.from(item.reps) : [],
        note: (item.note || '').trim()
      });
      clean.reps = clean.reps.slice(0, clean.sets);
      return clean;
    }),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('sheets', sheet);
  state.sheets = await dbAll('sheets');
  bootstrap.Modal.getInstance(document.getElementById('sheetEditorModal')).hide();
  refreshAfterSheetChange();
}

// Desativar esconde a ficha do seletor do Treinar sem apagar nada; reativar traz de volta.
async function toggleSheetActive(id) {
  const sheet = findSheet(id);
  if (!sheet) return;
  if (sheet.active === false && sheetNameExists(sheet.name, sheet.id)) {
    alert('Já existe uma ficha ativa com esse nome. Renomeie uma delas antes de reativar.');
    return;
  }
  await dbPut('sheets', Object.assign({}, sheet, { active: sheet.active === false, updatedAt: new Date().toISOString() }));
  state.sheets = await dbAll('sheets');
  refreshAfterSheetChange();
}

// Exercícios que a importação pode usar: Biblioteca (ativos) antes do catálogo.
function importCandidates() {
  return state.exercises.filter(function (e) { return e.active !== false; }).concat(state.catalog || []);
}

function exactExercise(name) {
  const key = normalizeText(name);
  return importCandidates().find(function (e) { return normalizeText(e.name) === key; }) || null;
}

// Lê o arquivo, valida e abre a revisão: nomes sem par exato pedem escolha (parecido ou criar novo).
function setImportButton(label) {
  document.getElementById('sheetImportConfirm').innerHTML = '<i class="bi bi-check-lg"></i> ' + label;
}

// Passo 1: caixa de texto para colar o JSON.
function openSheetImport() {
  state.pendingImport = null;
  document.getElementById('sheetImportText').value = '';
  document.getElementById('sheetImportPaste').classList.remove('d-none');
  document.getElementById('sheetImportBody').innerHTML = '';
  setImportButton('Revisar');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('sheetImportModal')).show();
}

// Passo 2: valida o texto e mostra a revisão (o botão vira "Importar").
async function reviewSheetImport() {
  let sheets;
  try {
    sheets = parseSheetImportText(document.getElementById('sheetImportText').value);
  } catch (e) {
    alert('Não deu para importar a ficha.\n\n' + (e instanceof SyntaxError ? 'O texto não é um JSON válido. Copie a resposta inteira da IA.' : e.message));
    return;
  }

  await loadCatalog();
  const unmatched = [];
  sheets.forEach(function (s) {
    s.exercises.forEach(function (item) {
      if (!exactExercise(item.name) && !unmatched.some(function (n) { return normalizeText(n) === normalizeText(item.name); })) {
        unmatched.push(item.name);
      }
    });
  });
  state.pendingImport = { sheets: sheets, unmatched: unmatched };

  const summary = '<ul class="small mb-3">' + sheets.map(function (s) {
    return '<li><strong>' + esc(s.name) + '</strong> — ' + s.exercises.length + (s.exercises.length === 1 ? ' exercício' : ' exercícios') + '</li>';
  }).join('') + '</ul>';

  const review = unmatched.length
    ? '<p class="small mb-2"><i class="bi bi-question-circle text-primary"></i> Estes nomes não existem no app. Escolha um exercício parecido para não duplicar, ou crie um novo:</p>' +
      unmatched.map(function (name, i) {
        const candidates = importCandidates();
        const strong = suggestExercises(name, candidates, 1, 0.5)[0];
        const options = suggestExercises(name, candidates, 6).map(function (e) {
          return '<option value="' + esc(e.id) + '"' + (e === strong ? ' selected' : '') + '>' + esc(e.name) + (typeof e.id === 'number' ? ' (catálogo)' : ' (biblioteca)') + '</option>';
        }).join('');
        return '<div class="mb-2"><label class="form-label small fw-semibold mb-1" for="imp-' + i + '">' + esc(name) + '</label>' +
          '<select class="form-select form-select-sm" id="imp-' + i + '">' +
          '<option value=""' + (strong ? '' : ' selected') + '>➕ Criar novo: ' + esc(name) + '</option>' + options + '</select></div>';
      }).join('')
    : '<p class="small text-success mb-0"><i class="bi bi-check-circle"></i> Todos os exercícios já existem no app.</p>';

  document.getElementById('sheetImportBody').innerHTML = summary + review;
  document.getElementById('sheetImportPaste').classList.add('d-none');
  setImportButton('Importar');
}

async function confirmSheetImport() {
  const pending = state.pendingImport;
  state.pendingImport = null;   // antes dos awaits: toque duplo não grava duas vezes
  if (!pending) return;

  const chosen = {};
  pending.unmatched.forEach(function (name, i) {
    const id = document.getElementById('imp-' + i).value;
    chosen[normalizeText(name)] = id ? importCandidates().find(function (e) { return String(e.id) === id; }) : null;
  });

  for (let i = 0; i < pending.sheets.length; i++) {
    const s = pending.sheets[i];
    const exercises = [];
    for (let j = 0; j < s.exercises.length; j++) {
      const item = s.exercises[j];
      const found = exactExercise(item.name) || chosen[normalizeText(item.name)] || await findOrCreateExercise(item.name);
      exercises.push(Object.assign({}, item, { exerciseId: found.id, name: found.name }));
    }
    let name = s.name;
    while (sheetNameExists(name, null)) name += ' (importada)';
    const now = new Date().toISOString();
    await dbPut('sheets', { id: uid(), name: name, active: true, exercises: exercises, createdAt: now, updatedAt: now });
    state.sheets = await dbAll('sheets');
  }

  bootstrap.Modal.getInstance(document.getElementById('sheetImportModal')).hide();
  refreshAfterSheetChange();
  renderExercises();
}

/* ---------- contrato para a IA (#/ia) ---------- */

async function renderIa() {
  const area = document.getElementById('iaText');
  area.value = 'Carregando…';
  const response = await fetch('FICHA-JSON.md');
  const contract = await response.text();
  area.value = contract + '\n\n' + exerciseNamesText(libraryExercises(state.exercises), await loadCatalog());
}

async function deleteSheet(id) {
  if (!confirm('Excluir esta ficha? Os treinos já registrados não são afetados.')) return;
  await dbDelete('sheets', id);
  state.sheets = await dbAll('sheets');
  refreshAfterSheetChange();
}

/* ---------- calendar ---------- */

function changeMonth(delta) {
  state.calendarCursor = shiftMonth(state.calendarCursor || new Date(), delta);
  renderCalendar();
}

function renderCalendar() {
  if (!state.calendarCursor) state.calendarCursor = new Date();
  const y = state.calendarCursor.getFullYear();
  const m = state.calendarCursor.getMonth();
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  document.getElementById('calMonthLabel').textContent = monthNames[m] + ' de ' + y;

  const prefix = y + '-' + pad2(m + 1);
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const byDate = workoutsByDate(state.workouts);
  let total = 0;

  const cells = [];
  const today = todayISO();
  for (let i = 0; i < firstDow; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = prefix + '-' + pad2(day);
    const dayWorkouts = byDate[iso] || [];
    const count = dayWorkouts.length;
    total += count;
    const classes = 'cal-cell' + (count ? ' has-workout' : '') + (iso === today ? ' today' : '');
    // Dia com treino é um link para o treino (com dois no dia, abre o mais recente).
    cells.push(count
      ? '<a class="' + classes + '" href="#/detail/' + esc(dayWorkouts[0].id) + '" aria-label="' + esc('Abrir treino de ' + fmtBR(iso) + (count > 1 ? ' (' + count + ' treinos no dia)' : '')) + '">' + day + '<span class="cal-badge">' + count + '</span></a>'
      : '<div class="' + classes + '">' + day + '</div>');
  }

  document.getElementById('calendarGrid').innerHTML = cells.join('');

  document.getElementById('calendarTotal').innerHTML = '<i class="bi bi-calendar-check"></i> ' + total + (total === 1 ? ' treino' : ' treinos') + ' em ' + monthNames[m] + '.';
  renderWeeklyProgress();
}

/* ---------- evolução semanal (volume, treinos, cardio) ---------- */

function fmtKg(n) {
  return Math.round(n).toLocaleString('pt-BR') + ' kg';
}

function renderWeeklyProgress() {
  const el = document.getElementById('weeklyProgress');
  if (!el) return;

  const weeks = weeklyTotals(state.workouts, weekRange().anchor, 8);
  if (!weeks.some(function (w) { return w.workouts > 0; })) {
    el.innerHTML = '';
    return;
  }

  const maxVolume = Math.max.apply(null, weeks.map(function (w) { return w.volume; }).concat([1]));
  const target = state.settings.weeklyWorkoutTarget;

  el.innerHTML = '<div class="card mt-3"><div class="card-body">' +
    '<h2 class="h6 mb-1"><i class="bi bi-graph-up-arrow text-primary"></i> Evolução das últimas 8 semanas</h2>' +
    '<p class="small text-muted mb-2">Volume = soma de reps × carga das séries (sem aquecimento). Semanas no mesmo ciclo das metas.</p>' +
    weeks.slice().reverse().map(function (w, i) {
      const pct = w.volume ? Math.max(3, Math.round((w.volume / maxVolume) * 100)) : 0;
      const hitGoal = w.workouts >= target;
      return '<div class="week-row mb-2">' +
        '<div class="d-flex justify-content-between small">' +
        '<span>' + (i === 0 ? '<strong>Esta semana</strong>' : fmtBR(w.start).slice(0, 5) + ' – ' + fmtBR(w.end).slice(0, 5)) + '</span>' +
        '<span><strong>' + fmtKg(w.volume) + '</strong></span>' +
        '</div>' +
        '<div class="progress" style="height: 10px" role="progressbar" aria-label="Volume da semana" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="progress-bar" style="width: ' + pct + '%"></div></div>' +
        '<div class="small text-muted">' +
        '<span class="' + (hitGoal ? 'text-success fw-semibold' : '') + '">' + (hitGoal ? '<i class="bi bi-check-circle-fill"></i> ' : '') +
        w.workouts + '/' + target + (w.workouts === 1 ? ' treino' : ' treinos') + '</span>' +
        (w.cardio ? ' · ' + w.cardio + ' min cardio' : '') +
        '</div>' +
        '</div>';
    }).join('') +
    '</div></div>';
}

/* ---------- colinha ---------- */

function renderColinhaList() {
  const el = document.getElementById('colinhaList');
  const list = state.colinha.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

  if (!list.length) {
    el.innerHTML = '<p class="text-muted small"><i class="bi bi-journal-text"></i> Nenhuma colinha ainda.</p>';
    return;
  }

  el.innerHTML = list.map(function (c) {
    return '<div class="d-flex justify-content-between align-items-center py-1 border-bottom">' +
      '<div class="me-2"><strong>' + esc(c.title) + '</strong><br><small class="text-muted">' + esc(c.content) + '</small></div>' +
      '<div class="d-flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-outline-primary" onclick="openColinhaForm(\'' + c.id + '\')" aria-label="Editar colinha"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteColinha(\'' + c.id + '\')" aria-label="Excluir colinha"><i class="bi bi-trash"></i></button>' +
      '</div></div>';
  }).join('');
}

function openColinhaForm(id) {
  const c = id ? state.colinha.find(function (x) { return x.id === id; }) : null;
  document.getElementById('colinhaId').value = c ? c.id : '';
  document.getElementById('colinhaTitle').value = c ? c.title : '';
  document.getElementById('colinhaContent').value = c ? c.content : '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('colinhaModal')).show();
}

async function saveColinha() {
  const id = document.getElementById('colinhaId').value;
  const title = document.getElementById('colinhaTitle').value.trim();
  const content = document.getElementById('colinhaContent').value.trim();
  if (!title && !content) {
    alert('Preencha o título ou o conteúdo.');
    return;
  }

  const existing = id ? state.colinha.find(function (x) { return x.id === id; }) : null;
  const note = {
    id: id || uid(),
    title: title,
    content: content,
    order: existing ? existing.order : Date.now()
  };

  await dbPut('colinha', note);
  state.colinha = await dbAll('colinha');
  bootstrap.Modal.getInstance(document.getElementById('colinhaModal')).hide();
  renderColinhaList();
}

async function deleteColinha(id) {
  if (!confirm('Excluir esta colinha?')) return;
  await dbDelete('colinha', id);
  state.colinha = await dbAll('colinha');
  renderColinhaList();
}

/* ---------- more / settings ---------- */

function renderMore() {
  document.getElementById('setWorkoutTarget').value = state.settings.weeklyWorkoutTarget;
  document.getElementById('setCardioTarget').value = state.settings.weeklyCardioTarget;
  document.getElementById('setWeekAnchor').value = state.settings.weekAnchor || todayISO();
  document.getElementById('setRestSeconds').value = restSecondsOf(state.settings);
  document.getElementById('btnUndoImport').classList.toggle('d-none', !state.lastImportSnapshot);
  renderBackupStatus();
  renderStorageInfo();
  renderColinhaList();
}

/* ---------- armazenamento persistente ---------- */

// Pede ao navegador para nao apagar os dados quando o aparelho ficar sem espaco.
// O navegador pode recusar; nesse caso o app continua funcionando como antes.
async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) {
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',') + ' GB';
}

// Mostra em Mais -> Dados quanto espaco o app usa e se o armazenamento e persistente.
async function renderStorageInfo() {
  const el = document.getElementById('storageInfo');
  if (!el) return;
  if (!navigator.storage || !navigator.storage.estimate) {
    el.textContent = '';
    return;
  }

  try {
    const est = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    let text = 'Espaço usado: ' + formatBytes(est.usage);
    if (est.quota) text += ' de ' + formatBytes(est.quota) + ' disponíveis';
    text += persisted
      ? ' · armazenamento protegido'
      : ' · armazenamento não protegido (o navegador pode apagar se faltar espaço — mantenha o backup em dia)';
    el.textContent = text;
  } catch (e) {
    el.textContent = '';
  }
}

async function saveSettingsForm() {
  state.settings.weeklyWorkoutTarget = Math.max(1, toNum(document.getElementById('setWorkoutTarget').value) || 1);
  state.settings.weeklyCardioTarget = Math.max(0, toNum(document.getElementById('setCardioTarget').value) || 0);
  state.settings.weekAnchor = document.getElementById('setWeekAnchor').value || todayISO();
  state.settings.restSeconds = restSecondsOf({ restSeconds: document.getElementById('setRestSeconds').value });
  await dbPut('settings', state.settings);
  alert('Metas salvas.');
}

async function startWeekToday() {
  state.settings.weekAnchor = todayISO();
  await dbPut('settings', state.settings);
  renderMore();
  alert('Semana iniciada hoje (' + fmtBR(todayISO()) + ').');
}

/* ---------- export / import ---------- */

/* ---------- erase all data (own screen, no alerts) ---------- */

function renderErase() {
  const el = document.getElementById('eraseBody');

  if (state.eraseDone) {
    el.innerHTML =
      '<div class="alert alert-success"><i class="bi bi-check2-circle"></i> <strong>Pronto!</strong> Todos os dados do app foram apagados deste aparelho.</div>' +
      '<p class="text-muted small">O app voltou ao estado inicial: metas padrão (3 treinos / 120 min de cardio) e semana começando hoje.</p>' +
      '<a href="#/dashboard" class="btn btn-primary w-100">Voltar para o início</a>';
    return;
  }

  el.innerHTML =
    '<div class="alert alert-danger">' +
    '<i class="bi bi-exclamation-triangle"></i> <strong>Atenção:</strong> esta ação apaga <strong>todos</strong> os dados deste aparelho — ' +
    'treinos, fichas, exercícios da biblioteca, colinha e metas. <strong>Não há como desfazer.</strong>' +
    '</div>' +
    '<div class="card mb-3"><div class="card-body">' +
    '<div class="form-check">' +
    '<input class="form-check-input" type="checkbox" id="eraseAck">' +
    '<label class="form-check-label" for="eraseAck">Quero realmente apagar todos os meus dados.</label>' +
    '</div>' +
    '<p class="small text-muted mb-0 mt-2">Dica: se quiser guardar uma cópia antes, use ' +
    '<strong>Mais → Dados → Exportar</strong>.</p>' +
    '</div></div>' +
    '<div class="d-flex gap-2">' +
    '<a href="#/more" class="btn btn-outline-secondary flex-fill">Cancelar</a>' +
    '<button class="btn btn-danger flex-fill" type="button" id="eraseConfirmBtn" disabled><i class="bi bi-trash"></i> Apagar tudo</button>' +
    '</div>';

  const ack = document.getElementById('eraseAck');
  const confirmBtn = document.getElementById('eraseConfirmBtn');

  ack.addEventListener('change', function () {
    confirmBtn.disabled = !ack.checked;
  });

  confirmBtn.addEventListener('click', guard(eraseAllData));
}

async function eraseAllData() {
  const ack = document.getElementById('eraseAck');
  if (!ack || !ack.checked) return;

  await dbClear('workouts');
  await dbClear('exercises');
  await dbClear('sheets');
  await dbClear('settings');
  await dbClear('colinha');

  state.viewingWorkoutId = null;
  state.viewingExerciseId = null;
  state.viewingExerciseName = '';
  state.editingWorkoutId = null;
  state.lastImportSnapshot = null;
  state.libraryGroup = '';
  state.libraryQuery = '';
  state.sheetExercises = [];
  state.formSets = [];
  state.eraseDone = true;

  await loadState();
  renderErase();
}
/* ---------- share a single workout as human-readable text ---------- */


function exportWorkoutText(id) {
  const workout = id ? state.workouts.find(function (w) { return w.id === id; }) : null;
  if (!workout) return;

  document.getElementById('exportText').value = workoutAsText(workout, state.sheets, allExercises(), commaDecimal);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('exportModal')).show();
}

async function copyExportText(areaId) {
  const area = document.getElementById(areaId);
  const text = area.value;

  try {
    await navigator.clipboard.writeText(text);
    alert('Texto copiado!');
  } catch (e) {
    area.select();
    document.execCommand('copy');
    alert('Texto copiado!');
  }
}

async function shareExportText(areaId) {
  const text = document.getElementById(areaId).value;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Meu Treino', text: text });
      return;
    } catch (e) {
      // cancelled or unsupported: fall back to copy
    }
  }

  copyExportText(areaId);
}

function appVersionLabel() {
  const el = document.getElementById('appVersion');
  return el ? el.textContent.trim() : '';
}

/* ---------- backup (arquivo, compartilhar e lembrete) ---------- */

// Depois de quantos dias sem backup o app lembra o usuário.
const BACKUP_REMINDER_DAYS = 7;

function buildBackup() {
  const payload = {
    app: 'meu-treino',
    version: 2,
    appVersion: appVersionLabel(),
    exportedAt: new Date().toISOString(),
    data: {
      workouts: state.workouts,
      exercises: state.exercises,
      sheets: state.sheets,
      settings: state.settings,
      colinha: state.colinha
    }
  };

  const json = JSON.stringify(payload, null, 2);
  const name = backupFileName();

  return { name: name, json: json, file: new File([json], name, { type: 'application/json' }) };
}

async function markBackupDone() {
  state.settings.lastBackupAt = new Date().toISOString();
  await dbPut('settings', state.settings);
  renderBackupStatus();
  renderBackupReminder();
}

function renderBackupStatus() {
  const el = document.getElementById('backupStatus');
  const versao = appVersionLabel();
  if (el) {
    el.textContent = backupStatus(state.settings, new Date(), BACKUP_REMINDER_DAYS).label +
      (versao ? ' · ' + versao : '');
  }
  renderExportHint();
}

// Lembrete no Início quando o último backup está velho (ou nunca foi feito).
function renderBackupReminder() {
  const el = document.getElementById('backupReminder');
  if (!el) return;

  const hasData = state.workouts.length > 0 || state.sheets.length > 0;
  const info = backupStatus(state.settings, new Date(), BACKUP_REMINDER_DAYS);

  if (!hasData || !info.overdue || state.dismissBackupReminder) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = '<div class="alert alert-warning py-2">' +
    '<div><i class="bi bi-cloud-arrow-up"></i> <strong>Backup pendente.</strong> ' + esc(info.label) +
    ' Guarde uma cópia para não perder seus treinos.</div>' +
    '<div class="d-flex gap-2 mt-2">' +
    '<button type="button" class="btn btn-sm btn-primary flex-fill" id="reminderBackup"><i class="bi bi-share"></i> Fazer backup</button>' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" id="reminderDismiss">Depois</button>' +
    '</div></div>';

  document.getElementById('reminderBackup').addEventListener('click', guard(exportBackup));
  document.getElementById('reminderDismiss').addEventListener('click', function () {
    state.dismissBackupReminder = true;
    renderBackupReminder();
  });
}

function isTouchDevice() {
  return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function backupActionStatus(message) {
  const el = document.getElementById('backupAction');
  if (el) el.textContent = message || '';
}

// O navegador deste aparelho sabe compartilhar arquivos?
function canShareBackupFile() {
  if (!navigator.canShare) return false;
  try {
    return !!navigator.canShare(backupSharePayload(new File([], 'backup.json', { type: 'application/json' })));
  } catch (e) {
    return false;
  }
}

// Dica embaixo do botão Exportar: diz para onde o arquivo vai neste aparelho (e ajusta o ícone).
function renderExportHint() {
  const hint = document.getElementById('backupAction');
  const btn = document.getElementById('btnExport');
  const action = backupAction({ canShareFiles: canShareBackupFile(), touch: isTouchDevice() });

  if (hint) hint.textContent = backupHint(action);
  if (btn) {
    btn.innerHTML = (action === 'share'
      ? '<i class="bi bi-share"></i> '
      : '<i class="bi bi-download"></i> ') + 'Exportar';
  }
}

// Salva o arquivo no aparelho (download). Aceita um backup já montado para não gerar
// nomes diferentes na mesma ação.
async function downloadBackup(prebuilt) {
  // Atenção: o handler de clique passa o evento como argumento; só usamos um backup de verdade.
  const backup = isBackupPayload(prebuilt) ? prebuilt : buildBackup();
  const url = URL.createObjectURL(new Blob([backup.json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backup.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  await markBackupDone();
  backupActionStatus('Arquivo gerado: ' + backup.name);
}

// Botão "Exportar": abre o menu de compartilhamento do aparelho (Drive, WhatsApp, Arquivos)
// no celular/tablet e baixa o arquivo no computador. Se o compartilhamento falhar,
// NÃO baixa sozinho — assim nunca aparecem dois arquivos.
async function exportBackup() {
  const backup = buildBackup();

  if (backupAction({ canShareFiles: canShareBackupFile(), touch: isTouchDevice() }) === 'download') {
    await downloadBackup(backup);
    return;
  }

  try {
    await navigator.share(backupSharePayload(backup.file));
    await markBackupDone();
    backupActionStatus('Backup compartilhado: ' + backup.name);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      backupActionStatus('Compartilhamento cancelado — nada foi gerado.');
      return;
    }
    backupActionStatus('Não deu para compartilhar agora. Tente de novo ou use um computador.');
  }
}

async function forceUpdate() {
  const ok = confirm('Atualizar o app?\n\nIsso limpa o cache e recarrega a versão mais nova. Seus treinos salvos não são afetados.');
  if (!ok) return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let i = 0; i < registrations.length; i++) {
        await registrations[i].unregister();
      }
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    }
  } catch (e) {
    // segue e recarrega mesmo assim
  }

  location.reload();
}


async function importData(file) {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    alert('Arquivo JSON inválido.');
    return;
  }

  // O arquivo de exemplo usa datas relativas (dayOffset); materializamos na importação também.
  const data = (payload && payload.sample)
    ? materializeSampleData(payload, todayISO())
    : (payload && payload.data ? payload.data : payload);
  if (!data || !Array.isArray(data.workouts)) {
    alert('Este arquivo não parece ser um backup do Meu Treino.');
    return;
  }

  if (!confirm('Substituir todos os dados atuais pelo backup importado?\n\nSe algo estiver errado, você poderá desfazer em Mais → Dados.')) return;

  // Keep the current data in memory so the import can be undone.
  const snapshot = {
    workouts: state.workouts,
    exercises: state.exercises,
    sheets: state.sheets,
    settings: state.settings,
    colinha: state.colinha
  };

  await restoreAll(data);
  state.lastImportSnapshot = snapshot;

  await loadState();
  await linkSheetItems();
  alert('Backup importado! Para desfazer, use "Desfazer importação" em Mais → Dados.');
  location.hash = '#/dashboard';
  renderDashboard();
}

async function restoreAll(data) {
  // normalizeBackup converte backups antigos (v1) para o formato atual sem perder dados.
  const normalized = normalizeBackup(data);

  // Apagar e gravar na MESMA transação: se algo falhar, os dados antigos não se perdem.
  await dbReplaceAll({
    workouts: normalized.workouts,
    exercises: normalized.exercises,
    sheets: normalized.sheets,
    colinha: normalized.colinha,
    settings: [Object.assign({}, normalized.settings, { id: APP_SETTINGS_ID })]
  });
}

async function loadSampleData() {
  const status = document.getElementById('sampleStatus');
  status.textContent = 'Carregando...';

  const ok = confirm('Carregar os dados de exemplo?\n\nSao 3 fichas, 12 treinos e 6 exercicios. Isso substitui os dados atuais, mas voce pode desfazer em Mais > Dados.');
  if (!ok) {
    status.textContent = '';
    return;
  }

  const response = await fetch('data/sample-data.json');
  const payload = await response.json();
  const data = materializeSampleData(payload, todayISO());

  const snapshot = {
    workouts: state.workouts,
    exercises: state.exercises,
    sheets: state.sheets,
    settings: state.settings,
    colinha: state.colinha
  };

  await restoreAll(data);
  state.lastImportSnapshot = snapshot;

  await loadState();
  await linkSheetItems();
  await repairLibrarySources();

  status.textContent = 'Dados de exemplo carregados: ' + data.sheets.length + ' fichas, ' +
    data.workouts.length + ' treinos e ' + data.exercises.length + ' exercicios.';

  renderMore();
}

async function undoImport() {
  const snapshot = state.lastImportSnapshot;
  if (!snapshot) return;
  if (!confirm('Desfazer a última importação e voltar aos dados anteriores?')) return;

  await restoreAll(snapshot);
  state.lastImportSnapshot = null;
  await loadState();
  alert('Dados anteriores restaurados.');
  renderMore();
}

/* ---------- events & boot ---------- */

function bindEvents() {
  window.addEventListener('hashchange', navigate);

  document.getElementById('btnAddExercise').addEventListener('click', guard(openExercisePickerModal));
  document.getElementById('workoutSave').addEventListener('click', guard(saveWorkout));
  document.getElementById('workoutDelete').addEventListener('click', guard(deleteWorkout));
  document.getElementById('workoutCancel').addEventListener('click', cancelWorkout);
  document.getElementById('workoutExport').addEventListener('click', function () { exportWorkoutText(state.editingWorkoutId); });
  document.getElementById('detailBack').addEventListener('click', function () { history.back(); });
  document.getElementById('exerciseBack').addEventListener('click', function () { history.back(); });
  document.getElementById('detailEdit').addEventListener('click', function () {
    state.editingWorkoutId = state.viewingWorkoutId;
    location.hash = '#/workout';
  });
  document.getElementById('detailExport').addEventListener('click', function () { exportWorkoutText(state.viewingWorkoutId); });
  document.getElementById('detailDelete').addEventListener('click', guard(deleteViewedWorkout));
  document.getElementById('workoutSheet').addEventListener('change', guard(onSheetChange));
  ['workoutDate', 'workoutCardio', 'workoutNotes'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', scheduleDraftSave);
    document.getElementById(id).addEventListener('change', scheduleDraftSave);
  });
  // Celular: ao trocar de app ou bloquear a tela, grava o rascunho na hora.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushDraft();
  });
  window.addEventListener('pagehide', flushDraft);
  document.getElementById('restAdd').addEventListener('click', function () { addRest(15); });
  document.getElementById('restStop').addEventListener('click', stopRest);

  document.getElementById('btnNewSheet').addEventListener('click', function () { openSheetEditor(null); });
  document.getElementById('btnImportSheet').addEventListener('click', openSheetImport);
  document.getElementById('sheetEditorSave').addEventListener('click', guard(saveSheetEditor));
  document.getElementById('btnSheetAddExercise').addEventListener('click', guard(toggleSheetPicker));
  document.getElementById('sheetPickerSearch').addEventListener('input', function () {
    renderSheetPickerResults(this.value);
  });

  document.getElementById('btnNewExercise').addEventListener('click', function () { openExerciseForm(null); });
  document.getElementById('libraryGroupFilter').addEventListener('change', function () {
    state.libraryGroup = this.value;
    renderExercises();
  });
  document.getElementById('librarySearch').addEventListener('input', function () {
    state.libraryQuery = this.value;
    renderExercises();
  });
  document.getElementById('exerciseFormSave').addEventListener('click', guard(saveExerciseForm));
  document.getElementById('btnFichaCatalog').addEventListener('click', toggleFichaCatalog);
  document.getElementById('fichaCatalogSearch').addEventListener('input', function () {
    renderFichaCatalogResults(this.value);
  });

  document.getElementById('pickerSearch').addEventListener('input', function () {
    renderPickerResults(this.value);
  });

  document.getElementById('calPrev').addEventListener('click', function () { changeMonth(-1); });
  document.getElementById('calNext').addEventListener('click', function () { changeMonth(1); });

  document.getElementById('btnAddColinha').addEventListener('click', function () { openColinhaForm(null); });
  document.getElementById('colinhaSave').addEventListener('click', guard(saveColinha));

  document.getElementById('btnSaveSettings').addEventListener('click', guard(saveSettingsForm));
  document.getElementById('btnWeekToday').addEventListener('click', guard(startWeekToday));

  document.getElementById('btnExport').addEventListener('click', guard(exportBackup));
  document.getElementById('exportCopy').addEventListener('click', function () { guard(copyExportText)('exportText'); });
  document.getElementById('iaCopy').addEventListener('click', function () { guard(copyExportText)('iaText'); });
  document.getElementById('exportShare').addEventListener('click', function () { guard(shareExportText)('exportText'); });
  document.getElementById('iaShare').addEventListener('click', function () { guard(shareExportText)('iaText'); });
  document.getElementById('sheetImportConfirm').addEventListener('click', function () {
    guard(state.pendingImport ? confirmSheetImport : reviewSheetImport)();
  });
  document.getElementById('btnForceUpdate').addEventListener('click', guard(forceUpdate));
  document.getElementById('btnImport').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('btnUndoImport').addEventListener('click', guard(undoImport));
  document.getElementById('btnLoadSample').addEventListener('click', guard(loadSampleData));
  document.getElementById('btnEraseAll').addEventListener('click', function () { state.eraseDone = false; });
  document.getElementById('importFile').addEventListener('change', function () {
    if (this.files && this.files[0]) guard(importData)(this.files[0]);
    this.value = '';
  });
}

function guard(fn) {
  return function () {
    try {
      const result = fn.apply(this, arguments);
      if (result && typeof result.catch === 'function') {
        result.catch(function (err) { alert('Erro: ' + ((err && err.message) ? err.message : err)); });
      }
    } catch (err) {
      alert('Erro: ' + ((err && err.message) ? err.message : err));
    }
  };
}

// Versões anteriores escondiam da Biblioteca os exercícios cujo NOME existia no catálogo.
// Isso escondia exercícios criados pelo usuário — aqui desfazemos essa marcação
// (mantemos 'catalog' apenas quando houver catalogId, que comprova a origem).
// Dá "chave estrangeira" aos itens de ficha antigos: liga pelo nome ao exercício da Biblioteca.
async function linkSheetItems() {
  // Biblioteca + catalogo: fichas antigas ganham o id do catalogo quando o nome casa exatamente.
  const result = linkSheetItemsToExercises(state.sheets, allExercises());
  if (!result.changed) return 0;

  for (let i = 0; i < result.sheets.length; i++) {
    if (result.sheets[i] !== state.sheets[i]) await dbPut('sheets', result.sheets[i]);
  }

  state.sheets = await dbAll('sheets');
  return result.changed;
}

async function repairLibrarySources() {
  const resultado = fixLibrarySources(state.exercises);

  for (let i = 0; i < resultado.exercises.length; i++) {
    if (resultado.exercises[i] !== state.exercises[i]) await dbPut('exercises', resultado.exercises[i]);
  }

  state.exercises = await dbAll('exercises');
  return resultado.changed;
}

async function init() {
  await loadState();
  await repairLibrarySources();
  await linkSheetItems();

  try {
    await loadCatalog();
  } catch (e) {
    // o catálogo é opcional para o app funcionar
  }
  bindEvents();
  navigate();

  // nao bloqueia a abertura do app; atualiza o card Dados quando o navegador responder
  requestPersistentStorage().then(function () { renderStorageInfo(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

init();
