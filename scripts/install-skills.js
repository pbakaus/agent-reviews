#!/usr/bin/env node

/**
 * Copies skills/ into .claude/skills/ so they're available locally
 * as slash commands during development.
 *
 * Patches `npx agent-reviews` to `node <repo>/bin/agent-reviews.js`
 * so the local dev version is used instead of the published npm package.
 *
 * Run: node scripts/install-skills.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "skills");
const DEST = path.join(ROOT, ".claude", "skills");
const LOCAL_CLI = path.join(ROOT, "bin", "agent-reviews.js");

const SKILL_DIRS = ["resolve-reviews", "resolve-agent-reviews", "resolve-human-reviews"];

fs.mkdirSync(DEST, { recursive: true });

for (const name of SKILL_DIRS) {
  const skillDest = path.join(DEST, name);
  fs.mkdirSync(skillDest, { recursive: true });

  let content = fs.readFileSync(path.join(SRC, name, "SKILL.md"), "utf8");

  // Patch all npx agent-reviews references to use local CLI binary
  content = content.replaceAll("npx agent-reviews", `node ${LOCAL_CLI}`);

  // Remove the package manager substitution note (irrelevant in local dev)
  content = content.replace(
    /All commands below use [^\n]*\. If the project uses a different package manager[^\n]*\. Honor the user's package manager preference throughout\.\n\n/,
    ""
  );

  fs.writeFileSync(path.join(skillDest, "SKILL.md"), content);
  console.log(`Installed ${name} -> .claude/skills/${name}/ (patched for local dev)`);
}
