# Plan — Workout App (PWA)

## 1. Vision
An installable web app (PWA) to log gym workouts, track flexible weekly goals, keep ficha records and a
training-frequency calendar. All data stays **100% on the device** (IndexedDB), with **JSON** backup
(export/import). No backend, no publishing to stores.

## 2. Closed decisions
- **Distribution**: GitHub Pages (free static hosting; installs as an app and works offline).
- **Storage**: IndexedDB (native to the browser; works in Chrome/Edge and Safari/iOS).
- **Weekly cycle**: warning + confirmation at the end of the 7 days.
- **Stack**: plain HTML + CSS + JavaScript, no build and no dependencies.
- **UI language**: pt-BR.
- **Code language**: English (identifiers and comments).
- **Fichas**: a ficha groups several exercises (e.g. "TREINO A - inferiores"); when logging the workout, the
  selected ficha loads its exercises automatically.
- **Pre-fill**: the ficha defines **sets and reps per set**; the load comes from the **last execution**; RIR is
  filled in the workout.
- **Progress**: basic per-exercise progression already in the MVP.
- **UI framework**: Bootstrap 5 (local files in `vendor/`, no CDN at runtime).

## 3. Functional requirements
- **FR-01 — Log a workout**: date, ficha (selected from the list; loads its exercises), cardio (minutes) and extra
  exercises if wanted.
- **FR-02 — Sets per exercise**: each set stores number, reps done, carga (kg), RIR (reps in reserve) and a free
  note. The sets are **pre-filled** from the ficha's defaults and editable.
- **FR-03 — Dashboard**: weekly counter (e.g. `1/3 treinos`, `30/120 min cardio`), latest workouts and
  per-exercise progress (last session vs previous + PR).
- **FR-04 — Flexible week**: the user marks "semana iniciada"; the app counts 7 days from that date, without
  fixing weekdays.
- **FR-05 — Exercise library**: exercise CRUD (name, muscle group, note/reminder), with **filter by group** and
  **search**; it shows **which fichas** use each exercise. When creating one, you can pick from a **built-in
  catalog** of pt-BR exercises.
- **FR-06 — Colinha**: quick-reference section (RIR, rest time, reminders) editable by the user.
- **FR-07 — Frequency calendar**: monthly view with the days trained and the number of workouts in the month.
- **FR-08 — Backup**: export all data as JSON (download); import JSON restoring the data after confirmation, with
  an **automatic backup of the current state before importing**.
- **FR-09 — PWA**: installable on the home screen, works offline after the first load.
- **FR-10 — Workout fichas**: ficha CRUD with an **ordered** list of exercises; each exercise in the ficha has a
  **number of sets**, **reps per set** (they can vary, e.g. 12-10-8) and the **professora's note**. It is the ficha
  you select when logging the workout.
- **FR-11 — Edit/delete workout**: any logged workout can be opened for editing or deletion.
- **FR-12 — Warm-up per exercise**: each exercise in the workout log has its own warm-up line, where the trainee
  records **reps, peso and RIR**.
- **FR-13 — Export workout as text**: generate a readable message for a specific workout (date, ficha, **warm-up
  inside each exercise**, sets with reps/carga/RIR/obs, cardio and notes; **without** the professora's note, since
  v77) to **copy** or **share** with the professora.

## 4. Business rules
- **Week**: a 7-day window `[start, start + 6]` from the marked date. Workouts are always assigned to a week **by
  date**. When the 7 days pass, the app shows a "semana encerrada" warning with the week's final result; the user
  confirms to move on to the next window. Workouts dated outside the current window **are never lost** (they stay
  saved by date). The start can be reset at any time in Ajustes.
- **Default goal**: 3 workouts/week and 120 min of cardio/week (editable in Ajustes).
- **Valid workout**: counts toward the goal if it has at least 1 recorded set or cardio > 0.
- **Cardio**: minutes recorded inside the workout (a workout can be "só cardio").
- **Warm-up**: each exercise in the workout has its own warm-up line (reps, peso, RIR), saved with the workout; it
  **does not** count in per-exercise progress or in tonnage.
- **Fichas**: when logging, you select a ficha; its exercises enter the form in the registered order (with the
  option to replace what was already there). The ficha name is copied into the workout (snapshot) to preserve the
  history.
- **Built-in catalog**: the app ships `data/exercises.json` (927 pt-BR exercises: source
  `gugeldev/exercicios-bd-ptbr`, CC0-1.0 license, + own curation of common gym exercises). Each item has a
  **permanent** sequential integer `id` (never reassigned or reused), the original `sourceId`, `name` and `group`.
  When building a ficha (or adding an extra exercise to the workout), you can pick from the catalog or create your
  own. Catalog exercises are **not** copied into the Biblioteca (the Biblioteca keeps only the exercises created by
  the user).
