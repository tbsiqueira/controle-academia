# DeepSeek reviewer setup

The REVIEWER ([reviewer.md](reviewer.md)) and the DESIGN REVIEWER ([design-reviewer.md](design-reviewer.md)) are Claude Code talking to DeepSeek's
Anthropic-compatible API. One-time setup per machine, **outside the repo** (it holds the API key; never commit it):

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

`claude --settings <that file>` loads it for one run only; plain `claude` stays on Anthropic. Inside either reviewer,
`/status` should show the DeepSeek address. Both use `deepseek-flash[1m]` (`[1m]` tells Claude Code
the context window is 1M tokens; it isn't part of the model name). To change the model, edit `--model` in
[developer.md](developer.md#review-rounds) and [planner.md](planner.md#design-review) and the two `DEFAULT_*_MODEL` lines above. Reference:
https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code
