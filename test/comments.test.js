import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanBody,
  isBot,
  isMetaComment,
  processComments,
  filterComments,
} from "../lib/comments.js";

// ---------------------------------------------------------------------------
// cleanBody
// ---------------------------------------------------------------------------

describe("cleanBody", () => {
  it("returns falsy values as-is", () => {
    expect(cleanBody(null)).toBe(null);
    expect(cleanBody(undefined)).toBe(undefined);
    expect(cleanBody("")).toBe("");
  });

  it("passes through plain text unchanged", () => {
    expect(cleanBody("This is a normal comment.")).toBe(
      "This is a normal comment."
    );
  });

  it("strips single-line HTML comments", () => {
    expect(cleanBody("before <!-- hidden --> after")).toBe("before  after");
  });

  it("strips multi-line HTML comments", () => {
    const input = `Title

<!-- DESCRIPTION START -->
Some description
<!-- DESCRIPTION END -->

More text`;

    const result = cleanBody(input);
    expect(result).not.toContain("DESCRIPTION START");
    expect(result).not.toContain("DESCRIPTION END");
    expect(result).toContain("Title");
    expect(result).toContain("Some description");
    expect(result).toContain("More text");
  });

  it("strips BUGBOT_BUG_ID comments", () => {
    const input =
      "Finding\n\n<!-- BUGBOT_BUG_ID: d0d24d61-904c-47c1-a54e-e038f62791b6 -->";
    expect(cleanBody(input)).toBe("Finding");
  });

  it("strips LOCATIONS comments", () => {
    const input = `Text

<!-- LOCATIONS START
.claude/skills/agent-reviews/SKILL.md#L26-L27
.claude/settings.json#L93-L110
LOCATIONS END -->

More`;

    const result = cleanBody(input);
    expect(result).not.toContain("LOCATIONS START");
    expect(result).not.toContain("SKILL.md#L26");
    expect(result).toContain("Text");
    expect(result).toContain("More");
  });

  it("strips Additional Locations <details> blocks", () => {
    const input = `Finding text

<details>
<summary>Additional Locations (2)</summary>

- [\`.claude/settings.json#L93-L110\`](https://github.com/example/repo/blob/abc/.claude/settings.json#L93-L110)
- [\`.claude/skills/agent-reviews/SKILL.md#L133-L134\`](https://github.com/example/repo/blob/abc/.claude/skills/agent-reviews/SKILL.md#L133-L134)

</details>

Rest of comment`;

    const result = cleanBody(input);
    expect(result).not.toContain("<details>");
    expect(result).not.toContain("Additional Locations");
    expect(result).not.toContain("</details>");
    expect(result).toContain("Finding text");
    expect(result).toContain("Rest of comment");
  });

  it("strips Cursor Fix buttons", () => {
    const input = `Finding text

<p><a href="https://cursor.com/open?data=eyJhbGciOiJSUzI1NiI..." target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/fix-in-cursor-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/fix-in-cursor-light.png"><img alt="Fix in Cursor" width="115" height="28" src="https://cursor.com/assets/images/fix-in-cursor-dark.png"></picture></a>&nbsp;<a href="https://cursor.com/agents?data=eyJhbGciOiJSUzI1NiI..." target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/fix-in-web-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/fix-in-web-light.png"><img alt="Fix in Web" width="99" height="28" src="https://cursor.com/assets/images/fix-in-web-dark.png"></picture></a></p>`;

    const result = cleanBody(input);
    expect(result).not.toContain("cursor.com");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("Fix in Cursor");
    expect(result).toBe("Finding text");
  });

  it("handles a full Cursor Bugbot comment", () => {
    const input = `### Skill command blocked by permissions

**High Severity**

<!-- DESCRIPTION START -->
\`SKILL.md\` runs \`scripts/agent-reviews.js\` directly, but \`.claude/settings.json\` no longer grants a matching \`Bash(...)\` permission.
<!-- DESCRIPTION END -->

<!-- BUGBOT_BUG_ID: d0d24d61-904c-47c1-a54e-e038f62791b6 -->

<!-- LOCATIONS START
.claude/skills/agent-reviews/SKILL.md#L26-L27
.claude/settings.json#L93-L110
LOCATIONS END -->
<details>
<summary>Additional Locations (2)</summary>

- [\`.claude/settings.json#L93-L110\`](https://github.com/org/repo/blob/abc/.claude/settings.json#L93-L110)
- [\`.claude/skills/agent-reviews/SKILL.md#L133-L134\`](https://github.com/org/repo/blob/abc/.claude/skills/agent-reviews/SKILL.md#L133-L134)

</details>

<p><a href="https://cursor.com/open?data=longtoken" target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/fix-in-cursor-dark.png"><img alt="Fix in Cursor" src="https://cursor.com/assets/images/fix-in-cursor-dark.png"></picture></a>&nbsp;<a href="https://cursor.com/agents?data=longtoken" target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/fix-in-web-dark.png"><img alt="Fix in Web" src="https://cursor.com/assets/images/fix-in-web-dark.png"></picture></a></p>`;

    const result = cleanBody(input);

    // Should keep the useful content
    expect(result).toContain("### Skill command blocked by permissions");
    expect(result).toContain("**High Severity**");
    expect(result).toContain("`SKILL.md` runs `scripts/agent-reviews.js`");

    // Should strip all boilerplate
    expect(result).not.toContain("<!--");
    expect(result).not.toContain("BUGBOT_BUG_ID");
    expect(result).not.toContain("LOCATIONS START");
    expect(result).not.toContain("Additional Locations");
    expect(result).not.toContain("cursor.com");
    expect(result).not.toContain("<details>");
    expect(result).not.toContain("<p>");
  });

  it("collapses excess blank lines", () => {
    const input = "Line 1\n\n\n\n\nLine 2";
    expect(cleanBody(input)).toBe("Line 1\n\nLine 2");
  });

  it("preserves non-Cursor <details> blocks", () => {
    const input = `<details>
<summary>Click to expand</summary>

Some useful content here.

</details>`;

    expect(cleanBody(input)).toContain("<details>");
    expect(cleanBody(input)).toContain("Click to expand");
  });

  it("preserves non-Cursor <p> blocks", () => {
    const input = "<p>This is a regular paragraph.</p>";
    expect(cleanBody(input)).toBe("<p>This is a regular paragraph.</p>");
  });
});

