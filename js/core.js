/* Meu Treino — lógica pura, compartilhada entre o app e os testes.
   Nada aqui acessa o DOM nem o estado global: são funções puras.
   ES module: o navegador importa pela ponte (js/bridge.js) e os testes importam direto
   (tests/core.test.mjs). */

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

// Primeiro dia do mês que fica `delta` meses depois (ou antes) da data.
// Sempre parte do dia 1: setMonth() num dia 31 pula ou repete um mês.
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

// Partes de uma data para a lista de treinos do Início: bloco com dia grande,
// mês e dia da semana ("hoje"/"ontem" quando for o caso) e a chave do mês para agrupar.
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

/* ---------- navegação ---------- */

// "#/detail/abc" -> { view: 'detail', id: 'abc' }. Com o id no endereço, o treino aberto
// sobrevive a recarregar a página (antes o id ficava só na memória).
function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/');
  return { view: parts[0] || 'dashboard', id: parts[1] || '' };
}

// Texto do card "Instalar o app": já instalado, botão do navegador, iPhone (só pelo Safari) ou menu do navegador.
function installHint(standalone, canPrompt, ios) {
  if (standalone) return 'O app já está instalado neste aparelho.';
  if (canPrompt) return 'Toque em Instalar: o Meu Treino ganha um ícone próprio e abre em tela cheia, sem a barra do navegador.';
  if (ios) return 'No iPhone, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início". ' +
    'O app instalado começa vazio: antes, use Exportar no card Dados e depois Importar dentro do app.';
  return 'Abra o menu do navegador (⋮ ou ⋯) e escolha "Instalar app" ou "Adicionar à tela inicial".';
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
    weeklyCardioTarget: 120
  };
}

// Janela de 7 dias a partir da data marcada (inclusive).
function weekWindow(anchorISO) {
  const anchor = anchorISO || todayISO();
  return { anchor: anchor, end: addDaysISO(anchor, 6) };
}

// Início da próxima semana de metas: avança de 7 em 7 dias (sempre pelo menos uma vez)
// até a janela alcançar hoje. Quem ficou 3 semanas sem abrir o app não precisa tocar 3 vezes.
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

/* ---------- aquecimento ---------- */

function warmupHasData(warm) {
  if (!warm) return false;
  return [warm.reps, warm.load, warm.rir].some(function (v) {
    return v !== null && v !== undefined && v !== '';
  });
}

// useComma: mostra a carga com vírgula (pt-BR), igual ao campo do formulário.
function warmupLine(warm, useComma) {
  if (!warm) return '';
  const parts = [];
  if (warm.reps !== null && warm.reps !== undefined && warm.reps !== '') parts.push(warm.reps + ' reps');
  if (warm.load !== null && warm.load !== undefined && warm.load !== '') parts.push(formatDecimal(warm.load, useComma) + ' kg');
  if (warm.rir !== null && warm.rir !== undefined && warm.rir !== '') parts.push('RIR ' + warm.rir);
  return parts.join(' · ');
}

/* ---------- séries ---------- */

function setLine(s, useComma) {
  const parts = [];
  parts.push((s.reps === null || s.reps === undefined) ? '—' : s.reps + ' reps');
  if (s.load !== null && s.load !== undefined) parts.push(formatDecimal(s.load, useComma) + ' kg');
  if (s.rir !== null && s.rir !== undefined) parts.push('RIR ' + s.rir);
  return parts.join(' · ');
}

// Lista (ul) das séries, no mesmo estilo da lista de exercícios das fichas.
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

/* ---------- formulário do Treinar: linha de uma série ---------- */

// Larguras (grade de 12 do Bootstrap). A carga fica com col-3: "102,5" não cabia em col-2.
// O número da série é um botão (marca a série como feita), por isso precisa de col-2 para o dedo.
const SET_COLS = { number: 'col-2', reps: 'col-2', load: 'col-3', rir: 'col-2', note: 'col-3' };

