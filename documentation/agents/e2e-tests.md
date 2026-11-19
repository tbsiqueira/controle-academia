# Writing browser tests (Playwright)

Setup and the commands to run them are in [workflow.md](workflow.md#browser-tests-playwright).

- Tests live in `tests/e2e/*.spec.js`; `node --test tests/` never picks them up.
- **Temporary tests** (`tests/e2e/temporarios/`, issue #39): during the refactor every behavior of every screen has
  its own test and `js/app.js` line coverage is 100%. They stay on and run like the others. Turning them off
  (`testIgnore` in `playwright.config.js`, without deleting them) is issue #40, which waits until #16 is closed;
  don't do it in another issue. Shared helpers in `temporarios/util.js`:
  `putRecords` (old or odd data the UI can't create), `failWritesTo`/`failDeletesIn` (IndexedDB failures simulated
  in the browser, not by patching app functions, so they survive the move to modules), `collectAlerts`.
  Cite them in `tests/CHECKLIST.md` by path (`temporarios/fichas.spec.js`).
- A test where the app itself reloads the page (`location.reload`, "Atualizar app") declares
  `{ annotation: RECARGA_DO_APP }` so its coverage is counted (snapshot at a breakpoint before the reload).
- They start their own server (`tests/e2e/server.js`, port 4173), so `serve.ps1` on 8080 can keep running.
- Same conditions everywhere: Chromium, 375px phone viewport, light theme, pt-BR, São Paulo time zone. Each test
  gets a fresh browser context (empty IndexedDB, no service worker).
- Use `test`/`expect` from `tests/e2e/helpers.js`: any console error or uncaught exception fails the test, and
  `confirm()` answers yes. Helpers: `freshApp`, `withSampleData`, `withBackup(page, 'file.json')` (imports a
  backup from `tests/e2e/fixtures/` through Mais → Importar, for an exact starting state; also takes an absolute path,
  e.g. the old backups in `tests/fixtures/`, or an object, e.g. a `readFixture('file.json')` copy changed in the
  test), `storedDraft(page)` (the draft saved in IndexedDB), `storedRecords(page, 'workouts')` (every record of a
  store), `goTo(page, 'Treinar')`, `answerConfirm(page, false)` (answer "Não" to every `confirm()` from now on and
  return a reader for the questions asked; every confirmation needs a test for its "Não" answer too,
  asserting the question text; `tests/confirm-no.test.js` fails when a `confirm()` in `app.js` has none).
- App update (`dados.spec.js`): Playwright can't intercept the service worker script, so the test server serves
  `sw.js` as version N when the context has the cookie `e2e-sw-version=N` (`context.addCookies`).
- No fixed waits (`waitForTimeout`): wait for what the user would see. For timers (rest), install `page.clock` before
  opening the app and move time with `runFor`/`setSystemTime` (see `treinar.spec.js`). For a fixed "today" (week,
  backup age), `page.clock.setFixedTime` before opening the app (see `inicio.spec.js`).
- In CI a failed run uploads the report and traces as the `relatorio-testes-navegador` artifact.
