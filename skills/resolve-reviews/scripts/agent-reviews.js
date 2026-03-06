#!/usr/bin/env node

/**
 * agent-reviews — CLI for managing GitHub PR review comments
 *
 * List, filter, reply to, and watch PR review comments from the terminal.
 * Designed for both human use and as a tool for AI coding agents.
 *
 * Usage:
 *   agent-reviews                        # List all review comments
 *   agent-reviews --unresolved           # List unresolved comments only
 *   agent-reviews --unanswered           # List comments without replies
 *   agent-reviews --reply <id> "msg"     # Reply to a specific comment
 *   agent-reviews --detail <id>          # Show full detail (no truncation)
 *   agent-reviews --json                 # Output as JSON for scripting
 *   agent-reviews --watch                # Watch for new comments (poll mode)
 *
 * Options:
 *   --pr <number>    Target specific PR (auto-detects from branch)
 *   --bots-only      Only show bot comments
 *   --humans-only    Only show human comments
 */

const {
  getProxyFetch,
  getGitHubToken,
  getRepoInfo,
  getCurrentBranch,
} = require("./github");

const {
  findPRForBranch,
  fetchPRComments,
  processComments,
  filterComments,
  replyToComment,
} = require("./comments");

const {
  colors,
  formatComment,
  formatDetailedComment,
  formatOutput,
} = require("./format");

const proxyFetch = getProxyFetch();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    command: "list",
    prNumber: null,
    filter: null,
    replyTo: null,
    replyMessage: null,
    json: false,
    botsOnly: false,
    humansOnly: false,
    detail: null,
    help: false,
    version: false,
    expanded: false,
    watch: false,
    watchInterval: 30,
    watchTimeout: 600,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--unresolved":
      case "-u":
        result.filter = "unresolved";
        break;
      case "--unanswered":
      case "-a":
        result.filter = "unanswered";
        break;
      case "--reply":
      case "-r":
        result.command = "reply";
        result.replyTo = args[++i];
        result.replyMessage = args[++i];
        break;
      case "--pr":
      case "-p":
        result.prNumber = Number.parseInt(args[++i], 10);
        break;
      case "--json":
      case "-j":
        result.json = true;
        break;
      case "--bots-only":
      case "-b":
        result.botsOnly = true;
        break;
      case "--humans-only":
      case "-H":
        result.humansOnly = true;
        break;
      case "--detail":
      case "-d":
        result.command = "detail";
        result.detail = args[++i];
        break;
      case "--watch":
      case "-w":
        result.watch = true;
        result.command = "watch";
        break;
      case "--interval":
      case "-i":
        result.watchInterval = Number.parseInt(args[++i], 10);
        break;
      case "--exit-after":
      case "--timeout":
        result.watchTimeout = Number.parseInt(args[++i], 10);
        break;
      case "--expanded":
      case "-e":
        result.expanded = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      default:
        break;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
${colors.bright}agent-reviews${colors.reset} — Manage PR review comments from the CLI

Designed for both human use and as a tool for AI coding agents (Claude Code, etc.).

${colors.bright}Usage:${colors.reset}
  agent-reviews                        List all review comments
  agent-reviews --unresolved           List unresolved comments only
  agent-reviews --unanswered           List comments without replies
  agent-reviews --reply <id> "msg"     Reply to a specific comment
  agent-reviews --detail <id>          Show full detail for a comment
  agent-reviews --expanded             Show full detail for each comment
  agent-reviews --watch                Watch for new comments (poll mode)
  agent-reviews --json                 Output as JSON for scripting

${colors.bright}Options:${colors.reset}
  -u, --unresolved   Show only unresolved/pending comments
  -a, --unanswered   Show only comments without any replies
  -r, --reply        Reply to a comment (requires ID and message)
  -d, --detail       Show full detail for a specific comment
  -p, --pr           Target specific PR number (auto-detects from branch)
  -j, --json         Output as JSON instead of formatted text
  -b, --bots-only    Only show comments from bots
  -H, --humans-only  Only show comments from humans
  -e, --expanded     Show full detail (body, diff hunk, replies) for each comment
  -h, --help         Show this help
  -v, --version      Show version

${colors.bright}Watch Mode:${colors.reset}
  -w, --watch        Poll for new comments (exits on detection)
  -i, --interval     Poll interval in seconds (default: 30)
  --timeout          Exit after N seconds of inactivity (default: 600)

