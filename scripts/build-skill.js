#!/usr/bin/env node

/**
 * Copies the CLI and lib files into each skill's scripts/ directory
 * so the skills are self-contained (no npx needed at runtime).
 *
 * Run: node scripts/build-skill.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");

const SKILL_DIRS = [
  "resolve-reviews",
  "resolve-agent-reviews",
  "resolve-human-reviews",
];

// Read and patch CLI entry point once (shared across all skills)
let cli = fs.readFileSync(path.join(ROOT, "bin", "agent-reviews.js"), "utf8");
cli = cli.replace(/require\("\.\.\/lib\//g, 'require("./');
const pkg = require(path.join(ROOT, "package.json"));
cli = cli.replace(
  /const pkg = require\("\.\.\/package\.json"\);\s*\n\s*console\.log\(pkg\.version\)/,
  `console.log("${pkg.version}")`
);

for (const skillName of SKILL_DIRS) {
  const dest = path.join(SKILLS_DIR, skillName, "scripts");
  fs.mkdirSync(dest, { recursive: true });

  // Copy lib files as-is
  for (const file of ["github.js", "comments.js", "format.js"]) {
    fs.copyFileSync(path.join(ROOT, "lib", file), path.join(dest, file));
  }

  // Write patched CLI
  fs.writeFileSync(path.join(dest, "agent-reviews.js"), cli);

  console.log(`Built ${path.relative(ROOT, dest)}/`);
  console.log(`  Files: ${fs.readdirSync(dest).join(", ")}`);
}
