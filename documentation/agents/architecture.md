# Architecture

The authoritative reference for how the code and data are organised: layers, data model and the constraints a
change must respect. Product behaviour is in [product-rules.md](product-rules.md); commands and process are in
[workflow.md](workflow.md); requirements are in [`PLANO.md`](../PLANO.md).

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

## Data model (IndexedDB v2)

- `sheets` (fichas): `{ id, name, active, exercises[], createdAt, updatedAt }`
  - `exercises[]`: `{ exerciseId, name, sets, reps[] (reps per set), note (professora's note) }`, in display order.
- `workouts`: `{ id, date (YYYY-MM-DD), sheetId, sheetName (snapshot), cardioMinutes, notes, warmups[], sets[], createdAt, updatedAt }`
  - `warmups[]`: `{ exerciseId, exerciseName, reps, load, rir }`
  - `sets[]`: `{ exerciseId, exerciseName (copy of the name at the time), exerciseNote (the ficha's note), number, reps, load, rir, note }`
- `exercises`: `{ id, name, group, correction, active, createdAt, updatedAt }` (Biblioteca; no load/RIR — those belong to the workout)
- `settings`: record `id: 'app'` (goals, week start, rest seconds, `lastBackupAt`…) plus record `id: 'workoutDraft'`
  (the workout in progress, saved on every keystroke, **not** included in backups). Unknown keys pass through untouched.
- `colinha`: `{ id, title, content, order }`

`sheets.active === false` means the ficha is deactivated: it disappears from the Treinar selector but is not deleted.

## Data rules

- **Reference by `id`; the name is only a snapshot.** Sets, warm-ups and sheet items store `exerciseId` plus the
  name as it was that day, so history stays readable if the item is later renamed or deleted. Display resolves the
  **current** name with `exerciseLabel` / `sheetLabel`. Why: identity by name caused the v27 (library origin guessed
  from the name), v40 (ficha rename) and v47 (catalog history) regressions; never infer identity from a name, store
  explicit fields. Fichas that predate ids get them on startup (`linkSheetItemsToExercises`) when the stored name
  matches one library exercise unambiguously; the name stays as the fallback for records that never match.
- **Two id spaces**: user exercises = UUID text, catalog = integer 1..927. **Compare ids as strings**
  (`String(id)`), in one place: `exerciseMatches`, `exerciseKey`, `exerciseLabel`, `sheetLabel`. The id arrives as a
  number from IndexedDB and as text from `data-*` attributes; normalising in one place is what fixed that class of bug.
- **Catalog ids are permanent**: never renumber, reuse or delete one; add new exercises at the end. **Do not migrate
  them to UUIDs without an explicit decision**: every sheet, workout, backup and historical reference points at
  these numbers, and the text comparison above already removes the number/text friction. Migration would rewrite
  user data for no user-visible gain.
- **Backups**: `normalizeBackup` converts any version (fixtures in `tests/fixtures/`) to the current shape, must stay
  idempotent and ignores unknown fields. Imported ids and dates are validated before writing, and
  `dbReplaceAll` clears and writes in **one transaction** so a failed import can't leave the DB empty. Old databases
  (`tests/old-db.test.js`) must still load. Adding a property to an existing object-store record generally does not
  require an IndexedDB schema upgrade; adding or changing object stores, key paths or indexes does. Preserve
  compatibility with existing databases and test migrations whenever the schema changes.
- Numbers accept a comma (`27,5`): parse with `parseLocalNumber` / `toNum`, show with `formatDecimal`.
  Decimal inputs are `type="text" inputmode="decimal"` (`type="number"` blocks the comma on iPhone).
- Escape everything that comes from the DB with `esc()` before putting it into HTML.

## Event handling (current mechanism, don't change it casually)

- Screens are HTML strings built in `app.js`; interactive elements use inline `onclick="fn(...)"` plus a few
  `oninput`/`onchange`. The scripts in `index.html` are classic scripts (no `type="module"`), so those handlers call
  functions that must be globally reachable (the top-level functions of `app.js` and the globals `core.js` registers
  in the browser). `check.ps1` verifies every `onclick` handler names an existing function.
- `index.html`'s CSP allows this with `'unsafe-inline'` in `script-src` (the `style-src` allowance is separate: the
  app also uses `style` attributes).
- Don't remove the inline handlers, the globals or the CSP allowance as part of an unrelated task. The migration to
  `data-action` + event delegation is refactor issue #9, in the Phase 2 order of
  [REFACTOR.md](../REFACTOR.md#3-phases-and-pr-order).

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
- **Sample data**: `data/sample-data.json` — 3 fichas and 12 workouts, with `dayOffset` dates relative to today
  (so the demo always looks recent) and 6 custom exercises. Generated by `tools/build-sample-data.ps1`; `check.ps1`
  regenerates it and compares the content, so generator and JSON never drift. It is **not** in the service worker
  precache (loaded on demand, so the first load needs a connection) and doubles as the fixture for
  `tests/sample-data.test.js` (shape, referential integrity, backup normalization, old-format migration, renaming).

## Versioning and caching

- The version `N` lives in **two** places and they must agree: `index.html` (every `?v=N` and
  `<span id="appVersion">vN</span>`) and `sw.js` (`CACHE_NAME = 'meu-treino-vN'` and every `?v=N` in `ASSETS`).
  Any change to `index.html`, `css/` or `js/` bumps it (`check.ps1` fails otherwise, CI's **Version** job enforces
  it). Why: the service worker serves versioned assets cache-first, so without a new `N` an installed phone keeps
  running the old files.
- `index.html` and `data/exercises.json` are network-first (with the cache as offline fallback); everything with
  `?v=N` is cache-first. On `localhost` the service worker stays network-first even for versioned files, so edits
  show up without a bump.
- The AI contracts `FICHA-JSON.md` and `TREINO-JSON.md` are **precached** because the app fetches them to show the
  text to paste into the AI, and that must work offline. They must stay at the repository root.
- No third-party requests: `Content-Security-Policy` in `index.html` restricts everything to the site itself.

## Development tooling is not the app

The published app is exactly the files in the repository: no bundler, no build, no runtime dependency.
`package.json` / `node_modules/` exist only for development tools (Playwright, and `typescript` in Phase 3), and
`tools/` is not published nor precached. The unit tests run with plain `node --test tests/`, without installing
anything.

## Things that look odd but are on purpose

- No bundler and no jsdom: the app is edited and served as-is. DOM code is covered by the browser tests in
  `tests/e2e/`, by static checks and by keeping logic in `core.js`.
- The catalog is a single file (≈240 KB) loaded once and cached by the service worker; it is not split.
- Icon font is base64 inside the CSS (avoids "square" icons when the font fails to load).
- `reset.html` is an escape page that unregisters the service worker and clears caches.
