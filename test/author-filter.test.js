import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseArgs } = require("../bin/agent-reviews.js");
const { processComments, filterComments } = require("../lib/comments.js");

describe("author exclusion arguments", () => {
  it("accepts repeatable exact logins alongside watch filters", () => {
    expect(parseArgs(["--watch", "--bots-only", "--ignore-author", "GitHub-Actions[bot]", "--ignore-author", "vercel[bot]"])).toMatchObject({
      command: "watch", botsOnly: true, ignoredAuthors: ["github-actions[bot]", "vercel[bot]"],
    });
  });
  it("accepts Enterprise Managed User logins with underscores", () => {
    expect(parseArgs(["--ignore-author", "Some_User_CORP"]).ignoredAuthors).toEqual(["some_user_corp"]);
    const comments = [{ id: 1, user: "Some_User_CORP" }, { id: 2, user: "another_user" }];
    expect(filterComments(comments, { ignoredAuthors: ["some_user_corp"] }).map((c) => c.id)).toEqual([2]);
  });
  it.each([[], ["--json"], [""], ["*"]])("rejects a missing or invalid login %j", (...value) => {
    expect(() => parseArgs(["--ignore-author", ...value])).toThrow("requires a GitHub login");
  });
});

describe("author exclusion", () => {
  const raw = {
    reviewComments: [
      { id: 100, body: "Review finding", user: { login: "reviewer[bot]" } },
      { id: 101, body: "Context from automation", in_reply_to_id: 100, user: { login: "github-actions[bot]" } },
      { id: 102, body: "Automation finding", user: { login: "github-actions[bot]" } },
      { id: 103, body: "Human finding", user: { login: "maintainer" } },
    ],
    issueComments: [{ id: 104, body: "Deployment status", user: { login: "github-actions[bot]" } }],
    reviews: [],
  };
  it("excludes exact authors case-insensitively while preserving thread context", () => {
    const comments = processComments(raw);
    const visible = filterComments(comments, { ignoredAuthors: ["GITHUB-ACTIONS[bot]"] });
    expect(visible.map((comment) => comment.id).sort()).toEqual([100, 103]);
    expect(visible.find((comment) => comment.id === 100).replies).toHaveLength(1);
    expect(filterComments(comments, { ignoredAuthors: ["github-actions"] })).toHaveLength(4);
    expect(filterComments(comments, {})).toHaveLength(4);
  });
  it("combines author exclusion with unanswered and bot filters on each fetch", () => {
    for (let poll = 0; poll < 2; poll++) {
      const comments = processComments(raw);
      expect(filterComments(comments, {
        ignoredAuthors: ["github-actions[bot]"], botsOnly: true, filter: "unanswered",
      })).toEqual([]);
      expect(filterComments(comments, {
        ignoredAuthors: ["github-actions[bot]", "maintainer"],
      }).map((comment) => comment.id)).toEqual([100]);
    }
  });
});
