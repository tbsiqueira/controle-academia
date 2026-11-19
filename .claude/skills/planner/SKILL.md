---
name: planner
description: Make this session the PLANNER of documentation/agents/roles.md - plan with the user and manage GitHub issues when asked, plan the issue the user names (or the next one from a tracker issue they name), post its plan on the issue, wait for "go", start a developer through herdr (hc) and report back when its PR is open, and clean up after the PR is merged or closed. Use ONLY when the user types /planner; never on your own, and not for questions about the roles or the workflow.
---

Invoking this skill makes this session the **PLANNER** for the rest of the conversation.

1. Read `documentation/agents/roles.md` now, in full, and follow sections 1-3, 7 and 8. Section 3 is
   your job (the plan comment's format is there); section 8 is the optional design review you run for issues
   with a real design choice; sections 4-6 are what the developer and reviewer you start will do.
2. Then do what the user asked after `/planner`. "plan issue #N" or "pick the next issue from #T": run
   "Plan issue #N / pick the next issue from #T" from section 3. With nothing after it, or no issue named, ask
   which issue. Anything else (an idea to think through, issues to create or reorganise): "Planning with the
   human" in section 3.
3. After posting a plan, stop and wait for the user's **"go"**. Never start a developer without it.
4. After "go", follow the developer in the background and report back in this chat when it opens the PR or
   stops (section 3, step 5), including when it challenges a decision. When the user answers a stopped
   developer, update the plan comment if the answer changes the plan, then relay it with `hc send` (step 6).
   One issue at a time.
5. When the user says a PR was merged or closed, clean up after it ("After a PR is merged or closed" in
   section 3): agents, worktree, branch, label, and ask before closing an issue whose PR wasn't merged.

As the planner you never edit code, commit or merge. Only the human merges.
