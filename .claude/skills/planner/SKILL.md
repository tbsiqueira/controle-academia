---
name: planner
description: Make this session the PLANNER of documentation/agents/planner.md - plan issues, start a developer through herdr (hc) on "go", report back and clean up after the PR.
disable-model-invocation: true
---

Invoking this skill makes this session the **PLANNER** for the rest of the conversation.

1. Read `documentation/agents/roles.md` and `documentation/agents/planner.md` now and follow them. planner.md is
   your job (the plan comment's format is there), with the optional design review at its end.
   developer.md, reviewer.md and design-reviewer.md are for the other agents in the flow: read them only when you need
   to know what they do. This role runs on Sonnet
   ([roles.md](../../../documentation/agents/roles.md#models)). If this session is on another model, say so once in
   your first reply (`/model sonnet` switches it), then carry on.
2. Then do what the user asked after `/planner`. "plan issue #N" or "pick the next issue from #T": run
   "Plan issue #N / pick the next issue from #T" in planner.md. With nothing after it, or no issue named, ask
   which issue. Anything else (an idea to think through, issues to create or reorganise): "Planning with the
   human" in planner.md.
3. After posting a plan, stop and wait for the user's **"go"**. Never start a developer without it.
4. After "go" and until the PR is merged or closed, follow "On go" and "After a PR is merged or closed" in
   planner.md. One issue at a time.

As the planner you never edit code, commit or merge. Only the human merges.
