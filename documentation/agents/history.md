# History, decisions and lessons

The detailed log is in [`PLANO.md`](../PLANO.md) (section "Histórico de revisões") and `git log`. This page keeps what a future
agent should know before touching the same area. Rules that came out of them live in the
docs they point to ([architecture.md](architecture.md), [product-rules.md](product-rules.md),
[workflow.md](workflow.md)); they are not repeated here.

## Decisions worth keeping

- **No build; npm only for dev tools** (Playwright, since #4; see the refactor plan below), no jsdom: the user
  edits and serves files directly.
- **Service worker**: versioned assets cache-first (fast start on weak signal), `index.html` network-first.
- **Deploy only by tag**, so `main` can move freely. Since 2026-11-17 the tag is created by `deploy.yml` itself
  when a PR with a new version is merged; nobody tags by hand.
- **PR flow (2026-11-17)**: `main` is protected by a ruleset; rebase merge only, linear history, required checks
  (the list is in [workflow.md](workflow.md#git)). Before that, everything was pushed straight to `main`.
- **Publish gate (issue #88)**: `deploy.yml` calls the whole `tests.yml` workflow before publishing, so the publish
  gate and the PR checks are the same jobs (unit, static and browser tests). Don't add the checks back as copied
  steps in `deploy.yml`: add them to `tests.yml` and both runs pick them up. `check.ps1` check 15 fails if the call
  disappears.
- **Refactor plan (2026-11-17)**: [REFACTOR.md](../REFACTOR.md). Browser tests (Playwright) first, then native ES
  modules, then JSDoc types checked by `tsc --noEmit`; still no build step. The app and the unit tests need
  nothing installed. `app.js` coverage is measured with a ratchet (`tests/e2e/coverage-baseline.json`).
- **Browser coverage of `app.js` (2026-11-17)**: every path a person can trigger has a browser test, including the
  "Não" answer of every confirmation (98.7% of lines at phase 1; 100% since the temporary tests of #39). Reloads
  by the app ("Atualizar app") are counted through a snapshot before the reload; holding the navigation to read the
  counters first hung the V8 profiler, so that approach was dropped.
  Treinar and Início were made critical screens (issues #5, #19); the rule is step 4 of the
  [checklist for every change](workflow.md#checklist-for-every-change).

## Regressions and their lessons

| Version | What broke | Lesson / guard added |
|---|---|---|
| v43 → v44 | A splice in `app.js` deleted the neighbouring helpers `allExercises`/`labelOf`/`refOf`; opening a workout threw `ReferenceError` | `check.ps1` check 14: every function called in `app.js` must exist. Grep after large edits |
| v40, v47 | Renaming a ficha didn't show everywhere; catalog exercise history opened empty (number vs text id) | Resolve names by id at display time; compare ids with `String(id)` in one place |
| v27 | User exercises vanished from the library (origin guessed from the name) | Never infer data from names; store explicit fields |
| v33 | `27,5` was saved as `27` on iPhone | Text input + `inputmode="decimal"` and a shared comma-aware parser |
| v35–v39 | Backup produced a second `.txt` file; the button passed the click event as the payload | Share only `{ files }`; validate the payload (`isBackupPayload`) |
| v55 | Version bumped in the footer but not in the `?v=` assets | `check.ps1` check 7 compares all version spots |
| pre-v60 | Importing a backup cleared stores in separate transactions; a failed write left the DB empty | Clear + write in one transaction (`dbReplaceAll`) |

## Recurring user feedback

- Wants the smoothest possible flow while training; every extra tap is a cost.
- Notices iPhone layout details (status bar overlap, gap under the bottom menu, field zoom). Check at 375px.
- Prefers removing unused features over keeping them around.
