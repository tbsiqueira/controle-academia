# Refactor plan

Tracking: issue [#2](https://github.com/tbsiqueira/controle-academia/issues/2) (pinned in the repository), with one
issue per PR, grouped into the **Refatoração · Fase 0–3** milestones.

This document says **why** to refactor, **where** the code is going and **which rules** every refactor PR follows.
What to do in each step is in the corresponding issue.

## 1. Why now

The app works and the logic is well looked after, but the screen side became a single block:

| File | Size | Situation |
|---|---|---|
| `js/app.js` | ~2,700 lines, 159 global functions | Screens, rendering into HTML strings, events and global state in one file. The HTMLs built here call global functions with `onclick="…"`, `oninput` and `onchange`. At the start, **no test ran in the browser** (fixed in Phase 1). |
| `js/core.js` | ~1,600 lines | Pure logic, **100% coverage** in unit tests. It's fine. |
| `js/db.js` | ~140 lines | IndexedDB, with a test. It's fine. |
| `index.html` | ~480 lines | All the screens. No inline handlers: the fixed buttons are wired with `addEventListener` in `app.js`'s `bindEvents()`. |
| `css/styles.css` | ~1,400 lines | Styling for the whole app. Out of scope for this refactor. |

`core.js`, `db.js` and `app.js` share the same global scope: any function from one is visible in the others and in
the HTML. That's why large changes in `app.js` have already broken distant parts of the app (v43: one hunk deleted
neighbouring functions and opening a workout started throwing `ReferenceError`; v40 and v47: names and ids
mismatched between screens). `check.ps1` catches part of this statically, but it does not exercise the app.

With more people interested in the project, every change needs a safety net that doesn't depend on someone
remembering to test everything by hand.

## 2. Where we're going

**Principles**

- **Still no build.** The browser loads the files as they are in the repository; editing and reloading keep
  working. No bundler, transpiler or framework.
- **Native ES modules** (`import`/`export`) instead of the global scope.
- **DOM-free logic goes into `core.js`, with a test.** The refactor is the time to take hidden logic out of `app.js`.
- **Neutral behaviour.** No refactor PR changes what the person sees or the data that gets saved.

**Target structure** (the exact boundaries between the areas may change in each PR):

```
index.html                 app shell; a single <script type="module" src="js/main.js">
js/
  main.js                  startup: loads state, routes, registers the service worker
  core.js                  pure logic (export)
  db.js                    IndexedDB (export)
  types.js                 only JSDoc @typedefs for the data (Phase 3)
  ui/                      shared pieces: state, routes, toast, names by id, render helpers
  screens/
    treino.js              Treinar: form, sets, warm-up, draft, rest, save
    fichas.js              Fichas, Criar com IA, Importar treinos antigos
    biblioteca.js          Biblioteca, catalog, exercise picker
    dados.js               backup, persistent storage, Apagar dados, sample data
    inicio.js              Início, Calendário, Histórico/Evolução, Metas, Mais
tests/                     unit tests (node --test), as today
tests/e2e/                 browser tests (Playwright)
```

The HTMLs built in `app.js` stop using `onclick="funcao()"` (and `oninput`/`onchange`) and start declaring
`data-action="…"`, handled by event delegation in each screen. With no inline handler, the `index.html` CSP
loses the `'unsafe-inline'` from `script-src` (the one in `style-src` stays: the app still uses `style`
attributes).

## 3. Phases and PR order

