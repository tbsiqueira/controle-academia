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

The order matters: **the safety net first, then touch the code.**

| Phase | What it delivers | Issues |
|---|---|---|
| **0 — Plan** | This document and the rules below | #3 |
| **1 — Browser tests** | Playwright in CI as a required check; **every behaviour** of the critical screens (Treinar and Início); tests for every flow in `tests/CHECKLIST.md`; `app.js` coverage ratchet | #4, #5, #19, #6, #7, #29 — **done**; #39 (temporary tests) before Phase 2 |
| **2 — Modules** | `core.js`/`db.js` as modules; `app.js` as a module with no inline handler and a CSP without `'unsafe-inline'` in `script-src`; coverage ratchet measuring several files; `app.js` split by area, one PR per area | #8, #9, #33, #10–#14 |
| **3 — Types** | Data types in JSDoc checked by `tsc --noEmit` in CI; `// @ts-check` in every file; final documentation | #15, #16, #40, #17 |

Before Phase 2 comes **#39 — temporary browser tests** (section 4, item 6): every feature of every screen with its
own test, so Phase 2 can touch `app.js` with the finest net possible.

Within Phase 2 the order also matters:

1. **#8 — `core.js`/`db.js` as modules.** It's not just swapping `module.exports` for `export`: the unit tests
   move from `require` to `import`, the loop in `tools/coverage-gate.js` that `require`s each test is rewritten
   and `tests/module.test.js` (which tests the UMD registration in the browser) goes away or is replaced.
2. **#9 — end of inline handlers, with `app.js` still in a single file.** The switch to `data-action` touches
   almost every render function; in a single file, the coverage ratchet and `check.ps1`'s handler check keep
   working as they are. It closes by removing `'unsafe-inline'` from the CSP's `script-src`.
3. **#33 — coverage ratchet for several files.** `tools/e2e-coverage.js` (and `tests/e2e/helpers.js`) measure
   only `js/app.js`. Before the first PR that splits `app.js`, the ratchet starts adding up `js/app.js`,
   `js/ui/**` and `js/screens/**`; otherwise the split would make the safety net measure less and less without
   anyone noticing.
4. **#10–#14 — split by area**, one PR per area.

In Phase 3, `js/types.js` is not enough on its own: `tsc` needs a development-only `tsconfig.json` (`allowJs`,
`checkJs`, `noEmit`) and each file references the types with `import('./types.js').Treino`, because a `@typedef`
is not visible in another module without that.

After #16 and before #17, **#40 turns off the temporary tests** from #39 (section 4, item 6), and #17 documents
the final state.

A **Phase 4** (real TypeScript, with a build) is not planned. It will only be evaluated at the end (issue #17),
with the experience from the previous phases. After Phase 3 that migration would be almost mechanical.

## 4. Testing policy

1. **Pure logic: 100%.** `js/core.js` keeps 100% of lines and branches covered by unit tests
   (`tools/coverage-gate.js`), as today.
2. **Critical screens: every behaviour.** **Treinar** and **Início** are the critical screens: Treinar is used at
   the gym, in a hurry, and Início is the first thing everyone sees. There, **every behaviour** the person can
   trigger has its own browser test and its own row in `tests/CHECKLIST.md` (full list in issues #5 and #19).
   Every PR that touches a critical screen keeps those tests green and brings a test for what it adds or changes.
   On **every screen**, every confirmation question has a test for both answers: the "Não" must keep what the
   person filled in (`answerConfirm` in `tests/e2e/helpers.js`) and the test checks the text of the question.
   `tests/confirm-no.test.js` fails a `confirm()` in `app.js` without a test for the "Não". Line coverage doesn't
   catch this: the `confirm()` line runs with either answer.
3. **Other screens: features, not lines.** Every feature listed in `tests/CHECKLIST.md` has at least one browser
   test of the main path, and CI fails if any is left without. A new feature comes with a browser test; a fixed
   bug comes with a test that reproduces it.
4. **`app.js` coverage measured, with a ratchet.** The browser tests measure which lines of the screen code ran.
   The number appears in the PR and **may not drop** relative to `main`. There is no fixed goal (like 100%): the
   last stretches are browser error paths that can only be reached with fragile and slow tests, and flaky tests
   teach people to ignore a red check.
5. **Browser tests stable and fast.** Phone (375px), light theme, database starting empty or with
   `data/sample-data.json`, no fixed waits. The whole job should take a few minutes.
6. **Temporary tests during the refactor (#39).** While the refactor lasts, the critical-screens rule (item 2)
   applies to **every screen**: every feature the person can trigger in Fichas, Biblioteca,
   Histórico/Calendário/Evolução, Mais and Dados gets its own browser test, and `app.js` line coverage goes to
   **100%**. The only exceptions, listed in #39 with the reason and the repository owner's OK: lines unreachable
   by the browser and lines that **run in a test but the collector can't count**, such as `forceUpdate`
   ("Atualizar app"), which reloads the page before the coverage snapshot (`tests/e2e/helpers.js`). #39 first
   tries to make the collector count those lines. This is the temporary exception to the "no fixed goal" of item 4.
   These tests live in `tests/e2e/temporarios/`, with their own table in `tests/CHECKLIST.md`;
   `tests/checklist.test.js` and `tests/confirm-no.test.js` start reading the subfolders of `tests/e2e/`. Each PR
   that raises coverage updates the ratchet (`node tools/e2e-coverage.js --update`). They run in CI as a required
   check **until #16**, the last refactor PR that touches code.
   **After that they are turned off, not deleted (#40):** a PR after #16 and before #17 removes the folder from the
   run (`testIgnore` in `playwright.config.js`), moves the CHECKLIST table to a section of turned-off tests that the
   checks ignore and **lowers the ratchet a single time, on purpose**: today CI fails any drop relative to `main`,
   so that PR brings the explicit way to accept the drop (details in #40). They stay in the repository to be turned
   back on in a future large change. Items 1–5 keep applying after that.

## 5. Development tools (npm)

Until here the project had no `package.json`. From Phase 1 on it exists **only for development tools**
(`@playwright/test` and, in Phase 3, `typescript`), with a versioned `package-lock.json` and `node_modules/` out of
git.

- The published app remains exactly the files in the repository: the `package.json` doesn't go into the app.
- The unit tests keep running with `node --test tests/`, without installing anything.
- `npm ci` is only needed to run the browser tests and the type check (in CI this is automatic).

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
