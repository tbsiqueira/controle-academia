# Coverage checklist — feature → tests

Map of **every app feature** to the tests that cover it. It answers
"is this tested?" without reading the whole tests.

- Unit tests: `node --test tests/` (no dependencies).
- Browser tests: `npm run test:e2e` (Playwright, `tests/e2e/` folder; setup in `documentation/agents/workflow.md`).
  **Browser tests** column: every row has at least one (`tests/checklist.test.js` fails a row with "—"
  and a cited file that does not exist). A new feature comes with a row and a browser test. Treinar and
  Início are **critical screens**: every behaviour of them gets its own row and test.
- Every confirmation question (`confirm()` in `app.js`) has a browser test for the **Não** answer, which checks the
  question text: `tests/confirm-no.test.js` fails a new question without that test.
- Coverage: `node tools/coverage-gate.js` (CI requires **100% of lines and branches in `js/core.js`**).
  `js/app.js` coverage by the browser tests: `node tools/e2e-coverage.js` after `npm run test:e2e`;
  CI publishes the number in the job summary and fails if it drops against `main` (ratchet, `tests/e2e/coverage-baseline.json`).
- Pure logic lives in `js/core.js` on purpose: it is what can be tested without a browser.
- Screens/DOM handling (`js/app.js`) are checked statically by `check.ps1`
  (ids, handlers, assets, version, anti-zoom) and, more and more, by the browser tests.

