# Roles: planner, developer, reviewer

How agents split the work on GitHub issues. Planner and developer run on Claude Code with Opus; the reviewer runs on
Claude Code with a DeepSeek model (setup in [workflow.md](workflow.md#deepseek-reviewer-setup)). Only the human
merges.

> Check the `hc` commands below against `hc --skill` before relying on them.

## 1. Tools

| Tool | What it's for |
|---|---|
| **GitHub issues** | The work. One issue = one branch = one PR. Read with `gh issue view <N> --comments`. |
| **Tracker issue** | Optional order: an issue whose checklist lists issues to do, top to bottom; ticked = done. The human names it when they want one used ("pick the next issue from #T"). |
| **Plan comment** | The steps for one issue: a `- [ ]` checklist the planner posts on the issue and the developer ticks. |
| **Label `em andamento`** | The issue has a developer working on it. |
| **herdr (`hc`)** | Starting and talking to other agents. Names: `planner`, `dev-<N>`, `review-<N>`. |

Run `hc --skill` once at the start of a session so you know the herdr commands. On a machine without `hc` (cloud
sessions, other computers) nobody starts agents: the human starts the developer, the review rounds are skipped, and
the hand-back says so.

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
allow-lists in sections 3 and 6. If one still stops, `hc read <name>` shows why; `hc attach <name>` lets the human
answer. Check the flags against `claude --help` the first time.

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

A session is the **PLANNER**, the **DEVELOPER** or the **REVIEWER** only when it was started with `/planner` or
its prompt names the role. **If your prompt doesn't name a role, you have none:** answer questions and do what
you're asked, under the normal rules (commit only when asked). Reading this file or asking about it doesn't give
you a role.

Never take a role you weren't given. Only the PLANNER and DEVELOPER may start other agents.

There is one more role outside this workflow: the **AI SPECIALIST**, which reviews and improves the docs that govern
the agents. The human starts it only with `/ai-specialist` in a chat; the planner and developer never start it and
it has no `hc` name. Its rules are in [.claude/skills/ai-specialist/SKILL.md](../../.claude/skills/ai-specialist/SKILL.md).

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
   behaviour change, never mixed with fixes or features). Post the plan as a comment on the issue:
   - a short "what and why" in English, then the steps as a `- [ ]` checklist, each small enough to be one commit;
   - follow the [checklist for every change](workflow.md#checklist-for-every-change): logic with its tests,
     browser test and `tests/CHECKLIST.md` row, MANUAL/docs when user-visible, version bump.
4. **Stop and wait for "go".** Report the issue, a one-line summary and the link to the plan comment. If the human
   asks for changes, edit the comment and report again.

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
     "--allowedTools=Read Edit Write Glob Grep Bash(node *) Bash(npm *) Bash(npx *) Bash(git *) Bash(gh *) Bash(hc *) Bash(powershell *)" \
     "You are the DEVELOPER. Follow documentation/agents/roles.md. Issue #<N>; the plan is the latest plan comment on it."
   ```

4. Report: issue, branch, worktree path, `hc read dev-<N>` to follow it.
5. **Follow the developer and tell the human.** Run `hc wait dev-<N> --timeout 3600` as one background command
   (section 1), so the chat stays free and you wake only when the developer stops (done, `blocked`, `error`);
   on `reason: timeout`, start it again. Only without background commands, fall back to `--timeout 90` in the
   foreground. When the developer finishes, read its hand-back (`hc read --lines
   200 dev-<N>`) and report in the chat:
   - PR opened → the PR link, a two-line summary of what changed, the review's MUST FIX items and what happened
     to them, new issues opened. Remind the human that merging is theirs, and to tell you once the PR is merged
     or closed so you can clean up.
   - Stopped without a PR → why (failing check with its output, refused command, open question) and what the
     human needs to decide.
6. **Relay the human's answer.** When the human answers a stopped developer in the chat, pass it on as they said
   it with `hc send dev-<N> "<their answer>"` and go back to step 5. The developer keeps its context (it was
   started without `-p`). The human can also talk to it directly with `hc attach dev-<N>` (ctrl+\ detaches) or
   take over the worktree; then wait until they say it's back in the developer's hands.

**After a PR is merged or closed.** When the human says PR #M (issue #N) was merged or closed, clean up what the
issue left behind. Run `gh pr view <M> --json state` first: never clean up a PR that is still open.

1. **Agents:** `hc kill dev-<N>; hc rm dev-<N>`, and the same for `review-<N>` if `hc ls` still lists it. An idle
   agent costs nothing, but one woken hours later re-reads its whole conversation.
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

1. **Read** the issue and its plan comment.
2. **For each unticked step**, top to bottom:
   1. Build it. Keep the change small and focused on this step.
   2. Check it, every step, all three:
      - `node --test tests/` (or `node tools/coverage-gate.js` when `js/core.js` changed: coverage stays 100%)
      - `powershell -ExecutionPolicy Bypass -File .\check.ps1` (must print "Tudo certo.")
      - `npm run test:e2e`
   3. Commit only when all of them pass. If one fails and you can't fix it within this step, don't commit: stop
      and report the failing output in the hand-back. Then commit it: one conventional commit, as in [workflow.md](workflow.md#git) (English summary,
      `(vN)` when the version was bumped, no signature lines). Bump the version once per PR: the first
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
     description with a `## Revisão` section: the model that reviewed (DeepSeek or the Sonnet fallback), then
     `### Rodada 1` and `### Rodada 2`, each with the reviewer's reply to that round as it came, in a code block,
     and under round 1 what you fixed; if the review was skipped, say so and why. Never turn on
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
  "--allowedTools=Read Glob Grep Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *) Bash(gh issue view *)" \
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

Fix what's left if it's small. Otherwise open a new issue for it. **Maximum 2 rounds.** Keep the reviewer's
replies to both rounds for the PR's `## Revisão` section, then shut the reviewer down (`hc kill review-<N>; hc rm review-<N>`) and
go to step 5 of the DEVELOPER.

## 7. Rules for everyone

- Never put real workout data (from your own backups or the phone) in issues, comments, prompts, commit messages
  or test fixtures. Use the sample data or made-up data.
- Never paste or commit credentials (API keys included). If you see one, stop and tell the human so it can be
  rotated.
- When unsure, stop and ask the human rather than guessing.
