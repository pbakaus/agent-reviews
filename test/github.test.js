import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseHeaderMap,
  parseLastHeaderBlock,
  getGitHubToken,
  getRepoInfo,
} from "../lib/github.js";

// ---------------------------------------------------------------------------
// parseHeaderMap
// ---------------------------------------------------------------------------

describe("parseHeaderMap", () => {
  it("parses simple headers", () => {
    const raw = "Content-Type: application/json\nX-Request-Id: abc123";
    const headers = parseHeaderMap(raw);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("abc123");
  });

  it("is case-insensitive for lookups", () => {
    const raw = "Content-Type: text/html";
    const headers = parseHeaderMap(raw);
    expect(headers.get("CONTENT-TYPE")).toBe("text/html");
    expect(headers.get("content-type")).toBe("text/html");
    expect(headers.get("Content-Type")).toBe("text/html");
  });

  it("handles headers with colons in values", () => {
    const raw = "Link: <https://api.github.com/repos?page=2>; rel=\"next\"";
    const headers = parseHeaderMap(raw);
    expect(headers.get("link")).toBe(
      "<https://api.github.com/repos?page=2>; rel=\"next\""
    );
  });

  it("skips lines without colons", () => {
    const raw = "HTTP/1.1 200 OK\nContent-Type: text/plain";
    const headers = parseHeaderMap(raw);
    expect(headers.get("content-type")).toBe("text/plain");
  });

  it("returns null for missing headers", () => {
    const headers = parseHeaderMap("Content-Type: text/plain");
    expect(headers.get("x-missing")).toBe(null);
  });

  it("handles empty input", () => {
    const headers = parseHeaderMap("");
    expect(headers.get("anything")).toBe(null);
  });

  it("handles CRLF line endings", () => {
    const raw = "Content-Type: application/json\r\nAccept: text/html";
    const headers = parseHeaderMap(raw);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("text/html");
  });
});

// ---------------------------------------------------------------------------
// parseLastHeaderBlock
// ---------------------------------------------------------------------------

describe("parseLastHeaderBlock", () => {
  it("extracts the only header block", () => {
    const input = "HTTP/1.1 200 OK\nContent-Type: text/html";
    const result = parseLastHeaderBlock(input);
    expect(result).toContain("HTTP/1.1 200 OK");
    expect(result).toContain("Content-Type: text/html");
  });

  it("extracts the last block after redirects", () => {
    const input = [
      "HTTP/1.1 301 Moved Permanently",
      "Location: https://example.com/new",
      "",
      "HTTP/1.1 200 OK",
      "Content-Type: application/json",
    ].join("\r\n");

    const result = parseLastHeaderBlock(input);
    expect(result).toContain("HTTP/1.1 200 OK");
    expect(result).not.toContain("301");
  });

  it("handles multiple redirect hops", () => {
    const input = [
      "HTTP/1.1 301 Moved",
      "Location: /step2",
      "",
      "HTTP/1.1 302 Found",
      "Location: /step3",
      "",
      "HTTP/1.1 200 OK",
      "Content-Type: text/plain",
    ].join("\r\n");

    const result = parseLastHeaderBlock(input);
    expect(result).toContain("200 OK");
    expect(result).not.toContain("301");
    expect(result).not.toContain("302");
  });

  it("returns empty string for empty input", () => {
    expect(parseLastHeaderBlock("")).toBe("");
  });

  it("returns empty string when no HTTP block found", () => {
    expect(parseLastHeaderBlock("not a header")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getGitHubToken (env var resolution)
// ---------------------------------------------------------------------------

describe("getGitHubToken", () => {
  const savedEnv = {};

  beforeEach(() => {
    savedEnv.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    savedEnv.GH_TOKEN = process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
  });

  afterEach(() => {
    if (savedEnv.GITHUB_TOKEN !== undefined) {
      process.env.GITHUB_TOKEN = savedEnv.GITHUB_TOKEN;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
    if (savedEnv.GH_TOKEN !== undefined) {
      process.env.GH_TOKEN = savedEnv.GH_TOKEN;
    } else {
      delete process.env.GH_TOKEN;
    }
  });

  it("prefers GITHUB_TOKEN over GH_TOKEN", () => {
    process.env.GITHUB_TOKEN = "gh-token-1";
    process.env.GH_TOKEN = "gh-token-2";
    expect(getGitHubToken()).toBe("gh-token-1");
  });

  it("falls back to GH_TOKEN", () => {
    process.env.GH_TOKEN = "gh-token-fallback";
    expect(getGitHubToken()).toBe("gh-token-fallback");
  });

  it("returns GITHUB_TOKEN when set", () => {
    process.env.GITHUB_TOKEN = "test-token";
    expect(getGitHubToken()).toBe("test-token");
  });
});

// ---------------------------------------------------------------------------
// getRepoInfo (GH_REPO env var)
// ---------------------------------------------------------------------------

describe("getRepoInfo", () => {
  const savedEnv = {};

  beforeEach(() => {
    savedEnv.GH_REPO = process.env.GH_REPO;
    delete process.env.GH_REPO;
  });

  afterEach(() => {
    if (savedEnv.GH_REPO !== undefined) {
      process.env.GH_REPO = savedEnv.GH_REPO;
    } else {
      delete process.env.GH_REPO;
    }
  });

  it("uses GH_REPO when set", () => {
    process.env.GH_REPO = "myorg/myrepo";
    const info = getRepoInfo();
    expect(info).toEqual({ owner: "myorg", repo: "myrepo" });
  });

  it("ignores invalid GH_REPO format", () => {
    process.env.GH_REPO = "not-a-valid-format";
    // Should fall through to git remote detection (which works in this repo)
    const info = getRepoInfo();
    expect(info).not.toEqual({ owner: "not-a-valid-format", repo: undefined });
  });

  it("falls back to git remote when GH_REPO is not set", () => {
    // We're in a git repo so this should work
    const info = getRepoInfo();
    expect(info).not.toBe(null);
    expect(info).toHaveProperty("owner");
    expect(info).toHaveProperty("repo");
  });
});
