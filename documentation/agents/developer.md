# DEVELOPER

Read [roles.md](roles.md) first (tools, `hc`, working without `hc`).

Works in the worktree of one issue, on its branch. Never two developers on the same issue.

1. **Read and check the decisions.** Read the issue and its plan comment. With no worktree (a cloud session
   without `hc`), first create the branch from the latest `origin/main` as in [workflow.md](workflow.md#git). In a
   fresh worktree or checkout, run `npm ci` once (no `node_modules/` yet; the Playwright browser is already
   installed per machine). Then check the plan's "Technical context and decisions" against the actual code before
   building anything. If a decision looks wrong, something must happen first, or a step is missing: **stop and say
   so in the hand-back** (what, why, what you'd do instead). Don't build it, and don't silently take a different
   route. The same applies when a later step shows that a decision is wrong. Challenging a decision is expected and
   welcome, not a failure: the plan was written before anyone touched the code. The planner takes it to the human,
   updates the plan comment once they decide, and tells you to continue (without `hc`: see [roles.md](roles.md#tools)).
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
4. **Review**: do the two rounds in [Review rounds](#review-rounds) below (skip them without `hc`, see
   [roles.md](roles.md#tools)). Commit the fixes (a
   conventional message saying what was fixed) after the same checks pass. No fixes → no new check run.
5. **Open the PR and hand back:**
   - `git fetch origin`, `git rebase origin/main`. Run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables)
     #4 again only if the rebase brought in new commits; the last green run still counts otherwise.
   - `git push -u origin <branch>`, then `gh pr create --base main`.
     First line of the description: `Closes #<N>` (or `Refs #<N>` if the issue isn't finished). End the
     description with a `## Review` section: the model that reviewed (DeepSeek or the Sonnet fallback), then
     `### Round 1` and `### Round 2`, each with the reviewer's reply to that round as it came, in a code block,
     and under round 1 what you fixed; if the review was skipped, say so and why. Never turn on
     auto-merge and never merge: the human merges, and merging is what publishes.
   - Report: the PR link, what changed, what the reviewer found each round and what you didn't fix (and why), new
     issues opened, and which model did the review (DeepSeek or the Sonnet fallback).

## Review rounds

One review per issue, after the last step and before the push.

**Round 1**: start the reviewer (no `-p`, so it stays open for round 2):

```bash
hc run --bg --name review-<N> --cwd <full path of this worktree> claude \
  --settings ~/.claude/providers/deepseek.json \
  --model "deepseek-flash[1m]" \
  --permission-mode dontAsk \
  "--allowedTools=Read Glob Grep Bash(git diff) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *) Bash(gh issue view *)" \
  "--disallowedTools=Edit Write NotebookEdit" \
  "You are the REVIEWER. Follow documentation/agents/reviewer.md. Review the branch for issue #<N>."
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
go to step 5 above.
