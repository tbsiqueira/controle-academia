# Plan — Workout App (PWA)

## 1. Vision
An installable web app (PWA) to log gym workouts, track flexible weekly goals, keep ficha records and a
training-frequency calendar. All data stays **100% on the device** (IndexedDB), with **JSON** backup
(export/import). No backend, no publishing to stores.

## 2. Closed decisions
- **Distribution**: GitHub Pages (free static hosting; installs as an app and works offline), with the same
  build also deployed to a temporary Cloudflare UAT Worker for testing before the phone install.
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
- **FR-02 — Sets per exercise**: each set stores number, reps done, load (kg), RIR (reps in reserve) and a free
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
  **number of sets**, **reps per set** (they can vary, e.g. 12-10-8) and the **teacher's note**. It is the ficha
  you select when logging the workout.
- **FR-11 — Edit/delete workout**: any logged workout can be opened for editing or deletion.
- **FR-12 — Warm-up per exercise**: each exercise in the workout log has its own warm-up line, where the trainee
  records **reps, load and RIR**.
- **FR-13 — Export workout as text**: generate a readable message for a specific workout (date, ficha, **warm-up
  inside each exercise**, sets with reps/load/RIR/note, cardio and notes; **without** the teacher's note, since
  v77) to **copy** or **share** with the teacher.

## 4. Business rules
- **Week**: a 7-day window `[start, start + 6]` from the marked date. Workouts are always assigned to a week **by
  date**. When the 7 days pass, the app shows a "semana encerrada" warning with the week's final result; the user
  confirms to move on to the next window. Workouts dated outside the current window **are never lost** (they stay
  saved by date). The start can be reset at any time in **Mais → Metas da semana**.
- **Default goal**: 3 workouts/week and 120 min of cardio/week (editable in **Mais → Metas da semana**).
- **Valid workout**: counts toward the goal if it has at least 1 recorded set or cardio > 0.
- **Cardio**: minutes recorded inside the workout (a workout can be "só cardio").
- **Warm-up**: each exercise in the workout has its own warm-up line (reps, load, RIR), saved with the workout; it
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
  pre-filled with **reps and load from the previous workout** (RIR blank). **Load and RIR belong to the workout**,
  not to the ficha.
- **On-the-fly creation**: in the exercise search (when building the ficha or logging the workout), if the name
  doesn't exist, the app offers "Criar \"...\"" and registers the exercise right away.
- **Progress**: per exercise, it shows the last session (load × reps) vs the previous session and the **PR**
  (highest load ever recorded in one set; on a tie, the set with more reps).
- **Tonnage** (optional, Phase 2): `Σ(reps × load)` per exercise and per workout, shown with a toggle.
- **Photos** (optional, Phase 2): 1 photo per exercise, stored in IndexedDB (Blob) and included in the export JSON
  as base64.
- **Import**: restores/replaces the local data after confirmation. The previous state stays in memory and can be
  recovered with **"Desfazer"** (Mais → Dados) — no automatic downloads.
- **Editing**: workouts can be edited or deleted at any time; there is no history lock.

## 5. Data model (IndexedDB)
Stores:
- `sheets` (fichas): `{ id, name, active, exercises[], createdAt, updatedAt }`
  - `exercises[]`: `{ exerciseId, name, sets, reps[] (reps per set), note (the teacher's note) }` (in the ficha order)
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
| Treinar (log) | Date, ficha (select/create; loads its exercises), **warm-up per exercise (reps/load/RIR)**, sets (reps/load/RIR/note), cardio; actions **Salvar / Cancelar** (discards) / Exportar texto / Excluir |
| Fichas and exercises | Tabs: **fichas** (ordered group of exercises) and **biblioteca** (filter by group, search and usage in fichas) + correction |
| Calendário | Monthly frequency |
| Colinha | RIR, rest, reminders |
| Mais → Metas da semana | Weekly goal, week start and rest time; export/import in **Mais → Dados**; **Apagar todos os dados** in **Mais → Debug** (own screen with confirmation) |