// ---------------------------------------------------------------------------
// isBot
// ---------------------------------------------------------------------------

describe("isBot", () => {
  it("detects [bot] suffix", () => {
    expect(isBot("cursor[bot]")).toBe(true);
    expect(isBot("dependabot[bot]")).toBe(true);
  });

  it("detects Copilot", () => {
    expect(isBot("Copilot")).toBe(true);
  });

  it("detects usernames containing bot", () => {
    expect(isBot("my-custom-bot")).toBe(true);
  });

  it("detects github-actions", () => {
    expect(isBot("github-actions")).toBe(true);
  });

  it("returns false for regular users", () => {
    expect(isBot("pbakaus")).toBe(false);
    expect(isBot("janedoe")).toBe(false);
  });

  it("returns false for falsy values", () => {
    expect(isBot(null)).toBe(false);
    expect(isBot(undefined)).toBe(false);
  });

  it("detects known bot logins without [bot] suffix", () => {
    expect(isBot("cursor")).toBe(true);
    expect(isBot("vercel")).toBe(true);
    expect(isBot("supabase")).toBe(true);
    expect(isBot("chatgpt-codex-connector")).toBe(true);
    expect(isBot("copilot-pull-request-reviewer")).toBe(true);
    expect(isBot("coderabbitai")).toBe(true);
    expect(isBot("sourcery-ai")).toBe(true);
    expect(isBot("codacy-production")).toBe(true);
    expect(isBot("sonarcloud")).toBe(true);
    expect(isBot("sonarqubecloud")).toBe(true);
    expect(isBot("sonarqube-cloud-us")).toBe(true);
  });

  it("detects gemini-code-assist (with and without [bot] suffix)", () => {
    expect(isBot("gemini-code-assist[bot]")).toBe(true);
    expect(isBot("gemini-code-assist")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isMetaComment
// ---------------------------------------------------------------------------

describe("isMetaComment", () => {
  it("filters Vercel deployment comments", () => {
    expect(isMetaComment("vercel[bot]", "[vc]: deployment status")).toBe(true);
  });

  it("filters Supabase branch comments", () => {
    expect(isMetaComment("supabase[bot]", "[supa]: branch ready")).toBe(true);
  });

  it("filters Cursor summary comments", () => {
    expect(
      isMetaComment(
        "cursor[bot]",
        "Cursor Bugbot has reviewed your changes and found 3 issues."
      )
    ).toBe(true);
  });

  it("does not filter Cursor finding comments", () => {
    expect(
      isMetaComment("cursor[bot]", "### Skill command blocked by permissions")
    ).toBe(false);
  });

  it("does not filter human comments", () => {
    expect(isMetaComment("pbakaus", "Looks good to me")).toBe(false);
  });

  it("returns false for empty body", () => {
    expect(isMetaComment("cursor[bot]", "")).toBe(false);
    expect(isMetaComment("cursor[bot]", null)).toBe(false);
  });

  it("filters Vercel comments without [bot] suffix", () => {
    expect(isMetaComment("vercel", "[vc]: deployment status")).toBe(true);
  });

  it("filters Supabase comments without [bot] suffix", () => {
    expect(isMetaComment("supabase", "[supa]: branch ready")).toBe(true);
  });

  it("filters Cursor comments without [bot] suffix", () => {
    expect(
      isMetaComment(
        "cursor",
        "Cursor Bugbot has reviewed your changes and found 3 issues."
      )
    ).toBe(true);
  });

  it("does not filter non-meta comments from bots without [bot] suffix", () => {
    expect(
      isMetaComment("cursor", "### Skill command blocked by permissions")
    ).toBe(false);
    expect(isMetaComment("vercel", "Build failed: see logs")).toBe(false);
  });

  it("filters Copilot PR review summary comments", () => {
    expect(
      isMetaComment(
        "copilot-pull-request-reviewer[bot]",
        "## Pull request overview\n\nSome summary of the PR changes."
      )
    ).toBe(true);
  });

  it("filters Copilot PR review summary without [bot] suffix", () => {
    expect(
      isMetaComment(
        "copilot-pull-request-reviewer",
        "## Pull request overview\n\nSome summary of the PR changes."
      )
    ).toBe(true);
  });

  it("does not filter Copilot inline findings", () => {
    expect(
      isMetaComment(
        "copilot-pull-request-reviewer[bot]",
        "This function is missing error handling for the case when..."
      )
    ).toBe(false);
  });

  // CodeRabbit
  it("filters CodeRabbit walkthrough/summary comments", () => {
    expect(
      isMetaComment(
        "coderabbitai[bot]",
        "<!-- This is an auto-generated comment: summarize by coderabbit.ai -->\n## Walkthrough\nThe PR introduces..."
      )
    ).toBe(true);
  });

  it("filters CodeRabbit review-skipped comments", () => {
    expect(
      isMetaComment(
        "coderabbitai[bot]",
        '<!-- This is an auto-generated comment: summarize by coderabbit.ai -->\n<!-- This is an auto-generated comment: skip review by coderabbit.ai -->\n\n> [!IMPORTANT]\n> ## Review skipped'
      )
    ).toBe(true);
  });

  it("does not filter CodeRabbit inline findings", () => {
    expect(
      isMetaComment(
        "coderabbitai[bot]",
        "This function has a potential null pointer dereference."
      )
    ).toBe(false);
  });

  // Sourcery
  it("filters Sourcery reviewer's guide comments", () => {
    expect(
      isMetaComment(
        "sourcery-ai[bot]",
        "<!-- Generated by sourcery-ai[bot]: start review_guide -->\n\n## Reviewer's Guide by Sourcery\n\nThis PR introduces..."
      )
    ).toBe(true);
  });

  it("filters Sourcery PR summary comments", () => {
    expect(
      isMetaComment(
        "sourcery-ai[bot]",
        "<!-- Generated by sourcery-ai[bot]: start pr_summary -->\n\n## PR Summary\n\nChanges in this PR..."
      )
    ).toBe(true);
  });

  it("does not filter Sourcery inline findings", () => {
    expect(
      isMetaComment(
        "sourcery-ai[bot]",
        "Consider defaulting linkPreview to true when the webhook doesn't specify it."
      )
    ).toBe(false);
  });

  // Codacy
  it("filters Codacy analysis summary comments", () => {
    expect(
      isMetaComment(
        "codacy-production[bot]",
        "## **Codacy's Analysis Summary**\n\n- 0 new issues\n- 0 new security issues"
      )
    ).toBe(true);
  });

  it("filters Codacy coverage summary comments", () => {
    expect(
      isMetaComment(
        "codacy-production[bot]",
        "## **Coverage summary from Codacy**\n\nSee diff coverage on Codacy"
      )
    ).toBe(true);
  });

  it("does not filter Codacy inline findings", () => {
    expect(
      isMetaComment(
        "codacy-production[bot]",
        "**MEDIUM RISK** - The current implementation defaults to enabling..."
      )
    ).toBe(false);
  });

  // SonarCloud / SonarQube Cloud
  it("filters SonarCloud quality gate comments", () => {
    expect(
      isMetaComment(
        "sonarcloud[bot]",
        "## Quality Gate passed\n\nIssues\n  0 New issues"
      )
    ).toBe(true);
  });

  it("filters SonarQube Cloud quality gate comments (rebranded)", () => {
    expect(
      isMetaComment(
        "sonarqubecloud[bot]",
        "## Quality Gate failed\n\nIssues\n  3 New issues"
      )
    ).toBe(true);
  });

  it("filters SonarQube Cloud US quality gate comments", () => {
    expect(
      isMetaComment(
        "sonarqube-cloud-us[bot]",
        "Quality Gate passed\n\nIssues\n  0 New issues"
      )
    ).toBe(true);
  });

  // Gemini Code Assist
  it("filters Gemini Code Assist Summary of Changes comments", () => {
    expect(
      isMetaComment(
        "gemini-code-assist[bot]",
        "## Summary of Changes\n\nHello @user, I'm Gemini Code Assist! I'm currently reviewing this pull request..."
      )
    ).toBe(true);
  });

  it("filters Gemini Code Assist comments without [bot] suffix", () => {
    expect(
      isMetaComment(
        "gemini-code-assist",
        "## Summary of Changes\n\nThis PR refactors..."
      )
    ).toBe(true);
  });

  it("does not filter Gemini Code Assist inline severity-badge findings", () => {
    expect(
      isMetaComment(
        "gemini-code-assist[bot]",
        "![high](https://www.gstatic.com/codereviewagent/high-priority.svg)\n\nThe `similarity_threshold` is hardcoded to `0.5` here."
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// processComments
// ---------------------------------------------------------------------------

describe("processComments", () => {
  const makeReviewComment = (overrides = {}) => ({
    id: 1,
    user: { login: "cursor[bot]" },
    body: "A finding",
    path: "src/index.js",
    line: 10,
    original_line: 10,
    diff_hunk: "@@ -1,3 +1,4 @@",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    html_url: "https://github.com/org/repo/pull/1#discussion_r1",
    ...overrides,
  });

  it("cleans body during processing", () => {
    const data = {
      reviewComments: [
        makeReviewComment({
          body: "Finding\n\n<!-- BUGBOT_BUG_ID: abc123 -->",
        }),
      ],
      issueComments: [],
      reviews: [],
    };

    const result = processComments(data);
    expect(result[0].body).toBe("Finding");
    expect(result[0].body).not.toContain("BUGBOT_BUG_ID");
  });

  it("cleans reply bodies", () => {
    const data = {
      reviewComments: [
        makeReviewComment({ id: 1 }),
        makeReviewComment({
          id: 2,
          in_reply_to_id: 1,
          body: "Reply\n\n<!-- some metadata -->",
        }),
      ],
      issueComments: [],
      reviews: [],
    };

    const result = processComments(data);
    expect(result[0].replies[0].body).toBe("Reply");
  });

  it("filters meta-comments", () => {
    const data = {
      reviewComments: [],
      issueComments: [
        {
          id: 1,
          user: { login: "cursor[bot]" },
          body: "Cursor Bugbot has reviewed your changes and found 3 issues.",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#issuecomment-1",
        },
      ],
      reviews: [],
    };

    const result = processComments(data);
    expect(result).toHaveLength(0);
  });

  it("filters meta-comments from bots without [bot] suffix", () => {
    const data = {
      reviewComments: [],
      issueComments: [
        {
          id: 1,
          user: { login: "cursor" },
          body: "Cursor Bugbot has reviewed your changes and found 3 issues.",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#issuecomment-1",
        },
        {
          id: 2,
          user: { login: "vercel" },
          body: "[vc]: deployment ready",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#issuecomment-2",
        },
      ],
      reviews: [],
    };

    const result = processComments(data);
    expect(result).toHaveLength(0);
  });

  it("marks known bots without [bot] suffix as isBot", () => {
    const data = {
      reviewComments: [
        makeReviewComment({ id: 1, user: { login: "Copilot" }, body: "Suggestion" }),
      ],
      issueComments: [],
      reviews: [],
    };

    const result = processComments(data);
    expect(result[0].isBot).toBe(true);
  });

  it("sorts comments newest first", () => {
    const data = {
      reviewComments: [
        makeReviewComment({
          id: 1,
          created_at: "2025-01-01T00:00:00Z",
        }),
        makeReviewComment({
          id: 2,
          created_at: "2025-01-02T00:00:00Z",
        }),
      ],
      issueComments: [],
      reviews: [],
    };

    const result = processComments(data);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });

  it("excludes bot review bodies (summaries)", () => {
    const data = {
      reviewComments: [],
      issueComments: [],
      reviews: [
        {
          id: 100,
          user: { login: "coderabbitai[bot]" },
          body: "**Actionable comments posted: 3**\n\nSome summary...",
          state: "COMMENTED",
          submitted_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#pullrequestreview-100",
        },
      ],
    };

    const result = processComments(data);
    expect(result).toHaveLength(0);
  });

  it("filters Gemini Code Assist Summary of Changes but keeps inline findings", () => {
    const data = {
      reviewComments: [
        makeReviewComment({
          id: 10,
          user: { login: "gemini-code-assist[bot]" },
          body: "![high](https://www.gstatic.com/codereviewagent/high-priority.svg)\n\nThe similarity_threshold is hardcoded.",
        }),
      ],
      issueComments: [
        {
          id: 20,
          user: { login: "gemini-code-assist[bot]" },
          body: "## Summary of Changes\n\nHello @user, I'm Gemini Code Assist! Highlights...",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#issuecomment-20",
        },
      ],
      reviews: [
        {
          id: 30,
          user: { login: "gemini-code-assist[bot]" },
          body: "## Code Review\n\nThis PR introduces several improvements...",
          state: "COMMENTED",
          submitted_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#pullrequestreview-30",
        },
      ],
    };

    const result = processComments(data);
    // Inline finding kept; summary issue comment + bot review body filtered.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
    expect(result[0].isBot).toBe(true);
  });

  it("keeps human review bodies", () => {
    const data = {
      reviewComments: [],
      issueComments: [],
      reviews: [
        {
          id: 200,
          user: { login: "reviewer" },
          body: "Looks good overall, just a few nits.",
          state: "COMMENTED",
          submitted_at: "2025-01-01T00:00:00Z",
          html_url: "https://github.com/org/repo/pull/1#pullrequestreview-200",
        },
      ],
    };

    const result = processComments(data);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// filterComments
// ---------------------------------------------------------------------------

describe("filterComments", () => {
  const comments = [
    { isBot: true, isResolved: false, hasHumanReply: false, hasAnyReply: false },
    {
      isBot: false,
      isResolved: false,
      hasHumanReply: true,
      hasAnyReply: true,
    },
    { isBot: true, isResolved: true, hasHumanReply: false, hasAnyReply: true },
  ];

  it("filters to bots only", () => {
    const result = filterComments(comments, { botsOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.isBot)).toBe(true);
  });

  it("filters to humans only", () => {
    const result = filterComments(comments, { humansOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].isBot).toBe(false);
  });

  it("filters unresolved", () => {
    const result = filterComments(comments, { filter: "unresolved" });
    expect(result).toHaveLength(1);
    expect(result[0].isResolved).toBe(false);
    expect(result[0].hasHumanReply).toBe(false);
  });

  it("filters unanswered", () => {
    const result = filterComments(comments, { filter: "unanswered" });
    expect(result).toHaveLength(1);
    expect(result[0].hasAnyReply).toBe(false);
  });

  it("combines bot filter with unanswered", () => {
    const result = filterComments(comments, {
      botsOnly: true,
      filter: "unanswered",
    });
    expect(result).toHaveLength(1);
    expect(result[0].isBot).toBe(true);
    expect(result[0].hasAnyReply).toBe(false);
  });

  it("combines human filter with unresolved", () => {
    const result = filterComments(comments, {
      humansOnly: true,
      filter: "unresolved",
    });
    // The one human comment has hasHumanReply=true so it's "resolved"
    expect(result).toHaveLength(0);
  });

  it("returns all when no filters", () => {
    const result = filterComments(comments, {});
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// GITHUB_API_URL override
// ---------------------------------------------------------------------------

describe("GITHUB_API_URL override", () => {
  afterEach(() => {
    delete process.env.GITHUB_API_URL;
    vi.resetModules();
  });

  it("findPRForBranch uses GITHUB_API_URL when set", async () => {
    process.env.GITHUB_API_URL = "https://gh.example.test/api";
    vi.resetModules();
    const { findPRForBranch } = await import("../lib/comments.js");

    const calls = [];
    await findPRForBranch("o", "r", "b", "tok", async (url) => {
      calls.push(url);
      return { ok: true, json: async () => [] };
    });

    expect(calls[0]).toBe(
      "https://gh.example.test/api/repos/o/r/pulls?head=o:b&state=open"
    );
  });

  it("findPRForBranch defaults to api.github.com when unset", async () => {
    delete process.env.GITHUB_API_URL;
    vi.resetModules();
    const { findPRForBranch } = await import("../lib/comments.js");

    const calls = [];
    await findPRForBranch("o", "r", "b", "tok", async (url) => {
      calls.push(url);
      return { ok: true, json: async () => [] };
    });

    expect(calls[0]).toBe(
      "https://api.github.com/repos/o/r/pulls?head=o:b&state=open"
    );
  });

  it("normalizes a trailing slash on GITHUB_API_URL", async () => {
    process.env.GITHUB_API_URL = "https://gh.example.test/api/v3/";
    vi.resetModules();
    const { findPRForBranch } = await import("../lib/comments.js");

    const calls = [];
    await findPRForBranch("o", "r", "b", "tok", async (url) => {
      calls.push(url);
      return { ok: true, json: async () => [] };
    });

    // No double slash between base and /repos.
    expect(calls[0]).toBe(
      "https://gh.example.test/api/v3/repos/o/r/pulls?head=o:b&state=open"
    );
  });

  it("replyToComment honors GITHUB_API_URL", async () => {
    process.env.GITHUB_API_URL = "https://gh.example.test/api/v3";
    vi.resetModules();
    const { replyToComment } = await import("../lib/comments.js");

    const calls = [];
    await replyToComment(
      "o",
      "r",
      42,
      777,
      "fixed",
      "tok",
      async (url) => {
        calls.push(url);
        return { ok: true, json: async () => ({ id: 1 }) };
      }
    );

    expect(calls[0]).toBe(
      "https://gh.example.test/api/v3/repos/o/r/pulls/42/comments/777/replies"
    );
  });

  it("resolveThread uses /graphql under api.github.com (default)", async () => {
    delete process.env.GITHUB_API_URL;
    vi.resetModules();
    const { resolveThread } = await import("../lib/comments.js");

    const calls = [];
    const fakeThread = {
      id: "PRRT_x",
      isResolved: false,
      comments: { nodes: [{ databaseId: 1 }] },
    };
    await resolveThread("o", "r", 42, 1, "tok", async (url, _opts) => {
      calls.push(url);
      // First call is the find-thread query, second is the resolve mutation.
      const body =
        calls.length === 1
          ? {
              data: {
                repository: {
                  pullRequest: {
                    reviewThreads: {
                      pageInfo: { hasNextPage: false, endCursor: null },
                      nodes: [fakeThread],
                    },
                  },
                },
              },
            }
          : {
              data: {
                resolveReviewThread: {
                  thread: { id: "PRRT_x", isResolved: true },
                },
              },
            };
      return { ok: true, json: async () => body };
    });

    expect(calls[0]).toBe("https://api.github.com/graphql");
    expect(calls[1]).toBe("https://api.github.com/graphql");
  });

  it("resolveThread maps GHES /api/v3 to /api/graphql at the same origin", async () => {
    process.env.GITHUB_API_URL = "https://gh.example.test/api/v3";
    vi.resetModules();
    const { resolveThread } = await import("../lib/comments.js");

    const calls = [];
    const fakeThread = {
      id: "PRRT_x",
      isResolved: false,
      comments: { nodes: [{ databaseId: 1 }] },
    };
    await resolveThread("o", "r", 42, 1, "tok", async (url, _opts) => {
      calls.push(url);
      const body =
        calls.length === 1
          ? {
              data: {
                repository: {
                  pullRequest: {
                    reviewThreads: {
                      pageInfo: { hasNextPage: false, endCursor: null },
                      nodes: [fakeThread],
                    },
                  },
                },
              },
            }
          : {
              data: {
                resolveReviewThread: {
                  thread: { id: "PRRT_x", isResolved: true },
                },
              },
            };
      return { ok: true, json: async () => body };
    });

    // GHES rewrites /api/v3 -> /api/graphql at the same origin.
    expect(calls[0]).toBe("https://gh.example.test/api/graphql");
    expect(calls[1]).toBe("https://gh.example.test/api/graphql");
  });

  it("GITHUB_GRAPHQL_URL overrides the derivation entirely", async () => {
    process.env.GITHUB_API_URL = "https://gh.example.test/api/v3";
    process.env.GITHUB_GRAPHQL_URL = "https://gql.example.test/custom";
    vi.resetModules();
    const { resolveThread } = await import("../lib/comments.js");

    const calls = [];
    await resolveThread("o", "r", 42, 1, "tok", async (url, _opts) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [],
                },
              },
            },
          },
        }),
      };
    });

    expect(calls[0]).toBe("https://gql.example.test/custom");
    delete process.env.GITHUB_GRAPHQL_URL;
  });
});
