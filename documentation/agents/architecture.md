# Architecture

Full file list and data model: [README.md → Estrutura / Modelo de dados](../../README.md#estrutura).
This page is the short version an agent needs to place a change correctly.

## Domain terms (the UI uses the Portuguese words)

| Term | Meaning | Lives in |
|---|---|---|
| **Ficha** (sheet) | The plan: ordered exercises, number of sets, reps **per set** (e.g. 3×12-10-8), the trainer's note | `sheets` |
| **Treino** (workout) | What was done on one day: date, chosen ficha, sets with reps / **carga** (load, kg) / **RIR** / obs, cardio minutes, notes | `workouts` |
| **Aquecimento** (warm-up) | One line per exercise (reps, peso, RIR). Never counts for volume, PRs or history charts | `workout.warmups[]` |
| **Biblioteca** (library) | Exercises the user created. Catalog exercises are **not** copied into it | `exercises` |
| **Catálogo** | 927 built-in exercises, `data/exercises.json` | static file |
| **Colinha** | Quick-reference notes | `colinha` |
| **Professora** | The user's trainer: workouts are exported as text for her | — |

Load and RIR belong to the workout, never to the ficha. "Peso" in the UI means lifting load, not body weight.

## Layers

| File | Role | Tested how |
|---|---|---|
| `js/core.js` | Pure logic: dates, week window, grouping, history/PRs/1RM, export text, backup normalize/import, ficha JSON import. No DOM. UMD: `module.exports` in Node, globals in the browser. | Unit tests, **100% line coverage enforced** (`tools/coverage-gate.js`) |
| `js/app.js` | Screens, rendering (HTML strings), event wiring, global `state`. Calls core functions as globals. | Browser tests (`tests/e2e/`, Playwright) for every user-triggered path, with a line-coverage ratchet (`tools/e2e-coverage.js`) + static checks in `check.ps1` + string assertions in `tests/features.test.js` |
| `js/db.js` | IndexedDB wrapper (`dbAll`, `dbGet`, `dbPut`, `dbDelete`, `dbReplaceAll`, `dbClear`). DB version 2 — don't bump without a migration plan. | `tests/db.test.js` |
| `index.html` | App shell: every screen is a `<section id="view-…">`, switched by hash routes (`#/dashboard`, `#/workout`, `#/exercises`, `#/calendar`, `#/more`, `#/detail/<id>`, `#/exercise`). | `check.ps1` (ids, handlers, assets) |
| `sw.js` | Service worker: cache-first for `?v=N` assets, network-first for `index.html` and the catalog. | `tests/sw.test.js` |
| `vendor/` | Bootstrap 5, Bootstrap Icons, Plus Jakarta Sans — local copies, no CDN (CSP blocks third parties). Don't edit. | — |

Rule of thumb: if it can be written without touching the DOM, it belongs in `core.js` with a test.
New core functions must be added to the export object at the bottom of `core.js`.

## Data rules

- **Reference by `id`, the name is only a copy.** Sets, warm-ups and sheet items store `exerciseId` plus the
  name as it was that day. Display resolves the current name with `exerciseLabel` / `sheetLabel`, so renames
  show up everywhere, including history. Old records with only a name still work through the fallback.
- Two id spaces: user exercises = UUID text, catalog = integer 1..927. **Compare ids as strings**
  (`String(id)`), in one place: `exerciseMatches`, `exerciseKey`, `exerciseLabel`, `sheetLabel`.
- Catalog ids are **permanent**: never renumber, reuse or delete one. Add new exercises at the end.
- `settings` store: record `id: 'app'` (goals, week start, rest seconds, `lastBackupAt`…) plus record
  `id: 'workoutDraft'` (the workout in progress, saved on every keystroke, **not** included in backups).
  Unknown keys in `settings` pass through untouched.
- Backups: `normalizeBackup` converts any version (fixtures in `tests/fixtures/`) to the current shape, must stay
  idempotent and ignores unknown fields. Imported ids and dates are validated before writing, and
  `dbReplaceAll` clears and writes in **one transaction** so a failed import can't leave the DB empty.
- Numbers accept a comma (`27,5`): parse with `parseLocalNumber` / `toNum`, show with `formatDecimal`.
  Decimal inputs are `type="text" inputmode="decimal"` (`type="number"` blocks the comma on iPhone).
- Escape everything that comes from the DB with `esc()` before putting it into HTML.
- Inline `onclick="fn()"` handlers call global functions, so `check.ps1` verifies every one exists.

## Features with their own contract

- **Ficha import from AI**: the user pastes JSON produced by an AI from the trainer's PDF. The contract is
  `FICHA-JSON.md` (always an array, one ficha per workout). Parsed by `parseSheetImportText` (strips a ```json fence),
  matched by `suggestExercises` (library first, then catalog). Changing the format means changing the contract too.
- **Old workouts import from AI** (Mais → Importar treinos antigos): contract `TREINO-JSON.md`, an object
  `{ fichas, treinos }`. `fichas` use the FICHA-JSON shape and are the *latest* routine, recreated so the
  "last time" load pre-fill works (it needs a ficha whose items share exercise ids with the history).
  Parsed by `parseHistoryImportText`; fichas with an existing name are reused (`splitImportedSheets`), workouts link
  to fichas by name (`sheetByName`) and duplicates are skipped by `workoutFingerprint` (date + cardio + reps×load,
  no names). `tests/history-import.test.js` parses the contract's own example, so keep them in sync.
- **Backup**: one button. Phone → share sheet with only the `.json` file (no `title`/`text`, they created stray
  `.txt` files). Desktop → download. If sharing fails, never download a second file automatically.
- **Sample data**: `data/sample-data.json`, generated by `tools/build-sample-data.ps1`; `check.ps1` fails if they drift.

## Things that look odd but are on purpose

- No bundler and no jsdom: the app is edited and served as-is. DOM code is covered by the browser tests in
  `tests/e2e/`, by static checks and by keeping logic in `core.js`.
- No build, but the UAT deploy packages the app: `tools/package-cloudflare.ps1` copies the browser files into
  `dist/` (no bundling, no transpiling) and `wrangler deploy` uploads that directory. `FICHA-JSON.md` and
  `TREINO-JSON.md` must stay in its file list: the app fetches them.
- Icon font is base64 inside the CSS (avoids "square" icons when the font fails to load).
- `reset.html` is an escape page that unregisters the service worker and clears caches.