function setHeaderHtml() {
  return '<div class="row g-1 text-center fw-semibold small text-muted mb-1">' +
    '<div class="' + SET_COLS.number + '">série</div><div class="' + SET_COLS.reps + '">reps</div>' +
    '<div class="' + SET_COLS.load + '">carga</div><div class="' + SET_COLS.rir + '">RIR</div>' +
    '<div class="' + SET_COLS.note + '">obs</div>' +
    '</div>';
}

// Os campos chamam setField(exercício, série, campo, valor), definido no app.js.
// O botão do número chama toggleSetDone(exercício, série): marca como feita e inicia o descanso.
// Série feita só muda de cor (sem som, vibração ou animação).
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
      if (list[i] && String(list[i].id) === String(ref.exerciseId) && list[i].name) return list[i].name;
    }
  }

  return ref.exerciseName || ref.name || '';
}

// Mesmo exercício? Compara pelo id quando a referência tem id; senão, pelo nome.
// O id é comparado como TEXTO: o mesmo id pode chegar como número (registro) ou
// texto (atributo data-* do HTML), e os dois precisam casar.
function exerciseMatches(entry, target) {
  const e = entry || {};
  const t = exerciseTarget(target);

  if (t.exerciseId && e.exerciseId) return String(e.exerciseId) === String(t.exerciseId);
  if (!t.exerciseName && !e.exerciseName) return false;   // nada para comparar
  return (e.exerciseName || '(sem nome)') === (t.exerciseName || '(sem nome)');
}

// O exercício já está na lista? Vale para o formulário do treino (exerciseName) e para os
// itens da ficha (name). O mesmo exercício duas vezes num treino vira um grupo só ao salvar
// (séries embaralhadas e um aquecimento perdido), então o app não deixa repetir.
function hasExercise(list, ref) {
  const target = exerciseTarget(ref);
  return (list || []).some(function (item) { return exerciseMatches(exerciseTarget(item), target); });
}

// Chave de agrupamento: id quando existe, nome como fallback (dados antigos).
// Normalizada como texto pelo mesmo motivo do exerciseMatches.
function exerciseKey(entry) {
  const e = entry || {};
  return e.exerciseId ? 'id:' + String(e.exerciseId) : 'nome:' + (e.exerciseName || '(sem nome)');
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

// Maior carga já registrada no exercício; 0 quando ele nunca teve carga (peso do corpo).
function maxBestLoad(workouts, target) {
  return (workouts || []).reduce(function (max, w) {
    const best = bestSetForExercise(w, target);
    return (best && best.load > max) ? best.load : max;
  }, 0);
}

// 1RM estimado (a carga que daria para levantar uma vez), fórmula de Epley: carga × (1 + reps/30).
// Uma repetição é a própria carga; sem carga ou sem reps não há estimativa (0).
// shortcut: Epley perde precisão acima de ~12 reps; serve para comparar treinos, não como carga-alvo.
function estimate1RM(load, reps) {
  const kg = toNum(load);
  const n = toNum(reps);
  if (kg <= 0 || n <= 0) return 0;
  return n === 1 ? kg : Math.round(kg * (1 + n / 30) * 10) / 10;
}

// Maior 1RM estimado do exercício num treino: mostra progresso mesmo quando a carga não subiu
// (mais reps com a mesma carga).
function best1RMForExercise(workout, target) {
  let best = 0;
  ((workout && workout.sets) || []).forEach(function (s) {
    if (exerciseMatches(s, target)) best = Math.max(best, estimate1RM(s.load, s.reps));
  });
  return best;
}

/* ---------- recordes pessoais ---------- */

// Exercícios em que este treino bateu o recorde de carga, comparando só com treinos de
// datas ANTERIORES. A primeira vez que um exercício é feito não conta como recorde.
// Calculado na hora (nada é gravado), então funciona para todo o histórico.
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

// Quantos recordes cada treino bateu ({ id: n }), numa passada só pelo histórico.
// Mesmo resultado de workoutRecords(workouts, w).length para cada w (ids únicos), mas sem
// varrer o histórico inteiro por treino: com centenas de treinos o Início travava.
// Mantém a regra do exerciseMatches: id com id; sem id de um dos lados, compara o nome.
function recordCounts(workouts) {
  const list = (workouts || []).filter(function (w) { return w && w.date != null; })
    .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  const byId = Object.create(null);        // maior carga por id
  const noIdByName = Object.create(null);  // maior carga das séries sem id, por nome
  const byName = Object.create(null);      // maior carga de todas as séries, por nome
  const counts = {};
  (workouts || []).forEach(function (w) { if (w) counts[w.id] = 0; });

  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j < list.length && list[j].date === list[i].date) j++;
    // treinos do mesmo dia comparam só com dias anteriores: conta tudo antes de somar o dia
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

/* ---------- formulário: última sessão, repetir treino, rascunho ---------- */

// Mais recente primeiro. No mesmo dia, desempata pelo horário em que o treino foi criado:
// sem isso, com dois treinos no dia, "Última vez" podia pegar qualquer um dos dois.
function byDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ca = a.createdAt || '';
  const cb = b.createdAt || '';
  return ca < cb ? 1 : (ca > cb ? -1 : 0);
}

