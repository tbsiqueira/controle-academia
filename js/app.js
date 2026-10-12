'use strict';

/* Meu Treino — main app logic (UI text in pt-BR, code in English). */

const APP_SETTINGS_ID = 'app';
const GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraços', 'Abdômen', 'Pernas', 'Glúteos', 'Panturrilhas', 'Pescoço', 'Cardio', 'Outros'];

const state = {
  workouts: [],
  exercises: [],
  workoutTypes: [],
  settings: null,
  colinha: [],
  catalog: null,
  editingWorkoutId: null,
  formSets: [],
  pickerQuery: '',
  fichaQuery: '',
  calendarCursor: null
};

/* ---------- helpers ---------- */

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

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function toNum(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function toNumOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function defaultSettings() {
  return {
    id: APP_SETTINGS_ID,
    weekAnchor: todayISO(),
    weeklyWorkoutTarget: 3,
    weeklyCardioTarget: 120,
    tonnageVisible: false
  };
}

/* ---------- data loading ---------- */

async function loadState() {
  state.workouts = await dbAll('workouts');
  state.exercises = await dbAll('exercises');
  state.workoutTypes = await dbAll('workoutTypes');
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
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'workout') renderWorkoutForm();
  if (viewName === 'exercises') renderExercises();
  if (viewName === 'calendar') renderCalendar();
  if (viewName === 'more') renderMore();
}

/* ---------- week logic ---------- */

function weekRange() {
  const anchor = state.settings.weekAnchor || todayISO();
  return { anchor: anchor, end: addDaysISO(anchor, 6) };
}

function isValidWorkout(w) {
  const hasSet = (w.sets || []).some(function (s) {
    return toNum(s.reps) > 0 || toNum(s.load) > 0;
  });
  return hasSet || toNum(w.cardioMinutes) > 0;
}

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
  renderRecent();
  renderPerformance();
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
  document.getElementById('weekProgress').innerHTML =
    '<div class="card mb-3">' +
    '<div class="card-body py-3">' +
    '<div class="d-flex justify-content-around text-center">' +
    '<div><div class="display-6 fw-bold">' + stats.workouts + '/' + state.settings.weeklyWorkoutTarget + '</div><small class="text-muted">treinos</small></div>' +
    '<div><div class="display-6 fw-bold">' + stats.cardio + '/' + state.settings.weeklyCardioTarget + '</div><small class="text-muted">min cardio</small></div>' +
    '</div></div></div>';
}

function renderRecent() {
  const el = document.getElementById('recentWorkouts');
  const recent = state.workouts.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  }).slice(0, 5);

  if (!recent.length) {
    el.innerHTML = '<p class="text-muted">Nenhum treino registrado ainda.</p>';
    return;
  }

  el.innerHTML = '<h6 class="mt-2">Últimos treinos</h6>' + recent.map(function (w) {
    const setCount = (w.sets || []).length;
    return '<div class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">' +
      '<div><strong>' + esc(w.typeName || 'Treino') + '</strong><br>' +
      '<small class="text-muted">' + fmtBR(w.date) + ' · ' + setCount + ' exerc.</small></div>' +
      '<a href="#/workout" data-edit-workout="' + esc(w.id) + '" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i></a>' +
      '</div></div>';
  }).join('');

  el.querySelectorAll('[data-edit-workout]').forEach(function (a) {
    a.addEventListener('click', function () {
      state.editingWorkoutId = a.getAttribute('data-edit-workout');
    });
  });
}

function computePerformance() {
  const byName = {};
  const sorted = state.workouts.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });

  sorted.forEach(function (w) {
    const perExercise = {};
    (w.sets || []).forEach(function (s) {
      const load = toNum(s.load);
      const reps = toNum(s.reps);
      if (!load && !reps) return;
      const name = s.exerciseName || '(sem nome)';

      if (!byName[name]) byName[name] = { name: name, last: null, prev: null, pr: { load: 0, reps: 0 } };
      const entry = byName[name];

      if (load > entry.pr.load || (load === entry.pr.load && reps > entry.pr.reps)) {
        entry.pr = { load: load, reps: reps };
      }

      if (!perExercise[name] || load > perExercise[name].load || (load === perExercise[name].load && reps > perExercise[name].reps)) {
        perExercise[name] = { load: load, reps: reps };
      }
    });

    Object.keys(perExercise).forEach(function (name) {
      const entry = byName[name];
      const best = perExercise[name];
      if (!entry.last) entry.last = { date: w.date, load: best.load, reps: best.reps };
      else if (!entry.prev) entry.prev = { date: w.date, load: best.load, reps: best.reps };
    });
  });

  return Object.keys(byName).map(function (k) {
    return byName[k];
  }).sort(function (a, b) {
    return a.name.localeCompare(b.name, 'pt');
  });
}

