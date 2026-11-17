---
name: release
description: Test, commit, push main and tag vN so deploy.yml publishes the site. Use when the user types /release or asks to test, commit, push, tag and publish.
---

Invoking this skill is the user's explicit request to commit, push and tag. Do not ask again at each step.

1. Run `node --test tests/` and `powershell -ExecutionPolicy Bypass -File .\check.ps1`. If either fails, stop and report the output.
2. Read the version `N` from `<span id="appVersion">vN</span>` in `index.html`. If tag `vN` already exists (`git tag -l vN`) and `index.html`, `css/` or `js/` changed, the bump is missing: stop and say so.
3. `git status` + `git diff`: commit the pending changes on `main` with a short conventional message ending in `(vN)`, plus the attribution line. Never commit secrets or unrelated files. If there is nothing to commit, go on.
4. `git pull --rebase origin main` (cloud sessions push to `main` too), then `git push origin main`. Never open a PR. If the rebase conflicts (often the version number, when another session already shipped `vN`), stop and report instead of forcing.
5. `git tag vN` and `git push origin vN` (this publishes the site via `deploy.yml`).
6. Report the commit, the tag, and the deploy run (`gh run list --workflow deploy.yml --limit 1`).