function blankIfNull(v) {
  return (v === null || v === undefined) ? '' : v;
}

// Séries da última vez que este exercício foi feito (ignorando o treino em edição),
// para a dica "última vez" no formulário.
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

// "27 kg × 12 (RIR 2) · 27 kg × 10" — compacto, para caber numa linha no celular.
function lastSessionLine(session, useComma) {
  if (!session) return '';
  return session.sets.map(function (s) {
    const load = formatDecimal(s.load, useComma);
    const reps = blankIfNull(s.reps) === '' ? '—' : s.reps;
    return (load ? load + ' kg × ' : '') + reps + (blankIfNull(s.rir) === '' ? '' : ' (RIR ' + s.rir + ')');
  }).join(' · ');
}

// Último treino registrado com esta ficha (ignorando o treino em edição).
function lastWorkoutForSheet(workouts, sheetId, excludeId) {
  if (!sheetId) return null;
  const sorted = (workouts || []).filter(function (w) {
    if (excludeId && String(w.id) === String(excludeId)) return false;
    const id = w.sheetId || w.typeId;
    return !!id && String(id) === String(sheetId) && ((w.sets || []).length + (w.warmups || []).length) > 0;
  }).sort(byDateDesc);
  return sorted[0] || null;
}

// Ficha sugerida para o próximo treino: a que vem depois da última usada, em ordem alfabética
// (TREINO A -> B -> C -> A). Sem histórico, ou se a última ficha não está mais ativa, é a primeira.
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

// Formulário a partir de um treino anterior: mesmos exercícios, reps e cargas.
// RIR e observações ficam em branco (são do treino de hoje).
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

// A série do formulário tem algo preenchido (reps, carga, RIR ou observação)?
function setHasData(s) {
  return [s.reps, s.load, s.rir, s.note].some(function (v) { return blankIfNull(v) !== ''; });
}

// O exercício do formulário tem algo que se perderia ao remover (série ou aquecimento preenchido)?
function groupHasData(group) {
  const g = group || {};
  return warmupHasData(g.warmup) || (g.sets || []).some(setHasData);
}

// Rascunho do treino em andamento: vale a pena guardar/oferecer só se tem algo preenchido.
function draftHasContent(draft) {
  if (!draft) return false;
  return (draft.formSets || []).length > 0 || toNum(draft.cardio) > 0 || String(draft.notes || '').trim() !== '';
}

/* ---------- descanso ---------- */

// Tempo de descanso padrão (segundos): o do usuário se for razoável, senão 90.
function restSecondsOf(settings) {
  const n = Math.round(toNum(settings && settings.restSeconds));
  return (n >= 10 && n <= 900) ? n : 90;
}

// 75 -> "1:15"; negativo vira 0:00.
function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(toNum(seconds)));
  return Math.floor(s / 60) + ':' + pad2(s % 60);
}

/* ---------- lista do Início ---------- */

