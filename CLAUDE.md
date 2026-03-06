# CLAUDE.md

## Project

CLI + Agent Skill for managing GitHub PR review bot comments. See `README.md` for full details.

## Structure

```
bin/agent-reviews.js             CLI entry point (npm -g users)
lib/                             Core modules (github, comments, format)
skills/resolve-reviews/          Skill: all reviews (human + bot)
skills/resolve-agent-reviews/    Skill: bot reviews only
skills/resolve-human-reviews/    Skill: human reviews only
scripts/build-skill.js           Copies lib/ + bin/ into each skill's scripts/
.claude-plugin/                  Plugin manifest + marketplace catalog
```

## Key Commands

| Task | Command |
|------|---------|
| Build skill bundle | `npm run build:skill` |
| Publish to npm | `npm publish` |
| Test CLI locally | `node bin/agent-reviews.js` |

## Rules

- **No em dashes**. Use commas, periods, or parentheses instead.
- **Node.js CommonJS** throughout (no ESM).
- **After changing `lib/` or `bin/`**, run `npm run build:skill` to sync the bundled copy in `skills/agent-reviews/scripts/`.
- **Version in three places**: `package.json`, `.claude-plugin/plugin.json`, `skills/agent-reviews/SKILL.md` frontmatter.
- **Rebuild before bumping version** (build script inlines the version string).
- Keep CLI output minimal. No status messages, only results.
