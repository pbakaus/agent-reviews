# CLAUDE.md

## Project

CLI + Agent Skills for managing GitHub PR review comments. See `README.md` for full details.

## Structure

```text
bin/agent-reviews.js             CLI entry point (npm -g users)
lib/                             Core modules (github, comments, format)
skills/resolve-reviews/          Skill: all reviews (human + bot)
skills/resolve-agent-reviews/    Skill: bot reviews only
skills/resolve-human-reviews/    Skill: human reviews only
.claude-plugin/                  Plugin manifest + marketplace catalog
```

## Key Commands

| Task | Command |
|------|---------|
| Install skills locally | `npm run install-skills` (also runs on `npm install`) |
| Publish to npm | `npm publish` |
| Test CLI locally | `node bin/agent-reviews.js` |
| Run tests | `npm test` |

## Rules

- **No em dashes**. Use commas, periods, or parentheses instead.
- **Node.js CommonJS** throughout (no ESM).
- **Version in three places**: `package.json`, `.claude-plugin/plugin.json`, `skills/*/SKILL.md` frontmatter.
- Skills use `npx agent-reviews` (no bundled scripts).
- Keep CLI output minimal. No status messages, only results.
- **Changelog**: when shipping a new version, add an entry to both `README.md` (under `## Changelog`) and `website/src/lib/components/Changelog.svelte` (new `changelog-entry` div at the top of the list). Keep entries concise, one `<li>` per feature/fix.
