# DeepSeek design reviewer setup

The DESIGN REVIEWER ([design-reviewer.md](design-reviewer.md)) is Claude Code talking to DeepSeek's
Anthropic-compatible API. The REVIEWER runs on Claude Opus and needs no setup. One-time setup per machine, **outside the repo** (it holds the API key; never commit it):

`~/.claude/providers/deepseek.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<DeepSeek API key>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-flash[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-flash[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-flash",
    "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-flash"
  }
}
```

`claude --settings <that file>` loads it for one run only; plain `claude` stays on Anthropic. Inside the design reviewer,
`/status` should show the DeepSeek address. It uses `deepseek-flash[1m]` (`[1m]` tells Claude Code
the context window is 1M tokens; it isn't part of the model name). To change the model, edit `--model` in
[planner.md](planner.md#design-review) and the two `DEFAULT_*_MODEL` lines above. Reference:
https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code