- **Pre-fill**: when loading the ficha, the app creates the sets with the **reps per set** defined in the ficha and
  uses the **load from the last execution** of the exercise (if there is one). The **warm-up** also comes
  pre-filled with **reps and peso from the previous workout** (RIR blank). **Load and RIR belong to the workout**,
  not to the ficha.
- **On-the-fly creation**: in the exercise search (when building the ficha or logging the workout), if the name
  doesn't exist, the app offers "Criar \"...\"" and registers the exercise right away.
- **Progress**: per exercise, it shows the last session (carga × reps) vs the previous session and the **PR**
  (highest load ever recorded in one set; on a tie, the set with more reps).
- **Tonnage** (optional, Phase 2): `Σ(reps × carga)` per exercise and per workout, shown with a toggle.
- **Photos** (optional, Phase 2): 1 photo per exercise, stored in IndexedDB (Blob) and included in the export JSON
  as base64.
- **Import**: restores/replaces the local data after confirmation. The previous state stays in memory and can be
  recovered with **"Desfazer importação"** (Mais → Dados) — no automatic downloads.
- **Editing**: workouts can be edited or deleted at any time; there is no history lock.

## 5. Data model (IndexedDB)
Stores:
- `sheets` (fichas): `{ id, name, active, exercises[], createdAt, updatedAt }`
  - `exercises[]`: `{ exerciseId, name, sets, reps[] (reps per set), note (professora's note) }` (in the ficha order)
- `workouts`: `{ id, date (YYYY-MM-DD), sheetId, sheetName (snapshot), cardioMinutes, notes, warmups[] { exerciseId, exerciseName, reps, load, rir }, sets[], createdAt, updatedAt }`
  - `sets[]`: `{ exerciseId, exerciseName (copy of the name at the time), exerciseNote (the ficha's note), number, reps, load, rir, note }`
- `exercises`: `{ id, name, group, correction, active, createdAt, updatedAt }` (biblioteca; no load/RIR — those belong to the workout)
- `settings`: `{ id: 'app', weekAnchor (YYYY-MM-DD), weeklyWorkoutTarget, weeklyCardioTarget }`
- `colinha`: `{ id, title, content, order }`

## 6. Screens
| Screen | Role |
|---|---|
| Dashboard | Weekly goal, "semana encerrada" warning, latest workouts (tap to **see how it went**) |
| View workout (read-only) | Workout summary with warm-up, sets, cardio and notes; tap the exercise to see its **evolution**; Editar / Exportar / Excluir buttons |
| Exercise evolution | Best set per day (bars), PR, trend and full history by date |
| Treinar (log) | Date, ficha (select/create; loads its exercises), **warm-up per exercise (reps/peso/RIR)**, sets (reps/carga/RIR/obs), cardio; actions **Salvar / Cancelar** (discards) / Exportar texto / Excluir |
| Fichas and exercises | Tabs: **fichas** (ordered group of exercises) and **biblioteca** (filter by group, search and usage in fichas) + correction |
| Calendário | Monthly frequency |
| Colinha | RIR, rest, reminders |
| Ajustes | Weekly goal, week start, shortcut to fichas, export/import JSON, **apagar todos os dados** (its own screen with confirmation) |

## 7. Architecture / files

Where the code lives, the layers, the data rules and the intentional oddities:
[agents/architecture.md](agents/architecture.md). The IndexedDB stores are in §5 above.

## 8. Distribution (GitHub Pages)
1. Repository: `https://github.com/tbsiqueira/controle-academia.git`. `main` only changes through pull requests
   (rebase merge, with the checks passing); **when a PR with a new version lands, GitHub Actions publishes to Pages
   and creates the tag** (`v1`, `v2`, ...).
2. Enable GitHub Pages in the repository (Settings → Pages → branch `main`, folder `/`).
3. On the phone, open the URL and use "Adicionar à tela inicial" (Chrome/Edge/Safari).
4. Once installed, the app opens from its icon and works offline.

## 9. Phases
- **Phase 1 (MVP)**: fichas (ordered group of exercises) and exercise library with built-in catalog, full workout
  logging (ficha loads the exercises, pre-filled sets, cardio), editing/deleting workouts, dashboard with goals and
  per-exercise progress, week with warning + confirmation, colinha, calendar, JSON export/import, installable PWA.
- **Phase 2 (extras)**: photo per exercise, optional tonnage, UX improvements.

## 10. Assumptions to confirm
1. Tonnage stays for Phase 2, as an optional display — ok?
2. Photo per exercise stays for Phase 2 — ok?
3. Importing replaces the current data after confirmation (with automatic backup) — ok?
4. Provisional app name: **"Meu Treino"**.
5. Does the week rule (item 4) match what you had in mind?

## 11. History

The revision log is in git: `git log --oneline` and the release tags (`vN`). Decisions that still matter for new
work are in [agents/history.md](agents/history.md). This document keeps the requirements and the closed decisions;
planning and the state of each change live in [GitHub issues](https://github.com/tbsiqueira/controle-academia/issues).
