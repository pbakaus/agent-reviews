/**
 * PR comment fetching, processing, and filtering
 *
 * Fetches all comment types (review comments, issue comments, reviews)
 * from GitHub's API, processes them into a unified format, and provides
 * filtering capabilities.
 */

const USER_AGENT = "agent-reviews";

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function findPRForBranch(owner, repo, branch, token, proxyFetch) {
  const response = await proxyFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=open`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to find PR: ${response.status}`);
  }

  const prs = await response.json();
  return prs[0] || null;
}

// ---------------------------------------------------------------------------
// Paginated fetch
// ---------------------------------------------------------------------------

async function fetchAllPages(url, token, proxyFetch) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await proxyFetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    results.push(...data);

    // Check for next page in Link header
    const linkHeader = response.headers.get("link");
    nextUrl = null;
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        nextUrl = nextMatch[1];
      }
    }
  }

  return results;
}

async function fetchPRComments(owner, repo, prNumber, token, proxyFetch) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // Fetch all comment types in parallel
  const [reviewComments, issueComments, reviews] = await Promise.all([
    fetchAllPages(
      `${baseUrl}/pulls/${prNumber}/comments?per_page=100`,
      token,
      proxyFetch
    ),
    fetchAllPages(
      `${baseUrl}/issues/${prNumber}/comments?per_page=100`,
      token,
      proxyFetch
    ),
    fetchAllPages(
      `${baseUrl}/pulls/${prNumber}/reviews?per_page=100`,
      token,
      proxyFetch
    ),
  ]);

  return { reviewComments, issueComments, reviews };
}

// ---------------------------------------------------------------------------
// Comment classification
// ---------------------------------------------------------------------------

/**
 * Default meta-comment filters.
 * These are auto-generated status updates, not actionable review findings.
 * Users can extend this list via the `metaFilters` option.
 */
const DEFAULT_META_FILTERS = [
  // Vercel deployment status
  (user, body) => user === "vercel[bot]" && body.startsWith("[vc]:"),
  // Supabase branch status
  (user, body) => user === "supabase[bot]" && body.startsWith("[supa]:"),
  // cursor[bot] summary (not the actual findings)
  (user, body) =>
    user === "cursor[bot]" &&
    body.startsWith("Cursor Bugbot has reviewed your changes"),
];

function isMetaComment(user, body, metaFilters = DEFAULT_META_FILTERS) {
  if (!body) return false;
  return metaFilters.some((filter) => filter(user, body));
}

function isBot(username) {
  if (!username) return false;
  return (
    username.endsWith("[bot]") ||
    username === "Copilot" ||
    username.includes("bot") ||
    username === "github-actions"
  );
}

// ---------------------------------------------------------------------------
// Body cleanup
// ---------------------------------------------------------------------------

/**
 * Strip bot boilerplate from comment bodies:
 *  - HTML comments (<!-- ... -->)
 *  - Cursor "Fix in Cursor" / "Fix in Web" button blocks
 *  - "Additional Locations" <details> blocks
 *  - Collapse leftover blank lines
 */
