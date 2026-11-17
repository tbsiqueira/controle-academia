# Workflow

## Commands (Windows, run from the repo root)

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1   # http://localhost:8080 (often already running)
node --test tests/                                      # unit tests
node tools/coverage-gate.js                             # tests + 100% coverage of js/core.js
powershell -ExecutionPolicy Bypass -File .\check.ps1   # static checks (must print "Tudo certo.")
powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1   # only after editing sample data content
```

Python is not installed; use Node for scripted edits. Node 26 locally and in CI.

CI: `tests.yml` runs `node --check`, the coverage gate and `check.ps1` on every push to `main`.
`deploy.yml` publishes to GitHub Pages **only on a `v*` tag**, after the same checks pass.

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
- Work on `main`. Commit only when asked, never push unless asked.
- **No pull requests.** Finished work is pushed straight to `origin main`; never open a PR.
- **Sync before you start.** Cloud sessions also push to `main`, so the local copy goes stale. Before starting
  work, or before creating any branch/worktree from `main`, run `git fetch origin` and
  `git pull --ff-only origin main` (on `main`). If it can't fast-forward or there are uncommitted changes, stop
  and ask; never reset or force anything. Before pushing, pull again (`--rebase` for your own unpushed commits).
- **Deploy = pushing a tag `vN`.** Never create or push tags on your own.
- Undoing a shipped visual change: revert it **and** bump the version again (v57 → v58), or phones keep it.
