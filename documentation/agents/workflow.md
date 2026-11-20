# Workflow

## Commands (Windows, run from the repo root)

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1   # http://localhost:8080 (often already running)
node --test tests/                                      # unit tests (no install needed)
npm run test:e2e                                        # browser tests (Playwright), see below
$env:COVERAGE_ENFORCE='1'; node tools/coverage-gate.js  # tests + fails below 100% coverage of js/core.js (without the variable it only warns)
powershell -ExecutionPolicy Bypass -File .\check.ps1   # static checks (must print "All good.")
powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1   # only after editing sample data content
```

Python is not installed; use Node for scripted edits. Node 26 locally and in CI.

CI: `tests.yml` runs `node --check`, the coverage gate, `check.ps1` and the browser tests on every PR and push to
`main`; on PRs its `Version` job also fails when `index.html`, `css/` or `js/` changed without a version bump (or the
version is already tagged). Its four jobs are the required checks of the `main` ruleset ([Git](#git)).
CI installs only the Chromium browser, without `--with-deps` (no apt); see the comment in `tests.yml`.
`deploy.yml` runs on every push to `main` (= a merged PR): if tag `vN` for the current version doesn't exist yet,
it calls the whole `tests.yml` workflow as the publish gate (unit, static and browser tests), publishes to GitHub
Pages and then creates and pushes tag `vN`. Otherwise it publishes nothing. A check added to `tests.yml` therefore
gates publishing too; `check.ps1` fails if the gate is unwired (the `verificar` job stops calling it, or `publicar`
stops needing `verificar`).

## Publishing (GitHub Pages)

One-time setup: **Settings → Pages → Source: GitHub Actions**, and **Settings → Environments → `github-pages`**
must allow deploys from `main`. The repository has to be public on the free plan. Repository settings (already
applied): rebase merge only, auto-merge off, merged branches deleted; the `main` ruleset blocks direct pushes,
force pushes and deletion, and requires the four checks named above.

The deploy gate itself is described above. If it fails:

| Symptom | Cause | Fix |
|---|---|---|
| `Branch "main" is not allowed to deploy to github-pages…` | the environment rule is missing | Settings → Environments → `github-pages` → allow branch `main`, then re-run |
| merge landed but nothing was published | the version didn't change, so tag `vN` exists | expected for docs/CI PRs; a code PR without a bump should have failed **Version** |
| `Get Pages site failed` / `Pages site not found` | Pages source isn't GitHub Actions | Settings → Pages → Source: GitHub Actions |
| "Rodar check.ps1" failed | inconsistent version or a missing file/id | run `check.ps1` locally and fix it in a new PR |
| deploy green but the site is stale | browser/service worker cache | in the app: Mais → Debug → Atualizar app; on the PC: Ctrl+F5 or `/reset.html` |

Rolling back a shipped change: revert it in a PR **and** bump the version again (v57 → v58), or phones keep the
cached version. Emergency publish: Actions → **Publicar no GitHub Pages** → Run workflow (publishes `main` as it
is and creates the tag if it's missing).

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

- Writing or changing browser tests: read [e2e-tests.md](e2e-tests.md) first (helpers, temporary tests, timers,
  fixed conditions).
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
  summary and, if useful, the body. This overrides any attribution line the tool suggests: a harness
  `Co-Authored-By` reminder doesn't change it, because commits here aren't signed and the repo rules win.
- Commit only when asked, never push unless asked. Exceptions: the DEVELOPER role in [developer.md](developer.md) commits
  each finished step, then pushes its branch and opens the PR; the AI SPECIALIST commits, pushes and opens a PR
  after the user's OK on a change ([its SKILL.md](../../.claude/skills/ai-specialist/SKILL.md)).
- **`main` only changes through PRs.** A ruleset on `main` blocks direct pushes, force pushes and deletion, and
  requires a linear history plus the checks `Unit tests`, `Static checks`, `Browser tests`
  and `Version` to pass on
  a branch that is up to date with `main`. The repo only allows **rebase merges** and deletes merged branches.
- **Branches**: `<prefix>/<short-kebab-summary>` using the commit prefix, e.g. `feat/import-workouts`,
  `fix/empty-rir`, `docs/manual-backup`. One topic per branch/PR. Keep the commits clean (each one a
  conventional message) because rebase merge puts every commit on `main` as is.
- **Sync before you start.** Cloud sessions also merge PRs, so the local copy goes stale. On `main`, run
  `git fetch origin` and `git pull --ff-only origin main` before creating a branch/worktree. If it can't
  fast-forward or there are uncommitted changes, stop and ask; never reset `main` or force anything onto it.
- **Before pushing**: `git fetch origin` + `git rebase origin/main`, then run the checks in
  [AGENTS.md](../../AGENTS.md#non-negotiables) #4 if the rebase brought in new commits or nothing has passed them
  since your last change (otherwise the last green run still counts), then
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
