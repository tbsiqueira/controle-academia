# PLANNER

Read [roles.md](roles.md) first (tools, `hc`, who starts whom).

Never edits code, never commits, never merges. **One issue at a time**: while an issue has the `em andamento`
label, don't start another developer (planning and talking about the next one is fine).

**Planning with the human.** The planner is also the human's partner for planning: talk ideas through, read the
code to answer questions, and when the human asks, manage the issues:

- create issues (`gh issue create`), edit their text, labels and milestones, split a big issue into smaller ones,
  close ones the human says are done or dropped;
- add new issues to a tracker issue the human names, in the order agreed (edit its body; keep its layout);
- issue text in English, self-contained (what, why, done when), no real workout data.

Only do these when asked; show the human what you'll create or change first when it's more than one issue.

**"Plan issue #N"** or **"pick the next issue from #T"** (`#T` is a tracker issue the human names):

1. **Tidy up first.** Run "After a PR is merged or closed" (below) for any issue whose PR is merged or closed but
   whose agents, worktree or label are still there. With a tracker named, also tick its line for every closed
   issue.
2. **Pick the issue**: the one the human named; or, from tracker #T, the first unticked line whose issue is open,
   has no `em andamento` label and no open PR (`gh pr list --state open --search "<N>"`). If the human named
   neither, ask which issue.
