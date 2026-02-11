#!/usr/bin/env node

/**
 * Copies the CLI and lib files into skills/agent-reviews/scripts/
 * so the skill is self-contained (no npx needed at runtime).
 *
 * Run: node scripts/build-skill.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEST = path.join(ROOT, "skills", "agent-reviews", "scripts");

// Ensure destination exists
fs.mkdirSync(DEST, { recursive: true });

// Copy lib files as-is
for (const file of ["github.js", "comments.js", "format.js"]) {
  fs.copyFileSync(path.join(ROOT, "lib", file), path.join(DEST, file));
}

// Copy and patch the CLI entry point:
// - Rewrite require("../lib/...") to require("./...")
// - Rewrite require("../package.json") to inline version
let cli = fs.readFileSync(path.join(ROOT, "bin", "agent-reviews.js"), "utf8");
cli = cli.replace(/require\("\.\.\/lib\//g, 'require("./');
const pkg = require(path.join(ROOT, "package.json"));
cli = cli.replace(
  /const pkg = require\("\.\.\/package\.json"\);\s*\n\s*console\.log\(pkg\.version\)/,
  `console.log("${pkg.version}")`
);

fs.writeFileSync(path.join(DEST, "agent-reviews.js"), cli);

console.log(`Built skill scripts to ${path.relative(ROOT, DEST)}/`);
console.log(
  `  Files: ${fs.readdirSync(DEST).join(", ")}`
);
