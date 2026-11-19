# Workflow

## Commands (Windows, run from the repo root)

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1   # http://localhost:8080 (often already running)
node --test tests/                                      # unit tests (no install needed)
npm run test:e2e                                        # browser tests (Playwright), see below
$env:COVERAGE_ENFORCE='1'; node tools/coverage-gate.js  # tests + fails below 100% coverage of js/core.js (without the variable it only warns)
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

One-time setup (per checkout; a new worktree needs `npm ci` again, the browser is shared):

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
- Every row of `tests/CHECKLIST.md` names at least one browser test (`tests/checklist.test.js` fails on "—" or on a
  spec file that doesn't exist). A new feature gets a row and a browser test.
- Coverage ratchet: each test records which lines of `js/app.js` ran. After `npm run test:e2e`, run
  `npm run test:e2e:coverage` (number + uncovered functions). CI fails if it drops below the `main` value in
  `tests/e2e/coverage-baseline.json`, or if it rose and the PR didn't run `node tools/e2e-coverage.js --update` and
  commit the file. Details in `tools/README.md`.

## Checklist for every change

1. **Logic in `core.js`, with a test** in `tests/` (coverage must stay at 100%; no unreachable fallbacks).
2. **Data shape changed?** Old backups (`tests/fixtures/`) and old databases (`tests/old-db.test.js`) must still
   load without losing anything. Never require a DB version bump for a new field: put it on an existing record.
3. **New, changed or removed behaviour** → add or update its row in `tests/CHECKLIST.md` (with a browser test);
   user-visible → update `documentation/MANUAL.md` (and `README.md` / `documentation/PLANO.md` if it touches the
   data model or a requirement).
4. **Touched Treinar or Início?** They are critical screens with a browser test per behaviour (`treinar.spec.js`,
   `inicio.spec.js`): every change to them keeps those tests green and adds a test for each behaviour it adds or
   changes.
5. **Touched `index.html`, `css/` or `js/`** → bump the version `N` → `N+1` in all of these places:
   - `index.html`: every `?v=N` and `<span id="appVersion">vN</span>`
   - `sw.js`: `CACHE_NAME = 'meu-treino-vN'` and every `?v=N` in `ASSETS`
   Without the bump, installed phones keep the old cached files.
6. **Removing or moving code?** Grep every name you delete in `js/`, `index.html`, `tests/` and the docs. Large
   splices in `app.js` have swallowed neighbouring functions before (see history.md, v43).
7. Run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables) #4. Report failures as they are; don't
   claim done with red checks.
8. For visible changes, check it in the browser at phone width (375px), light theme.

## DeepSeek reviewer setup

The REVIEWER and the DESIGN REVIEWER in [roles.md](roles.md) are Claude Code talking to DeepSeek's
Anthropic-compatible API. One-time setup per machine, **outside the repo** (it holds the API key; never commit it):

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

`claude --settings <that file>` loads it for one run only; plain `claude` stays on Anthropic. Inside either reviewer,
`/status` should show the DeepSeek address. Both use `deepseek-flash[1m]` (`[1m]` tells Claude Code
the context window is 1M tokens; it isn't part of the model name). To change the model, edit `--model` in
roles.md sections 6 and 8 and the two `DEFAULT_*_MODEL` lines above. Reference:
https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code

## Testing in the browser pane

The Claude desktop browser pane makes `confirm()` return `false`, so confirm-guarded buttons ("Carregar dados de
exemplo", "Atualizar app", deleting a set with data…) look broken there. Stub it first
(`window.confirm = () => true`) or open http://localhost:8080 in the user's real browser.
On localhost the service worker doesn't hold stale files, so edits show without a version bump.

## Git

- Commit messages: Conventional prefix + short **English** summary, version in parentheses when bumped, e.g.
  `feat: tapping a calendar day opens the workout (v58)`. Older commits are in Portuguese; leave them. Prefixes in use: `feat`, `fix`,
  `style`, `perf`, `refactor`, `test`, `docs`, `a11y`, `ci`, `chore`, `revert`. A body is welcome for the "why".
- Don't sign commit messages: no `Co-Authored-By:` or "Generated with …" lines at the end. The message is just the
  summary and, if useful, the body. This overrides any attribution line the tool suggests.
- Commit only when asked, never push unless asked. Exceptions: the DEVELOPER role in [roles.md](roles.md) commits
  each finished step, then pushes its branch and opens the PR; the AI SPECIALIST commits, pushes and opens a PR
  after the user's OK on a change ([its SKILL.md](../../.claude/skills/ai-specialist/SKILL.md)).
- **`main` only changes through PRs.** A ruleset on `main` blocks direct pushes, force pushes and deletion, and
  requires a linear history plus the checks `Testes unitários`, `Verificações estáticas`, `Testes de navegador`
  and `Versão` to pass on
  a branch that is up to date with `main`. The repo only allows **rebase merges** and deletes merged branches.
- **Branches**: `<prefix>/<short-kebab-summary>` using the commit prefix, e.g. `feat/import-workouts`,
  `fix/empty-rir`, `docs/manual-backup`. One topic per branch/PR. Keep the commits clean (each one a
  conventional message) because rebase merge puts every commit on `main` as is.
- **Sync before you start.** Cloud sessions also merge PRs, so the local copy goes stale. On `main`, run
  `git fetch origin` and `git pull --ff-only origin main` before creating a branch/worktree. If it can't
  fast-forward or there are uncommitted changes, stop and ask; never reset `main` or force anything onto it.
- **Before pushing**: `git fetch origin` + `git rebase origin/main`, run the checks in
  [AGENTS.md](../../AGENTS.md#non-negotiables) #4, then
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