| Feature | Where it lives | Tests | Browser tests |
|---|---|---|---|
| Opening the app with no error, the 5 tabs and inner screens, nothing leaves the device, fits at 375px | `index.html`, `js/app.js` (`navigate`) | — | `smoke.spec.js` |
| Dates (ISO ↔ BR, adding days, local time zone) | `core.js`: `pad2`, `fmtDate`, `parseDate`, `todayISO`, `addDaysISO`, `fmtBR`, `dateParts`, `fmtDateTimeBR` | `core.test.js` (dates), `core-edge-cases.test.js` (empty format) | `treinar.spec.js` (today's date in the form), `historico.spec.js` (dates in the detail, in the progress and in Calendário), `mais.spec.js` ("Iniciar semana") |
| Flexible week (7-day window, goals, warning) | `core.js`: `defaultSettings`, `weekWindow`, `isValidWorkout` | `core.test.js`, `core-edge-cases.test.js` (`weekWindow` with no argument) | `inicio.spec.js`, `mais.spec.js` (saving goals and rest, "Iniciar semana") |
| Numbers with a comma (iPhone bug) | `core.js`: `parseLocalNumber`, `toNum`, `toNumOrNull`, `formatDecimal` | `core.test.js` (includes the `27,5` load regression) | `treinar.spec.js` (`27,5` load in Treinar) |
| Search without accents | `core.js`: `normalizeText` | `core.test.js` | `biblioteca.spec.js` (search without accents and case-insensitive), `fichas.spec.js` (sheet-editor search) |
| Escaping HTML (XSS from the database) | `core.js`: `esc` | `core.test.js`, `setsSummaryLines` | `fichas.spec.js` (a name with HTML appears as text), `dados.spec.js` (backup with code in the id) |
| Warm-up (reps/load/RIR) | `core.js`: `warmupHasData`, `warmupLine`, `previousWarmupFields` | `core.test.js`, `core-edge-cases.test.js` | `treinar.spec.js` (pre-filled and edited in Treinar) |
| Sets and grouping **by id** | `core.js`: `setLine`, `setsSummaryLines`, `groupSets`, `exerciseKey` | `core.test.js`, `core-edge-cases.test.js` (same name/different ids, warm-up only, record with no name) | `historico.spec.js` (detail: sets grouped by exercise, in order), `biblioteca.spec.js` (renaming keeps the history by id) |
| History per exercise (chart, PR, trend) | `core.js`: `workoutRecords`, `lastLoadsForExercise`, `lastWarmupForExercise`, `sessionsForExercise`, `bestSetForExercise`, `exerciseMatches` | `core.test.js`, `core-edge-cases.test.js` (renaming does not lose history; equal names do not mix; ordering), `form-and-progress.test.js` (records: first time and equal load do not count) | `historico.spec.js` (max load, workouts, trend, best set per day, history with sheet and warm-up), progress with no records |
| **Current** name of exercise and sheet (no frozen name) | `core.js`: `exerciseLabel`, `sheetLabel`, `exerciseTarget` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (renamed sheet in the list) |
| Renaming an exercise propagates (old sheets and history) | `core.js`: `renameInSheets`, `renameInWorkouts`, `linkSheetItemsToExercises` | `core.test.js`, `sample-data.test.js` (old fixture relinked) | `biblioteca.spec.js` (rename: sheets, saved workouts, detail, progress and Treinar) |
| "Last time" hint and repeating the sheet's last workout | `core.js`: `lastSessionForExercise`, `lastSessionLine`, `lastWorkoutForSheet`, `formFromWorkout` | `form-and-progress.test.js` (ignores the workout being edited, old `typeId`, blank RIR/note) | `treinar.spec.js` |
| Workout draft in progress | `core.js`: `draftHasContent` (saving/restoring in `app.js`) | `form-and-progress.test.js` | `treinar.spec.js` (save, reload, hidden page, cancel, another workout) |
| Rest timer | `core.js`: `restSecondsOf`, `fmtClock` | `form-and-progress.test.js` | `treinar.spec.js` (controlled page clock) |
| Short Início list and filter by sheet | `core.js`: `recentCutoff`, `visibleWorkoutCount`, `sheetFilterOptions` | `form-and-progress.test.js` (year turn, minimum number of workouts) | `historico.spec.js` ("Ver meses anteriores", "Mostrar só os recentes", filter by sheet) |
| Weekly progress (volume, workouts, cardio) | `core.js`: `workoutVolume`, `weeklyTotals` | `form-and-progress.test.js` (warm-up outside the volume, invalid workout) | `historico.spec.js` (Calendário: last 8 weeks, volume, goal workouts and cardio) |
| Workout text to send to the teacher (without the teacher's note) | `core.js`: `workoutAsText` | `core.test.js` (includes: without the teacher's note), `core-edge-cases.test.js` (current name, set with no number, empty workout) | `treinar.spec.js` (export from Treinar; the teacher's note stays out of the text but stays in Treinar and is saved in the sets), `historico.spec.js` (Compartilhar; without the device menu it copies; copy by selection when the clipboard is blocked) |
| Sheets: create/edit/delete, items, migration by name | `core.js`: `normalizeSheet*`, `linkSheetItemsToExercises` | `core.test.js`, `core-edge-cases.test.js` | `fichas.spec.js` (create with Biblioteca, catalog and a new exercise; sets, reps, note, order; edit; rename; repeated name; delete), sheet with no exercises |
| Import sheet as JSON (`FICHA-JSON.md` contract, similar-exercise suggestion, text for the AI) | `core.js`: `parseSheetImportText`, `parseSheetImport`, `suggestExercises`, `exerciseNamesText` | `core.test.js` (```json fence, broken JSON, accepted formats, reps, errors, suggestion order, names without repetition) | `fichas.spec.js` (Create with AI: text for the AI and copy, invalid JSON, review with a similar suggestion, import, repeated name becomes "(importada)") |
| Import old workouts + recreated sheets (`TREINO-JSON.md` contract, sheets reused by name, repeated workouts skipped) | `core.js`: `parseHistoryImportText`, `parseHistoryImport`, `sheetByName`, `splitImportedSheets`, `importedWorkout`, `workoutFingerprint`, `splitImportedWorkouts`, `historyExerciseNames`, `sheetNamesText`, `historyImportSummaryHtml`, `historyImportToast` | `history-import.test.js` (review summary and final warning, contract example, BR/ISO/future dates, numbers with a comma, errors with the exact place, last-time load from the recreated sheet, importing again does not duplicate), `features.test.js` (card in Mais, window, precache, review/import wired, sheets saved before the workouts, exercise review shared with Create with AI) | `mais.spec.js` (text for the AI with sheets and exercises, invalid JSON, review, import with a recreated sheet and last-time load, importing again does not duplicate) |
| User Biblioteca × catalog | `core.js`: `isUserExercise`, `libraryExercises`, `fixLibrarySources` | `core.test.js`, `core-edge-cases.test.js` | `biblioteca.spec.js` (list with only the person's exercises and the sheets that use them, filter by group, create with catalog search, delete) |
| Backup: file name, status and reminder | `core.js`: `backupFileName`, `backupStatus` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (reminder on Início) |
| Backup: export/share (a single file) | `core.js`: `backupAction`, `backupSharePayload`, `isBackupPayload`, `backupHint` | `core.test.js` (payload without `text`/`title`; a click event is not a backup) | `dados.spec.js` (download on the computer; on the phone, a single `.json` for the share menu) |
| Backup: import and compatibility between versions | `core.js`: `normalizeBackup`, `normalizeWorkout`, `normalizeSet`, `normalizeWarmup`, `normalizeSettings` | `core.test.js` + `tests/fixtures/backup-v1.json`, `backup-v2-sheets.json` | `dados.spec.js` (each backup from `tests/fixtures/` imported through the screen: workouts, sheets, Biblioteca, colinha and goals; round trip export → erase → import again without losing anything; Undo; a file that is not a backup erases nothing) |
| Sample data (3 sheets, 12 workouts) | `core.js`: `materializeSampleData` + `data/sample-data.json` | `sample-data.test.js` (structure, referential integrity, load progression, normalization) | `smoke.spec.js` (load through the Mais screen; Início and Calendário with data), `dados.spec.js` (they replace the current data; Undo brings the previous ones back), `dados.spec.js` (answering "Não" changes nothing; the sample file imports through the screen with dates from today) |
| Embedded catalog (unique, contiguous, stable ids) | `data/exercises.json` | `core.test.js` (id locks) + `check.ps1` | `smoke.spec.js` (opens offline with the catalog), `treinar.spec.js` and `fichas.spec.js` (catalog exercise) |
| Browser module registration (globals) | `js/core.js` (UMD) | `module.test.js` (runs the core in a browser scope) | `smoke.spec.js` (opens with no error: the `core.js` functions exist for `app.js`) |
| Old database (pre-id era) survives init | `core.js`: `fixLibrarySources`, `linkSheetItemsToExercises`, `historyTarget`, `normalizeBackup` | `old-db.test.js` (no set/load/warm-up/item is lost; history by stored name) | `biblioteca.spec.js` (records without ids saved on the device: Biblioteca repaired, sheet linked, history by name) |
| PWA: consistent version, precache, offline | `index.html`, `sw.js`, `manifest.webmanifest` | `check.ps1` (13 checks) | `smoke.spec.js` (footer version × files × cache; opens offline with the catalog), `dados.spec.js` (new service worker version takes over and deletes the old cache; "Atualizar app"; the draft in progress survives both) |
| Export/import/erase inside the app (screens) | `js/app.js` | `check.ps1` (ids and handlers) + `core.js` logic | `dados.spec.js` (export, import, Apagar dados only after ticking the confirmation, Cancelar does not erase, erasing takes everything including the draft), cancelled or failed sharing warns and does not count as a backup; the Importar button opens the file picker (`dados.spec.js`) |
| Sheet-import screens (paste, review, Revisar → Importar button), deactivating/reactivating a sheet, Create with AI modal (text for the AI + pasting the answer), Debug card | `js/app.js` | `check.ps1` (ids and handlers) + `core.js` logic (`parseSheetImportText`, `suggestExercises`, `exerciseNamesText`, `normalizeSheet` keeps `active: false`) | `fichas.spec.js` (Create with AI, deactivate/reactivate), `mais.spec.js` (Debug card) |
| Answering **Não** in the other screens' confirmations changes nothing: deleting a workout from the detail, an exercise, a sheet and a colinha; importing a backup; Undo; sample data; "Atualizar app" | `js/app.js` | `confirm-no.test.js` (every question has a "Não" test) | `historico.spec.js`, `biblioteca.spec.js`, `fichas.spec.js`, `mais.spec.js`, `dados.spec.js` (answering "Não") |
| Import/undo/sample data without risk of losing everything (erases and writes in a single transaction) | `db.js`: `dbReplaceAll` (used by `restoreAll` in `app.js`) | `db.test.js` (fake IndexedDB: one transaction, `clear` before `put`, `abort` on an invalid record) | `dados.spec.js` (Undo; a file that is not a backup erases nothing; sample data and Undo) |
| Calendário: switching month (including on days 29–31) | `core.js`: `shiftMonth` | `core-edge-cases.test.js` (31/Oct ‹ goes to September; 31/Jan › goes to February; year turn) | `historico.spec.js` (switching month; 31 October and 31 January, both ways and at the year turn) |
| PR badge in the exercise progress (disappears when there is no load) | `core.js`: `maxBestLoad` | `core-edge-cases.test.js` (bodyweight = 0, no "PR 1 kg"; max load; load < 1 kg) | `historico.spec.js` (max load; bodyweight with no badge and no 1RM) |
| Imported backup does not trust the file (ids and dates) | `core.js`: `normalizeBackup` (`hasSafeId`), `normalizeWorkout`, `normalizeSettings` | `core-edge-cases.test.js` (id with quotes/tags is discarded; old id formats kept; invalid date becomes "no date"; invalid week start; idempotence) | `dados.spec.js` (id with code discarded, invalid date becomes "Sem data", invalid week) |
| Service worker: `?v=N` comes from the cache first (opens fast with a weak signal); the rest is network first | `sw.js` | `sw.test.js` (fake cache and network: production × localhost, offline, new version = new URL, what is not intercepted) | `smoke.spec.js` (opens offline), `dados.spec.js` (new service worker version takes over) |
| Starting the next week (skips missed weeks at once) | `core.js`: `nextWeekAnchor` | `core-edge-cases.test.js` (1 week, 3 weeks off, year turn, same weekday) | `inicio.spec.js` |
| Treinar form: set row (wide load, number as text) | `core.js`: `setRowHtml`, `setHeaderHtml` | `form-and-progress.test.js` (columns 1-2-3-2-4, "102,5" fits, `setField` handlers, keyboards, escape) | `treinar.spec.js` |
| Removing an exercise from the workout in progress (asks if something is filled in) | `core.js`: `groupHasData` (question in `app.js`: `removeFormExercise`) | `form-and-progress.test.js` (set/warm-up filled in, RIR 0, blank, confirmation before `splice`) | `treinar.spec.js` |
| Load with a comma also in the summary, history and exported text | `core.js`: `setLine`, `warmupLine`, `setsSummaryLines`, `workoutAsText` (`useComma` parameter) | `core-edge-cases.test.js` (comma when requested; without the parameter the old format does not change) | `historico.spec.js` (detail and progress with 47,5 and 42,5), `treinar.spec.js` (exported text) |
| Open workout survives a page reload (`#/detail/<id>`) | `core.js`: `parseRoute` (used by `navigate` in `app.js`) | `core-edge-cases.test.js` (id in the address, old addresses without id, empty address, app always navigates with id) | `historico.spec.js` (reload in the detail; workout that no longer exists) |
| Do not repeat the same exercise in a workout or in a sheet | `core.js`: `hasExercise` (warnings in `app.js`: `addExerciseToForm`, `addSheetExercise`) | `core-edge-cases.test.js` (by id, catalog id as text, sheet item with `name`, old record with no id; proof of the grouping that motivated the block) | `fichas.spec.js` (warning in the sheet editor), `treinar.spec.js` (warning in Treinar) |
| Sheet: at most 20 sets per exercise (editor, import and backup) | `core.js`: `normalizeSheetItem` (also used by `saveSheetEditor` in `app.js`) | `core-edge-cases.test.js` (500 becomes 20, long reps list, format v2, normal sheets untouched) | `fichas.spec.js` (500 sets in the editor become 20) |
| Two workouts on the same day: the newest comes first | `core.js`: `byDateDesc` (used in every date sort) | `core-edge-cases.test.js` (any input order, no `createdAt`, "last time"/loads/warm-up of the newest workout) | `historico.spec.js` (Início and Calendário open the newest) |
| Exercise search (workout picker, sheet and form) | `core.js`: `pickerHtml` (the three `render*Results` in `app.js`) | `picker.test.js` (Biblioteca × catalog, accent-insensitive search, Criar, limits, escape, handlers exist and accept id as text, dead code did not come back) | `treinar.spec.js` (Treinar picker: Biblioteca, catalog, Criar) |
| Summary on the Início card (exercises · volume · cardio · records) | `core.js`: `workoutSummary`, `fmtThousands` (+ `workoutRecords`) | `features.test.js` (full line, zeroed parts, singular, sample data, card uses the summary) | `treinar.spec.js` (saving goes to Início with the summary), `historico.spec.js` (summary and records of each row) |
| Starting the workout in one tap ("Treinar: <ficha>" button on Início) | `core.js`: `nextSheet` (button and sheet load in `app.js`) | `features.test.js` (next sheet alphabetically, back to the start, deactivated/deleted sheet, no sheets, v1 data) | `inicio.spec.js`, `treinar.spec.js` |
| Removing the last set of an exercise in Treinar | `core.js`: `setHasData` ("− série" button in `app.js`: `removeFormSet`) | `features.test.js` (blank × filled set, never removes the only one, asks first) | `treinar.spec.js` |
| Marking the set as done starts the rest (button on the set number) | `core.js`: `setRowHtml` (action in `app.js`: `toggleSetDone`) | `features.test.js` (button, done state, accessibility, load stays wide, `done` is not saved in the workout, no sound/vibration) | `treinar.spec.js` |
| Calendário: tapping the day opens that day's workout | `core.js`: `workoutsByDate` (link in `app.js`: `renderCalendar`) | `features.test.js` (groups by day, newest first, no date stays out, `#/detail/<id>` link) | `historico.spec.js` (opens the workout; with two on the day, the newest) |
| Estimated 1RM in the exercise progress (Epley) | `core.js`: `estimate1RM`, `best1RMForExercise` | `features.test.js` (formula, 1 rep, no load/reps, more reps at the same load = progress, best set of the exercise) | `historico.spec.js` (1RM of the exercise and of each day; no load, no 1RM) |
| Success warnings disappear on their own (toast); errors and questions keep blocking | `index.html`: `#appToast`; `app.js`: `showToast` | `features.test.js` (5 success messages became a toast, errors stay `alert`, plain text) | `mais.spec.js` ("Metas salvas." appears and disappears on its own), `dados.spec.js` (imported backup), `fichas.spec.js` ("Texto copiado!") |
| 16px fields on the phone (no iPhone zoom when tapping) | `css/styles.css`: 16px rule under `max-width: 767.98px` (no more specific rule changes the field size) | `check.ps1` (anti-zoom: the rule exists) | `smoke.spec.js` (computed size of every field visible in Treinar with a sheet, sheet editor, Create with AI, Biblioteca, Mais and Import old workouts), `treinar.spec.js` (set note) |
| 44px touch area on icon-only buttons | `css/styles.css`: `.btn-sm[aria-label]` | `features.test.js` (rule present; every icon button has `aria-label`) | `fichas.spec.js` (sheet icon buttons are 44px or more) |
| Debug card visible at the end of Mais, with no collapse (v74), with persistent storage | `index.html`; `app.js`: `requestPersistentStorage`, `renderStorageInfo` | `features.test.js` (last card, contains update/erase/sample/space used, backup stays before it) | `mais.spec.js` (visible at the end of Mais; asks for persistent storage on open: protected or not protected) |
| Mais → Install the app (browser button, instruction for iPhone and menu, "already installed") | `core.js`: `installHint` (event in `app.js`: `renderInstall`, `installApp`) | `features.test.js` (4 text cases, card between Data and Debug, `beforeinstallprompt` stored, button wired) | `mais.spec.js` (browser menu, Instalar button with the browser prompt, iPhone, already installed) |
| Colinha (create, edit, delete) | `app.js`: `renderColinhaList`, `saveColinha`, `deleteColinha` | `check.ps1` (ids and handlers) | `mais.spec.js` (create, edit, delete, empty is not saved) |
| Warm-up fields with a name for screen readers | `app.js`: `renderFormSets` | `features.test.js` (reps, weight and RIR with `aria-label`) | `treinar.spec.js` (fields found by name) |

## Treinar (critical screen): every behaviour

One browser test per behaviour (issue #5). The draft is checked in the device's IndexedDB.
Starting point: `tests/e2e/fixtures/treinar-backup.json`,
imported through the Mais screen. The rest uses Playwright's controlled clock (`page.clock`), with no fixed waits.

| Behaviour | Where it lives | Tests | Browser tests |
|---|---|---|---|
| Opening from the Treinar tab with no draft: empty form, today's date | `js/app.js` (Treinar) | — | `treinar.spec.js`: from the Treinar tab with no draft |
| Opening from Início's "Treinar: <ficha>" shortcut: sheet already loaded | `js/app.js` (Treinar) | — | `treinar.spec.js`: from Início's "Treinar: <ficha>" shortcut |
| Deactivated sheets do not appear in the selector | `js/app.js` (Treinar) | — | `treinar.spec.js`: deactivated sheets do not appear in the selector |
| Choosing the sheet loads exercises and sets (reps of each set from the sheet, load from the last workout) | `js/app.js` (Treinar) | — | `treinar.spec.js`: choosing the sheet loads exercises and sets |
| "Last time" hint of the chosen sheet | `js/app.js` (Treinar) | — | `treinar.spec.js`: "last time" hint of the chosen sheet |
| Warm-up pre-filled with reps and weight from the previous workout (RIR blank) | `js/app.js` (Treinar) | — | `treinar.spec.js`: warm-up pre-filled with reps and weight |
| "Repetir o último treino desta ficha" fills exercises, reps and loads | `js/app.js` (Treinar) | — | `treinar.spec.js`: "Repetir o último treino desta ficha" fills exercises, reps and loads |
| Switching sheet halfway replaces the exercises | `js/app.js` (Treinar) | — | `treinar.spec.js`: switching sheet halfway replaces the exercises |
| Editing reps, load, RIR and the set note | `js/app.js` (Treinar) | — | `treinar.spec.js`: edit reps, load, RIR and note |
| Load with a comma (`27,5`) stays 27,5 (iPhone regression) | `js/app.js` (Treinar) | — | `treinar.spec.js`: load with a comma (27,5) stays 27,5 |
| Set note with 16px on the phone (the iPhone does not zoom when tapping) | `css/styles.css` | — | `treinar.spec.js`: set observation field is at least 16px on the phone |
| Adding a set | `js/app.js` (Treinar) | — | `treinar.spec.js`: add a set |
| Removing the last set (one always remains) | `js/app.js` (Treinar) | — | `treinar.spec.js`: remove the last set |
| Tapping the set number marks it as done and starts the rest; tapping again only unmarks it | `js/app.js` (Treinar) | — | `treinar.spec.js`: tapping the set number marks it as done and starts the rest |
| Progress counter counts only the sets done | `js/app.js` (Treinar) | — | `treinar.spec.js`: progress counter counts only the sets done |
| Rest starts when the set is marked, with the time from Ajustes | `js/app.js` (Treinar) | — | `treinar.spec.js`: starts when the set is marked, with the time from Ajustes |
| Rest: add-time button (+15s) | `js/app.js` (Treinar) | — | `treinar.spec.js`: add-time button (+15s) |
| Rest: stop | `js/app.js` (Treinar) | — | `treinar.spec.js`: stop |
| End of the rest only changes colour: no sound, no vibration, no flashing | `js/app.js` (Treinar) | — | `treinar.spec.js`: at the end it only changes colour |
| Rest stays correct after the app goes to the background (counts by the end time) | `js/app.js` (Treinar) | — | `treinar.spec.js`: stays correct after the app goes to the background |
| Adding an exercise from Biblioteca, from the catalog and by creating a new one | `js/app.js` (Treinar) | — | `treinar.spec.js`: add an exercise from Biblioteca / from the catalog / by creating a new one |
| Removing an exercise | `js/app.js` (Treinar) | — | `treinar.spec.js`: remove an exercise |
| Adding an exercise that is already in the workout warns and does not duplicate | `js/app.js` (Treinar) | — | `treinar.spec.js`: the same exercise does not enter the workout twice |
| Answering **Não** keeps what was filled in: switching sheet, "Repetir o último treino", removing a filled exercise, Cancelar | `js/app.js` (Treinar) | — | `treinar.spec.js`: answering "Não" keeps what was filled in (4 tests) |
| Answering **Não** to removing the last filled set keeps the set | `js/app.js` (Treinar) | — | `treinar.spec.js`: remove the last filled-in set (answering "Não") |
| Answering **Não** to deleting a saved workout (in the edit) deletes nothing | `js/app.js` (Treinar) | — | `treinar.spec.js`: delete the workout (answering "Não") |
| Warm-up per exercise (reps, weight, RIR) | `js/app.js` (Treinar) | — | `treinar.spec.js`: warm-up per exercise |
| Cardio and notes | `js/app.js` (Treinar) | — | `treinar.spec.js`: cardio and notes |
| Every change saves the draft; reloading the page mid-workout continues where it stopped | `js/app.js` (Treinar) | — | `treinar.spec.js`: every change saves the draft |
| Leaving the app (hidden page) saves the draft right away | `js/app.js` (Treinar) | — | `treinar.spec.js`: leaving the app (hidden page) saves the draft right away |
| **Cancelar** discards the changes and the draft | `js/app.js` (Treinar) | — | `treinar.spec.js`: Cancelar discards the changes and the draft |
| **Cancelar** while editing a saved workout goes back to its detail, changing nothing | `js/app.js` (Treinar) | — | `treinar.spec.js`: Cancelar while editing a saved workout |
| Erasing everything that was typed erases the draft | `js/app.js` (Treinar) | — | `treinar.spec.js`: erasing everything that was typed |
| Saving works in a browser without `crypto.randomUUID` | `js/app.js` (Treinar) | — | `treinar.spec.js`: saves the workout even without crypto.randomUUID |
| Draft of **another** workout: opening a different workout does not mix the data (continue or discard) | `js/app.js` (Treinar) | — | `treinar.spec.js`: draft of another workout (2 tests) |
| An invalid workout is not saved and shows the reason | `js/app.js` (Treinar) | — | `treinar.spec.js`: an invalid workout is not saved |
| Saving goes to Início with the summary; the workout appears in Calendário and in each exercise's history | `js/app.js` (Treinar) | — | `treinar.spec.js`: saving goes to Início with the summary |
| "Recorde" line when it beats the previous best load | `js/app.js` (Treinar) | — | `treinar.spec.js`: "Recorde" line when it beats the previous best load |
| After saving, the draft disappears | `js/app.js` (Treinar) | — | `treinar.spec.js`: after saving, the draft disappears |
| Existing workout: open from the detail, edit and save (without duplicating) | `js/app.js` (Treinar) | — | `treinar.spec.js`: open from the detail, edit and save |
| Existing workout: delete | `js/app.js` (Treinar) | — | `treinar.spec.js`: delete the workout |
| Existing workout: export as text (WhatsApp format, only the date at the top) | `js/app.js` (Treinar) | — | `treinar.spec.js`: export as text |

## Início (critical screen): every behaviour

One browser test per behaviour (issue #19). Starting point: `tests/e2e/fixtures/inicio-backup.json`,
imported through the Mais screen, with the page clock fixed at 20/05/2026 (`page.clock.setFixedTime`). Variations
(no backup, smaller goal, different last sheet) are built in the test itself with `readFixture`.

| Behaviour | Where it lives | Tests | Browser tests |
|---|---|---|---|
| First use with no data: correct empty state, no console error | `js/app.js` (Início) | — | `inicio.spec.js`: first use with no data |
| Draft banner appears with a workout in progress (draft description) | `js/app.js` (Início) | — | `inicio.spec.js`: appears with a workout in progress |
| Draft banner: **Continuar** opens Treinar with the draft | `js/app.js` (Início) | — | `inicio.spec.js`: Continuar opens Treinar with the draft |
| Draft banner: **Descartar** removes the draft and the banner | `js/app.js` (Início) | — | `inicio.spec.js`: Descartar removes the draft and the banner |
| Draft banner: answering **Não** to Descartar keeps the draft and the banner | `js/app.js` (Início) | — | `inicio.spec.js`: answering "Não" to Descartar |
| Draft banner describes the editing of a saved workout ("Edição do treino de <data>") | `js/app.js` (Início) | — | `inicio.spec.js`: describes the editing of a saved workout |
| Goal progress: workouts (x/goal) and cardio minutes (x/goal), with the bars | `js/app.js` (Início) | — | `inicio.spec.js`: goal progress |
| Goal reached: "Meta batida" badge and full bars, without going past 100% | `js/app.js` (Início) | — | `inicio.spec.js`: goal reached |
| A workout dated outside the week window does not count in the current week (and is not lost) | `js/app.js` (Início) | — | `inicio.spec.js`: a workout dated outside the week window |
| **Week-over** banner after 7 days, with the final result | `js/app.js` (Início) | — | `inicio.spec.js`: week-over banner after 7 days |
| Confirming the banner advances to the next window (and is saved) | `js/app.js` (Início) | — | `inicio.spec.js`: confirming the banner advances |
| "Treinar: <ficha>" suggests the right next sheet (by the routine) and opens Treinar with it loaded | `js/app.js` (Início) | — | `inicio.spec.js`: "Treinar: <ficha>" suggests the next sheet in the routine |
| Treinar shortcut disappears while a draft exists | `js/app.js` (Início) | — | `inicio.spec.js`: disappears while a draft exists |
| Deactivated sheets are not suggested in the shortcut | `js/app.js` (Início) | — | `inicio.spec.js`: deactivated sheets are not suggested |
| Backup reminder appears when there has never been a backup | `js/app.js` (Início) | — | `inicio.spec.js`: appears when there has never been a backup |
| Backup reminder appears when the last backup is old; disappears when it is up to date | `js/app.js` (Início) | — | `inicio.spec.js`: appears when the last backup is old |
| Backup reminder disappears after making a backup | `js/app.js` (Início) | — | `inicio.spec.js`: disappears after making a backup |
| Backup reminder: ✕ "Lembrar depois" hides it | `js/app.js` (Início) | — | `inicio.spec.js`: "Lembrar depois" (✕) hides the reminder |
| Recent workouts: date and sheet name, newest to oldest | `js/app.js` (Início) | — | `inicio.spec.js`: list with date and sheet name |
| Tapping a workout in the list opens the detail | `js/app.js` (Início) | — | `inicio.spec.js`: tapping a workout opens the detail |
| Renamed sheet appears with the new name in the list | `js/app.js` (Início) | — | `inicio.spec.js`: a renamed sheet appears with the new name |
| The row's share button opens the workout text | `js/app.js` (Início) | — | `inicio.spec.js`: the row's share button opens the workout text |

## Temporary refactor tests

**Temporary** (issue #39, `documentation/REFACTOR.md` section 4, item 6): while the refactor lasts, the rule
for the critical screens applies to every screen and `js/app.js` line coverage stays at 100%. The files live
in `tests/e2e/temporarios/` and run in CI like the others until #16; then #40 turns them off without deleting them. Failures
(device with no space, blocked cache, broken `canShare`) are simulated in the browser (IndexedDB, Cache Storage),
without touching the app functions.

| Behaviour | Screen | Browser tests |
|---|---|---|
| Saving a sheet with no name warns and does not close the editor | Fichas | `temporarios/fichas.spec.js` |
| Moving an exercise down in the editor; Up on the first and Down on the last do nothing | Fichas | `temporarios/fichas.spec.js` |
| Decreasing the sets removes the reps fields that are left over and does not save extra reps | Fichas | `temporarios/fichas.spec.js` |
| Closing the sheet editor without saving saves nothing | Fichas | `temporarios/fichas.spec.js` |
| Removing every exercise from the sheet shows how to add | Fichas | `temporarios/fichas.spec.js` |
| "Adicionar exercício" opens and closes the search; opening it again starts empty | Fichas | `temporarios/fichas.spec.js` |
| Editing a deactivated sheet keeps it deactivated, even with the name of an active one | Fichas | `temporarios/fichas.spec.js` |
| Old sheet with no reps per set shows only the number of sets | Fichas | `temporarios/fichas.spec.js` |
| Deactivated sheets come after the active ones, with the Reativar button | Fichas | `temporarios/fichas.spec.js` |
| Editing group and correction without renaming keeps the name and the history | Biblioteca | `temporarios/biblioteca.spec.js` |
| The teacher's correction becomes the note when putting the exercise in a sheet | Biblioteca | `temporarios/biblioteca.spec.js` |
| Closing the exercise form without saving creates nothing | Biblioteca | `temporarios/biblioteca.spec.js` |
| Search and group filter apply together | Biblioteca | `temporarios/biblioteca.spec.js` |
| In the form, the catalog button opens and closes the search | Biblioteca | `temporarios/biblioteca.spec.js` |
| Cardio-only workout: the detail warns that there are no exercises recorded | Workout detail | `temporarios/historico.spec.js` |
| "Editar" in the detail opens the workout in Treinar | Workout detail | `temporarios/historico.spec.js` |
| "Voltar" in the progress goes back to the screen it came from | Exercise progress | `temporarios/historico.spec.js` |
| A zero workout goal becomes 1; empty cardio becomes 0 | Mais | `temporarios/mais.spec.js` |
| Changing the week start date changes Início's week | Mais | `temporarios/mais.spec.js` |
| Colinha: only the title is enough; only the content is enough; spaces only is refused | Mais | `temporarios/mais.spec.js` |
| Colinhas in creation order; editing does not change the order | Mais | `temporarios/mais.spec.js` |
| Import old workouts: "Copiar texto" copies the text for the AI; Cancelar imports nothing | Mais | `temporarios/mais.spec.js` |
| Undo does not appear before importing and disappears after reloading the page | Data | `temporarios/dados.spec.js` |
| Workout of a deactivated sheet appears as "(inativa)" in the edit | Treinar | `temporarios/treinar.spec.js` |
| Workout of a deleted sheet appears as "(excluída)" and Treinar explains it | Treinar | `temporarios/treinar.spec.js` |
| Sheet with no exercises: Treinar explains where to add them | Treinar | `temporarios/treinar.spec.js` |
| With no sheet, Treinar points to the Fichas tab | Treinar | `temporarios/treinar.spec.js` |
| A draft that cannot be saved on the device stays in memory; a delete that fails still clears the screen | Treinar | `temporarios/falhas.spec.js` |
| An old draft with no save time appears without "salvo às" | Início | `temporarios/falhas.spec.js` |
| "Criar" exercise that cannot save warns the error (Treinar and Biblioteca form) | Treinar, Biblioteca | `temporarios/falhas.spec.js` |
| `canShare` that throws: Exportar downloads the file as on the computer | Mais | `temporarios/falhas.spec.js` |
| "Atualizar app" reloads even if clearing the cache fails | Mais | `temporarios/falhas.spec.js` |
| An unexpected error in an action shows the "Erro:" warning and the app keeps working | Treinar | `temporarios/falhas.spec.js` |

## Known limits

- **`js/app.js` coverage** (`documentation/REFACTOR.md`, section 4). With the temporary tests (#39), 100% of the
  lines. Without them (after #40), the unexpected-error warnings stay out of the count (`guard`, failure to create an
  exercise, IndexedDB failure when saving/deleting the draft) and sheet items with no reps list. "Atualizar app"
  stays in the count: the test declares `RECARGA_DO_APP` (`tests/e2e/helpers.js`) and coverage takes the snapshot at a
  breakpoint just before the app's `location.reload()` (the debugger only turns on in those tests: with it on, reloading
  offline from the service worker cache takes the page down).
- **`core.js` module wrapper** (Node × browser detection) stays out of the coverage goal: each
  environment runs one side. The browser side is tested in `module.test.js` (loads the core in a
  scope without `module.exports` and checks that the functions become globals).
