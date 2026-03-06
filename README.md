# agent-reviews

Manage GitHub PR review comments from the terminal and from AI coding agents.

PR review bots (Copilot, Cursor Bugbot, CodeRabbit, etc.) leave inline comments on your pull requests. agent-reviews gives you a CLI to list, filter, reply to, and watch those comments, plus agent skills that automate the entire triage-fix-reply loop.

## Why

**`gh` CLI is fragile for review comments.** Agents frequently get the syntax wrong, fail to paginate, and can't reliably detect whether a comment has been replied to. agent-reviews provides a single, purpose-built interface that handles all of this correctly.

**Bot reviews create a doom loop.** You fix one round of findings, push, and new comments appear. Fix those, push again, more comments. This cycle can eat hours. The included skill solves it with an integrated watcher that keeps fixing and replying until the bots go quiet.

**Works in cloud environments.** Most solutions rely on local tooling that isn't available in cloud or remote agent environments. agent-reviews works everywhere, so you can kick off a session, let the agent resolve all findings autonomously, and come back to a clean PR.

## Install

### CLI (npm)

```bash
npm install -g agent-reviews
```

### Agent Skills

Three skills are available, each as a slash command (no npm install required):

| Skill | What it resolves |
|-------|-----------------|
| `resolve-reviews` | All comments (human + bot) |
| `resolve-agent-reviews` | Bot comments only (Copilot, Cursor, etc.) |
| `resolve-human-reviews` | Human comments only |

Works with any agent that supports [Agent Skills](https://agentskills.io) (Claude Code, Cursor, Codex, etc.):

```bash
npx skills add pbakaus/agent-reviews@resolve-agent-reviews
```

Replace `resolve-agent-reviews` with whichever skill you want. Skills use `npx agent-reviews` at runtime, so the CLI is fetched automatically.

> You can also use both: install the CLI globally for direct terminal use, and a skill for the agent workflow.

## Authentication

The primary authentication method is the **GitHub CLI**. If you're logged in with `gh auth login`, agent-reviews picks up the token automatically. No configuration needed.

For environments where `gh` isn't available (like cloud/remote agents that route git through an HTTPS proxy), agent-reviews falls back to:

1. `GITHUB_TOKEN` or `GH_TOKEN` environment variable
2. `.env.local` in the repo root

The proxy environment is also why agent-reviews includes [undici](https://github.com/nodejs/undici) `ProxyAgent` support. When `HTTPS_PROXY` is set, GitHub API requests are routed through it automatically.

**Resolution order** (first match wins):

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `.env.local` in the repo root
4. `gh auth token` (GitHub CLI)

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
| `--resolve` | | Resolve the review thread after replying (use with `--reply`) |
| `--detail <id>` | `-d` | Full detail for a comment |
| `--pr <number>` | `-p` | Target a specific PR |
| `--json` | `-j` | JSON output |
| `--bots-only` | `-b` | Only bot comments |
| `--humans-only` | `-H` | Only human comments |
| `--expanded` | `-e` | Show full detail for each listed comment |
| `--watch` | `-w` | Poll for new comments |
| `--interval <sec>` | `-i` | Poll interval in seconds (default: 30) |
| `--timeout <sec>` | | Inactivity timeout in seconds (default: 600) |

## Agent Skills

The skills automate the full PR review resolution workflow:

1. Fetch unanswered comments (all, bot-only, or human-only depending on skill)
2. Evaluate each finding (true positive, false positive, actionable, etc.)
3. Fix real issues and run lint/type-check
4. Dismiss false positives with an explanation
5. Reply to every comment with the outcome
6. Watch for new comments and repeat until quiet
7. Report a summary of all actions taken

### Skill behavior

- **True positives / actionable feedback** get fixed and replied with `Fixed in {commit}`
- **False positives** get replied with `Won't fix: {reason}`
- **Uncertain findings** prompt the user for guidance
- All fixes are batched into a single commit before polling begins
- Watch mode loops until no new comments appear for 10 minutes

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
| `no reply` | No one has replied |
| `replied` | A human has replied |
| `bot replied` | Only bots have replied |

### Watch mode

Polls the GitHub API at a configurable interval and reports new comments as they appear. Outputs both formatted text and JSON for AI agent consumption. Exits automatically after a configurable inactivity timeout (default: 10 minutes).

## License

MIT