// Primeiro dia do mês anterior: o Início mostra o mês atual e o anterior.
function recentCutoff(todayIso) {
  const d = parseDate(todayIso);
  return fmtDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

// Quantos treinos (de uma lista em ordem decrescente de data) mostrar sem expandir:
// os do mês atual e do anterior, e no mínimo `minCount` (para quem ficou um tempo parado).
function visibleWorkoutCount(sortedDesc, todayIso, minCount) {
  const list = sortedDesc || [];
  const cutoff = recentCutoff(todayIso);
  const recent = list.filter(function (w) { return w.date >= cutoff; }).length;
  return Math.min(list.length, Math.max(recent, minCount));
}

// Nomes de ficha presentes nos treinos (para o filtro do Início), em ordem alfabética.
function sheetFilterOptions(workouts, sheets) {
  const seen = {};
  (workouts || []).forEach(function (w) {
    const label = sheetLabel(w, sheets);
    if (label) seen[label] = true;
  });
  return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
}

/* ---------- calendário ---------- */

// Treinos por dia: { "2026-10-08": [mais recente, ...] }. Treino sem data válida fica de fora.
function workoutsByDate(workouts) {
  const map = {};
  (workouts || []).slice().sort(byDateDesc).forEach(function (w) {
    if (!ISO_DATE.test(String(w.date))) return;
    (map[w.date] = map[w.date] || []).push(w);
  });
  return map;
}

/* ---------- evolução semanal ---------- */

// Volume (tonelagem) de um treino: soma de reps × carga das séries de trabalho.
// O aquecimento não entra (regra do app).
function workoutVolume(workout) {
  return ((workout && workout.sets) || []).reduce(function (sum, s) {
    return sum + toNum(s.reps) * toNum(s.load);
  }, 0);
}

// 12400 -> "12.400" (milhar com ponto, pt-BR). Feito à mão para não depender do idioma do aparelho.
function fmtThousands(n) {
  return String(Math.round(toNum(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Resumo de um treino para o card do Início: "5 exercícios · 12.400 kg · 30 min cardio".
// Partes zeradas ficam de fora; treino sem nada devolve ''.
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

// Totais das últimas `count` semanas (janelas de 7 dias como as metas), da mais antiga para a atual.
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

/* ---------- nome atual da ficha ---------- */

// O treino guarda o nome da ficha como estava no dia em que foi registrado (snapshot).
// Para MOSTRAR, resolvemos pelo id: assim renomear a ficha aparece em todo o app.
// Se a ficha foi excluída (ou o registro é antigo, sem id), usamos o nome guardado.
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

/* ---------- exportar treino como texto ---------- */

// Formatado para o WhatsApp: *negrito*, _itálico_, "1." e "- " viram listas lá.
function workoutAsText(workout, sheets, exercises, useComma) {
  const lines = [];
  lines.push('*' + fmtBR(workout.date) + '*');

  const sheetName = sheetLabel(workout, sheets);
  if (sheetName) lines.push('Ficha: _' + sheetName + '_');
  lines.push('');

  const groups = groupSets(workout.sets, workout.warmups);

  groups.forEach(function (g, i) {
    lines.push((i + 1) + '. *' + exerciseLabel(g, exercises) + '*');
    if (g.note) lines.push('_Obs.: ' + g.note + '_');

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

/* ---------- busca de exercício (seletor do treino, da ficha e do cadastro) ---------- */

// Lista de resultados da busca: "Criar …", Biblioteca (quando pedida e com resultado) e Catálogo.
// fn = nomes das funções do app.js chamadas no toque: { create, library, catalog }.
// Sem fn.library a Biblioteca fica de fora (cadastro de exercício: só o catálogo interessa).
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

// Mesmo limite do editor de ficha (que desenha no máximo 20 campos de reps).
const MAX_SETS = 20;

function normalizeSheetItem(item) {
  if (!item) return null;

  const raw = item;
  const legacySingle = !Array.isArray(raw.reps) && raw.reps !== undefined && raw.reps !== null && raw.reps !== '';
  let reps = Array.isArray(raw.reps) ? raw.reps.slice(0, MAX_SETS) : [];

  const sets = Math.min(MAX_SETS, Math.max(1, parseInt(raw.sets, 10) || reps.length || 3));

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

// Ficha importada em JSON (formato em FICHA-JSON.md): um objeto { name, exercises }, uma lista
// deles, ou { fichas: [...] }. Devolve [{ name, exercises }] já normalizado ou lança Error com o motivo.
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

// Texto colado (resposta da IA) -> fichas. A IA costuma cercar o JSON com ```json ... ```: tiramos a cerca.
// JSON quebrado lança SyntaxError; JSON válido fora do contrato lança Error com o motivo.
function parseSheetImportText(text) {
  return parseSheetImport(parseAiJson(text));
}

function parseAiJson(text) {
  return JSON.parse(String(text).replace(/^\s*```(?:json)?|```\s*$/g, ''));
}

/* ---------- importar treinos antigos + fichas recriadas (TREINO-JSON.md) ---------- */

// Data do JSON: AAAA-MM-DD ou DD/MM/AAAA, e precisa existir no calendário (31/02 não passa).
function importDate(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = br ? br[3] + '-' + pad2(br[2]) + '-' + pad2(br[1]) : text;
  return ISO_DATE.test(iso) && fmtDate(parseDate(iso)) === iso ? iso : '';
}

// Número opcional: ausente vira null; texto que não é número (ou negativo) é erro, nunca um palpite.
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

// Lista de treinos feitos -> [{ date, sheetName, cardioMinutes, notes, exercises: [{ name, note, warmup, sets }] }]
// em ordem de data, ou Error dizendo qual treino e qual campo. Datas depois de `today` são recusadas.
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

// Formato de TREINO-JSON.md: { "fichas": [...], "treinos": [...] }. As fichas seguem FICHA-JSON.md
// e são opcionais; uma lista solta conta como só treinos. Devolve { sheets, workouts } ou lança Error.
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

// Ficha do app com o mesmo nome (sem diferenciar maiúscula/acento), ativa primeiro.
function sheetByName(sheets, name) {
  const key = normalizeText(name);
  const same = key ? (sheets || []).filter(function (s) { return normalizeText(s.name) === key; }) : [];
  return same.find(function (s) { return s.active !== false; }) || same[0] || null;
}

// Fichas do JSON: as que já existem no app (mesmo nome) são reaproveitadas, não duplicadas.
function splitImportedSheets(sheets, existing) {
  const fresh = [];
  const reused = [];
  sheets.forEach(function (s) {
    (sheetByName(existing, s.name) ? reused : fresh).push(s);
  });
  return { fresh: fresh, reused: reused };
}

// Treino importado -> registro do banco (sem id e datas de criação). A ficha é ligada pelo nome;
// sem par, o treino guarda só o nome. exerciseFor(nome) devolve { id, name }.
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

// "Impressão digital" de um treino: data, cardio e reps×carga de cada série, em ordem.
// Não usa nomes: renomear exercício ou ficha não faz um treino reimportado parecer novo.
function workoutFingerprint(w) {
  const sets = w.exercises
    ? w.exercises.reduce(function (all, ex) { return all.concat(ex.sets); }, [])
    : (w.sets || []);
  return [w.date, toNum(w.cardioMinutes)].concat(sets.map(function (s) {
    return toNum(s.reps) + 'x' + toNum(s.load);
  })).join('|');
}

// Separa os treinos do JSON em novos e repetidos (já no app, ou duas vezes no mesmo JSON).
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

// Nomes de exercício usados no JSON (fichas + treinos), sem repetir, na ordem em que aparecem.
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

// Resumo da revisão: treinos novos (com o período), repetidos que serão pulados e fichas novas/reaproveitadas.
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

// Aviso depois de importar: "3 treinos importados e 2 fichas criadas." (cada parte só se houver).
function historyImportToast(workoutCount, sheetCount) {
  const parts = [];
  if (workoutCount) parts.push(countLabel(workoutCount, 'treino importado', 'treinos importados'));
  if (sheetCount) parts.push(countLabel(sheetCount, 'ficha criada', 'fichas criadas'));
  return parts.join(' e ') + '.';
}

// Lista das fichas do app para colar na IA junto com TREINO-JSON.md.
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

// Exercícios parecidos com um nome (palavras em comum / tamanho do nome maior).
// Empate fica na ordem da lista: passe a Biblioteca antes do catálogo. minScore (0..1) corta os fracos.
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

// Lista de nomes (Biblioteca + catálogo, sem repetir) para colar na IA junto com FICHA-JSON.md.
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

  // v1: as fichas eram "tipos de treino" (typeId/typeName).
  workout.sheetId = (w.sheetId === undefined || w.sheetId === null) ? (w.typeId || null) : w.sheetId;
  workout.sheetName = w.sheetName || w.typeName || '';
  delete workout.typeId;
  delete workout.typeName;

  // Data fora do formato vira "sem data" (o treino não se perde, só sai do calendário).
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

// O arquivo de backup pode ter sido editado à mão ou vir de outra pessoa, e o id vai
// parar em atributos onclick do HTML. Só entram ids com letras, números, "-" e "_"
// (é tudo o que o app já gerou: UUID, "id-123-abc", "w1", inteiro do catálogo).
function hasSafeId(record) {
  return !!record && !!record.id && /^[\w-]+$/.test(String(record.id));
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
    workouts: (source.workouts || []).filter(hasSafeId).map(normalizeWorkout),
    sheets: rawSheets.filter(hasSafeId).map(normalizeSheet),
    exercises: (source.exercises || []).filter(hasSafeId).map(normalizeExercise),
    settings: normalizeSettings(source.settings),
    colinha: (source.colinha || []).filter(hasSafeId)
  };
}

export {
  // datas
  pad2,
  fmtDate,
  parseDate,
  todayISO,
  addDaysISO,
  fmtBR,
  shiftMonth,
  parseRoute,
  installHint,
  dateParts,
  // texto e números
  esc,
  toNum,
  toNumOrNull,
  parseLocalNumber,
  formatDecimal,
  normalizeText,
  // configurações e semana
  defaultSettings,
  weekWindow,
  nextWeekAnchor,
  isValidWorkout,
  // dados de exemplo
  materializeSampleData,
  // referência por id
  linkSheetItemsToExercises,
  renameInSheets,
  renameInWorkouts,
  // backup
  backupFileName,
  fmtDateTimeBR,
  backupStatus,
  backupAction,
  backupSharePayload,
  isBackupPayload,
  backupHint,
  // biblioteca
  isUserExercise,
  libraryExercises,
  pickerHtml,
  fixLibrarySources,
  // aquecimento e séries
  warmupHasData,
  warmupLine,
  setLine,
  setsSummaryLines,
  setHeaderHtml,
  setRowHtml,
  groupSets,
  // histórico
  lastLoadsForExercise,
  lastWarmupForExercise,
  previousWarmupFields,
  sessionsForExercise,
  bestSetForExercise,
  maxBestLoad,
  estimate1RM,
  best1RMForExercise,
  // recordes
  workoutRecords,
  recordCounts,
  // formulário, descanso, Início e evolução
  byDateDesc,
  lastSessionForExercise,
  lastSessionLine,
  lastWorkoutForSheet,
  nextSheet,
  formFromWorkout,
  draftHasContent,
  groupHasData,
  setHasData,
  restSecondsOf,
  fmtClock,
  recentCutoff,
  visibleWorkoutCount,
  sheetFilterOptions,
  workoutsByDate,
  workoutVolume,
  fmtThousands,
  workoutSummary,
  weeklyTotals,
  // exportação
  workoutAsText,
  sheetLabel,
  exerciseTarget,
  exerciseLabel,
  exerciseMatches,
  exerciseKey,
  hasExercise,
  historyTarget,
  // compatibilidade de dados
  normalizeBackup,
  normalizeSheetItem,
  parseSheetImport,
  parseSheetImportText,
  suggestExercises,
  exerciseNamesText,
  // importar treinos antigos + fichas recriadas (TREINO-JSON.md)
  parseHistoryImport,
  parseHistoryImportText,
  sheetByName,
  splitImportedSheets,
  importedWorkout,
  workoutFingerprint,
  splitImportedWorkouts,
  historyExerciseNames,
  historyImportSummaryHtml,
  historyImportToast,
  sheetNamesText
};
