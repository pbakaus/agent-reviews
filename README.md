# agent-reviews

Manage GitHub PR review comments from the terminal and from AI coding agents.

PR review bots (Copilot, Cursor Bugbot, CodeRabbit, etc.) leave inline comments on your pull requests. agent-reviews gives you a CLI to list, filter, reply to, and watch those comments, plus agent skills that automate the entire triage-fix-reply loop.

## Why

**`gh` CLI is fragile for review comments.** Agents frequently get the syntax wrong, fail to paginate, and can't reliably detect whether a comment has been replied to. agent-reviews provides a single, purpose-built interface that handles all of this correctly.

**Bot reviews create a doom loop.** You fix one round of findings, push, and new comments appear. Fix those, push again, more comments. This cycle can eat hours. The included skills solve this with an integrated watcher that keeps fixing and replying until the bots go quiet.

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

The simplest method is the **GitHub CLI**. If you're logged in with `gh auth login`, agent-reviews picks up the token automatically. No configuration needed.

For cloud/remote environments or HTTPS proxy setups, set `GITHUB_TOKEN` or `GH_TOKEN` directly. agent-reviews includes [undici](https://github.com/nodejs/undici) `ProxyAgent` support and will route requests through `HTTPS_PROXY` automatically when set.

**Resolution order** (first match wins):

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `.env.local` in the repo root
4. `gh auth token` (GitHub CLI)

### Custom API host

Set `GITHUB_API_URL` to point agent-reviews at a GitHub Enterprise host or any API-compatible server (useful for testing, recording, or routing through a local mediator). Defaults to `https://api.github.com`.

```bash
GITHUB_API_URL=https://github.example.com/api/v3 agent-reviews
```

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

Bot review bodies (`REVIEW` type) are always filtered out since actionable findings come through as inline comments. Additionally, these bot issue comments are filtered:

| Bot | What's filtered |
|-----|----------------|
| Vercel | Deployment status (`[vc]:...`) |
| Supabase | Branch status (`[supa]:...`) |
| Cursor Bugbot | Review summary ("Cursor Bugbot has reviewed your changes...") |
| Copilot | PR review summary ("Pull request overview") |
| CodeRabbit | Walkthrough, summary, and "review skipped" comments |
| Sourcery | Reviewer's guide and PR summary |
| Codacy | Analysis summary and coverage summary |
| SonarCloud | Quality Gate pass/fail summary |

### Reply status

Each comment displays its reply status:

| Status | Meaning |
|--------|---------|
| `no reply` | No one has replied |
| `replied` | A human has replied |
| `bot replied` | Only bots have replied |

### Watch mode

Polls the GitHub API at a configurable interval and reports new comments as they appear. Outputs both formatted text and JSON for AI agent consumption. Exits automatically after a configurable inactivity timeout (default: 10 minutes).

## Changelog

### 1.0.0

**Three skills instead of one.** The single `agent-reviews` skill has been split into three, each tailored for different workflows:

- `resolve-reviews` resolves all comments (human + bot)
- `resolve-agent-reviews` resolves bot comments only
- `resolve-human-reviews` resolves human comments only

**Thread resolution.** The new `--resolve` flag marks GitHub review threads as resolved after replying. Uses the GraphQL `resolveReviewThread` mutation. Works with `--reply` in any argument order.

**Expanded bot support.** Added detection and meta-comment filtering for CodeRabbit, Sourcery, Codacy, SonarCloud/SonarQube Cloud, and Copilot PR reviewer, in addition to the existing Cursor Bugbot, Vercel, and Supabase filters.

**Agent-harness universal.** Skills now work with any agent that supports [Agent Skills](https://agentskills.io) (Claude Code, Cursor, Codex, etc.), not just Claude Code.

**Watch mode improvements.** The watcher now exits immediately when new comments are found (with a 5s grace period for batch posts), designed for loop-based workflows where the agent processes comments and restarts the watcher.

**New CLI options:**

- `--resolve` resolves the review thread after replying (use with `--reply`)
- `--expanded` / `-e` shows full detail (body, diff hunk, replies) for each comment in list mode

**Bug fixes:**

- `--json --resolve` no longer emits plain-text status messages to stdout

**Cloud and proxy support:**

- `GH_TOKEN` environment variable support (in addition to `GITHUB_TOKEN`)
- `GH_REPO` environment variable for targeting repos in detached environments
- Curl-based HTTP fallback for environments without native fetch/undici
- Curl requests include timeouts (10s connect, 60s max)

**Smarter filtering.** Bot review bodies (summaries listing inline findings) are now automatically excluded, since actionable findings always come through as inline comments. Reply comments posted by agent-reviews itself (`> Re: comment ...`) are also filtered to avoid noise.

**Simplified architecture.** Skills now invoke `npx agent-reviews` at runtime instead of bundling their own scripts, reducing the package from ~4000 lines of duplicated code to a single CLI entry point. Skills no longer run redundant startup commands (version check, branch detection, PR lookup), relying on the CLI's own error handling instead.

## License

MIT
