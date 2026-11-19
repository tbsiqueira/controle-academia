# Roles: what the planner and developer share

How agents split the work on GitHub issues. The PLANNER and DEVELOPER read this file, then their own
([planner.md](planner.md), [developer.md](developer.md)); the REVIEWER and DESIGN REVIEWER read only theirs
([reviewer.md](reviewer.md), [design-reviewer.md](design-reviewer.md)). Only the human merges.

## Models

Sonnet builds, Opus challenges.

| Role | Model | Launch flags (always explicit) | Accepted model prefix | Started by |
|---|---|---|---|---|
| PLANNER | Sonnet | Chat: none; the chat must already be on Sonnet (`/planner` doesn't switch the model). `hc`: `--model sonnet --session-id <id>`, no `--settings`. | `claude-sonnet-` (chat: system-prompt-reported; `hc`: transcript-verified) | The human: `/planner` in a chat, or `hc run` below. Opus only when the human asks for it, for an exceptional architectural decision. |
| DEVELOPER | Sonnet | `--model sonnet --session-id <id>`, no `--settings` (Anthropic) | `claude-sonnet-` | The planner ([planner.md](planner.md), "On go") |
| REVIEWER | Opus (Anthropic), whenever agent review is available | `--model opus --session-id <id>`, no `--settings` | `claude-opus-` | The developer ([developer.md](developer.md#review-rounds)); never swapped for another model without the human's OK, and never for DeepSeek. Without `hc` there is no agent review ([Tools](#tools)). |
| DESIGN REVIEWER (optional) | DeepSeek Flash | `--settings ~/.claude/providers/deepseek.json --model "deepseek-flash[1m]" --session-id <id>` | `deepseek-flash` | The planner ([planner.md](planner.md#design-review)); setup in [deepseek-setup.md](deepseek-setup.md) |
| DESIGN REVIEWER on Opus (only on the human's explicit OK) | Opus | `--model opus --session-id <id>`, no `--settings` | `claude-opus-` | The planner ([planner.md](planner.md#design-review)) |

**Cost.** Since 2026-11-19 the REVIEWER runs on Opus instead of DeepSeek Flash, and planning and building moved
from Opus to Sonnet. Opus costs more per token than DeepSeek Flash, but what a review actually costs depends on
how many tokens it uses. The cost of the flow is measured across complete issues, before and after this change;
never claim a saving from model prices alone. No automatic model switching: a model changes only when this table
changes.

## Checking an agent's model

Never rely on a model inherited from the parent session, and never pass `--fallback-model`. Every launched
agent is **transcript-verified**:

1. Before `hc run`, make a session id: `node -e "console.log(crypto.randomUUID())"`. Pass it as
   `--session-id <id>` and keep it for the report.
2. When an `hc wait` on that agent returns a **terminal result** (`done`, `blocked`, `error` or exit; only the
   waits named in the role files, no extra wait or poll), run the check **before** you use its output. Never
   on `reason: timeout`: the agent is still working, so just start another background wait. The check works as
   is in Bash and in Windows PowerShell:

   ```bash
   node -e "const fs=require('fs'),p=require('path'),[id,want]=process.argv.slice(1),r=p.join(require('os').homedir(),'.claude','projects');let f;try{f=fs.readdirSync(r).map(d=>p.join(r,d,id+'.jsonl')).find(x=>fs.existsSync(x))}catch(e){}if(f===undefined){console.log('FAIL: no transcript '+id+'.jsonl under '+r);process.exit(1)}const m=new Set();for(const l of fs.readFileSync(f,'utf8').split('\n')){try{const j=JSON.parse(l);if(j.type==='assistant'&&j.message&&j.message.model)m.add(j.message.model)}catch(e){}}const all=[...m],ok=all.filter(x=>x.startsWith(want)),bad=all.filter(x=>(x.startsWith(want)||x==='<synthetic>')===false);if(bad.length){console.log('FAIL: unexpected model(s) '+bad.join(', ')+'; expected '+want+'*');process.exit(1)}if(ok.length===0){console.log('FAIL: no model answered'+(all.length?' (only <synthetic>, a Claude Code error)':''));process.exit(1)}console.log('OK transcript-verified: '+ok.join(', '))" <id> <accepted prefix>
   ```

   It reads the agent's transcript (`~/.claude/projects/<folder>/<id>.jsonl`, where Claude Code records the
   model each API reply came from) and prints one line, never the transcript:
   - `OK transcript-verified: <model>` (exit 0): every model found has the accepted prefix in the table above;
     `<synthetic>` entries (Claude Code's own error text, not a model) are allowed alongside. Note the model for
     the report.
   - `FAIL: …` (exit 1): an unexpected model, no transcript (transcript saving is off: see the `hc` server
     rule below) or no model answered (only `<synthetic>`). **Fail closed:** `hc kill <name>; hc rm <name>`,
     don't use its output, don't start it again on another model; stop and report the `FAIL` line. The human
     decides. One exception: a REVIEWER may be retried once, on Opus again with a new session id
     ([developer.md](developer.md#review-rounds), "Opus fails"); if that retry also fails, stop and report.

**Verification strength.** Reports label each model:
- **transcript-verified**: the check above passed. It shows the model name in each API reply, i.e. what the
  provider says served the agent, not only what was asked for. It can't prove what a third-party provider ran
  behind that name.
- **system-prompt-reported**: the model the agent's system prompt names (Claude Code states it there). This is
  only what Claude Code requested. It's the only check for a `/planner` chat (this workflow has no session id
  for it) and the developer's early self-check. A planner started with `hc` has a session id and is
  transcript-verified like the other launched agents.

## Tools

| Tool | What it's for |
|---|---|
| **GitHub issues** | The work. One issue = one branch = one PR. Read with `gh issue view <N> --comments`. |
| **Tracker issue** | Optional order: an issue whose checklist lists issues to do, top to bottom; ticked = done. The human names it when they want one used ("pick the next issue from #T"). |
| **Plan comment** | The plan for one issue, posted by the planner: what and why, "Technical context and decisions", a "Design review:" line, and the steps as a `- [ ]` checklist the developer ticks ([planner.md](planner.md)). |
| **Label `em andamento`** | The issue has a developer working on it. |
| **herdr (`hc`)** | Starting and talking to other agents. Names: `planner`, `dev-<N>`, `review-<N>`, `design-<N>`, `review-docs` (AI SPECIALIST). |

Every agent that uses `hc` runs `hc --skill` once at the start of its session and checks the `hc` commands in this file and in its role file against it.

**Without `hc`** (cloud sessions, other computers) nobody starts agents. On "go" the planner still adds the label
and, on a local computer, creates the worktree ([planner.md](planner.md), "On go", steps 1–2), then gives the human this prompt to paste
into a new chat opened in that worktree (in a cloud session the new chat has its own checkout: the developer
creates the branch itself as in [workflow.md](workflow.md#git)):
"You are the DEVELOPER. Follow documentation/agents/roles.md and documentation/agents/developer.md. Issue #<N>;
the plan is the latest plan comment on it. No `hc` on this machine." The developer skips step 4 (no review rounds) and the PR's
`## Review` section says "Skipped: no `hc` on this machine." The planner also skips the design review ([planner.md](planner.md#design-review))
and the plan says so. When the developer challenges a decision ([developer.md](developer.md), step 1), the human answers in that chat;
the developer edits the plan comment to match and carries on.

**Start the `hc` server from a normal terminal, never from Claude.** Every agent `hc` starts gets the environment
of the `hc` server, not of the command that ran `hc run`. Any `hc` command starts the server when it isn't
running; if that command came from a Claude session (the desktop app or an agent), the server keeps Claude's
`ANTHROPIC_*`/`CLAUDE_CODE_*` variables and every agent breaks: `hc` never sees its status (`status: null`, so
`hc wait` only returns on timeout), the DeepSeek design reviewer sends the Claude login to DeepSeek (401, "issue with the
selected model") and transcripts are not saved. So the human runs `hc server restart` in a normal terminal
(Windows Terminal, not one opened from Claude) before using the flow. An agent that shows `status: null` after
starting, or the warning "Transcript saving is off", means the server was started from Claude: stop and ask the
human to restart it.

**Agents started with `hc --bg` run unattended.** A permission prompt would leave them waiting with nobody to
answer. So they start in `dontAsk` mode (anything not on their allow-list is refused instead of asked) with the
allow-lists in [planner.md](planner.md) and [developer.md](developer.md). If one still stops, `hc read <name>` shows why; `hc attach <name>` lets the
human answer. The exception is a planner started with `hc` (below): the human attaches to it and answers its
prompts.

**Tool lists take the `=` form** (`"--allowedTools=Read Edit …"`, `"--disallowedTools=Edit …"`). These flags take
several values, so with a space (`--allowedTools "…" "prompt"`) Claude reads the prompt as one more tool name and
the agent starts with an empty prompt. Keep the prompt as the last argument.

**Waiting on another agent.** `hc wait <name>` returns the moment the agent stops working (done, `blocked`,
`error` or exit); `--timeout` is only a cap, and `reason: timeout` just means "still working": wait again.

- **How to wait:** run `hc wait <name> --timeout <seconds>` as a Claude Code **background command**: the shell
  tool (Bash or PowerShell) called with `run_in_background: true`. Don't use `&`, `nohup` or `Start-Process`:
  they detach the command from Claude Code, so nothing wakes you when it ends. Claude Code wakes you when the
  command exits; until then, don't read its output and don't run `hc get` in a loop. Then `hc read` the agent.
  On `reason: timeout` the agent is still working: start the background wait again.
  Timeouts: 3600 when the planner waits for a developer, 1800 for a review, 600 for a design review.
- **Fallback, only when background commands are refused or unavailable:** `hc wait <name> --timeout 90` in the
  foreground (under Claude Code's 2-minute limit on a shell command); repeat it on timeout.

`hc get <name>` shows its status: `working`, `done`, `blocked` (it needs a person: read its screen), `error`.
Never sleep or poll in a loop of your own.

## Who does what

Who has a role, and who doesn't, is in [AGENTS.md](../../AGENTS.md#roles). Never take a role you weren't given.
Only the PLANNER and DEVELOPER may start other agents. The AI SPECIALIST is outside this workflow (see
[its SKILL.md](../../.claude/skills/ai-specialist/SKILL.md)). Separately, the AI SPECIALIST may start one REVIEWER
round on its own docs branch, before opening the PR, and only when the human asks.

The human starts the planner with `/planner` in any Claude Code chat (app or CLI), e.g.
`/planner plan issue #12` or `/planner pick the next issue from #7`. Or as a background agent they can talk to
whenever they want, with a new session id ([Checking an agent's model](#checking-an-agents-model)):

```bash
hc run --bg --name planner claude --model sonnet --session-id <id> "You are the PLANNER. Follow documentation/agents/roles.md and documentation/agents/planner.md. Your session id is <id>."
hc send planner "plan issue #12"
hc wait planner --timeout 600   # on reason: timeout, wait again; on a terminal result, run the model check on <id> with prefix claude-sonnet-
hc attach planner
```

On `FAIL`, don't use what it posted: `hc kill planner; hc rm planner`. The planner itself runs the same check on
its own id before each report and labels itself transcript-verified (or reports the `FAIL` line and stops).
