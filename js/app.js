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
  calendarCursor: null
};

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
  const viewName = hash.replace('#/', '') || 'dashboard';

  if (viewName !== 'workout') state.editingWorkoutId = null;

  document.querySelectorAll('.view').forEach(function (v) {
    v.classList.add('d-none');
  });

  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.remove('d-none');

  document.querySelectorAll('.bottom-nav a').forEach(function (a) {
    const activeHash = (viewName === 'detail' || viewName === 'exercise') ? '#/dashboard' : ((viewName === 'erase') ? '#/more' : hash);
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
  state.settings.weekAnchor = addDaysISO(state.settings.weekAnchor, 7);
  await dbPut('settings', state.settings);
  renderDashboard();
}

/* ---------- dashboard ---------- */

function renderDashboard() {
  renderWeek();
  renderBackupReminder();
  renderRecent();
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


function renderRecent() {
  const el = document.getElementById('recentWorkouts');
  const recent = state.workouts.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  }).slice(0, 5);

  if (!recent.length) {
    el.innerHTML = '<p class="text-muted"><i class="bi bi-emoji-smile"></i> Nenhum treino registrado ainda. Toque em <strong>Treinar</strong> para começar.</p>';
    return;
  }

  el.innerHTML = '<h6 class="mt-2"><i class="bi bi-clock-history text-primary"></i> Últimos treinos</h6>' + recent.map(function (w) {
    const setCount = (w.sets || []).length;
    const name = sheetLabel(w, state.sheets) || 'Treino';
    const warm = warmupSummary(w.warmups);
    return '<div class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">' +
      '<button type="button" class="btn btn-link p-0 text-start text-decoration-none flex-grow-1" data-view-workout="' + esc(w.id) + '">' +
      '<strong>' + esc(name) + '</strong><br>' +
      '<small class="text-muted">' + fmtBR(w.date) + ' · ' + setCount + ' exerc.' + (warm ? ' · ' + esc(warm) : '') + '</small>' +
      '</button>' +
      '<div class="d-flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-share-workout="' + esc(w.id) + '" title="Exportar como texto" aria-label="Exportar como texto"><i class="bi bi-share"></i></button>' +
      '</div>' +
      '</div></div>';
  }).join('');

  el.querySelectorAll('[data-view-workout]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.viewingWorkoutId = b.getAttribute('data-view-workout');
      location.hash = '#/detail';
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

  if (!groups.length) {
    html += '<p class="text-muted">Este treino não tem exercícios registrados.</p>';
  }

  html += groups.map(function (g, i) {
    return '<div class="card mb-2"><div class="card-body p-2">' +
      '<button type="button" class="btn btn-link p-0 text-decoration-none d-flex justify-content-between align-items-center w-100" data-open-exercise="' + esc(g.exerciseId || '') + '" data-open-exercise-name="' + esc(labelOf(g)) + '">' +
      '<strong><span class="badge text-bg-primary me-1">' + (i + 1) + '</span> ' + esc(labelOf(g)) + '</strong>' +
      '<i class="bi bi-chevron-right text-muted"></i>' +
      '</button>' +
      (g.note ? '<div class="small text-muted"><i class="bi bi-info-circle"></i> ' + esc(g.note) + '</div>' : '') +
      (warmupHasData(g.warmup) ? '<div class="small text-muted"><i class="bi bi-fire"></i> Aquecimento: ' + esc(warmupLine(g.warmup)) + '</div>' : '') +
      (g.sets.length ? setsSummaryLines(g.sets) : '<div class="small text-muted mt-1">Sem séries de trabalho.</div>') +
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

  const maxLoad = Math.max.apply(null, rows.map(function (r) { return r.best ? r.best.load : 0; }).concat([1]));

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
    '<span class="badge text-bg-warning"><i class="bi bi-trophy"></i> PR ' + maxLoad + ' kg</span>' +
    '</div></div>';

  html += '<h6 class="text-muted"><i class="bi bi-bar-chart-line"></i> Melhor série por dia</h6>';
  html += rows.slice(0, 12).map(function (r) {
    const load = r.best ? r.best.load : 0;
    const reps = r.best ? r.best.reps : 0;
    const pct = Math.max(4, Math.round((load / maxLoad) * 100));
    return '<div class="mb-2">' +
      '<div class="d-flex justify-content-between small"><span>' + fmtBR(r.workout.date) + '</span><strong>' + load + ' kg × ' + reps + '</strong></div>' +
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
      (warmupHasData(warm) ? '<div class="small text-muted"><i class="bi bi-fire"></i> Aquecimento: ' + esc(warmupLine(warm)) + '</div>' : '') +
      (sets.length ? setsSummaryLines(sets) : '<div class="small text-muted mt-1">Sem séries de trabalho.</div>') +
      '</div></div>';
  }).join('');

  el.innerHTML = html;
}
/* ---------- workout form ---------- */

function activeSheets() {
  return state.sheets.filter(function (s) { return s.active !== false; });
}

function findSheet(id) {
  return state.sheets.find(function (s) { return s.id === id; }) || null;
}

function renderSheetOptions(selectedId) {
  const sel = document.getElementById('workoutSheet');
  let html = '<option value="">— Selecione a ficha —</option>';
  activeSheets().forEach(function (s) {
    html += '<option value="' + esc(s.id) + '"' + (selectedId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  });
  sel.innerHTML = html;
  renderSheetHint(selectedId);
}

function renderSheetHint(sheetId) {
  const hint = document.getElementById('sheetHint');
  const sheet = sheetId ? findSheet(sheetId) : null;
  if (!sheet) {
    hint.innerHTML = activeSheets().length
      ? 'Selecione a ficha do treino de hoje.'
      : 'Você ainda não tem fichas. Crie a sua na aba <a href="#/exercises">Fichas</a>.';
    return;
  }
  const count = (sheet.exercises || []).length;
  hint.textContent = count
    ? (count === 1 ? '1 exercício na ficha — carregado no treino.' : count + ' exercícios na ficha — carregados no treino.')
    : 'Esta ficha ainda não tem exercícios. Adicione na aba Fichas.';
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
}

function onSheetChange() {
  const sheetId = document.getElementById('workoutSheet').value;
  renderSheetHint(sheetId);

  const sheet = sheetId ? findSheet(sheetId) : null;
  if (!sheet) return;
  if (!(sheet.exercises || []).length) return;

  if (state.formSets.length && !confirm('Substituir os exercícios já no formulário pelos da ficha "' + sheet.name + '"?')) {
    return;
  }
  loadSheetIntoForm(sheet);
}


function renderWorkoutForm() {
  const editing = state.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.editingWorkoutId; })
    : null;

  document.getElementById('workoutTitle').innerHTML = editing
    ? '<i class="bi bi-pencil-square text-primary"></i> Editar treino'
    : '<i class="bi bi-plus-circle text-primary"></i> Treinar';
  document.getElementById('workoutDate').value = editing ? editing.date : todayISO();
  renderSheetOptions(editing ? (editing.sheetId || editing.typeId) : null);
  document.getElementById('workoutCardio').value = editing ? (editing.cardioMinutes || '') : '';
  document.getElementById('workoutNotes').value = editing ? (editing.notes || '') : '';

  state.formSets = editing ? groupSets(editing.sets, editing.warmups) : [];
  document.getElementById('workoutDelete').classList.toggle('d-none', !editing);
  document.getElementById('workoutExport').classList.toggle('d-none', !editing);
  renderFormSets();
}

function setRow(exIdx, setIdx, s) {
  return '<div class="row g-1 mb-1 align-items-center">' +
    '<div class="col-2"><input type="text" inputmode="numeric" class="form-control form-control-sm text-center" value="' + esc(s.number) + '" readonly tabindex="-1"></div>' +
    '<div class="col-2"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.reps) + '" aria-label="Reps da série ' + esc(s.number) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'reps',this.value)\"></div>" +
    '<div class="col-2"><input type="text" inputmode="decimal" autocomplete="off" class="form-control form-control-sm" value="' + esc(formatDecimal(s.load, commaDecimal)) + '" aria-label="Carga da série ' + esc(s.number) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'load',this.value)\"></div>" +
    '<div class="col-2"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.rir) + '" aria-label="RIR da série ' + esc(s.number) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'rir',this.value)\"></div>" +
    '<div class="col-4"><input type="text" class="form-control form-control-sm" value="' + esc(s.note) + '" aria-label="Observação da série ' + esc(s.number) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'note',this.value)\"></div>" +
    '</div>';
}