## 7. Architecture / files
```
index.html
css/styles.css
js/core.js (pure logic, covered by tests)
js/app.js + js/db.js
tests/core.test.js + tests/fixtures/ (unit tests and data-compatibility tests)
test.ps1 (runs the tests locally)
vendor/bootstrap/ (local Bootstrap 5)
vendor/bootstrap-icons/ (local icons)
manifest.webmanifest
sw.js (service worker)
icons/icon-192.png, icon-512.png
serve.ps1 (local server for testing)
check.ps1 (static checks: JSON, ids, handlers, assets, version)
data/exercises.json (built-in exercise catalog, pt-BR, CC0)
data/sample-data.json (sample data: 3 fichas, 12 workouts, 6 custom exercises)
tools/build-sample-data.ps1 + tools/sample-data-content.json (reproducible fixture generator)
README.md (how to run, publish to GitHub Pages and the UAT, structure, versioning)
documentation/MANUAL.md (usage documentation: examples, FAQ, common problems, glossary)
.gitattributes / .nojekyll (repository and GitHub Pages hygiene)
wrangler.toml (Cloudflare Worker that serves the UAT build from dist/)
tools/package-cloudflare.ps1 + tools/serve-dist.ps1 (package the app into dist/ and serve it locally)
.github/workflows/deploy.yml (when a new version lands on main: tests, deploy to Pages and to the UAT Worker, then tag vN)
.github/workflows/tests.yml (tests, checks and version bump: required checks of the PRs)
documentation/PLANO.md
```
- Service worker: cache-first for the app "shell"; **no data is sent to a server**.
- Privacy: no analytics, no external calls; `Content-Security-Policy` in `index.html`.
- Local test without Node/Python: `serve.ps1` starts a local HTTP server via PowerShell (`localhost` is a secure
  context, so the PWA can be tested before publishing).

## 8. Distribution (GitHub Pages + Cloudflare UAT)
1. Repository: `https://github.com/tbsiqueira/controle-academia.git`. `main` only changes through pull requests
   (rebase merge, with the checks passing); **when a PR with a new version lands, GitHub Actions publishes to Pages
   and to the UAT Worker and then creates the tag** (`v1`, `v2`, ...). The tag only exists after both deployments
   succeed.
2. Enable GitHub Pages in the repository (Settings → Pages → Source: **GitHub Actions**).
3. Cloudflare UAT (temporary): the `cloudflare-pages-uat` environment holds the `CLOUDFLARE_API_TOKEN` secret and
   the `CLOUDFLARE_ACCOUNT_ID` variable. `deploy.yml` packages the browser files into `dist/`
   (`tools/package-cloudflare.ps1`) and runs `wrangler deploy`; the Worker `uat` (`wrangler.toml`) answers on
   `https://uat.<account-subdomain>.workers.dev/`. GitHub Pages stays the published app; the UAT is a second copy
   for testing before the phone install.
4. On the phone, open the Pages URL and use "Adicionar à tela inicial" (Chrome/Edge/Safari).
5. Once installed, the app opens from its icon and works offline.

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

