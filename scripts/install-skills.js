#!/usr/bin/env node

/**
 * Copies skills/ into .claude/skills/ so they're available locally
 * as slash commands during development.
 *
 * Run: node scripts/install-skills.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "skills");
const DEST = path.join(ROOT, ".claude", "skills");

const SKILL_DIRS = ["resolve-reviews", "resolve-agent-reviews", "resolve-human-reviews"];

fs.mkdirSync(DEST, { recursive: true });

for (const name of SKILL_DIRS) {
  const skillDest = path.join(DEST, name);
  fs.mkdirSync(skillDest, { recursive: true });
  fs.copyFileSync(
    path.join(SRC, name, "SKILL.md"),
    path.join(skillDest, "SKILL.md")
  );
  console.log(`Installed ${name} -> .claude/skills/${name}/`);
}