function renderPerformance() {
  const el = document.getElementById('performance');
  const perf = computePerformance();
  if (!perf.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = '<h6 class="mt-3">Desempenho por exercício</h6>' + perf.map(function (p) {
    const last = p.last ? fmtBR(p.last.date) + ' — ' + p.last.load + 'kg × ' + p.last.reps : '—';
    const prev = p.prev ? fmtBR(p.prev.date) + ' — ' + p.prev.load + 'kg × ' + p.prev.reps : '—';
    return '<div class="card mb-2"><div class="card-body py-2">' +
      '<div class="d-flex justify-content-between align-items-center">' +
      '<strong>' + esc(p.name) + '</strong>' +
      '<span class="badge text-bg-warning">PR ' + p.pr.load + 'kg × ' + p.pr.reps + '</span>' +
      '</div>' +
      '<small class="text-muted">última: ' + last + ' · anterior: ' + prev + '</small>' +
      '</div></div>';
  }).join('');
}

/* ---------- workout form ---------- */

function renderTypeOptions(selectedId) {
  const sel = document.getElementById('workoutType');
  let html = '<option value="">— Selecione —</option>';
  state.workoutTypes.forEach(function (t) {
    if (t.active === false) return;
    html += '<option value="' + esc(t.id) + '"' + (selectedId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
  });
  sel.innerHTML = html;
}

function groupSets(flatSets) {
  const groups = [];
  const index = {};
  (flatSets || []).forEach(function (s) {
    const key = s.exerciseName || '(sem nome)';
    if (!Object.prototype.hasOwnProperty.call(index, key)) {
      index[key] = groups.length;
      groups.push({ exerciseId: s.exerciseId || null, exerciseName: key, sets: [] });
    }
    groups[index[key]].sets.push({ number: s.number, reps: s.reps, load: s.load, rir: s.rir, note: s.note || '' });
  });
  return groups;
}

function renderWorkoutForm() {
  const editing = state.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.editingWorkoutId; })
    : null;

  document.getElementById('workoutTitle').textContent = editing ? 'Editar treino' : 'Registrar treino';
  document.getElementById('workoutDate').value = editing ? editing.date : todayISO();
  renderTypeOptions(editing ? editing.typeId : null);
  document.getElementById('workoutCardio').value = editing ? (editing.cardioMinutes || '') : '';
  document.getElementById('workoutNotes').value = editing ? (editing.notes || '') : '';
  state.formSets = editing ? groupSets(editing.sets) : [];
  document.getElementById('workoutDelete').classList.toggle('d-none', !editing);
  renderFormSets();
}

function setRow(exIdx, setIdx, s) {
  return '<div class="row g-1 mb-1 align-items-center">' +
    '<div class="col-2"><input type="text" inputmode="numeric" class="form-control form-control-sm text-center" value="' + esc(s.number) + '" readonly tabindex="-1"></div>' +
    '<div class="col-2"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.reps) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'reps',this.value)\"></div>" +
    '<div class="col-2"><input type="number" step="0.5" inputmode="decimal" class="form-control form-control-sm" value="' + esc(s.load) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'load',this.value)\"></div>" +
    '<div class="col-2"><input type="number" inputmode="numeric" class="form-control form-control-sm" value="' + esc(s.rir) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'rir',this.value)\"></div>" +
    '<div class="col-4"><input type="text" class="form-control form-control-sm" value="' + esc(s.note) + '" oninput="setField(' + exIdx + ',' + setIdx + ",'note',this.value)\"></div>" +
    '</div>';
}

