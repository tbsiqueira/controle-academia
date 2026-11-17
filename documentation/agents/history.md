# History, decisions and lessons

The detailed log is in [`PLANO.md`](../PLANO.md) (section "Histórico de revisões") and `git log`. This page keeps what a future
agent should know before touching the same area.

## Timeline at a glance

| When | Versions | What happened |
|---|---|---|
| 2026-10-12 | v1–v24 | MVP: fichas with ordered exercises and reps per set, warm-up per exercise, export as text, library, catalog, tag-based deploy |
| 2026-10-12/13 | v25–v48 | Logic extracted to `core.js` with tests; 100% coverage gate; references by id; backup share flow; sample data |
| 2026-11-13 | v49–v52 | Persistent storage, draft, "last time" hint, repeat last workout, rest timer, weekly evolution, PRs |
| 2026-11-14 | v53–v59 | Import ficha from AI-generated JSON (`FICHA-JSON.md`), deactivate fichas, Debug card |
| 2026-11-15 | v60–v67 | Bug-fix sweep, one-tap "Treinar agora", 1RM, lime theme (v62), iPhone layout polish, body weight removed |

## Decisions worth keeping

- **No build, no npm** (and no jsdom): the user edits and serves files directly.
- **Catalog keeps permanent integer ids** (1..927) instead of migrating to UUIDs; ids are compared as text.
- **DB version stays at 2**: new settings go onto the existing `settings` record so no migration is needed.
- **Backups stay manual and local** (share sheet / download), no cloud integration.
- **Service worker**: versioned assets cache-first (fast start on weak signal), `index.html` network-first.
- **Deploy only by tag**, so `main` can move freely. Since 2026-11-17 the tag is created by `deploy.yml` itself
  when a PR with a new version is merged; nobody tags by hand.
- **PR flow (2026-11-17)**: `main` is protected by a ruleset; rebase merge only, linear history, required checks
  (tests + coverage, `check.ps1`, version bump). Before that, everything was pushed straight to `main`.
- **Refactor plan (2026-11-17)**: [REFACTOR.md](../REFACTOR.md). Browser tests (Playwright) first, then native ES
  modules, then JSDoc types checked by `tsc --noEmit`; still no build step. This **relaxes "no npm"**: from the
  Playwright PR (#4) on, a `package.json` exists for dev tools only; the app and the unit tests still need nothing
  installed. Browser tests cover every feature, not 100% of lines; `app.js` coverage is measured with a ratchet.

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
| v51 | Rest end beeped, vibrated and pulsed | User rule: no sound/vibration; colour change only |
| v57 | Alternating card colours on the training screen | Reverted in v58; propose visual changes as a mockup first |

## Recurring user feedback

- Wants the smoothest possible flow while training; every extra tap is a cost.
- Notices iPhone layout details (status bar overlap, gap under the bottom menu, field zoom). Check at 375px.
- Prefers removing unused features over keeping them around.
