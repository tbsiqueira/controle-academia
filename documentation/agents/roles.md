# Roles: planner, developer, reviewer

How agents split the work on GitHub issues. Planner and developer run on Claude Code with Opus; the reviewer runs on
Claude Code with a DeepSeek model (setup in [workflow.md](workflow.md#deepseek-reviewer-setup)). Only the human
merges.

> Check the `hc` commands below against `hc --skill` before relying on them.

## 1. Tools

| Tool | What it's for |
|---|---|
| **GitHub issues** | The work. One issue = one branch = one PR. Read with `gh issue view <N> --comments`. |
| **Tracker issue #2** | The order. Its checklist lists the issues to do, top to bottom; ticked = done. |
| **Plan comment** | The steps for one issue: a `- [ ]` checklist the planner posts on the issue and the developer ticks. |
| **Label `em andamento`** | The issue has a developer working on it. |
| **herdr (`hc`)** | Starting and talking to other agents. Names: `planner`, `dev-<N>`, `review-<N>`. |

Run `hc --skill` once at the start of a session so you know the herdr commands. On a machine without `hc` (cloud
sessions, other computers) nobody starts agents: the human starts the developer, the review rounds are skipped, and
the hand-back says so.

**Agents started with `hc --bg` run unattended.** A permission prompt would leave them waiting with nobody to
answer. So they start in `dontAsk` mode (anything not on their allow-list is refused instead of asked) with the
allow-lists in sections 3 and 6. If one still stops, `hc read <name>` shows why; `hc attach <name>` lets the human
answer. Check the flags against `claude --help` the first time.

**Waiting on another agent.** `hc wait` can take longer than a shell command is allowed to run (the Claude desktop
app stops commands after a few minutes). If your commands have a time limit, run `hc wait` in the background, or
check with `hc read` every few minutes until the reply is complete.

## 2. Roles

A session is the **PLANNER**, the **DEVELOPER** or the **REVIEWER** only when it was started with `/planner` or
its prompt names the role. **If your prompt doesn't name a role, you have none:** answer questions and do what
you're asked, under the normal rules (commit only when asked). Reading this file or asking about it doesn't give
you a role.

Never take a role you weren't given. Only the PLANNER and DEVELOPER may start other agents.

The human starts the planner with `/planner` in any Claude Code chat (app or CLI), e.g.
`/planner check the next issue`. Or as a background agent they can talk to whenever they want:

```bash
hc run --bg --name planner claude --model opus "You are the PLANNER. Follow documentation/agents/roles.md."
hc send planner "check the next issue in the list"
hc attach planner
```

## 3. PLANNER

Never edits code, never commits, never merges. **One issue at a time**: while an issue has the `em andamento`
label, don't start another developer (planning and talking about the next one is fine).

**Planning with the human.** The planner is also the human's partner for planning: talk ideas through, read the
code to answer questions, and when the human asks, manage the issues:

- create issues (`gh issue create`), edit their text, labels and milestones, split a big issue into smaller ones,
  close ones the human says are done or dropped;
- add new issues to tracker #2 in the order agreed (edit its body; keep the existing layout);
- issue text in pt-BR, self-contained (what, why, done when), no real workout data.

Only do these when asked; show the human what you'll create or change first when it's more than one issue.

**"Check the next issue"** (or "plan issue #N" for one outside the tracker):

1. **Tidy up first.** For every issue in #2 that is closed: tick its line in #2, remove its `em andamento` label,
   and remove its worktree if one is left (`git worktree remove <path>`).
2. **Pick the next issue**: the first unticked line in #2 whose issue is open, has no `em andamento` label and
   no open PR (`gh pr list --state open --search "<N>"`).
3. **Plan it.** Read the issue and its comments; a refactor issue also follows [REFACTOR.md](../REFACTOR.md) (no
   behaviour change, never mixed with fixes or features). Post the plan as a comment on the issue:
   - a short "what and why" in pt-BR, then the steps as a `- [ ]` checklist, each small enough to be one commit;
   - follow the [checklist for every change](workflow.md#checklist-for-every-change): logic with its tests,
     browser test and `tests/CHECKLIST.md` row, MANUAL/docs when user-visible, version bump.
4. **Stop and wait for "go".** Report the issue, a one-line summary and the link to the plan comment. If the human
   asks for changes, edit the comment and report again.

**On "go":**

1. Add the label: `gh issue edit <N> --add-label "em andamento"`.
2. Create the worktree from the latest `main` (branch name as in [workflow.md](workflow.md#git)):
   `git fetch origin` then `git worktree add ../Academia-<N> -b <prefix>/<short-kebab-summary> origin/main`.
3. Start the developer **in that worktree**:

   ```bash
   cd ../Academia-<N>
   hc run --bg --name dev-<N> claude --model opus \
     --permission-mode dontAsk \
     --allowedTools "Read Edit Write Glob Grep Bash(node:*) Bash(npm:*) Bash(npx:*) Bash(git:*) Bash(gh:*) Bash(hc:*) Bash(powershell:*)" \
     "You are the DEVELOPER. Follow documentation/agents/roles.md. Issue #<N>; the plan is the latest plan comment on it."
   ```

4. Report: issue, branch, worktree path, `hc read dev-<N>` to follow it.
5. **Follow the developer and tell the human.** Run `hc wait dev-<N>` in the background (or check `hc read dev-<N>`
   every few minutes), so the chat stays free. When the developer finishes, read its hand-back (`hc read --lines
   200 dev-<N>`) and report in the chat:
   - PR opened → the PR link, a two-line summary of what changed, the review's MUST FIX items and what happened
     to them, new issues opened. Remind the human that merging is theirs.
   - Stopped without a PR → why (failing check with its output, refused command, open question) and what the
     human needs to decide.
6. **Relay the human's answer.** When the human answers a stopped developer in the chat, pass it on as they said
   it with `hc send dev-<N> "<their answer>"` and go back to step 5. The developer keeps its context (it was
   started without `-p`). The human can also talk to it directly with `hc attach dev-<N>` (ctrl+\ detaches) or
   take over the worktree; then wait until they say it's back in the developer's hands.

## 4. DEVELOPER

Works in the worktree of one issue, on its branch. Never two developers on the same issue.

1. **Read** the issue and its plan comment.
2. **For each unticked step**, top to bottom:
   1. Build it. Keep the change small and focused on this step.
   2. Check it, every step, all three:
      - `node --test tests/` (or `node tools/coverage-gate.js` when `js/core.js` changed: coverage stays 100%)
      - `powershell -ExecutionPolicy Bypass -File .\check.ps1` (must print "Tudo certo.")
      - `npm run test:e2e`
   3. Commit only when all of them pass. If one fails and you can't fix it within this step, don't commit: stop
      and report the failing output in the hand-back. Then commit it: one conventional commit, as in [workflow.md](workflow.md#git) (Portuguese summary without
      accents, `(vN)` when the version was bumped, no signature lines). Bump the version once per PR: the first
      step that touches `index.html`, `css/` or `js/` bumps it, later steps keep it.
   4. Tick the step in the plan comment.
3. **Out of scope?** Anything you found but won't fix → open a new issue (`gh issue create`) and mention it in
   the PR. Don't silently expand scope.
4. **Review**: do the two rounds in section 6. Commit the fixes (a conventional message saying what was fixed),
   after the same three checks pass.
5. **Open the PR and hand back:**
   - Run the full set once more: `node --test tests/`, `check.ps1`, `npm run test:e2e`.
   - `git fetch origin`, `git rebase origin/main`, `git push -u origin <branch>`, then `gh pr create --base main`.
     First line of the description: `Closes #<N>` (or `Refs #<N>` if the issue isn't finished). End the
     description with a `## Revisão` section: the model that reviewed (DeepSeek or the Sonnet fallback) and the
     reviewer's last reply as it came, in a code block; if the review was skipped, say so and why. Never turn on
     auto-merge and never merge: the human merges, and merging is what publishes.
   - Report: the PR link, what changed, what the reviewer found each round and what you didn't fix (and why), new
     issues opened, and which model did the review (DeepSeek or the Sonnet fallback).

## 5. REVIEWER

- Only review. Do not edit files. Do not start other agents. Do not touch issues or PRs.
- Look at everything the branch changes: `git diff origin/main...HEAD` plus uncommitted changes (`git diff`), the
  issue and its plan comment (`gh issue view <N> --comments`).
- Check:
  - Does it do what the issue and the plan ask? Nothing more (no scope creep, no refactor mixed with a fix)?
  - Bugs, edge cases, missing tests. Logic belongs in `js/core.js` with tests; `js/app.js` only renders and wires
    the DOM.
  - Old backups and old databases still load, unknown fields ignored ([architecture.md](architecture.md)).
  - `index.html`, `css/` or `js/` changed → version bumped in every place listed in workflow.md.
  - New or changed behaviour → `tests/CHECKLIST.md` row with a browser test; user-visible → `documentation/MANUAL.md`.
  - [Product rules](product-rules.md): UI text in pt-BR; no sound, vibration or flashing; no extra taps on the
    training screen.
  - Security: HTML built from strings in `app.js` must escape user text (XSS); nothing that breaks the CSP in
    `index.html`.
- Reply in this format, nothing else:

```
MUST FIX
- file:line – problem – suggested fix

NICE TO HAVE
- ...

LOOKS GOOD
- ...
```

- When asked to check again: confirm each earlier MUST FIX item as fixed / not fixed, then list anything new.

## 6. Review rounds (DEVELOPER runs these)

One review per issue, after the last step and before the push. A large issue may also get one after a step that
stands on its own.

**Round 1**: start the reviewer (no `-p`, so it stays open for round 2):

```bash
hc run --bg --name review-<N> claude \
  --settings ~/.claude/providers/deepseek.json \
  --model "deepseek-flash[1m]" \
  --permission-mode dontAsk \
  --allowedTools "Read Glob Grep Bash(git diff:*) Bash(git log:*) Bash(git show:*) Bash(git status:*) Bash(gh issue view:*)" \
  --disallowedTools "Edit Write NotebookEdit" \
  "You are the REVIEWER. Follow section 5 of documentation/agents/roles.md. Review the branch for issue #<N>."
hc wait review-<N>
hc read --lines 120 review-<N>
```

If the DeepSeek reviewer fails to start or errors, run the same command without `--settings` and with
`--model sonnet`, and say so in the hand-back.

Fix all MUST FIX items.

**Round 2**: ask the same reviewer to check again:

```bash
hc send review-<N> "I fixed your points. Check again: is every MUST FIX resolved, and is there anything new?"
hc wait review-<N>
hc read --lines 120 review-<N>
```

Fix what's left if it's small. Otherwise open a new issue for it. **Maximum 2 rounds.** Then go to step 5 of
the DEVELOPER.

## 7. Rules for everyone

- Never put real workout data (from your own backups or the phone) in issues, comments, prompts, commit messages
  or test fixtures. Use the sample data or made-up data.
- Never paste or commit credentials (API keys included). If you see one, stop and tell the human so it can be
  rotated.
- When unsure, stop and ask the human rather than guessing.
