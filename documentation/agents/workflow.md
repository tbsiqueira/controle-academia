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
- They start their own server (`tests/e2e/server.js`, port 4173), so `serve.ps1` on 8080 can keep running.
- Same conditions everywhere: Chromium, 375px phone viewport, light theme, pt-BR, São Paulo time zone. Each test
  gets a fresh browser context (empty IndexedDB, no service worker).
- Use `test`/`expect` from `tests/e2e/helpers.js`: any console error or uncaught exception fails the test, and
  `confirm()` answers yes. Helpers: `freshApp`, `withSampleData`, `goTo(page, 'Treinar')`.
- No fixed waits (`waitForTimeout`): wait for what the user would see.
- In CI a failed run uploads the report and traces as the `relatorio-testes-navegador` artifact.

## Refactor in progress

The code is being reorganised in phases (browser tests → ES modules → JSDoc types), one GitHub issue per PR.
Before picking up a refactor issue, read [REFACTOR.md](../REFACTOR.md): refactor PRs are behaviour-neutral and
never mix in features or fixes. Tracking issue: #2.
**Treinar and Início are critical screens**: once their browser tests exist (#5, #19), every change to them
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

## Testing in the browser pane

The Claude desktop browser pane makes `confirm()` return `false`, so confirm-guarded buttons ("Carregar dados de
exemplo", "Atualizar app", deleting a set with data…) look broken there. Stub it first
(`window.confirm = () => true`) or open http://localhost:8080 in the user's real browser.
On localhost the service worker doesn't hold stale files, so edits show without a version bump.

## Git

- Commit messages: Conventional prefix + short **Portuguese** summary without accents, version in parentheses
  when bumped, e.g. `feat: tocar num dia do calendario abre o treino (v58)`. Prefixes in use: `feat`, `fix`,
  `style`, `perf`, `refactor`, `test`, `docs`, `a11y`, `ci`, `chore`, `revert`. A body is welcome for the "why".
- Commit only when asked, never push unless asked.
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
- **Merge**: `gh pr merge <n> --rebase --auto` merges as soon as the checks pass. If another PR merged first,
  GitHub asks for the branch to be updated: rebase on `origin/main` again. A version conflict (both shipped `vN`)
  means bumping yours to the next number.
- **Deploy = merging a PR with a new version.** `deploy.yml` publishes and creates tag `vN`; never create or
  push tags yourself. Docs/CI-only PRs keep the version and publish nothing.
- Undoing a shipped visual change: revert it **and** bump the version again (v57 → v58), or phones keep it.
