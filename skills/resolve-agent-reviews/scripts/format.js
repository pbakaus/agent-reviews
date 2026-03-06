/**
 * Terminal output formatting for PR comments
 */

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function truncate(str, maxLength) {
  if (!str) return "";
  const oneLine = str.replace(/\n/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3)}...`;
}

function getReplyStatus(comment) {
  if (!comment.hasAnyReply) {
    return `${colors.red}○ no reply${colors.reset}`;
  }
  if (comment.hasHumanReply) {
    return `${colors.green}✓ replied${colors.reset}`;
  }
  return `${colors.yellow}⚡ bot replied${colors.reset}`;
}

function formatComment(comment) {
  const typeColors = {
    review_comment: colors.cyan,
    issue_comment: colors.blue,
    review: colors.magenta,
  };

  const typeLabels = {
    review_comment: "CODE",
    issue_comment: "COMMENT",
    review: "REVIEW",
  };

  const typeColor = typeColors[comment.type] || colors.reset;
  const typeLabel = typeLabels[comment.type] || comment.type.toUpperCase();
  const userColor = comment.isBot ? colors.yellow : colors.green;
  const replyStatus = getReplyStatus(comment);

  let location = "";
  if (comment.path) {
    location = `${colors.dim}${comment.path}`;
    if (comment.line) {
      location += `:${comment.line}`;
    }
    location += colors.reset;
  }

  const lines = [
    `${colors.bright}[${comment.id}]${colors.reset} ${typeColor}${typeLabel}${colors.reset} by ${userColor}${comment.user}${colors.reset} ${replyStatus}`,
  ];

  if (location) {
    lines.push(`  ${location}`);
  }

  lines.push(`  ${colors.dim}${truncate(comment.body, 100)}${colors.reset}`);

  if (comment.replies.length > 0) {
    lines.push(
      `  ${colors.dim}└ ${comment.replies.length} repl${comment.replies.length === 1 ? "y" : "ies"}${colors.reset}`
    );
  }

  return lines.join("\n");
}

function formatDetailedComment(comment) {
  const typeLabels = {
    review_comment: "CODE",
    issue_comment: "COMMENT",
    review: "REVIEW",
  };
  const typeLabel = typeLabels[comment.type] || comment.type.toUpperCase();
  const replyStatus = comment.hasAnyReply
    ? comment.hasHumanReply
      ? "✓ replied"
      : "⚡ bot replied"
    : "○ no reply";

  const lines = [];

  lines.push(`=== Comment [${comment.id}] ===`);
  lines.push(
    `Type: ${typeLabel} | By: ${comment.user} | Status: ${replyStatus}`
  );

  if (comment.path) {
    let location = `File: ${comment.path}`;
    if (comment.line) location += `:${comment.line}`;
    lines.push(location);
  }

  lines.push(`URL: ${comment.url}`);

  if (comment.diffHunk) {
    lines.push("");
    lines.push("--- Code Context ---");
    lines.push(comment.diffHunk);
    lines.push("--- End Code Context ---");
  }

  lines.push("");
  lines.push(comment.body || "(no body)");

  if (comment.replies.length > 0) {
    lines.push("");
    lines.push(`--- Replies (${comment.replies.length}) ---`);
    for (const reply of comment.replies) {
      const date = reply.createdAt
        ? new Date(reply.createdAt)
            .toISOString()
            .replace("T", " ")
            .slice(0, 16)
        : "unknown";
      lines.push(`[${reply.id}] ${reply.user} (${date}):`);
      lines.push(reply.body || "(no body)");
      lines.push("");
    }
    lines.push("--- End Replies ---");
  }

  return lines.join("\n");
}

function formatOutput(comments, options) {
  if (options.json) {
    return JSON.stringify(comments, null, 2);
  }

  if (comments.length === 0) {
    const filterDesc =
      options.filter === "unresolved"
        ? "unresolved "
        : options.filter === "unanswered"
          ? "unanswered "
          : "";
    return `${colors.green}No ${filterDesc}comments found.${colors.reset}`;
  }

  const header = `${colors.bright}Found ${comments.length} comment${comments.length === 1 ? "" : "s"}${colors.reset}\n`;
  const formatter = options.expanded ? formatDetailedComment : formatComment;
  const separator = options.expanded ? "\n\n" + "=".repeat(60) + "\n\n" : "\n\n";
  const formatted = comments.map((c) => formatter(c)).join(separator);

  return `${header}\n${formatted}`;
}

module.exports = {
  colors,
  truncate,
  formatComment,
  formatDetailedComment,
  formatOutput,
};
