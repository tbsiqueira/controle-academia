# Agent guide — Meu Treino

Offline gym-log PWA. Plain HTML/CSS/JS: no build, no backend, no npm for the app (npm only for
dev tools: Playwright). All data lives on the device (IndexedDB).
**Language.** What people read about the app stays **pt-BR**: UI text, `README.md`, the user manual
(`documentation/MANUAL.md`), the exercise catalog and sample data.
Everything else is **English**: code, identifiers, comments, tests, commit messages, branch names, issues, plan
comments, PR descriptions and docs for developers and agents. Older comments, tests, docs, issues and commits are
still in Portuguese and get translated in their own issues: don't translate them inside unrelated changes, and
never rewrite old commits.

Read only what your task needs. Questions need none of these unless the answer depends on them.

- Before changing any file, running the checks, committing or opening a PR:
  [workflow.md](documentation/agents/workflow.md) (commands, the checklist every change goes through, Git).
- Before changing code, read [architecture.md](documentation/agents/architecture.md) for the relevant layers,
  data model and invariants. For user-visible behaviour or UI changes, also read
  [product-rules.md](documentation/agents/product-rules.md). Before touching an area it lists:
  [history.md](documentation/agents/history.md) (key decisions, past regressions and their lessons).
- Before writing or changing browser tests: [e2e-tests.md](documentation/agents/e2e-tests.md) (helpers, temporary
  tests, timers) and the testing policy in [REFACTOR.md §4](documentation/REFACTOR.md#4-testing-policy) (critical
  screens, confirmation answers, coverage ratchet, temporary tests).
- Only with a role: the files your role names (see Roles).
- Only for a refactor issue: [REFACTOR.md](documentation/REFACTOR.md) (the ongoing refactor, tracked in issue #2;
  one issue per PR).

## Roles

Most sessions have no role: answer questions and do what you're asked, under the normal rules here.
A session has a role only when it's started with `/planner` ([its skill](.claude/skills/planner/SKILL.md)) or its
prompt names one (PLANNER, DEVELOPER, REVIEWER or DESIGN REVIEWER). Then read only your files in
`documentation/agents/` and follow them:
PLANNER [roles.md](documentation/agents/roles.md) + [planner.md](documentation/agents/planner.md); DEVELOPER
[roles.md](documentation/agents/roles.md) + [developer.md](documentation/agents/developer.md); REVIEWER
[reviewer.md](documentation/agents/reviewer.md); DESIGN REVIEWER
[design-reviewer.md](documentation/agents/design-reviewer.md).
Asking about the roles or the workflow doesn't give you one.
The **AI SPECIALIST** (reviews and improves the agent docs) is outside the issue workflow: only `/ai-specialist`
in a chat gives it; its rules are in [.claude/skills/ai-specialist/SKILL.md](.claude/skills/ai-specialist/SKILL.md).

## Where documentation goes

- **All new documentation goes in `documentation/`.** Agent references live in `documentation/agents/`.
  Don't create new `.md` files at the repo root or next to code.
- Root exceptions: `README.md` (GitHub shows it), `AGENTS.md` and `CLAUDE.md` (tools only read them at the root).
- Human docs: [documentation/MANUAL.md](documentation/MANUAL.md) (user manual),
  [documentation/PLANO.md](documentation/PLANO.md) (requirements and closed decisions) and
  [documentation/REFACTOR.md](documentation/REFACTOR.md) (refactor plan).
- **`FICHA-JSON.md` and `TREINO-JSON.md` must stay at the root**: the app fetches them and the service worker caches them.
- Other docs that stay where they are: `tests/CHECKLIST.md` (feature → tests) and `tools/README.md`.

## Non-negotiables

1. Logic goes in `js/core.js` (pure, 100% covered by tests); `js/app.js` only renders and wires the DOM.
2. Never break old backups: imports must keep loading old data and silently ignore fields they don't know.
3. Changing `index.html`, `css/` or `js/` → bump the version (see workflow.md). `check.ps1` fails otherwise.
4. Before you say done: `node --test tests/`, `powershell -ExecutionPolicy Bypass -File .\check.ps1` and
   `npm run test:e2e` (browser tests) all pass. When `js/core.js` changed, run the coverage gate with enforcement
   instead of `node --test tests/` (without the variable it only warns): `COVERAGE_ENFORCE=1 node
   tools/coverage-gate.js` (bash) or `$env:COVERAGE_ENFORCE='1'; node tools/coverage-gate.js` (PowerShell).
   Docs-only changes: the unit tests and `check.ps1` are enough (CI still runs all).
5. Commit only when asked; never push unless asked. **Only the human merges**: never merge a PR and never turn on
   auto-merge. Never tag by hand. Every change goes through a branch and a PR: when asked to change files, sync
   and create the branch first, even if you weren't asked to commit; leave the commit for when you are. The full
   Git rules, exceptions included, are in [workflow.md](documentation/agents/workflow.md#git).
6. No sound, vibration or flashing. No extra taps on the training screen.
7. Never put real workout data (from your own backups or the phone) in issues, comments, prompts, commit messages
   or test fixtures; use the sample data or made-up data. Never paste or commit credentials (API keys included):
   if you see one, stop and tell the human so it can be rotated. When unsure, stop and ask rather than guess.