function renderFormSets() {
  const el = document.getElementById('workoutExercises');
  if (!state.formSets.length) {
    el.innerHTML = '<p class="text-muted">Adicione exercícios ao treino.</p>';
    return;
  }

  el.innerHTML = state.formSets.map(function (group, exIdx) {
    return '<div class="card mb-2"><div class="card-body p-2">' +
      '<div class="d-flex justify-content-between align-items-center mb-1">' +
      '<strong>' + esc(group.exerciseName) + '</strong>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFormExercise(' + exIdx + ')"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '<div class="row g-1 text-center fw-semibold small text-muted mb-1">' +
      '<div class="col-2">série</div><div class="col-2">reps</div><div class="col-2">carga</div><div class="col-2">RIR</div><div class="col-4">obs</div>' +
      '</div>' +
      group.sets.map(function (s, setIdx) { return setRow(exIdx, setIdx, s); }).join('') +
      '<button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addFormSet(' + exIdx + ')"><i class="bi bi-plus"></i> série</button>' +
      '</div></div>';
  }).join('');
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

function lastLoadsByName(name) {
  const sorted = state.workouts
    .filter(function (w) {
      return (w.sets || []).some(function (s) { return s.exerciseName === name; });
    })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  if (!sorted.length) return {};
  const last = sorted[0];
  const map = {};
  last.sets.forEach(function (s) {
    if (s.exerciseName === name && toNum(s.load) > 0) map[s.number] = s.load;
  });
  return map;
}

function addExerciseToForm(opts) {
  const name = opts.exerciseName || 'Exercício';
  const lastLoads = lastLoadsByName(name);
  const setCount = Math.max(1, parseInt(opts.defaultSets, 10) || 1);
  const sets = [];

  for (let i = 1; i <= setCount; i++) {
    const lastLoad = Object.prototype.hasOwnProperty.call(lastLoads, i) ? lastLoads[i] : '';
    sets.push({
      number: i,
      reps: (opts.defaultReps === undefined || opts.defaultReps === null || opts.defaultReps === '') ? '' : opts.defaultReps,
      load: lastLoad !== '' ? lastLoad : ((opts.defaultLoad === undefined || opts.defaultLoad === null || opts.defaultLoad === '') ? '' : opts.defaultLoad),
      rir: (opts.defaultRir === undefined || opts.defaultRir === null || opts.defaultRir === '') ? '' : opts.defaultRir,
      note: ''
    });
  }

  state.formSets.push({ exerciseId: opts.exerciseId || null, exerciseName: name, sets: sets });
  renderFormSets();
}

async function saveWorkout() {
  const date = document.getElementById('workoutDate').value || todayISO();
  const typeId = document.getElementById('workoutType').value;
  const type = state.workoutTypes.find(function (t) { return t.id === typeId; });
  const cardioMinutes = toNum(document.getElementById('workoutCardio').value);
  const notes = document.getElementById('workoutNotes').value.trim();

  const sets = [];
  state.formSets.forEach(function (group) {
    group.sets.forEach(function (s) {
      sets.push({
        exerciseId: group.exerciseId || null,
        exerciseName: group.exerciseName,
        number: s.number,
        reps: toNumOrNull(s.reps),
        load: toNumOrNull(s.load),
        rir: toNumOrNull(s.rir),
        note: (s.note || '').trim()
      });
    });
  });

  if (!sets.length && !cardioMinutes) {
    alert('Adicione pelo menos um exercício com série ou informe os minutos de cardio.');
    return;
  }

  const editing = state.editingWorkoutId
    ? state.workouts.find(function (w) { return w.id === state.editingWorkoutId; })
    : null;

  const workout = {
    id: editing ? editing.id : uid(),
    date: date,
    typeId: typeId || null,
    typeName: type ? type.name : '',
    cardioMinutes: cardioMinutes,
    notes: notes,
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

function renderPickerResults(query) {
  const q = (query || '').trim();
  state.pickerQuery = q;
  const lower = q.toLowerCase();
  const el = document.getElementById('pickerResults');

  const fichas = state.exercises.filter(function (e) {
    return e.active !== false && (!lower || e.name.toLowerCase().indexOf(lower) !== -1);
  }).slice(0, 30);

  const catalog = (state.catalog || []).filter(function (e) {
    return !lower || e.name.toLowerCase().indexOf(lower) !== -1;
  }).slice(0, 50);

  let html = '';

  if (q) {
    html += '<button type="button" class="list-group-item list-group-item-action text-primary fw-semibold" onclick="createExerciseFromPicker()">' +
      '<i class="bi bi-plus-circle"></i> Criar "' + esc(q) + '"</button>';
  }

  html += '<div class="px-2 py-1 small text-muted fw-semibold">Minhas fichas</div>';
  if (!fichas.length) html += '<div class="list-group-item small text-muted">Nenhuma ficha encontrada.</div>';
  html += fichas.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickFicha(\'' + e.id + '\')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  html += '<div class="px-2 py-1 small text-muted fw-semibold mt-2">Catálogo (pt-BR)</div>';
  if (!catalog.length) html += '<div class="list-group-item small text-muted">Nada encontrado.</div>';
  html += catalog.map(function (e) {
    return '<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="pickCatalogItem(' + e.id + ')">' +
      '<span>' + esc(e.name) + '</span><span class="badge text-bg-light">' + esc(e.group || '') + '</span></button>';
  }).join('');

  el.innerHTML = html;
}

function pickFicha(id) {
  const e = state.exercises.find(function (x) { return x.id === id; });
  if (!e) return;
  addExerciseToForm({
    exerciseId: e.id,
    exerciseName: e.name,
    defaultSets: e.defaultSets,
    defaultReps: e.defaultReps,
    defaultLoad: e.defaultLoad,
    defaultRir: e.defaultRir
  });
  bootstrap.Modal.getInstance(document.getElementById('exercisePickerModal')).hide();
}

function pickCatalogItem(id) {
  const e = (state.catalog || []).find(function (x) { return String(x.id) === String(id); });
  if (!e) return;
  addExerciseToForm({ exerciseId: null, exerciseName: e.name, defaultSets: 1, defaultReps: '', defaultLoad: '', defaultRir: '' });
  bootstrap.Modal.getInstance(document.getElementById('exercisePickerModal')).hide();
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
  const lower = q.toLowerCase();
  const el = document.getElementById('fichaCatalogResults');

  const catalog = (state.catalog || []).filter(function (e) {
    return !lower || e.name.toLowerCase().indexOf(lower) !== -1;
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

async function findOrCreateExercise(name) {
  const clean = (name || '').trim();
  const existing = state.exercises.find(function (e) {
    return e.name.toLowerCase() === clean.toLowerCase();
  });
  if (existing) return existing;

  const exercise = {
    id: uid(),
    name: clean,
    group: 'Outros',
    defaultSets: 3,
    defaultReps: null,
    defaultLoad: null,
    defaultRir: null,
    correction: '',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('exercises', exercise);
  state.exercises.push(exercise);
  return exercise;
}

async function createExerciseFromPicker() {
  const name = state.pickerQuery;
  if (!name) return;
  const exercise = await findOrCreateExercise(name);
  addExerciseToForm({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    defaultSets: exercise.defaultSets,
    defaultReps: exercise.defaultReps,
    defaultLoad: exercise.defaultLoad,
    defaultRir: exercise.defaultRir
  });
  const modal = bootstrap.Modal.getInstance(document.getElementById('exercisePickerModal'));
  if (modal) modal.hide();
}

async function createExerciseFromFichaSearch() {
  const name = state.fichaQuery;
  if (!name) return;
  const exercise = await findOrCreateExercise(name);
  document.getElementById('fichaName').value = exercise.name;
  const groupSelect = document.getElementById('fichaGroup');
  const match = Array.prototype.some.call(groupSelect.options, function (o) { return o.value === exercise.group; });
  if (exercise.group && match) groupSelect.value = exercise.group;
  document.getElementById('fichaCatalogBox').classList.add('d-none');
}

/* ---------- exercises (fichas) ---------- */

function renderExercises() {
  const el = document.getElementById('exercisesList');
  const list = state.exercises.filter(function (e) { return e.active !== false; });

  if (!list.length) {
    el.innerHTML = '<p class="text-muted">Nenhuma ficha cadastrada.</p>';
    return;
  }

  el.innerHTML = list.map(function (e) {
    const defaults = (e.defaultSets || 0) + '×' + (e.defaultReps || 0) + (e.defaultLoad ? ' · ' + e.defaultLoad + 'kg' : '');
    return '<div class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">' +
      '<div><strong>' + esc(e.name) + '</strong><br>' +
      '<small class="text-muted">' + esc(e.group || '') + (defaults !== '0×0' ? ' · ' + defaults : '') + '</small></div>' +
      '<div class="d-flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-outline-primary" onclick="openExerciseForm(\'' + e.id + '\')"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteExercise(\'' + e.id + '\')"><i class="bi bi-trash"></i></button>' +
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
  document.getElementById('fichaSets').value = e ? (e.defaultSets || '') : '';
  document.getElementById('fichaReps').value = e ? (e.defaultReps || '') : '';
  document.getElementById('fichaLoad').value = e ? (e.defaultLoad || '') : '';
  document.getElementById('fichaRir').value = e ? (e.defaultRir || '') : '';
  document.getElementById('fichaCorrection').value = e ? (e.correction || '') : '';
  document.getElementById('fichaCatalogSearch').value = '';
  document.getElementById('fichaCatalogBox').classList.add('d-none');
  document.getElementById('exerciseFormTitle').textContent = e ? 'Editar ficha' : 'Nova ficha';

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
    defaultSets: toNumOrNull(document.getElementById('fichaSets').value),
    defaultReps: toNumOrNull(document.getElementById('fichaReps').value),
    defaultLoad: toNumOrNull(document.getElementById('fichaLoad').value),
    defaultRir: toNumOrNull(document.getElementById('fichaRir').value),
    correction: document.getElementById('fichaCorrection').value.trim(),
    active: true,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbPut('exercises', exercise);
  state.exercises = await dbAll('exercises');
  bootstrap.Modal.getInstance(document.getElementById('exerciseFormModal')).hide();
  renderExercises();
}

async function deleteExercise(id) {
  if (!confirm('Excluir esta ficha?')) return;
  await dbDelete('exercises', id);
  state.exercises = await dbAll('exercises');
  renderExercises();
}

/* ---------- workout types ---------- */

function openTypeModal() {
  document.getElementById('newTypeName').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('workoutTypeModal')).show();
}

function typeNameExists(name) {
  return state.workoutTypes.some(function (t) {
    return t.active !== false && t.name.toLowerCase() === name.toLowerCase();
  });
}

async function saveType() {
  const name = document.getElementById('newTypeName').value.trim();
  if (!name) {
    alert('Informe o nome do tipo.');
    return;
  }
  if (typeNameExists(name)) {
    alert('Esse tipo já existe.');
    return;
  }

  await dbPut('workoutTypes', { id: uid(), name: name, active: true });
  state.workoutTypes = await dbAll('workoutTypes');
  bootstrap.Modal.getInstance(document.getElementById('workoutTypeModal')).hide();
  renderTypeOptions(document.getElementById('workoutType').value || null);
  renderTypesList();
}

async function addWorkoutTypeFromInput() {
  const input = document.getElementById('newTypeInput');
  const name = input.value.trim();
  if (!name) return;
  if (typeNameExists(name)) {
    alert('Esse tipo já existe.');
    return;
  }

  await dbPut('workoutTypes', { id: uid(), name: name, active: true });
  state.workoutTypes = await dbAll('workoutTypes');
  input.value = '';
  renderTypesList();
}

async function deleteWorkoutType(id) {
  if (!confirm('Excluir este tipo?')) return;
  await dbDelete('workoutTypes', id);
  state.workoutTypes = await dbAll('workoutTypes');
  renderTypesList();
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
  for (let i = 0; i < firstDow; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = prefix + '-' + pad2(day);
    const count = counts[iso] || 0;
    cells.push('<div class="cal-cell' + (count ? ' has-workout' : '') + '">' + day + (count ? '<span class="cal-badge">' + count + '</span>' : '') + '</div>');
  }

  document.getElementById('calendarGrid').innerHTML = cells.join('');

  const total = Object.keys(counts).reduce(function (sum, k) { return sum + counts[k]; }, 0);
  document.getElementById('calendarTotal').textContent = total + (total === 1 ? ' treino' : ' treinos') + ' em ' + monthNames[m] + '.';
}

/* ---------- colinha ---------- */

function renderColinhaList() {
  const el = document.getElementById('colinhaList');
  const list = state.colinha.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

  if (!list.length) {
    el.innerHTML = '<p class="text-muted small">Nenhuma colinha ainda.</p>';
    return;
  }

  el.innerHTML = list.map(function (c) {
    return '<div class="d-flex justify-content-between align-items-center py-1 border-bottom">' +
      '<div class="me-2"><strong>' + esc(c.title) + '</strong><br><small class="text-muted">' + esc(c.content) + '</small></div>' +
      '<div class="d-flex gap-1">' +
      '<button type="button" class="btn btn-sm btn-outline-primary" onclick="openColinhaForm(\'' + c.id + '\')"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteColinha(\'' + c.id + '\')"><i class="bi bi-trash"></i></button>' +
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
  renderTypesList();
  renderColinhaList();
}

function renderTypesList() {
  const el = document.getElementById('typesList');
  const list = state.workoutTypes.filter(function (t) { return t.active !== false; });

  if (!list.length) {
    el.innerHTML = '<p class="text-muted small">Nenhum tipo cadastrado.</p>';
    return;
  }

  el.innerHTML = list.map(function (t) {
    return '<div class="d-flex justify-content-between align-items-center py-1 border-bottom">' +
      '<span>' + esc(t.name) + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteWorkoutType(\'' + t.id + '\')"><i class="bi bi-trash"></i></button>' +
      '</div>';
  }).join('');
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

async function exportData() {
  const payload = {
    app: 'meu-treino',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      workouts: state.workouts,
      exercises: state.exercises,
      workoutTypes: state.workoutTypes,
      settings: state.settings,
      colinha: state.colinha
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meu-treino-backup-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
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

  const data = payload && payload.data ? payload.data : payload;
  if (!data || !Array.isArray(data.workouts)) {
    alert('Este arquivo não parece ser um backup do Meu Treino.');
    return;
  }

  // Safety backup of the current state before replacing.
  await exportData();

  if (!confirm('Substituir todos os dados locais pelo backup importado?')) return;

  await dbClear('workouts');
  await dbClear('exercises');
  await dbClear('workoutTypes');
  await dbClear('settings');
  await dbClear('colinha');

  const db = await openDb();
  const tx = db.transaction(STORES, 'readwrite');
  const stores = {};
  STORES.forEach(function (name) { stores[name] = tx.objectStore(name); });

  (data.workouts || []).forEach(function (v) { if (v && v.id) stores.workouts.put(v); });
  (data.exercises || []).forEach(function (v) { if (v && v.id) stores.exercises.put(v); });
  (data.workoutTypes || []).forEach(function (v) { if (v && v.id) stores.workoutTypes.put(v); });

  const settings = data.settings || defaultSettings();
  settings.id = APP_SETTINGS_ID;
  stores.settings.put(settings);

  (data.colinha || []).forEach(function (v) { if (v && v.id) stores.colinha.put(v); });

  await new Promise(function (resolve, reject) {
    tx.oncomplete = resolve;
    tx.onerror = function () { reject(tx.error); };
    tx.onabort = function () { reject(tx.error); };
  });

  await loadState();
  alert('Backup importado com sucesso.');
  location.hash = '#/dashboard';
  renderDashboard();
}

/* ---------- events & boot ---------- */

function bindEvents() {
  window.addEventListener('hashchange', navigate);

  document.getElementById('btnAddExercise').addEventListener('click', openExercisePicker);
  document.getElementById('workoutSave').addEventListener('click', saveWorkout);
  document.getElementById('workoutDelete').addEventListener('click', deleteWorkout);
  document.getElementById('btnAddType').addEventListener('click', openTypeModal);
  document.getElementById('typeSave').addEventListener('click', saveType);

  document.getElementById('btnNewExercise').addEventListener('click', function () { openExerciseForm(null); });
  document.getElementById('exerciseFormSave').addEventListener('click', saveExerciseForm);
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
  document.getElementById('colinhaSave').addEventListener('click', saveColinha);

  document.getElementById('btnSaveSettings').addEventListener('click', saveSettingsForm);
  document.getElementById('btnWeekToday').addEventListener('click', startWeekToday);
  document.getElementById('btnAddTypeSettings').addEventListener('click', addWorkoutTypeFromInput);

  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function () {
    if (this.files && this.files[0]) importData(this.files[0]);
    this.value = '';
  });
}

async function init() {
  await loadState();
  loadCatalog().catch(function () {});
  bindEvents();
  navigate();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

init();