The order and the state of each step are tracked in issue
[#2](https://github.com/tbsiqueira/controle-academia/issues/2), one issue per PR, with the milestones
**Refatoração · Fase 0–3**. In short:

| Phase | What it delivers | Issues |
|---|---|---|
| **1 — Browser tests** | Playwright in CI as a required check; every behaviour of the critical screens; `app.js` coverage ratchet | #4, #5, #19, #6, #7, #29 — **done**; #39 (temporary tests) before Phase 2 |
| **2 — Modules** | `core.js`/`db.js` as modules; `app.js` with no inline handler and a CSP without `'unsafe-inline'` in `script-src`; ratchet for several files; `app.js` split by area | #8 → #9 → #33 → #10–#14 |
| **3 — Types** | JSDoc types checked by `tsc --noEmit` in CI; `// @ts-check`; final documentation | #15, #16, #40, #17 |

The order inside Phase 2 matters: **#8** moves the unit tests and the coverage gate from `require` to `import`;
**#9** ends the inline handlers while `app.js` is still one file, so the ratchet and `check.ps1` keep working, and
closes by removing `'unsafe-inline'` from the CSP's `script-src`; **#33** makes the ratchet add up several files
before the first split; **#10–#14** split one area per PR. In Phase 3 the types need a development-only
`tsconfig.json` (`allowJs`, `checkJs`, `noEmit`), and each file references them with
`import('./types.js').Treino`. **#40** turns the temporary tests off (without deleting them) before **#17**, which
documents the final state. A Phase 4 (real TypeScript with a build) is not planned: it gets evaluated at the end.

## 4. Testing policy

1. **Pure logic: 100%.** `js/core.js` keeps 100% of lines and branches covered by unit tests
   (`tools/coverage-gate.js`), as today.
2. **Critical screens: every behaviour.** In **Treinar** and **Início**, every behaviour the person can trigger has
   its own browser test and its own row in `tests/CHECKLIST.md` (full lists in #5 and #19). On every screen, every
   confirmation question also has a test for its "Não" answer, asserting the question text
   (`tests/confirm-no.test.js` catches a missing one; line coverage can't).
3. **Other screens: features, not lines.** Every feature in `tests/CHECKLIST.md` has at least one browser test of
   the main path. A new feature comes with a browser test; a fixed bug comes with a test that reproduces it.
4. **`app.js` coverage measured, with a ratchet.** The browser tests record which lines of the screen code ran; the
   number **may not drop** relative to `main`. No fixed goal: the last stretches are browser error paths that need
   fragile and slow tests, and flaky tests teach people to ignore a red check.
5. **Stable and fast.** Phone (375px), light theme, database starting empty or with `data/sample-data.json`, no
   fixed waits. The whole job should take a few minutes.
6. **Temporary tests during the refactor (#39).** Until #16, every screen has a test per behaviour and `app.js`
   line coverage is **100%**; the only exceptions, listed in #39, are lines unreachable from the browser and lines
   the collector can't count. Tests live in `tests/e2e/temporarios/` with their own `tests/CHECKLIST.md` table, and
   each PR that raises coverage updates the ratchet (`node tools/e2e-coverage.js --update`). **#40 turns them off,
   not deletes them** (`testIgnore`, the CHECKLIST table moves to a turned-off section, the ratchet drops once on
   purpose). Items 1–5 keep applying after that.

## 5. Development tools (npm)

`package.json` exists only for development tools (`@playwright/test`, and `typescript` in Phase 3), with a
versioned `package-lock.json` and `node_modules/` out of git. The published app stays exactly the files in the
repository; the unit tests keep running with `node --test tests/`, without installing anything. `npm ci` is only
needed for the browser tests and the type check.

## 6. Rules for every refactor PR

- **One PR per issue**, with `Closes #N` in the description. An issue that is too big may become more than one PR;
  say so in the issue first.
- **Neutral behaviour**: same screens, same texts, same data; old backups (`tests/fixtures/`) keep importing
  without losing anything.
- **No mixing**: no new feature, visual fix or "while I was here I changed" in a refactor PR. Found a bug along the
  way? Open an issue and fix it in a separate PR.
- **Touched `index.html`, `css/` or `js/`** → raise the version (the **Version** job enforces it) and update the
  `ASSETS` list in `sw.js` when files come in or go out.
- **Moved or deleted code** → grep every name in `js/`, `index.html`, `tests/` and the documentation (lesson from
  v43).
- **Before opening the PR**: `node --test tests/`, `check.ps1` and, from Phase 1 on, the browser tests passing
  (including the temporary ones from #39, while they're on). Rebase merge only, with all checks green.
- Tests that check the text of `app.js` (`tests/features.test.js`) and `check.ps1` checks that look for functions in
  `app.js` get adjusted along with the change that affects them, never turned off.
