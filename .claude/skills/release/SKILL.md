---
name: release
description: Test, commit on a branch, push, open a PR and set it to rebase-merge when the checks pass, so deploy.yml publishes and tags vN. Use when the user types /release or asks to test, commit, push and publish.
---

Invoking this skill is the user's explicit request to commit, push, open the PR and turn on its auto-merge. Do not ask again at each step.

`main` is protected (PR only, rebase merge only, required checks). Never push to `main` and never create tags: merging a PR whose version has no tag yet makes `deploy.yml` publish and tag `vN`.

1. Run `node --test tests/` and `powershell -ExecutionPolicy Bypass -File .\check.ps1`. If either fails, stop and report the output.
2. Read the version `N` from `<span id="appVersion">vN</span>` in `index.html`. If `index.html`, `css/` or `js/` changed and tag `vN` already exists (`git ls-remote --tags origin vN`), the bump is missing: stop and say so.
3. If you are on `main`, create a branch `<prefix>/<short-kebab-summary>` (same prefix as the commit). `git status` + `git diff`: commit the pending changes with a short conventional message ending in `(vN)` when the version was bumped, plus the attribution line. Never commit secrets or unrelated files.
4. `git fetch origin` and `git rebase origin/main`. If the rebase conflicts (often the version number, when another PR already shipped `vN`), stop and report instead of forcing. Push with `git push -u origin <branch>` (`--force-with-lease` only if this branch was already pushed and you just rebased it).
5. Open the PR if the branch has none (`gh pr create --base main --fill`), then `gh pr merge --rebase --auto`.
6. Report the PR link, its checks (`gh pr checks`), and that once it merges `deploy.yml` publishes and tags `vN` (or publishes nothing when the version did not change).