## 11. Revision history
- **Revision 1** (`dec-392110e34edd83a3`): distribution via GitHub Pages, IndexedDB, week with warning + confirmation.
- **Revision 2** (`dec-93a822fbea27513a`): workout type as a manageable list, set pre-fill, per-exercise progress in the MVP; editing/deleting workouts and automatic backup on import.
- **Revision 3**: built-in exercise catalog (`data/exercises.json`, 869 pt-BR items, CC0-1.0, source `gugeldev/exercicios-bd-ptbr`); code language in English.
- **Revision 4**: catalog IDs converted to permanent sequential integers (1..869), with the original `sourceId` preserved and a stability policy in `meta.idPolicy`.
- **Revision 5** (`dec-a52daaa2e8f02e86`): UI framework Bootstrap 5, with files vendored locally (no CDN at runtime).
- **Revision 6**: catalog search inline in the ficha modal (fixes overlapping modals); on-the-fly exercise creation; catalog extended with +58 common gym exercises (ids 870–927, 927 total).
- **Revision 7**: "ficha" becomes the **complete workout** (ordered group of exercises) and "exercícios" become the library; when logging, the selected ficha loads its exercises. Automatic migration of the old "tipos de treino" into fichas (IndexedDB v2).
- **Revision 8**: in the ficha, each exercise has **sets + reps per set** (e.g. 3×12-10-8) and the **professora's note**; **load and RIR left the ficha and the library** (they belong to the workout). The library kept name, group and note.
- **Revision 9**: **warm-up line** in the workout log (reps, peso, RIR), saved with the workout.
- **Revision 10**: the warm-up becomes **per exercise** (each exercise in the workout has its own reps/peso/RIR line), not a single block for the workout.
- **Revision 11**: warm-up pre-filled with **reps and peso from the previous workout**; bottom menu item "Exercícios" renamed to **"Fichas"**.
- **Revision 12**: visual polish — icons in titles/cards/buttons, **progress bars** on the weekly goals, **trend arrow** (↑/↓/=) in per-exercise progress, PR badge with a trophy, exercise numbering in the ficha, **today** highlighted in the calendar and empty states with guidance.
- **Revision 13** (`dec-23116a57a6ed6e0c`): "Exercícios" tab renamed to **"Biblioteca"**, with **filter by muscle group**, search and indication of **which fichas** use each exercise.
- **Revision 14**: menu item "Registrar" renamed to **"Treinar"**; each workout can be **exported as readable text** (warm-up, sets, loads, RIR, notes, cardio) to copy/share with the professora.
- **Revision 15**: exercises picked from the catalog are now **saved in the Biblioteca**; **visible error handling** in actions (no silent failures); a workout with only a warm-up also saves; import without automatic download, with **"Desfazer importação"**.
- **Revision 16**: in the exported text, the **warm-up appears inside each exercise** (and exercises with only a warm-up are listed too).
- **Revision 17**: "Desempenho por exercício" left the Dashboard; a new consultation flow: tapping a workout opens the **"Como foi o treino"** screen (read-only) and tapping an exercise opens the **Evolução** (best set per day, PR, trend and history).
- **Revision 18**: **Cancelar** button on the workout screen, discarding all changes (returns to "Como foi o treino" when it was editing).
- **Revision 19**: short explanatory texts on the **Fichas** screen (what a ficha is, what the Biblioteca is) and a hint inside the ficha editor.
- **Revision 20**: the **Biblioteca** now lists only the exercises **created by the user** (catalog ones are no longer copied there or shown in the list).
- **Revision 21**: standardised button bars (actions on the **same line**, icon buttons with fixed width `.btn-icon`) on every screen.
- **Revision 42**: audit of **references by id** across the whole app — `exerciseLabel`, `sheetLabel`, `exerciseTarget`, `exerciseMatches` and `exerciseKey` in the core; set grouping, history, PR, fichas, pre-fill and exported text now resolve by id (the stored name is only a fallback for old/no-id data); ids that were being dropped (`pickCatalogExercise`, adding from the catalog to the ficha) are now saved; invalid ficha items are discarded in normalization.
- **Tests (2026-11-17, no app change)**: Phase 1 of the refactor (`documentation/REFACTOR.md`) done — the real app is tested in a phone Chromium (Playwright, `tests/e2e/`) on every PR. Every path a person triggers has a browser test, including the **Não** answer of every confirmation; CI fails a `tests/CHECKLIST.md` row without a browser test and a drop in `js/app.js` coverage relative to `main` (ratchet, 98.7% today). Issues #4, #5, #19, #6, #7 and #29.
- **Tests (2026-11-18, no app change)**: **temporary** browser tests for the refactor (issue #39, `tests/e2e/temporarios/`): every behaviour of every screen has its own test and `js/app.js` line coverage reached **100%**, including error paths (device out of space, blocked cache) simulated in the browser and "Atualizar app", which started being counted. They stay on until #16; #40 turns them off without deleting them.
- **Process (2026-11-17, no app change)**: `main` became protected — every change goes in through a **pull request**, merge **only by rebase**, linear history and required checks (tests + coverage, `check.ps1` and the new **Version** job, which requires the bump when `index.html`, `css/` or `js/` change). `deploy.yml` now runs on every merge to `main` and, if the version has no tag yet, publishes to Pages and **creates the `vN` tag itself**; nobody tags by hand anymore.
- **Deployment (2026-11-20, no app change)**: **temporary Cloudflare UAT** — `deploy.yml` also publishes the same
  build to the Worker `uat` (`wrangler.toml`, `dist/` packaged by `tools/package-cloudflare.ps1`), through the
  `cloudflare-pages-uat` environment (`CLOUDFLARE_API_TOKEN` secret, `CLOUDFLARE_ACCOUNT_ID` variable). The `vN`
  tag is created only after **both** deployments succeed, so a broken UAT blocks the release instead of shipping
  half of it; a manual dispatch republishes the current version. GitHub Pages remains the published app.
- **v77**: the **workout text** sent to the professora no longer carries the **professora's note** (the `_Obs.: …_` line under each exercise): it is her own text. The note stays saved in the sets and appears in Treinar and in the workout detail.
- **v76**: the **set note** field in Treinar and the **Criar com IA** texts went back to 16px on the phone (a more specific rule made them smaller and the iPhone zoomed on tap). A browser test measures the size of each field in view at 375px.
- **v74**: leaner **Mais** screen: **Debug** card always visible at the end (the collapsible "Opções avançadas" is gone); **Fichas de treino** card removed (the Fichas tab already does that); **Colinha** right below **Metas da semana**. Order: Metas, Colinha, Importar treinos antigos, Dados, Instalar o app, Debug.
- **v73**: the review summary and the final warning of **Importar treinos antigos** moved to the core with tests (`historyImportSummaryHtml`, `historyImportToast`); the warning no longer says "0 treinos importados" when only fichas come in. Wiring tests for the two AI imports (review, import, ficha → workout order, shared exercise review).
- **v72**: new **Mais → Importar treinos antigos** card: the AI converts a spreadsheet of workouts already done following the `TREINO-JSON.md` contract (`{ fichas, treinos }`) and recreates the **fichas of the most recent routine**, linked to the same exercises from the history, so the last time's load already comes filled in. Review with period, new/reused fichas and a similar-exercise choice; repeated workouts (same date and sets) are skipped. Core: `parseHistoryImport`, `sheetByName`, `splitImportedSheets`, `importedWorkout`, `workoutFingerprint`, `splitImportedWorkouts`, `historyExerciseNames`, `sheetNamesText`.
- **v70**: new **Mais → Instalar o app** card (between Dados and Opções avançadas): **Instalar** button when the browser offers it (Chrome/Edge, phone or computer), Safari on iPhone step by step and an "already installed" warning. Core: `installHint`.
- **v68**: **Pedir uma ficha para a IA** and **Importar** became a single button, **Criar com IA**: the same window brings the text for the AI (copy, 2-line field) and the box to paste the answer; the `#/ia` screen and the AI text's **Compartilhar** button were removed.
- **v59**: the AI contract accepts **a PDF with several workouts** (always an array, one ficha per workout, distinct names, phase in the name); **Ver dados** screen removed; **Atualizar app**, **Apagar todos os dados**, storage used and sample data moved to the **Mais → Debug** card.
- **v55–v58**: Início cards with only the date + ficha name (counts and the record badge left; the record stays in the workout summary); the **compartilhar** button came back to the card (v56); alternating colours on the Treinar cards tried and reverted (v57/v58).
- **v53–v54**: **Importar ficha em JSON** by pasting the text (accepts the ` ```json ` fence), with a **review** that suggests similar exercises (Biblioteca before the catalog) or "Criar novo"; the **#/ia** screen that joins the `FICHA-JSON.md` contract + Biblioteca and catalog names to paste into the AI; fichas can be **deactivated/reactivated** (they disappear from the Treinar selector without deleting anything). Core: `parseSheetImport`, `suggestExercises`, `exerciseNamesText`.
- **Revision 49** (`dec-f51620feb7b4bdb2`, removed in v59): new **Mais → Dados → Ver dados** screen (read-only): counts per store, workouts table (date, ficha, exercises, sets, open), fichas, library (with "used in") and goals/week, plus **Copiar JSON** and **Exportar backup**. Nothing is written by that screen.
- **Revision 48** (`dec-9abff65482647369`): fixed the **catalog exercise history that opened empty** (numeric catalog id × text id coming from `data-*` in the HTML) — the id comparison is now done **as text** in a single place (`exerciseMatches`, `exerciseKey`, `exerciseLabel`, `sheetLabel`). Decision: **keep the numeric catalog ids** (1..927, policy already documented) with the normalized comparison, instead of migrating the catalog to UUID and rewriting the legacy data.
- **Revision 47**: **urgent fix** — v43 had accidentally removed the helpers `allExercises`/`labelOf`/`refOf` from `app.js` (the splice that swapped the workout list swallowed the following block): opening a workout and editing stopped working (`ReferenceError: labelOf is not defined`). The helpers came back and `check.ps1` gained check **14**: every function called in `app.js` must exist (in `app.js`, `core.js` or `db.js`) — the syntax tests (`node --check`) don't catch this kind of error.
- **Revision 46**: Início now lists **all workouts** (not just the 5 latest), with a counter; app icons updated to the new ones in the `icons/` folder (favicon 16/32, apple-touch 180, manifest 192/512 + maskable, precache in the service worker).
- **Revision 45**: **old database** regression test (`tests/old-db.test.js`): simulates the v33 era (workouts/fichas without id, renamed names, `source: catalog` without proof) going through init (repair + linking by name) and normalization — proves that nothing is lost and that the old history is still findable by the stored name (`historyTarget`). The source repair got a pure version (`fixLibrarySources`), used by the app.
- **Revision 44**: coverage **closed at 100%** — the gate measures, beyond the Node lines, a pass in a **single process** (without the false positives of the per-process report) and requires zero stretches of logic without a test; only the module wrapper (Node × browser) was left out, validated by `tests/module.test.js`. Along the way, two unreachable fallbacks were removed from the core. The gate now **blocks** CI (`COVERAGE_ENFORCE=1`).
- **Revision 43**: **100% test coverage** of `js/core.js` (lines and branches) with a gate in CI (`tools/coverage-gate.js` + `COVERAGE_ENFORCE=1`), feature → tests list in `tests/CHECKLIST.md`, edge tests and module registration in the browser. Decision: **no jsdom/npm**; the DOM stays covered by static checks + logic extracted into the core (see "Known limits" in the checklist).
- **Revision 41**: fixed the outdated ficha name in the overview — the workout stores the ficha name as a snapshot, and the screens now resolve the **current name by id** (`sheetLabel`, same pattern as the exercise history), including in the exported text; renaming/deleting a ficha already updates Início, Fichas, the workout selector and the Calendário right away.
- **Revision 40**: sharing sends **only the file** (`{ files }`, no `title` and no `text`) — it was the last field able to become a `.txt` on the device; the app version appears next to the backup status in **Mais → Dados** to check right away whether the phone already has the new code.
- **Revision 39**: **a single backup button** — "Exportar" (before "Exportar" + "Compartilhar backup"): on the phone it opens the share sheet, on the computer it downloads the file; the icon and the hint under the button (`backupHint`) change with the device.
- **Revision 38**: simplified **Apagar dados** screen (only the checkbox, no typing `APAGAR`) and without the redundant backup button; fixed the backup button that downloaded an invalid file (the handler received the click event as an argument — now validated by `isBackupPayload`, with a regression test).
- **Revision 37**: backup sharing sends **only the file** (`backupSharePayload`, no `text`) — some devices saved the text as a second `.txt` file; update buttons consolidated into one (**"Atualizar app"** clears the cache and reloads), with `reset.html` kept only as an escape page.
- **Revision 36**: fixed the duplicate backup — the decision became a pure rule (`backupAction`): **phone/tablet** opens the share sheet, **computer** downloads straight away; if sharing fails, the app does **not** download on its own (it warns and suggests "Exportar"). Action feedback ("Arquivo gerado: …" / "Backup compartilhado: …" / "cancelado").
- **Revision 35**: improved manual backup flow — **Compartilhar backup** button (Web Share API with a file: Drive, WhatsApp, Files), **last backup status** in Mais → Dados and a **reminder on Início** when more than 7 days pass (dismissible). Decision: stay 100% local, **no** OAuth integration with Google Drive.
- **Revision 34**: carga fields accept a **comma** (`27,5`) and are shown with a comma in pt-BR; on the iPhone the decimal field became `type="text"` + `inputmode="decimal"` (`type="number"` blocked the comma key) and the parser was fixed — before, `27,5` was saved as `27`.
- **Revision 33**: support tools versioned (`tools/`) — the sample fixture generator became reproducible (`tools/build-sample-data.ps1` + content in `tools/sample-data-content.json`), and `check.ps1` regenerates and compares the hash to keep the two in sync.
- **Revision 32**: sample data (fixture) — `data/sample-data.json` with 3 fichas (5-6 catalog exercises + 2 custom each) and 12 workouts (4 per ficha, relative dates), loadable in Mais → Dados de exemplo and used as a fixture in the compatibility tests.
- **Revision 31**: workout details in **lists** (`<ul>`) with the same style as the fichas; ficha editor with clear labels; **reference by id (foreign key)** in ficha items — renaming an exercise updates fichas (by id and, for old data, by name) and the history that points to the id, with **automatic migration** that links old fichas to the Biblioteca.
- **Revision 30**: backup with **date and time** in the file name (`meu-treino-backup-AAAA-MM-DD_HH-mm-ss.json`) and the **app version** recorded inside the file.
- **Revision 29**: ficha list redesigned — each ficha shows the exercises in a numbered **list** (`<ul>`), with sets×reps highlighted and the note alongside, instead of the compact row.
- **Revision 28**: Biblioteca fix — the app no longer "guesses" the origin from the name (`isUserExercise`): user-created exercises show up again, and old markings without `catalogId` are repaired on startup.
- **Revision 27**: fix for the iOS auto-zoom when focusing text fields (form controls at 16px on phone screens).
- **Revision 26**: extraction of the pure logic into `js/core.js` (dates, week, set grouping, warm-up, history, text export and `normalizeBackup`) with **unit tests in Node** (`tests/core.test.js`, v1/v2 backup fixtures) and **pipelines** for tests (`tests.yml` on every push/PR) and for tag deploy (which only publishes if the tests pass).
- **Revision 25**: safe publishing flow — only the `main` branch + version **tags**; Pages is published by **GitHub Actions** when a `v*` tag is pushed (with `check.ps1` as the gate before deploy).
- **Revision 24**: `MANUAL.md` — documentation for users (getting started, ficha and workout example, evolution, goals, backup, FAQ, common problems and glossary).
- **Revision 23**: general best-practices review — complete `README.md` (with a GitHub Pages step by step), `check.ps1` (static checks), `.gitattributes`, `.nojekyll`, `Content-Security-Policy` and `aria-label` on icon buttons.
- **Revision 22**: **accent-insensitive** search (e.g. "puxada maquina" finds "Puxada máquina") in every search; the **Treinar** screen no longer creates fichas (the trainee creates them in the Fichas tab); new **Apagar dados** screen (confirmation by typing, no `alert`).