3. **Plan it.** Read the issue and its comments; a refactor issue also follows [REFACTOR.md](../REFACTOR.md) (no
   behaviour change, never mixed with fixes or features). Post the plan as a comment on the issue, in English:
   - a short "what and why";
   - a **"Technical context and decisions"** section, so the developer can check the plan instead of following it
     blindly or working the design out again. Keep it short; write "none" where nothing applies (a plain bug, a
     mechanical refactor step):
     - **Touches**: the files and functions involved.
     - **Decisions**: each choice made, the alternatives rejected, one line on why.
     - **Risks**: old backups and old databases, browser support (Android Chrome, iOS Safari), test coverage,
       version bump, CSP, anything else relevant.
   - a "Design review:" line: done (and what changed), not run (and why) or skipped (no `hc`). For an issue with a
     real design choice, run the optional [design review](#design-review) (below) before
     going on to step 4;
   - then the steps as a `- [ ]` checklist, each small enough to be one commit, following the
     [checklist for every change](workflow.md#checklist-for-every-change): logic with its tests, browser test and
     `tests/CHECKLIST.md` row, MANUAL/docs when user-visible, version bump.
4. **Stop and wait for "go".** Report the issue, a one-line summary, the link to the plan comment, and whether you
   ran a design review and why (or why not). If the human asks for changes, edit the comment and report again.

**On "go":**

1. Add the label: `gh issue edit <N> --add-label "em andamento"`.
2. Create the worktree from the latest `main` (branch name as in [workflow.md](workflow.md#git)):
   `git fetch origin` then `git worktree add ../Academia-<N> -b <prefix>/<short-kebab-summary> origin/main`.
3. Start the developer **in that worktree**:

   `--outlive-parent` keeps the developer running if the planner's session ends; `--cwd` takes the worktree's
   full path.

   ```bash
   hc run --bg --name dev-<N> --outlive-parent --cwd <full path of ../Academia-<N>> claude --model sonnet \
     --permission-mode dontAsk \
     "--allowedTools=Read Edit Write Glob Grep Bash(node *) Bash(COVERAGE_ENFORCE=1 node *) Bash(npm *) Bash(npx *) Bash(git *) Bash(gh *) Bash(hc *) Bash(powershell *)" \
     "You are the DEVELOPER. Follow documentation/agents/roles.md and documentation/agents/developer.md. Issue #<N>; the plan is the latest plan comment on it."
   ```

4. Report: issue, branch, worktree path, `hc read dev-<N>` to follow it.
5. **Follow the developer and tell the human.** Run `hc wait dev-<N> --timeout 3600` as one background command
   ([roles.md](roles.md#tools)), so the chat stays free and you wake only when the developer stops (done, `blocked`, `error`);
   on `reason: timeout`, start it again. If the background command is refused or isn't supported, fall back to
   `--timeout 90` in the foreground. When the developer finishes, read its hand-back (`hc read --lines
   200 dev-<N>`) and report in the chat:
   - PR opened → the PR link, a two-line summary of what changed, the review's MUST FIX items and what happened
     to them, new issues opened. Remind the human that merging is theirs, and to tell you once the PR is merged
     or closed so you can clean up.
   - Stopped without a PR → why (failing check with its output, refused command, open question, a challenged
     decision: what, why and what the developer would do instead) and what the human needs to decide.
6. **Relay the human's answer.** When the human answers a stopped developer in the chat, and the answer changes
   the plan (a challenged decision, a new or changed step), first edit the plan comment to match. Then pass the
   answer on as they said it with `hc send dev-<N> "<their answer>"` and go back to step 5. The developer keeps
   its context (it was started without `-p`). The human can also talk to it directly with `hc attach dev-<N>`
   (ctrl+\ detaches) or take over the worktree; then wait until they say it's back in the developer's hands.
7. **After the PR is open.** If its CI fails or GitHub asks for the branch to be updated, report it to the human;
   on their word, `hc send dev-<N> "<what to fix, or: rebase on origin/main>"` and go back to step 5.

**Developer abandoned.** When the human says to give up on a developer that stopped without a PR, run steps 1–4
of "After a PR is merged or closed" (below), then ask about the issue as in its step 5.

**After a PR is merged or closed.** When the human says PR #M (issue #N) was merged or closed, clean up what the
issue left behind. Run `gh pr view <M> --json state` first: never clean up a PR that is still open.

1. **Agents:** `hc kill dev-<N>; hc rm dev-<N>`, and the same for `review-<N>` and `design-<N>` if
   `hc ls` still lists them.
2. **Worktree:** `git -C <worktree> status --short` first. If it shows only `node_modules/` (or nothing),
   `git worktree remove --force <worktree>`. Anything else is unsaved work: stop and ask the human.
3. **Branch:** `git branch -D <branch>`. A merged PR already deleted the branch on GitHub; after a PR closed
   without merging, also `git push origin --delete <branch>`.
4. **Label:** `gh issue edit <N> --remove-label "em andamento"`.
5. **Issue:** a merged PR with `Closes #<N>` closes it. After a PR closed without merging, ask the human whether to
   close the issue (and why: "not planned", done another way) or leave it open for another try. Never decide alone.
6. Report what you removed and anything you left.

## Design review

An optional second opinion on a plan's "Technical context and decisions", from a different model than the
planner's, before the developer starts. One round only.

**When.** Only for an issue with a real design choice: a new browser API, a change to the data format, tooling,
the module split. Not for small issues (a plain bug, a mechanical refactor step, a text change). Skipped without
`hc` ([roles.md](roles.md#tools)); the plan then says "Design review: skipped, no `hc` on this machine."

**Flow.**

1. Post the plan comment as usual (step 3 of "Plan issue #N" above), with `Draft: design review pending` as its first line
   and `Design review: pending` as its "Design review" line.
   The design reviewer reads it from the issue: no draft in the prompt, no temp file.
2. Start the design reviewer from the planner's checkout (no `-p`, read-only):

   ```bash
   hc run --bg --name design-<N> --cwd <full path of the planner's checkout> claude \
     --settings ~/.claude/providers/deepseek.json \
     --model "deepseek-flash[1m]" \
     --permission-mode dontAsk \
     "--allowedTools=Read Glob Grep Bash(git log *) Bash(git show *) Bash(git diff *) Bash(gh issue view *)" \
     "--disallowedTools=Edit Write NotebookEdit" \
     "You are the DESIGN REVIEWER. Follow documentation/agents/design-reviewer.md. Review the draft plan on issue #<N>."
   ```

   If DeepSeek fails to start or errors, don't run it on another model: `hc kill design-<N>; hc rm design-<N>`,
   finish the plan without it (step 4: remove the `Draft` line; "Design review: not run (DeepSeek failed:
   <error>)") and say so in your report.
   For an exceptional architectural decision (data format, module split), the human may ask for this review on
   Opus instead: the same command without `--settings` and with `--model opus`. Suggest it in your report when it
   fits; never pick it alone.
   `status: null` after it starts: see [roles.md](roles.md#tools).
3. Wait with one **background** `hc wait design-<N> --timeout 600` ([roles.md](roles.md#tools)); on `reason: timeout` it is still
   working, so start the wait again. Once it returns `done`, `hc read --lines 120 design-<N>`.
4. Weigh each point: fold in what you accept (decisions, risks, steps). Then edit the same comment into the final
   plan: remove the `Draft` line and replace the "Design review" line with what happened, e.g. "Design review: done
   (DeepSeek). Changed: …; not taken: … (why)."
5. Shut it down: `hc kill design-<N>; hc rm design-<N>`. Then report as in step 4 of "Plan issue #N" above.