function cleanBody(body) {
  if (!body) return body;

  let cleaned = body;

  // Remove HTML comments (single and multi-line)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Remove <details> blocks containing "Additional Locations"
  cleaned = cleaned.replace(
    /<details>\s*<summary>\s*Additional Locations[\s\S]*?<\/details>/gi,
    ""
  );

  // Remove <p> blocks containing cursor.com links
  cleaned = cleaned.replace(/<p>\s*<a [^>]*cursor\.com[\s\S]*?<\/p>/gi, "");

  // Collapse runs of 3+ newlines into 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

function processComments(data, options = {}) {
  const { reviewComments, issueComments, reviews } = data;
  const metaFilters = options.metaFilters || DEFAULT_META_FILTERS;

  // Build a map of comment replies
  const repliesMap = new Map();
  for (const comment of reviewComments) {
    if (comment.in_reply_to_id) {
      if (!repliesMap.has(comment.in_reply_to_id)) {
        repliesMap.set(comment.in_reply_to_id, []);
      }
      repliesMap.get(comment.in_reply_to_id).push({
        id: comment.id,
        user: comment.user?.login,
        body: cleanBody(comment.body),
        createdAt: comment.created_at,
        isBot: isBot(comment.user?.login),
      });
    }
  }

  const processed = [];

  // Process review comments (inline code comments)
  for (const comment of reviewComments) {
    if (comment.in_reply_to_id) continue;
    if (isMetaComment(comment.user?.login, comment.body, metaFilters)) continue;

    const replies = repliesMap.get(comment.id) || [];
    const hasHumanReply = replies.some((r) => !r.isBot);
    const hasAnyReply = replies.length > 0;

    processed.push({
      id: comment.id,
      type: "review_comment",
      user: comment.user?.login,
      isBot: isBot(comment.user?.login),
      path: comment.path,
      line: comment.line || comment.original_line,
      diffHunk: comment.diff_hunk || null,
      body: cleanBody(comment.body),
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
      replies,
      hasHumanReply,
      hasAnyReply,
      isResolved: false,
    });
  }

  // Process issue comments (general PR comments)
  for (const comment of issueComments) {
    if (isMetaComment(comment.user?.login, comment.body, metaFilters)) continue;

    processed.push({
      id: comment.id,
      type: "issue_comment",
      user: comment.user?.login,
      isBot: isBot(comment.user?.login),
      path: null,
      line: null,
      diffHunk: null,
      body: cleanBody(comment.body),
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
      replies: [],
      hasHumanReply: false,
      hasAnyReply: false,
      isResolved: false,
    });
  }

  // Process review bodies (only if they have content)
  for (const review of reviews) {
    if (isMetaComment(review.user?.login, review.body, metaFilters)) continue;
    if (!review.body?.trim()) continue;

    processed.push({
      id: review.id,
      type: "review",
      user: review.user?.login,
      isBot: isBot(review.user?.login),
      path: null,
      line: null,
      diffHunk: null,
      body: cleanBody(review.body),
      state: review.state,
      createdAt: review.submitted_at,
      updatedAt: review.submitted_at,
      url: review.html_url,
      replies: [],
      hasHumanReply: false,
      hasAnyReply: false,
      isResolved: review.state === "APPROVED" || review.state === "DISMISSED",
    });
  }

  // Sort by date (newest first)
  processed.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return processed;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function filterComments(comments, options) {
  let filtered = comments;

  if (options.botsOnly) {
    filtered = filtered.filter((c) => c.isBot);
  } else if (options.humansOnly) {
    filtered = filtered.filter((c) => !c.isBot);
  }

  if (options.filter === "unresolved") {
    filtered = filtered.filter((c) => !(c.isResolved || c.hasHumanReply));
  } else if (options.filter === "unanswered") {
    filtered = filtered.filter((c) => !c.hasAnyReply);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------

async function replyToComment(
  owner,
  repo,
  prNumber,
  commentId,
  message,
  token,
  proxyFetch
) {
  // Try review comment reply endpoint first
  const response = await proxyFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ body: message }),
    }
  );

  if (!response.ok) {
    // Fallback to issue comment endpoint
    const issueResponse = await proxyFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          body: `> Re: comment ${commentId}\n\n${message}`,
        }),
      }
    );

    if (!issueResponse.ok) {
      const error = await issueResponse.text();
      throw new Error(`Failed to reply: ${issueResponse.status} - ${error}`);
    }

    return issueResponse.json();
  }

  return response.json();
}

module.exports = {
  findPRForBranch,
  fetchAllPages,
  fetchPRComments,
  processComments,
  filterComments,
  replyToComment,
  isBot,
  isMetaComment,
  cleanBody,
  DEFAULT_META_FILTERS,
};
