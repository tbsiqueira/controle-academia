# Roles: planner, developer, reviewer, design reviewer

How agents split the work on GitHub issues. The reviewer and the design reviewer run on DeepSeek (setup in
[workflow.md](workflow.md#deepseek-reviewer-setup)). Only the human merges.

## 1. Tools

| Tool | What it's for |
|---|---|
| **GitHub issues** | The work. One issue = one branch = one PR. Read with `gh issue view <N> --comments`. |
| **Tracker issue** | Optional order: an issue whose checklist lists issues to do, top to bottom; ticked = done. The human names it when they want one used ("pick the next issue from #T"). |
| **Plan comment** | The plan for one issue, posted by the planner: what and why, "Technical context and decisions", a "Design review:" line, and the steps as a `- [ ]` checklist the developer ticks (section 3). |
| **Label `em andamento`** | The issue has a developer working on it. |
| **herdr (`hc`)** | Starting and talking to other agents. Names: `planner`, `dev-<N>`, `review-<N>`, `design-<N>`, `review-docs` (AI SPECIALIST). |

Every agent that uses `hc` runs `hc --skill` once at the start of its session and checks the `hc` commands in this file against it.

**Without `hc`** (cloud sessions, other computers) nobody starts agents. On "go" the planner still adds the label
and, on a local computer, creates the worktree (section 3, steps 1–2), then gives the human this prompt to paste
into a new chat opened in that worktree (in a cloud session the new chat has its own checkout: the developer
creates the branch itself as in [workflow.md](workflow.md#git)):
"You are the DEVELOPER. Follow documentation/agents/roles.md. Issue #<N>; the plan is the latest plan comment on
it. No `hc` on this machine." The developer skips step 4 (no review rounds) and the PR's
`## Review` section says "Skipped: no `hc` on this machine." The planner also skips the design review (section 8)
and the plan says so. When the developer challenges a decision (section 4, step 1), the human answers in that chat;
the developer edits the plan comment to match and carries on.

**Start the `hc` server from a normal terminal, never from Claude.** Every agent `hc` starts gets the environment
of the `hc` server, not of the command that ran `hc run`. Any `hc` command starts the server when it isn't
running; if that command came from a Claude session (the desktop app or an agent), the server keeps Claude's
`ANTHROPIC_*`/`CLAUDE_CODE_*` variables and every agent breaks: `hc` never sees its status (`status: null`, so
`hc wait` only returns on timeout), the DeepSeek reviewer sends the Claude login to DeepSeek (401, "issue with the
selected model") and transcripts are not saved. So the human runs `hc server restart` in a normal terminal
(Windows Terminal, not one opened from Claude) before using the flow. An agent that shows `status: null` after
starting, or the warning "Transcript saving is off", means the server was started from Claude: stop and ask the
human to restart it.

**Agents started with `hc --bg` run unattended.** A permission prompt would leave them waiting with nobody to
answer. So they start in `dontAsk` mode (anything not on their allow-list is refused instead of asked) with the
allow-lists in sections 3, 6 and 8. If one still stops, `hc read <name>` shows why; `hc attach <name>` lets the
human answer. The exception is a planner started with `hc` (section 2): the human attaches to it and answers its
prompts.

**Tool lists take the `=` form** (`"--allowedTools=Read Edit …"`, `"--disallowedTools=Edit …"`). These flags take
several values, so with a space (`--allowedTools "…" "prompt"`) Claude reads the prompt as one more tool name and
the agent starts with an empty prompt. Keep the prompt as the last argument.

**Waiting on another agent.** `hc wait <name>` returns the moment the agent stops working (done, `blocked`,
`error` or exit); `--timeout` is only a cap, and `reason: timeout` just means "still working": wait again.

- **Long waits (the planner waiting for a developer):** one **background** command,
  `hc wait <name> --timeout 3600`. Background commands have no 2-minute limit and you are woken only when it
  ends, so you hear back as soon as the agent stops, without spending a turn every few minutes.
- **Short waits in the foreground (the developer waiting for a review):** `hc wait <name> --timeout 90`, under
  the 2-minute limit Claude Code puts on a shell command; repeat on timeout.

`hc get <name>` shows its status: `working`, `done`, `blocked` (it needs a person: read its screen), `error`.
Never sleep or poll in a loop of your own.

## 2. Roles

Who has a role, and who doesn't, is in [AGENTS.md](../../AGENTS.md#roles). Never take a role you weren't given.
Only the PLANNER and DEVELOPER may start other agents. The AI SPECIALIST is outside this workflow (see
[its SKILL.md](../../.claude/skills/ai-specialist/SKILL.md)). Separately, the AI SPECIALIST may start one REVIEWER
round on its own docs branch, before opening the PR, and only when the human asks.

The human starts the planner with `/planner` in any Claude Code chat (app or CLI), e.g.
`/planner plan issue #12` or `/planner pick the next issue from #7`. Or as a background agent they can talk to
whenever they want:

```bash
hc run --bg --name planner claude --model opus "You are the PLANNER. Follow documentation/agents/roles.md."
hc send planner "plan issue #12"
hc attach planner
```

## 3. PLANNER

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
     real design choice, run the optional [design review](#8-design-review-planner-runs-it) (section 8) before
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
   hc run --bg --name dev-<N> --outlive-parent --cwd <full path of ../Academia-<N>> claude --model opus \
     --permission-mode dontAsk \
     "--allowedTools=Read Edit Write Glob Grep Bash(node *) Bash(COVERAGE_ENFORCE=1 node *) Bash(npm *) Bash(npx *) Bash(git *) Bash(gh *) Bash(hc *) Bash(powershell *)" \
     "You are the DEVELOPER. Follow documentation/agents/roles.md. Issue #<N>; the plan is the latest plan comment on it."
   ```

4. Report: issue, branch, worktree path, `hc read dev-<N>` to follow it.
5. **Follow the developer and tell the human.** Run `hc wait dev-<N> --timeout 3600` as one background command
   (section 1), so the chat stays free and you wake only when the developer stops (done, `blocked`, `error`);
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

## 4. DEVELOPER

Works in the worktree of one issue, on its branch. Never two developers on the same issue.

1. **Read and check the decisions.** Read the issue and its plan comment. With no worktree (a cloud session
   without `hc`), first create the branch from the latest `origin/main` as in [workflow.md](workflow.md#git). In a
   fresh worktree or checkout, run `npm ci` once (no `node_modules/` yet; the Playwright browser is already
   installed per machine). Then check the plan's "Technical context and decisions" against the actual code before
   building anything. If a decision looks wrong, something must happen first, or a step is missing: **stop and say
   so in the hand-back** (what, why, what you'd do instead). Don't build it, and don't silently take a different
   route. The same applies when a later step shows that a decision is wrong. Challenging a decision is expected and
   welcome, not a failure: the plan was written before anyone touched the code. The planner takes it to the human,
   updates the plan comment once they decide, and tells you to continue (without `hc`: see section 1).
2. **For each unticked step**, top to bottom:
   1. Build it. Keep the change small and focused on this step.
   2. Check it, every step: run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables) #4 (coverage gate
      with enforcement when `js/core.js` changed; a docs-only step needs only the unit tests and `check.ps1`).
   3. All checks pass → commit: one conventional commit, as in [workflow.md](workflow.md#git) (English summary,
      `(vN)` when the version was bumped, no signature lines). One fails and you can't fix it within this step →
      don't commit; stop and report the failing output in the hand-back. Bump the version once per PR: the first
      step that touches `index.html`, `css/` or `js/` bumps it, later steps keep it.
   4. Tick the step in the plan comment. Find its id with `gh api repos/{owner}/{repo}/issues/<N>/comments`
      (the latest comment with the plan checklist), then save the body with the box ticked:
      `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<id> -f body="<full body>"`. Don't use
      `gh issue comment --edit-last`: it edits your own last comment, which may not be the plan.
3. **Out of scope?** Anything you found but won't fix → open a new issue (`gh issue create`) and mention it in
   the PR. Don't silently expand scope.
4. **Review**: do the two rounds in section 6 (skip them without `hc`, see section 1). Commit the fixes (a conventional message saying what was fixed),
   after the same three checks pass.
5. **Open the PR and hand back:**
   - Run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables) #4 once more.
   - `git fetch origin`, `git rebase origin/main`, `git push -u origin <branch>`, then `gh pr create --base main`.
     First line of the description: `Closes #<N>` (or `Refs #<N>` if the issue isn't finished). End the
     description with a `## Review` section: the model that reviewed (DeepSeek or the Sonnet fallback), then
     `### Round 1` and `### Round 2`, each with the reviewer's reply to that round as it came, in a code block,
     and under round 1 what you fixed; if the review was skipped, say so and why. Never turn on
     auto-merge and never merge: the human merges, and merging is what publishes.
   - Report: the PR link, what changed, what the reviewer found each round and what you didn't fix (and why), new
     issues opened, and which model did the review (DeepSeek or the Sonnet fallback).

## 5. REVIEWER

- Only review. Do not edit files. Do not start other agents. Do not touch issues or PRs.
- Look at everything the branch changes: `git diff origin/main...HEAD` plus uncommitted changes (`git diff`), the
  issue and its plan comment (`gh issue view <N> --comments`). With no issue (an AI SPECIALIST docs PR), the
  prompt states the goal instead. If a command is refused, say under LOOKS GOOD what you couldn't check.
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

One review per issue, after the last step and before the push.

**Round 1**: start the reviewer (no `-p`, so it stays open for round 2):

```bash
hc run --bg --name review-<N> --cwd <full path of this worktree> claude \
  --settings ~/.claude/providers/deepseek.json \
  --model "deepseek-flash[1m]" \
  --permission-mode dontAsk \
  "--allowedTools=Read Glob Grep Bash(git diff) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *) Bash(gh issue view *)" \
  "--disallowedTools=Edit Write NotebookEdit" \
  "You are the REVIEWER. Follow section 5 of documentation/agents/roles.md. Review the branch for issue #<N>."
hc wait review-<N> --timeout 90   # repeat while it returns reason: timeout
hc read --lines 120 review-<N>
```

If the DeepSeek reviewer fails to start or errors, run the same command without `--settings` and with
`--model sonnet`, and say so in the hand-back.

Copy this reply now for the PR (round 2 scrolls it out of `hc read`). Fix all MUST FIX items.

**Round 2**: ask the same reviewer to check again:

```bash
hc send review-<N> "I fixed your points. Check again: is every MUST FIX resolved, and is there anything new?"
hc wait review-<N> --timeout 90   # repeat while it returns reason: timeout
hc read --lines 120 review-<N>
```

After round 2, fix what's left if it fits within this issue's plan. A NICE TO HAVE that needs a new step or
touches another area → open a new issue for it. A MUST FIX you can't fix this way → don't defer it alone: report
it to the human in the hand-back. **Maximum 2 rounds.** Keep the reviewer's
replies to both rounds for the PR's `## Review` section, then shut the reviewer down (`hc kill review-<N>; hc rm review-<N>`) and
go to step 5 of the DEVELOPER.

## 7. Rules for everyone

- Never put real workout data (from your own backups or the phone) in issues, comments, prompts, commit messages
  or test fixtures. Use the sample data or made-up data.
- Never paste or commit credentials (API keys included). If you see one, stop and tell the human so it can be
  rotated.
- When unsure, stop and ask the human rather than guessing.

## 8. Design review (PLANNER runs it)

An optional second opinion on a plan's "Technical context and decisions", from a different model than the
planner's, before the developer starts. One round only.

**When.** Only for an issue with a real design choice: a new browser API, a change to the data format, tooling,
the module split. Not for small issues (a plain bug, a mechanical refactor step, a text change). Skipped without
`hc` (section 1); the plan then says "Design review: skipped, no `hc` on this machine."

**Flow.**

1. Post the plan comment as usual (section 3, "Plan it"), with `Draft: design review pending` as its first line
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
     "You are the DESIGN REVIEWER. Follow section 8 of documentation/agents/roles.md. Review the draft plan on issue #<N>."
   ```

   If DeepSeek fails to start or errors, run the same command without `--settings` and with `--model sonnet`.
   `status: null` after it starts is the `hc` server, not the command: ask the human to restart the server
   (section 1).
3. Wait with one **background** `hc wait design-<N> --timeout 600` (section 1); on `reason: timeout` it is still
   working, so start the wait again. Once it returns `done`, `hc read --lines 120 design-<N>`.
4. Weigh each point: fold in what you accept (decisions, risks, steps). Then edit the same comment into the final
   plan: remove the `Draft` line and replace the "Design review" line with what happened, e.g. "Design review: done
   (DeepSeek). Changed: …; not taken: … (why)."
5. Shut it down: `hc kill design-<N>; hc rm design-<N>`. Then report as in section 3, step 4.

**The DESIGN REVIEWER.**

- Only review the plan. Do not edit files. Do not start other agents. Do not touch issues or PRs.
- Read the issue and its latest plan comment (`gh issue view <N> --comments`), then the code the plan touches.
  Check its decisions against the code and the docs ([architecture.md](architecture.md),
  [product-rules.md](product-rules.md), [history.md](history.md)): a better alternative, a decision that breaks
  something, a missing step, a risk not listed (old backups and old databases, Android Chrome and iOS Safari,
  test coverage, version bump, CSP).
- Reply in this format, one line per point, nothing else:

```
DISAGREE
- decision or file – problem – what instead

RISKS MISSED
- ...

LOOKS GOOD
- ...
```