${colors.bright}Examples:${colors.reset}
  agent-reviews                              # Show all comments
  agent-reviews -u                           # Show unresolved only
  agent-reviews -a --bots-only               # Unanswered bot comments
  agent-reviews -a --bots-only --expanded    # Full detail for unanswered bot comments
  agent-reviews --reply 12345 "Fixed!"       # Reply to comment #12345
  agent-reviews --detail 12345               # Full detail for a comment
  agent-reviews --detail 12345 --json        # Detail as JSON
  agent-reviews --json | jq '.[]'            # Pipe to jq
  agent-reviews --watch --bots-only          # Watch for new bot comments
  agent-reviews -w -i 15 --timeout 300       # Poll every 15s, exit after 5 min

${colors.bright}Authentication:${colors.reset}
  Set GITHUB_TOKEN env var, or use 'gh auth login' (gh CLI).

${colors.dim}Comment IDs are shown in brackets, e.g., [12345678]${colors.reset}
`);
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

function formatTimestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function watchForComments(context, options) {
  const { owner, repo, prNumber, prUrl, token } = context;
  const seenIds = new Set();
  let lastActivityTime = Date.now();
  let pollCount = 0;

  function getWatchFilterDesc() {
    if (options.botsOnly) return "bots-only";
    if (options.humansOnly) return "humans-only";
    return "all";
  }
  const filterDesc = getWatchFilterDesc();

  console.log(
    `\n${colors.bright}=== PR Comments Watch Mode ===${colors.reset}`
  );
  console.log(`${colors.dim}PR #${prNumber}: ${prUrl}${colors.reset}`);
  console.log(
    `${colors.dim}Polling every ${options.watchInterval}s, exit after ${options.watchTimeout}s of inactivity${colors.reset}`
  );
  console.log(
    `${colors.dim}Filters: ${filterDesc}, ${options.filter || "all comments"}${colors.reset}`
  );
  console.log(
    `${colors.dim}Started at ${formatTimestamp()}${colors.reset}\n`
  );

  // Initial fetch to populate seen IDs
  const initialData = await fetchPRComments(
    owner,
    repo,
    prNumber,
    token,
    proxyFetch
  );
  const initialProcessed = processComments(initialData);
  const initialFiltered = filterComments(initialProcessed, options);

  for (const comment of initialFiltered) {
    seenIds.add(comment.id);
  }

  console.log(
    `${colors.dim}[${formatTimestamp()}] Initial state: ${initialFiltered.length} existing comments tracked${colors.reset}`
  );

  if (initialFiltered.length > 0) {
    console.log(`\n${colors.yellow}=== EXISTING COMMENTS ===${colors.reset}`);
    for (const comment of initialFiltered) {
      console.log(formatComment(comment));
      console.log("");
    }
  }

  // Watch loop
  while (true) {
    await sleep(options.watchInterval);
    pollCount++;

    const rawData = await fetchPRComments(
      owner,
      repo,
      prNumber,
      token,
      proxyFetch
    );
    const processed = processComments(rawData);
    const filtered = filterComments(processed, options);

    const newComments = filtered.filter((c) => !seenIds.has(c.id));

    if (newComments.length > 0) {
      for (const comment of newComments) {
        seenIds.add(comment.id);
      }

      console.log(
        `\n${colors.green}=== NEW COMMENTS DETECTED [${formatTimestamp()}] ===${colors.reset}`
      );
      console.log(
        `${colors.bright}Found ${newComments.length} new comment${newComments.length === 1 ? "" : "s"}${colors.reset}`
      );

      // Brief grace period to catch any stragglers from the same bot batch
      console.log(
        `${colors.dim}Waiting 5s for additional comments...${colors.reset}`
      );
      await sleep(5);

      // Re-fetch to catch any comments posted during the grace period
      const graceData = await fetchPRComments(
        owner,
        repo,
        prNumber,
        token,
        proxyFetch
      );
      const graceProcessed = processComments(graceData);
      const graceFiltered = filterComments(graceProcessed, options);
      const lateComments = graceFiltered.filter((c) => !seenIds.has(c.id));

      for (const comment of lateComments) {
        seenIds.add(comment.id);
        newComments.push(comment);
      }

      if (lateComments.length > 0) {
        console.log(
          `${colors.bright}Caught ${lateComments.length} additional comment${lateComments.length === 1 ? "" : "s"}${colors.reset}`
        );
      }

      console.log("");
      for (const comment of newComments) {
        console.log(formatComment(comment));
        console.log("");
      }

      // JSON output for AI agent parsing
      console.log(`${colors.dim}--- JSON for processing ---${colors.reset}`);
      console.log(JSON.stringify(newComments, null, 2));
      console.log(`${colors.dim}--- end JSON ---${colors.reset}`);

      // Exit immediately so the caller can process and restart if needed
      console.log(
        `\n${colors.green}=== WATCH: EXITING WITH NEW COMMENTS ===${colors.reset}`
      );
      console.log(
        `${colors.dim}Restart watcher after processing to catch further comments.${colors.reset}`
      );
      return;
    } else {
      const inactiveSeconds = Math.round(
        (Date.now() - lastActivityTime) / 1000
      );
      console.log(
        `${colors.dim}[${formatTimestamp()}] Poll #${pollCount}: No new comments (${inactiveSeconds}s/${options.watchTimeout}s idle)${colors.reset}`
      );

      if (inactiveSeconds >= options.watchTimeout) {
        console.log(`\n${colors.green}=== WATCH COMPLETE ===${colors.reset}`);
        console.log(
          `${colors.dim}No new comments after ${options.watchTimeout}s of inactivity.${colors.reset}`
        );
        console.log(
          `${colors.dim}Total comments tracked: ${seenIds.size}${colors.reset}`
        );
        console.log(
          `${colors.dim}Exiting at ${formatTimestamp()}${colors.reset}`
        );
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs();

  if (options.version) {
    console.log("0.6.0");
    process.exit(0);
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Get GitHub token
  const token = getGitHubToken();
  if (!token) {
    console.error(`${colors.red}Error: GitHub token not found${colors.reset}`);
    console.error(
      "Set GITHUB_TOKEN env var, or authenticate with: gh auth login"
    );
    process.exit(1);
  }

  // Get repo info
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    console.error(
      `${colors.red}Error: Could not determine repository from git remote${colors.reset}`
    );
    process.exit(1);
  }

  // Find PR
  let prNumber = options.prNumber;
  let prUrl = null;

  if (!prNumber) {
    const branch = getCurrentBranch();
    if (!branch) {
      console.error(
        `${colors.red}Error: Could not determine current branch${colors.reset}`
      );
      process.exit(1);
    }

    const pr = await findPRForBranch(
      repoInfo.owner,
      repoInfo.repo,
      branch,
      token,
      proxyFetch
    );
    if (!pr) {
      console.error(
        `${colors.red}Error: No open PR found for branch '${branch}'${colors.reset}`
      );
      process.exit(1);
    }

    prNumber = pr.number;
    prUrl = pr.html_url;
  }

  // Handle reply command
  if (options.command === "reply") {
    if (!(options.replyTo && options.replyMessage)) {
      console.error(
        `${colors.red}Error: --reply requires comment ID and message${colors.reset}`
      );
      console.error('Usage: agent-reviews --reply <id> "message"');
      process.exit(1);
    }

    const result = await replyToComment(
      repoInfo.owner,
      repoInfo.repo,
      prNumber,
      options.replyTo,
      options.replyMessage,
      token,
      proxyFetch
    );

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `${colors.green}✓ Reply posted successfully${colors.reset}`
      );
      console.log(`  ${colors.dim}${result.html_url}${colors.reset}`);
    }

    return;
  }

  // Handle detail command
  if (options.command === "detail") {
    if (!options.detail) {
      console.error(
        `${colors.red}Error: --detail requires a comment ID${colors.reset}`
      );
      process.exit(1);
    }

    const rawData = await fetchPRComments(
      repoInfo.owner,
      repoInfo.repo,
      prNumber,
      token,
      proxyFetch
    );
    const processed = processComments(rawData);
    const targetId = Number(options.detail);
    const comment = processed.find((c) => c.id === targetId);

    if (!comment) {
      console.error(
        `${colors.red}Error: Comment ${options.detail} not found in PR #${prNumber}${colors.reset}`
      );
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(comment, null, 2));
    } else {
      console.log(formatDetailedComment(comment));
    }

    return;
  }

  // Handle watch command
  if (options.command === "watch") {
    await watchForComments(
      { owner: repoInfo.owner, repo: repoInfo.repo, prNumber, prUrl, token },
      options
    );
    return;
  }

  // Default: fetch and display comments
  const rawData = await fetchPRComments(
    repoInfo.owner,
    repoInfo.repo,
    prNumber,
    token,
    proxyFetch
  );

  const processed = processComments(rawData);
  const filtered = filterComments(processed, options);

  console.log(formatOutput(filtered, options));

}

main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
