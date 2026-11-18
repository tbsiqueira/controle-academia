# Workflow

## Commands (Windows, run from the repo root)

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1   # http://localhost:8080 (often already running)
node --test tests/                                      # unit tests (no install needed)
npm run test:e2e                                        # browser tests (Playwright), see below
node tools/coverage-gate.js                             # tests + 100% coverage of js/core.js
powershell -ExecutionPolicy Bypass -File .\check.ps1   # static checks (must print "Tudo certo.")
powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1   # only after editing sample data content
```

Python is not installed; use Node for scripted edits. Node 26 locally and in CI.

CI: `tests.yml` runs `node --check`, the coverage gate, `check.ps1` and the browser tests on every PR and push to
`main`; on PRs its `Versão` job also fails when `index.html`, `css/` or `js/` changed without a version bump (or the
version is already tagged). These four jobs are the required checks of the `main` ruleset.
`deploy.yml` runs on every push to `main` (= a merged PR): if tag `vN` for the current version doesn't exist yet,
it runs the checks, publishes to GitHub Pages and then creates and pushes tag `vN`. Otherwise it publishes nothing.

## Browser tests (Playwright)

`package.json` exists only for dev tools; the app never loads anything from it. One-time setup:

```powershell
npm ci                              # Playwright, from package-lock.json, into node_modules/ (git-ignored)
npx playwright install chromium     # the browser, ~150 MB, into %LOCALAPPDATA%\ms-playwright
```

```powershell
npm run test:e2e          # all browser tests, headless, same settings as CI
npm run test:e2e:ui       # Playwright UI: pick a test, watch each step
npm run test:e2e:report   # HTML report of the last run (traces of failures)
```

- Tests live in `tests/e2e/*.spec.js`; `node --test tests/` never picks them up.
- **Temporary tests** (`tests/e2e/temporarios/`, issue #39): during the refactor every behavior of every screen has
  its own test and `js/app.js` line coverage is 100%. They run like the others until #16; #40 turns them off
  without deleting them (`testIgnore` in `playwright.config.js`). Shared helpers in `temporarios/util.js`:
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
- Every row of `tests/CHECKLIST.md` names at least one browser test (`tests/checklist.test.js` fails on "—" or on a
  spec file that doesn't exist). A new feature gets a row and a browser test.
- Coverage ratchet: each test records which lines of `js/app.js` ran. After `npm run test:e2e`, run
  `npm run test:e2e:coverage` (number + uncovered functions). CI fails if it drops below the `main` value in
  `tests/e2e/coverage-baseline.json`, or if it rose and the PR didn't run `node tools/e2e-coverage.js --update` and
  commit the file. Details in `tools/README.md`.

## Refactor in progress

The code is being reorganised in phases (browser tests → ES modules → JSDoc types), one GitHub issue per PR.
Before picking up a refactor issue, read [REFACTOR.md](../REFACTOR.md): refactor PRs are behaviour-neutral and
never mix in features or fixes. Tracking issue: #2.
**Treinar and Início are critical screens** with a browser test per behaviour (`treinar.spec.js`, `inicio.spec.js`): every change to them
keeps those tests green and adds a test for each behaviour it adds or changes.

## Checklist for every change

1. **Logic in `core.js`, with a test** in `tests/` (coverage must stay at 100%; no unreachable fallbacks).
2. **Data shape changed?** Old backups (`tests/fixtures/`) and old databases (`tests/old-db.test.js`) must still
   load without losing anything. Never require a DB version bump for a new field: put it on an existing record.
3. **New or removed feature** → update its row in `tests/CHECKLIST.md`; user-visible → update `documentation/MANUAL.md`
   (and `README.md` / `documentation/PLANO.md` if it touches the data model or a requirement).
4. **Touched `index.html`, `css/` or `js/`** → bump the version `N` → `N+1` in all of these places:
   - `index.html`: every `?v=N` and `<span id="appVersion">vN</span>`
   - `sw.js`: `CACHE_NAME = 'meu-treino-vN'` and every `?v=N` in `ASSETS`
   Without the bump, installed phones keep the old cached files.
5. **Removing or moving code?** Grep every name you delete in `js/`, `index.html`, `tests/` and the docs. Large
   splices in `app.js` have swallowed neighbouring functions before (see history.md, v43).
6. Run the tests and `check.ps1`. Report failures as they are; don't claim done with red checks.
7. For visible changes, check it in the browser at phone width (375px), light theme.

## DeepSeek reviewer setup

The REVIEWER in [roles.md](roles.md) is Claude Code talking to DeepSeek's Anthropic-compatible API. One-time setup
per machine, **outside the repo** (it holds the API key; never commit it):

`~/.claude/providers/deepseek.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<DeepSeek API key>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-flash[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-flash[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-flash",
    "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-flash"
  }
}
```

`claude --settings <that file>` loads it for one run only; plain `claude` stays on Anthropic. Inside the reviewer,
`/status` should show the DeepSeek address. Model names (DeepSeek pricing page, Nov 2026): `deepseek-flash`
(current Flash; the old `deepseek-v4-flash` still works but is retired) and `deepseek-v4-pro` (stronger, no image
input). `[1m]` is not part of the name: it tells Claude Code the context window is 1M tokens, as in DeepSeek's
guide. The reviewer uses `deepseek-flash[1m]` for now; to try Pro, change `--model` in roles.md section 6 and the
two `DEFAULT_*_MODEL` lines above. Reference:
https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code

## Testing in the browser pane

The Claude desktop browser pane makes `confirm()` return `false`, so confirm-guarded buttons ("Carregar dados de
exemplo", "Atualizar app", deleting a set with data…) look broken there. Stub it first
(`window.confirm = () => true`) or open http://localhost:8080 in the user's real browser.
On localhost the service worker doesn't hold stale files, so edits show without a version bump.

## Git

- Commit messages: Conventional prefix + short **Portuguese** summary without accents, version in parentheses
  when bumped, e.g. `feat: tocar num dia do calendario abre o treino (v58)`. Prefixes in use: `feat`, `fix`,
  `style`, `perf`, `refactor`, `test`, `docs`, `a11y`, `ci`, `chore`, `revert`. A body is welcome for the "why".
- Don't sign commit messages: no `Co-Authored-By:` or "Generated with …" lines at the end. The message is just the
  summary and, if useful, the body.
- Commit only when asked, never push unless asked. Exception: the DEVELOPER role in [roles.md](roles.md) commits
  each finished step, then pushes its branch and opens the PR.
- **`main` only changes through PRs.** A ruleset on `main` blocks direct pushes, force pushes and deletion, and
  requires a linear history plus the checks `Testes unitários`, `Verificações estáticas` and `Versão` to pass on
  a branch that is up to date with `main`. The repo only allows **rebase merges** and deletes merged branches.
- **Branches**: `<prefix>/<short-kebab-summary>` using the commit prefix, e.g. `feat/importar-treinos`,
  `fix/rir-vazio`, `docs/manual-backup`. One topic per branch/PR. Keep the commits clean (each one a
  conventional message) because rebase merge puts every commit on `main` as is.
- **Sync before you start.** Cloud sessions also merge PRs, so the local copy goes stale. On `main`, run
  `git fetch origin` and `git pull --ff-only origin main` before creating a branch/worktree. If it can't
  fast-forward or there are uncommitted changes, stop and ask; never reset `main` or force anything onto it.
- **Before pushing**: `git fetch origin` + `git rebase origin/main`, run the tests and `check.ps1`, then
  `git push -u origin <branch>` (after a rebase of an already-pushed branch: `--force-with-lease`, only on your
  own branch). Open the PR with `gh pr create --base main` (title = the commit message for one-commit PRs).
- **PR linked to an issue → reference it in the description**, so any agent picking up the PR can open the issue
  for the full context: `Closes #N` when the PR resolves it (GitHub closes it on merge), `Refs #N` when it only
  advances it (e.g. one of several PRs). Put it on the first line of the description and keep the description
  self-contained (what changed and why), not just the link.
- **Merge: only the human merges.** Agents never run `gh pr merge` and never turn on auto-merge; merging is what
  publishes. If another PR merged first, GitHub asks for the branch to be updated: rebase on `origin/main` again
  and push (`--force-with-lease`). A version conflict (both shipped `vN`)
  means bumping yours to the next number.
- **Deploy = merging a PR with a new version.** `deploy.yml` publishes and creates tag `vN`; never create or
  push tags yourself. Docs/CI-only PRs keep the version and publish nothing.
- Undoing a shipped visual change: revert it **and** bump the version again (v57 → v58), or phones keep it.
