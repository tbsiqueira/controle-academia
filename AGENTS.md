# Agent guide — Meu Treino

Offline gym-log PWA. Plain HTML/CSS/JS: no build, no npm, no backend. All data lives on the device (IndexedDB).
**Language.** What people read about the app stays **pt-BR**: UI text, `README.md`, the user manual
(`documentation/MANUAL.md`), the exercise catalog and sample data.
Everything else is **English**: code, identifiers, comments, tests, commit messages, branch names, issues, plan
comments, PR descriptions and docs for developers and agents. Older comments, tests, docs, issues and commits are
still in Portuguese and get translated in their own issues: don't translate them inside unrelated changes, and
never rewrite old commits.

Read before changing anything:

- [documentation/agents/architecture.md](documentation/agents/architecture.md) — where code lives, domain terms, data rules
- [documentation/agents/workflow.md](documentation/agents/workflow.md) — commands and the checklist every change goes through
- [documentation/agents/product-rules.md](documentation/agents/product-rules.md) — what the user wants (and has rejected)
- [documentation/agents/history.md](documentation/agents/history.md) — key decisions, past regressions and their lessons
- [documentation/agents/roles.md](documentation/agents/roles.md) — PLANNER / DEVELOPER / REVIEWER: how an
  issue is picked, planned on the issue, built step by step and reviewed by a DeepSeek agent
  through herdr (`hc`)
- [documentation/REFACTOR.md](documentation/REFACTOR.md) — the ongoing refactor (phases, target structure, test policy,
  rules for refactor PRs). Tracked in issue #2; work one issue per PR

## Roles

Most sessions have no role: answer questions and do what you're asked, under the normal rules here.
A session has a role only when it's started with `/planner` or its prompt names one (PLANNER, DEVELOPER or
REVIEWER). Then read [documentation/agents/roles.md](documentation/agents/roles.md) first and follow it.
Asking about the roles or the workflow doesn't give you one.
The **AI SPECIALIST** (reviews and improves the agent docs) is outside the issue workflow: only `/ai-specialist`
in a chat gives it; its rules are in [.claude/skills/ai-specialist/SKILL.md](.claude/skills/ai-specialist/SKILL.md).

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
5. Commit only when asked; never push unless asked. Exception: the DEVELOPER role ([roles.md](documentation/agents/roles.md))
   commits each finished step on its issue branch, then pushes and opens the PR. **Only the human merges**: never
   merge a PR and never turn on auto-merge. `main` is protected: every change goes through a branch and a PR,
   merged **only by rebase** after the required checks pass. Never tag by hand: merging a PR with a new version
   makes `deploy.yml` publish and tag `vN`. Always `git pull --ff-only origin main` before branching from `main`
   (cloud sessions merge PRs too), and rebase on `origin/main` before pushing. A PR related to a GitHub issue
   references it in its description (`Closes #N` or `Refs #N`) so the full context is one click away.
6. No sound, vibration or flashing. No extra taps on the training screen.