function renderFormSets() {
  const el = document.getElementById('workoutExercises');
  if (!state.formSets.length) {
    el.innerHTML = '<p class="text-muted">Adicione exercícios ao treino.</p>';
    return;
  }

  el.innerHTML = state.formSets.map(function (group, exIdx) {
    const warm = group.warmup || {};
    return '<div class="card mb-2"><div class="card-body p-2">' +
      '<div class="d-flex justify-content-between align-items-center mb-1">' +
      '<strong><i class="bi bi-activity text-primary"></i> ' + esc(labelOf(group)) + '</strong>' +
      '<div class="d-flex align-items-center gap-1">' +
      '<span class="badge text-bg-light">' + group.sets.length + (group.sets.length === 1 ? ' série' : ' séries') + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFormExercise(' + exIdx + ')" aria-label="Remover exercício"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '</div>' +
      (group.note ? '<div class="small text-muted mb-1"><i class="bi bi-info-circle"></i> ' + esc(group.note) + '</div>' : '') +
      '<div class="border rounded bg-light p-1 mb-1">' +
      '<div class="small text-muted mb-1"><i class="bi bi-fire"></i> Aquecimento</div>' +
      '<div class="row g-1">' +
      '<div class="col-4"><input type="number" min="0" inputmode="numeric" class="form-control form-control-sm" value="' + esc(warm.reps) + '" placeholder="reps" oninput="setWarmupField(' + exIdx + ",'reps',this.value)\"></div>" +
      '<div class="col-4"><input type="text" inputmode="decimal" autocomplete="off" min="0" class="form-control form-control-sm" value="' + esc(formatDecimal(warm.load, commaDecimal)) + '" placeholder="peso" aria-label="Peso do aquecimento" oninput="setWarmupField(' + exIdx + ",'load',this.value)\"></div>" +
      '<div class="col-4"><input type="number" min="0" inputmode="numeric" class="form-control form-control-sm" value="' + esc(warm.rir) + '" placeholder="RIR" oninput="setWarmupField(' + exIdx + ",'rir',this.value)\"></div>" +
      '</div>' +
      '</div>' +
      '<div class="row g-1 text-center fw-semibold small text-muted mb-1">' +
      '<div class="col-2">série</div><div class="col-2">reps</div><div class="col-2">carga</div><div class="col-2">RIR</div><div class="col-4">obs</div>' +
      '</div>' +
      group.sets.map(function (s, setIdx) { return setRow(exIdx, setIdx, s); }).join('') +
      '<button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addFormSet(' + exIdx + ')"><i class="bi bi-plus"></i> série</button>' +
      '</div></div>';
  }).join('');
}

