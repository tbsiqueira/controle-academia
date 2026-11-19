# Product rules

Decisions the user has made. Follow them without asking again; add new ones here when the user states one.

## Who uses it, and how

One person, on an iPhone, as an installed PWA, mid-workout with one hand. They train from fichas written by
their trainer (the "professora") and send her each workout as text. Everything must work offline.

## Feedback and alerts

- **Never add sound or vibration**: no beeps, Web Audio, `<audio>`, speech, `navigator.vibrate`, not even as an
  opt-in setting. No pulsing or flashing either.
- New visual changes (alerts included): show the user a mockup first (v57 shipped alternating card colours unasked
  and was reverted).
- Alerts are a plain, static visual change. Example: when rest is over, the timer stays orange at 0:00 until
  closed (it doesn't close itself).
- Success messages are toasts that disappear on their own; errors are always visible (no silent failures).

## Training screen (`#/workout`)

- **No extra taps**: every exercise stays expanded and the obs field stays visible inline. Don't add accordions,
  toggles, popovers or new buttons that add steps (the existing tap on the set number, which marks it done
  and starts the rest timer, stays).
- For new behaviour, prefer automatic state over actions (e.g. derive "filled" from reps + load being set).
- Pre-fill everything possible: reps from the ficha, load from last time, warm-up from last time; RIR stays blank.
- Nothing typed may be lost: the draft is saved continuously and offered back after the app closes.
- Exercise cards are plain (alternating colours were tried in v57 and reverted).

## General UI

- Phone first (iPhone Safari). Form fields at least 16px font so iOS doesn't zoom (`check.ps1` checks this).
  Icon-only buttons get a 44px touch area and an `aria-label`. Respect the iPhone safe areas (status bar, home bar).
- UI text in pt-BR, short and plain. Lime-green theme (v62+): reuse the `--mt-*` variables and existing classes in
  `css/styles.css` plus Bootstrap utilities; don't introduce a new palette.
- Keep screens lean: the Início list shows date + ficha name + a short summary; details live one tap away.
- Rarely used tools (update app, erase data, storage used, sample data) live in the **Debug** card at the end of **Mais**, always visible (the collapsible "Opções avançadas" wrapper was removed in v74 at the user's request; don't hide it again).
- Destructive actions confirm first; erasing everything uses a checkbox, not typing a word.

## Data and privacy

- 100% local: no backend, accounts, analytics or third-party requests. **No Google Drive/OAuth integration**;
  backups go through the phone's share sheet.
- One backup action produces exactly one `.json` file.
- Never invent data on import; never delete user data as a side effect of a feature change.

## Removed or rejected on purpose (don't bring back unasked)

- **Body weight tracking** (removed in v67). Old backups may still carry `settings.bodyWeights`; leave it unused.
  Lifting load ("carga" / warm-up "peso") is a different thing and stays.
- "Ver dados" read-only data screen (removed in v59).
- Alternating card colours on the training screen (reverted in v58).
- Sound/vibration/pulsing at the end of rest (removed right after v51).
