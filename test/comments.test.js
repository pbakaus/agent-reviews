import { describe, it, expect } from "vitest";
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
});
