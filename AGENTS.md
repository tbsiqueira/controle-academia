# Agent guide — Meu Treino

Offline gym-log PWA. Plain HTML/CSS/JS: no build, no npm, no backend. All data lives on the device (IndexedDB).
UI text is **pt-BR**; code and identifiers are English.

Read before changing anything:

- [documentation/agents/architecture.md](documentation/agents/architecture.md) — where code lives, domain terms, data rules
- [documentation/agents/workflow.md](documentation/agents/workflow.md) — commands and the checklist every change goes through
- [documentation/agents/product-rules.md](documentation/agents/product-rules.md) — what the user wants (and has rejected)
- [documentation/agents/history.md](documentation/agents/history.md) — key decisions, past regressions and their lessons
- [documentation/REFACTOR.md](documentation/REFACTOR.md) — the ongoing refactor (phases, target structure, test policy,
  rules for refactor PRs). Tracked in issue #2; work one issue per PR

## Where documentation goes

- **All new documentation goes in `documentation/`.** Agent references live in `documentation/agents/`.
  Don't create new `.md` files at the repo root or next to code.
- Root exceptions: `README.md` (GitHub shows it), `AGENTS.md` and `CLAUDE.md` (tools only read them at the root).
- Human docs: [documentation/MANUAL.md](documentation/MANUAL.md) (user manual),
  [documentation/PLANO.md](documentation/PLANO.md) (requirements + revision log) and
  [documentation/REFACTOR.md](documentation/REFACTOR.md) (refactor plan).
- **`FICHA-JSON.md` and `TREINO-JSON.md` must stay at the root**: the app fetches them and the service worker caches them.
- Other docs that stay where they are: `tests/CHECKLIST.md` (feature → tests) and `tools/README.md`.

## Non-negotiables

1. Logic goes in `js/core.js` (pure, 100% covered by tests); `js/app.js` only renders and wires the DOM.
2. Never break old backups: imports must keep loading old data and silently ignore fields they don't know.
3. Changing `index.html`, `css/` or `js/` → bump the version (see workflow.md). `check.ps1` fails otherwise.
4. Before you say done: `node --test tests/`, `powershell -ExecutionPolicy Bypass -File .\check.ps1` and
   `npm run test:e2e` (browser tests) all pass.
5. Commit only when asked; never push unless asked (exception: a clean local DeepSeek review, see workflow.md,
   is the go-ahead to commit, push and open the PR, never to merge). `main` is protected: every change goes through a branch and a
   PR, merged **only by rebase** after the required checks pass. Never tag by hand: merging a PR with a new version
   makes `deploy.yml` publish and tag `vN`. Always `git pull --ff-only origin main` before branching from `main`
   (cloud sessions merge PRs too), and rebase on `origin/main` before pushing. A PR related to a GitHub issue
   references it in its description (`Closes #N` or `Refs #N`) so the full context is one click away.
6. No sound, vibration or flashing. No extra taps on the training screen.