function setWarmupField(exIdx, field, value) {
  const group = state.formSets[exIdx];
  if (!group) return;
  if (!group.warmup) group.warmup = { reps: '', load: '', rir: '' };
  group.warmup[field] = value;
}

function setField(exIdx, setIdx, field, value) {
  const group = state.formSets[exIdx];
  if (!group || !group.sets[setIdx]) return;
  group.sets[setIdx][field] = value;
}

function addFormSet(exIdx) {
  const group = state.formSets[exIdx];
  if (!group) return;
  group.sets.push({ number: group.sets.length + 1, reps: '', load: '', rir: '', note: '' });
  renderFormSets();
}

function removeFormExercise(exIdx) {
  state.formSets.splice(exIdx, 1);
  renderFormSets();
}




function addExerciseToForm(opts) {
  const ref = { exerciseId: opts.exerciseId || null, exerciseName: opts.exerciseName || 'Exercício' };
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

  const workout = {
    id: editing ? editing.id : uid(),
    date: date,
    sheetId: sheetId || null,
    sheetName: sheet ? sheet.name : '',
    cardioMinutes: cardioMinutes,
    notes: notes,
    warmups: warmups,
    sets: sets,
    createdAt: editing ? editing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('workouts', workout);
  state.workouts = await dbAll('workouts');
  state.editingWorkoutId = null;
  location.hash = '#/dashboard';
}

async function deleteWorkout() {
  if (!state.editingWorkoutId) return;
  if (!confirm('Excluir este treino?')) return;
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

  state.formSets = [];
  state.editingWorkoutId = null;

  if (editingId) {
    state.viewingWorkoutId = editingId;
    location.hash = '#/detail';
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

async function openExercisePicker() {
  await openExercisePickerModal();
}

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
  const q = (query || '').trim();
  state.pickerQuery = q;
  const lower = normalizeText(q);
  const el = document.getElementById('pickerResults');

  const fichas = state.exercises.filter(function (e) {
    return e.active !== false && isUserExercise(e) && (!lower || normalizeText(e.name).indexOf(lower) !== -1);
  }).slice(0, 30);

  const catalog = (state.catalog || []).filter(function (e) {
    return !lower || normalizeText(e.name).indexOf(lower) !== -1;
  }).slice(0, 50);

  let html = '';

  if (q) {
    html += '<button type="button" class="list-group-item list-group-item-action text-primary fw-semibold" onclick="createExerciseFromPicker()">' +
      '<i class="bi bi-plus-circle"></i> Criar "' + esc(q) + '"</button>';
  }

  html += '<div class="px-2 py-1 small text-muted fw-semibold">Biblioteca</div>';
  if (!fichas.length) html += '<div class="list-group-item small text-muted">Nenhum exercício cadastrado.</div>';
  html += fichas.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickLibraryExercise(\'' + e.id + '\')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  html += '<div class="px-2 py-1 small text-muted fw-semibold mt-2">Catálogo (pt-BR)</div>';
  if (!catalog.length) html += '<div class="list-group-item small text-muted">Nada encontrado.</div>';
  html += catalog.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickCatalogExercise(' + e.id + ')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  el.innerHTML = html;
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
  const q = (query || '').trim();
  state.fichaQuery = q;
  const lower = normalizeText(q);
  const el = document.getElementById('fichaCatalogResults');

  const catalog = (state.catalog || []).filter(function (e) {
    return !lower || normalizeText(e.name).indexOf(lower) !== -1;
  }).slice(0, 50);

  let html = '';

  if (q) {
    html += '<button type="button" class="list-group-item list-group-item-action text-primary fw-semibold" onclick="createExerciseFromFichaSearch()">' +
      '<i class="bi bi-plus-circle"></i> Criar "' + esc(q) + '"</button>';
  }

  if (!catalog.length) {
    html += '<div class="list-group-item small text-muted">Nada encontrado no catálogo.</div>';
  }

  html += catalog.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickCatalogForFicha(' + e.id + ')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  el.innerHTML = html;
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

  if (!list.length) {
    el.innerHTML = '<p class="text-muted"><i class="bi bi-clipboard2-plus"></i> Nenhuma ficha cadastrada. Crie uma ficha (ex.: TREINO A - inferiores) e adicione os exercícios dela.</p>';
    return;
  }

  el.innerHTML = list.map(function (s) {
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
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteSheet(\'' + s.id + '\')" aria-label="Excluir ficha"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '</div>' +
      exercisesHtml +
      '</div></div>';
  }).join('');
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
  const q = (query || '').trim();
  state.sheetPickerQuery = q;
  const lower = normalizeText(q);
  const el = document.getElementById('sheetPickerResults');

  const library = state.exercises.filter(function (e) {
    return e.active !== false && isUserExercise(e) && (!lower || normalizeText(e.name).indexOf(lower) !== -1);
  }).slice(0, 20);

  const catalog = (state.catalog || []).filter(function (e) {
    return !lower || normalizeText(e.name).indexOf(lower) !== -1;
  }).slice(0, 50);

  let html = '';

  if (q) {
    html += '<button type="button" class="list-group-item list-group-item-action text-primary fw-semibold" onclick="createExerciseFromSheetPicker()">' +
      '<i class="bi bi-plus-circle"></i> Criar "' + esc(q) + '"</button>';
  }

  if (library.length) {
    html += '<div class="px-2 py-1 small text-muted fw-semibold">Biblioteca</div>';
    html += library.map(function (e) {
      return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickSheetLibraryExercise(\'' + e.id + '\')">' +
        '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
    }).join('');
  }

  html += '<div class="px-2 py-1 small text-muted fw-semibold">Catálogo (pt-BR)</div>';
  if (!catalog.length) html += '<div class="list-group-item small text-muted">Nada encontrado.</div>';
  html += catalog.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickSheetCatalogExercise(' + e.id + ')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  el.innerHTML = html;
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
  renderRecent();
  renderCalendar();
}

async function saveSheetEditor() {
  const name = document.getElementById('sheetName').value.trim();
  if (!name) {
    alert('Informe o nome da ficha.');
    return;
  }

  const id = document.getElementById('sheetId').value;
  if (sheetNameExists(name, id)) {
    alert('Já existe uma ficha com esse nome.');
    return;
  }

  const existing = id ? findSheet(id) : null;

  const sheet = {
    id: id || uid(),
    name: name,
    active: true,
    exercises: state.sheetExercises.map(function (item) {
      const rawReps = Array.isArray(item.reps) ? item.reps : [];
      const count = Math.max(1, parseInt(item.sets, 10) || rawReps.length || 3);
      const reps = [];
      for (let i = 0; i < count; i++) {
        reps.push(toNumOrNull(rawReps[i]));
      }
      return {
        exerciseId: item.exerciseId || null,
        name: labelOf(item),
        sets: count,
        reps: reps,
        note: (item.note || '').trim()
      };
    }),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('sheets', sheet);
  state.sheets = await dbAll('sheets');
  bootstrap.Modal.getInstance(document.getElementById('sheetEditorModal')).hide();
  refreshAfterSheetChange();
}

async function deleteSheet(id) {
  if (!confirm('Excluir esta ficha? Os treinos já registrados não são afetados.')) return;
  await dbDelete('sheets', id);
  state.sheets = await dbAll('sheets');
  refreshAfterSheetChange();
}

/* ---------- calendar ---------- */

function changeMonth(delta) {
  const d = state.calendarCursor || new Date();
  d.setMonth(d.getMonth() + delta);
  state.calendarCursor = new Date(d.getFullYear(), d.getMonth(), 1);
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

  const counts = {};
  state.workouts.forEach(function (w) {
    if (w.date.indexOf(prefix) === 0) counts[w.date] = (counts[w.date] || 0) + 1;
  });

  const cells = [];
  const today = todayISO();
  for (let i = 0; i < firstDow; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = prefix + '-' + pad2(day);
    const count = counts[iso] || 0;
    const classes = 'cal-cell' + (count ? ' has-workout' : '') + (iso === today ? ' today' : '');
    cells.push('<div class="' + classes + '">' + day + (count ? '<span class="cal-badge">' + count + '</span>' : '') + '</div>');
  }

  document.getElementById('calendarGrid').innerHTML = cells.join('');

  const total = Object.keys(counts).reduce(function (sum, k) { return sum + counts[k]; }, 0);
  document.getElementById('calendarTotal').innerHTML = '<i class="bi bi-calendar-check"></i> ' + total + (total === 1 ? ' treino' : ' treinos') + ' em ' + monthNames[m] + '.';
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
  document.getElementById('btnUndoImport').classList.toggle('d-none', !state.lastImportSnapshot);
  renderBackupStatus();
  renderColinhaList();
}

async function saveSettingsForm() {
  state.settings.weeklyWorkoutTarget = Math.max(1, toNum(document.getElementById('setWorkoutTarget').value) || 1);
  state.settings.weeklyCardioTarget = Math.max(0, toNum(document.getElementById('setCardioTarget').value) || 0);
  state.settings.weekAnchor = document.getElementById('setWeekAnchor').value || todayISO();
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

  document.getElementById('exportText').value = workoutAsText(workout, state.sheets, allExercises());
  bootstrap.Modal.getOrCreateInstance(document.getElementById('exportModal')).show();
}

async function copyExportText() {
  const area = document.getElementById('exportText');
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

async function shareExportText() {
  const text = document.getElementById('exportText').value;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Meu Treino', text: text });
      return;
    } catch (e) {
      // cancelled or unsupported: fall back to copy
    }
  }

  copyExportText();
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
  alert('Backup importado! Para desfazer, use "Desfazer importação" em Mais → Dados.');
  location.hash = '#/dashboard';
  renderDashboard();
}

async function restoreAll(data) {
  // normalizeBackup converte backups antigos (v1) para o formato atual sem perder dados.
  const normalized = normalizeBackup(data);

  await dbClear('workouts');
  await dbClear('exercises');
  await dbClear('sheets');
  await dbClear('settings');
  await dbClear('colinha');

  const db = await openDb();
  const tx = db.transaction(STORES, 'readwrite');
  const stores = {};
  STORES.forEach(function (name) { stores[name] = tx.objectStore(name); });

  normalized.workouts.forEach(function (v) { stores.workouts.put(v); });
  normalized.exercises.forEach(function (v) { stores.exercises.put(v); });
  normalized.sheets.forEach(function (v) { stores.sheets.put(v); });
  normalized.colinha.forEach(function (v) { stores.colinha.put(v); });
  stores.settings.put(Object.assign({}, normalized.settings, { id: APP_SETTINGS_ID }));

  await new Promise(function (resolve, reject) {
    tx.oncomplete = resolve;
    tx.onerror = function () { reject(tx.error); };
    tx.onabort = function () { reject(tx.error); };
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

  document.getElementById('btnAddExercise').addEventListener('click', guard(openExercisePicker));
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

  document.getElementById('btnNewSheet').addEventListener('click', function () { openSheetEditor(null); });
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
  document.getElementById('exportCopy').addEventListener('click', guard(copyExportText));
  document.getElementById('exportShare').addEventListener('click', guard(shareExportText));
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
  const result = linkSheetItemsToExercises(state.sheets, state.exercises);
  if (!result.changed) return 0;

  for (let i = 0; i < result.sheets.length; i++) {
    if (result.sheets[i] !== state.sheets[i]) await dbPut('sheets', result.sheets[i]);
  }

  state.sheets = await dbAll('sheets');
  return result.changed;
}

async function repairLibrarySources() {
  const wrong = exercisesNeedingRepair(state.exercises);

  for (let i = 0; i < wrong.length; i++) {
    wrong[i].source = 'custom';
    await dbPut('exercises', wrong[i]);
  }

  return wrong.length;
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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

init();
