# Development tools

Support scripts for the project. They are not part of the published app and don't go into the service worker
precache, but they are kept in the repo so that every change is reproducible.

| Tool | What it is for |
|---|---|
| `build-sample-data.ps1` | Builds `data/sample-data.json` (the "sample data" loaded in **Mais → Debug → Carregar dados de exemplo**) |
| `sample-data-content.json` | Portuguese content of the sample data: custom exercises, sheets (by catalog id), days, cardio, notes and colinhas. This one stays pt-BR: it is what the user sees |
| `coverage-gate.js` | Runs the unit tests and requires 100% of lines and branches in `js/core.js` |
| `e2e-coverage.js` | Measures how much of `js/app.js` the browser tests run and applies the CI ratchet (see below) |

## `js/app.js` coverage by the browser tests

Every browser test records in `tests/e2e/coverage/` (outside git) the `js/app.js` lines that ran, through
Chromium's JS coverage (automatic fixture in `tests/e2e/helpers.js`). After `npm run test:e2e`:

```powershell
npm run test:e2e:coverage                 # number and the functions with lines no test runs
node tools/e2e-coverage.js --update       # writes the number into tests/e2e/coverage-baseline.json
```

Every line with code counts (blank lines and comment-only lines don't); a line ran when the innermost block
that contains the start of it ran. Reloading the page discards the V8 counters: `page.reload`/`page.goto` in the
tests take a snapshot before that, but whatever runs right before the **app itself** reloads ("Atualizar app")
is not counted.

In CI, the **Browser tests** job publishes the number in the summary and fails when it drops compared to
`main`'s `tests/e2e/coverage-baseline.json`, or when it rose and the PR did not update that file (the ratchet
only goes up: run `--update` and commit it).

## Building the sample data

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1
```

`check.ps1` (and the pipeline) **regenerates the fixture and compares the content** with the committed file —
so the generator and the JSON never drift apart (the comparison is by meaning, not by bytes, because
Windows PowerShell 5.1 and PowerShell 7 serialize the JSON differently). If you change the content, run the
command above and commit the resulting `data/sample-data.json`.

## How the sample sheets are built

For each sheet defined in `sample-data-content.json`:

- `catalogIds` — exercises that come from the **embedded catalog** (`data/exercises.json`), referenced only by
  **id** (the name is read from the catalog, which keeps it always the same);
- `customIds` — exercises **created by the user** (defined in `customExercises`), which go into the
  Library and are linked to the sheets by **foreign key** (`exerciseId`);
- `dayOffsets` — how many days **ago** each workout happened (relative to today, so the demo always stays
  recent);
- `cardioMinutes` and `notes` — cardio and note of each workout.

Loads grow every session (+2.5 kg) so the progress charts show progress, and the first three exercises of each
workout have their warm-up filled in.

## Why the script is ASCII-only

Windows PowerShell 5.1 reads `.ps1` files without a BOM as ANSI, which would break accents ("Elevação" would
become garbage). So all Portuguese text lives in `sample-data-content.json`, read explicitly as UTF-8 — so the
script works the same on PowerShell 7 (Linux/CI). Both `tools/build-sample-data.ps1` and the root `check.ps1` are
ASCII-only for that reason: keep them that way.
