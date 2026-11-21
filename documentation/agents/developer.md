# DEVELOPER

Read [roles.md](roles.md) first (tools, `hc`, working without `hc`).

Works in the worktree of one issue, on its branch. Never two developers on the same issue.

1. **Read and check the decisions.** First check the model your system prompt names: if it isn't a Claude
   Sonnet model, stop before anything else and say so in the hand-back (the planner's transcript check is the
   one that counts; this one only catches a wrong launch early). Read the issue and its plan comment. With no worktree (a cloud session
   without `hc`), first create the branch from the latest `origin/main` as in [workflow.md](workflow.md#git). In a
   fresh worktree or checkout, run `npm ci` once (no `node_modules/` yet; the Playwright browser is already
   installed per machine). Then check the plan's "Technical context and decisions" against the actual code before
   building anything. If a decision looks wrong, something must happen first, or a step is missing: **stop and say
   so in the hand-back** (what, why, what you'd do instead). Don't build it, and don't silently take a different
   route. The same applies when a later step shows that a decision is wrong. Challenging a decision is expected and
   welcome, not a failure: the plan was written before anyone touched the code. The planner takes it to the human,
   updates the plan comment once they decide, and tells you to continue (without `hc`: see [roles.md](roles.md#tools)).
2. **For each unticked step**, top to bottom:
   1. Build it, with its tests, even if the step doesn't name them. Keep the change small and focused on this step.
      Follow the [checklist for every change](workflow.md#checklist-for-every-change); read
      [e2e-tests.md](e2e-tests.md) before writing or changing browser tests.
      - New behaviour → new tests: a browser test plus its `tests/CHECKLIST.md` row, and also a unit test in
        `tests/` when it adds logic to `js/core.js`.
      - Changed or removed behaviour → find the tests that cover it (grep the function name in `tests/`, and its
        `tests/CHECKLIST.md` row) and update or remove them so they check the new behaviour.
      - Bug fix → first a test that fails because of the bug, then the fix.
      - Never weaken, skip or delete a test just to make it pass. Change a test only when it checks the wrong
        behaviour, and say why in the commit body; if you're unsure, don't commit: stop and report it.
      - A refactor step changes no behaviour, so it needs no new behaviour test and the existing tests must stay
        green. Tests that check moved internals (`app.js` text, module loading) are adjusted with the change, never
        disabled; the plan and [REFACTOR.md](../REFACTOR.md) say which.
   2. Check it, every step: run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables) #4 (coverage gate
      with enforcement when `js/core.js` changed; a docs-only step needs only the unit tests and `check.ps1`).
   3. All checks pass → commit: one conventional commit, as in [workflow.md](workflow.md#git) (English summary,
      `(vN)` when the version was bumped, no signature lines). One fails and you can't fix it within this step →
      don't commit; stop and report the failing output in the hand-back. Bump the version once per PR: the first
      step that touches `index.html`, `css/` or `js/` bumps it (`app.json` + `node tools/set-version.js`), later steps keep it.
   4. Tick the step in the plan comment. Find its id with `gh api repos/{owner}/{repo}/issues/<N>/comments`
      (the latest comment with the plan checklist), then save the body with the box ticked:
      `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<id> -f body="<full body>"`. Don't use
      `gh issue comment --edit-last`: it edits your own last comment, which may not be the plan.
3. **Out of scope?** Anything you found but won't fix → open a new issue (`gh issue create`) and mention it in
   the PR. Don't silently expand scope.
4. **Review**: first check the whole branch (`git diff origin/main...HEAD`): every behaviour it adds, changes or
   removes has its test written or updated, and its `tests/CHECKLIST.md` row. Add what's missing in its own
   commit after the checks pass. Then do the review in [Review rounds](#review-rounds) below: one round, plus a second only
   when round 1 has MUST FIX items (skip it without `hc`, see [roles.md](roles.md#tools)). Commit the fixes (a
   conventional message saying what was fixed) after the same checks pass. No fixes → no new check run.
5. **Open the PR and hand back:**
   - `git fetch origin`, `git rebase origin/main`. Run the checks in [AGENTS.md](../../AGENTS.md#non-negotiables)
     #4 again only if the rebase brought in new commits; the last green run still counts otherwise.
   - `git push -u origin <branch>`, then `gh pr create --base main`.
     First line of the description: `Closes #<N>` (or `Refs #<N>` if the issue isn't finished). End the
     description with a `## Review` section: the model that reviewed each review cycle, as the model check
     printed it (`claude-opus-…`, transcript-verified, or the fallback the human approved), then `### Round 1` and, if it ran, `### Round 2`, each with the reviewer's reply as it came, in a code block,
     and what you fixed or applied. With no round 2, write `Round 2: not needed (no MUST FIX in round 1).` Then
     `### Not applied`: every NICE TO HAVE you didn't apply, with the issue you opened for it, if any. If the
     review was skipped, say so and why. Never turn on auto-merge and never merge: the human merges, and merging
     is what publishes.
   - Report: the PR link, what changed, what the reviewer found each round, what you fixed or applied and what
     you didn't (and why), new issues opened, and the models: `Models: developer <model> (system-prompt-reported);
     reviewer <model per review cycle> (transcript-verified) | skipped: <why> | failed: <FAIL line>`.

## Review rounds

One review cycle per issue, by Claude Opus, after the last step and before the push: **at most two rounds**,
round 2 only when round 1 had MUST FIX items or you chose to apply a NICE TO HAVE. **Nothing changes in the code
after the final review without being reviewed:** every code change in the PR has been reviewed.

**Round 1**: note the reviewed commit (`git rev-parse --short HEAD`) and make a new session id
([roles.md](roles.md#checking-an-agents-model)), then start the reviewer (no `-p`, so it stays open for round 2):

The reviewer is read-only on purpose: no `node` and no PowerShell tool, since a script could write files. It reads
diffs with Read and Grep; if it needs a check run, it says so and you run it.

```bash
hc run --bg --name review-<N> --cwd <full path of this worktree> claude \
  --model opus \
  --session-id <id> \
  --permission-mode dontAsk \
  "--allowedTools=Read Glob Grep Bash(git diff) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git status *) Bash(git fetch *) Bash(gh issue view *)" \
  "--disallowedTools=Edit Write NotebookEdit" \
  "You are the REVIEWER. Follow documentation/agents/reviewer.md. Review the branch for issue #<N>."
hc wait review-<N> --timeout 1800   # background command (roles.md#tools); on reason: timeout, just wait again
# on a terminal result (done, blocked, error, exit): the model check on <id> with prefix claude-opus-
# (roles.md#checking-an-agents-model), then read
hc read --lines 120 review-<N>
```

**Opus fails** (it doesn't start, `hc get` shows `error`, the reply is an API error instead of a review, or the
model check prints `FAIL`): never use that first output. `hc kill review-<N>; hc rm review-<N>` and retry
**once, on Opus again**, with a new session id; this single retry is the only exception to the fail-closed rule in
[roles.md](roles.md#checking-an-agents-model). If the retry also fails, don't review with another model and don't
push: stop and report both errors (or `FAIL` lines) in the hand-back. The human decides: retry later, or a review
by another Anthropic model (never DeepSeek), which the PR's `## Review` then names as the fallback. A different
model is never chosen automatically.

Copy the reply now for the PR (round 2 scrolls it out of `hc read`). Then:

- **MUST FIX** → always fix them all and have them verified: commit after the checks pass, then round 2. You
  may also apply NICE TO HAVE items that fit this issue's plan; round 2 reviews them too.
- **No MUST FIX** → by default, no round 2 and no more code changes: NICE TO HAVE items go in the PR under
  `### Not applied` (one that needs a new step or touches another area also gets a new issue). Applying a
  NICE TO HAVE is your choice, and choosing it means round 2: apply it, commit after the checks pass, then
  round 2.

**Round 2**: the same reviewer checks only the changes since round 1:

```bash
hc send review-<N> "I changed <round-1 commit>..HEAD. MUST FIX items I fixed: <list>. NICE TO HAVE items I applied: <list, or none>. Check that each MUST FIX is resolved, that each NICE TO HAVE I applied is implemented correctly, and that these commits introduced nothing new."
```

Wait, check and read as in round 1: the same session id, so the check covers every model in the whole review
session. A `FAIL` now means round 2 failed: don't use its reply; stop and report it. Round 2 is the final review: after it, change no code. NICE TO HAVE items from
round 2 go under `### Not applied`. A MUST FIX still open after round 2 → don't fix it unreviewed and don't defer
it alone: report it to the human in the hand-back and at the top of the PR's `## Review`. The human decides.

**Code changes after the final review** (a MUST FIX the human tells you to fix, a CI failure, a conflict you
resolve by hand) get a **separate, targeted review cycle**, not a third round of the one above: commit after the
checks pass, then start a fresh reviewer as in round 1 (a new session id, the same model check after each
terminal wait result) with this prompt. A fresh reviewer knows nothing of earlier reviews, so copy the findings
in word for word:

"You are the REVIEWER. Follow documentation/agents/reviewer.md. Targeted follow-up review: review only
<last reviewed commit>..HEAD on the branch for issue #<N>. Why these changes: <the human's request, the CI
failure or the conflict>. Previous findings these commits address, MUST FIX and NICE TO HAVE: <each finding as
the reviewer wrote it, labelled MUST FIX or NICE TO HAVE, or none>."

It follows the same rules: at most two rounds, round 2 only when its round 1 had MUST FIX items or you chose to
apply a NICE TO HAVE, no code changes after its final review. Add its replies to the PR's `## Review` under
`### Follow-up review`. A rebase with no conflicts changes no code of yours and needs no review.

Shut the reviewer down as soon as you're done with it (`hc kill review-<N>; hc rm review-<N>`), then go to step 5.
