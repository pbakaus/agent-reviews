# agent-reviews

Manage GitHub PR review comments from the terminal and from AI coding agents.

PR review bots (Copilot, Cursor Bugbot, CodeRabbit, etc.) leave inline comments on your pull requests. agent-reviews gives you a CLI to list, filter, reply to, and watch those comments — plus a Claude Code skill that automates the entire triage-fix-reply loop.

## Install

### CLI (npm)

```bash
npm install -g agent-reviews
```

### CLI (Homebrew)

```bash
brew install agent-reviews
```

### Claude Code skill

Install as a skill for the full automated workflow — no npm install required:

```bash
npx skills add pbakaus/agent-reviews@agent-reviews
```

This registers the `/agent-reviews` slash command. When invoked, it uses `npx` to auto-download the CLI on first run.

> You can also use both: install the CLI globally for direct terminal use, and the skill for the Claude Code workflow.

## Authentication

The primary authentication method is the **GitHub CLI** — if you're logged in with `gh auth login`, agent-reviews picks up the token automatically. No configuration needed.

For environments where `gh` isn't available (such as Claude Code Cloud, which routes git through an HTTPS proxy), agent-reviews falls back to:

1. `GITHUB_TOKEN` environment variable
2. `.env.local` in the repo root

The proxy environment is also why agent-reviews includes [undici](https://github.com/nodejs/undici) `ProxyAgent` support — when `HTTPS_PROXY` is set, GitHub API requests are routed through it automatically.

**Resolution order** (first match wins):

1. `GITHUB_TOKEN` environment variable
2. `.env.local` in the repo root
3. `gh auth token` (GitHub CLI)

## CLI Usage

```bash
# List all review comments on the current branch's PR
agent-reviews

# Only unresolved comments
agent-reviews --unresolved

# Only unanswered bot comments
agent-reviews --unanswered --bots-only

# Full detail for a specific comment (diff hunk + replies)
agent-reviews --detail 12345678

# Reply to a comment
agent-reviews --reply 12345678 "Fixed in abc1234"

# JSON output for scripting / AI agents
agent-reviews --json

# Watch for new comments (polls every 30s, exits after 10 min idle)
agent-reviews --watch --bots-only

# Target a specific PR (otherwise auto-detects from branch)
agent-reviews --pr 42
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--unresolved` | `-u` | Only unresolved/pending comments |
| `--unanswered` | `-a` | Only comments without any replies |
| `--reply <id> "msg"` | `-r` | Reply to a comment |
| `--detail <id>` | `-d` | Full detail for a comment |
| `--pr <number>` | `-p` | Target a specific PR |
| `--json` | `-j` | JSON output |
| `--bots-only` | `-b` | Only bot comments |
| `--humans-only` | `-H` | Only human comments |
| `--watch` | `-w` | Poll for new comments |
| `--interval <sec>` | `-i` | Poll interval in seconds (default: 30) |
| `--timeout <sec>` | | Inactivity timeout in seconds (default: 600) |

## Claude Code Skill

The `/agent-reviews` skill automates the full PR review bot workflow:

1. Fetch all unanswered bot comments via `npx agent-reviews --bots-only --json`
2. Evaluate each finding — true positive, false positive, or uncertain
3. Fix real bugs and run lint/type-check
4. Dismiss false positives with an explanation
5. Reply to every comment with the outcome
6. Watch for new comments as bots re-analyze the fixes
7. Report a summary of all actions taken

### Skill behavior

- **True positives** get fixed, verified, and replied with `✅ Fixed in {commit}`
- **False positives** get replied with `⚠️ Won't fix — {reason}`
- **Uncertain findings** prompt the user via `AskUserQuestion`
- All fixes are batched into a single commit before polling begins
- Watch mode runs for up to 10 minutes, processing any new findings

## How It Works

### Comment types

agent-reviews fetches three types of GitHub PR comments:

| Type | Label | Description |
|------|-------|-------------|
| Review comment | `CODE` | Inline comment attached to a specific line |
| Issue comment | `COMMENT` | General PR-level comment |
| Review | `REVIEW` | Review summary (approved, changes requested) |

### Meta-comment filtering

Status updates from bots are automatically filtered out:

- Vercel deployment status (`[vc]:...`)
- Supabase branch status (`[supa]:...`)
- Cursor Bugbot summary ("Cursor Bugbot has reviewed your changes...")

Only actionable findings are shown.

### Reply status

Each comment displays its reply status:

| Status | Meaning |
|--------|---------|
| `○ no reply` | No one has replied |
| `✓ replied` | A human has replied |
| `⚡ bot replied` | Only bots have replied |

### Watch mode

Polls the GitHub API at a configurable interval and reports new comments as they appear. Outputs both formatted text and JSON for AI agent consumption. Exits automatically after a configurable inactivity timeout (default: 10 minutes).

## License

MIT
