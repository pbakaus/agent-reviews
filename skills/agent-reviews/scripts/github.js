/**
 * GitHub API utilities for agent-reviews
 *
 * Handles authentication, proxy support, and repository detection.
 * Works in both local and cloud environments (HTTPS_PROXY, etc.).
 */

const { execSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Proxy-aware fetch (for cloud/corporate environments)
// ---------------------------------------------------------------------------

function getProxyFetch() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxyUrl) {
    try {
      const { ProxyAgent, fetch: undiciFetch } = require("undici");
      const agent = new ProxyAgent(proxyUrl);
      return (url, options = {}) =>
        undiciFetch(url, { ...options, dispatcher: agent });
    } catch {
      // undici not available, fall back to native fetch
    }
  }
  return globalThis.fetch;
}

// ---------------------------------------------------------------------------
// GitHub token resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a GitHub token from (in priority order):
 * 1. GITHUB_TOKEN env var
 * 2. .env.local files in the repo root
 * 3. `gh auth token` CLI
 */
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  const root = getRepoRoot();
  if (root) {
    const envFile = path.join(root, ".env.local");
    if (existsSync(envFile)) {
      const content = readFileSync(envFile, "utf8");
      const match = content.match(/^GITHUB_TOKEN=["']?([^"'\n]+)["']?/m);
      if (match) {
        return match[1];
      }
    }
  }

  try {
    const token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (token) {
      return token;
    }
  } catch {
    // gh CLI not available or not authenticated
  }

  return null;
}

// ---------------------------------------------------------------------------
// Repository info
// ---------------------------------------------------------------------------

function getRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getRepoInfo() {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf8",
    }).trim();

    const sshMatch = remoteUrl.match(
      /git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/
    );
    const httpsMatch = remoteUrl.match(
      /github\.com\/([^/]+)\/(.+?)(?:\.git)?$/
    );
    const proxyMatch = remoteUrl.match(/\/git\/([^/]+)\/([^/]+)$/);

    const match = sshMatch || httpsMatch || proxyMatch;
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

module.exports = {
  getProxyFetch,
  getGitHubToken,
  getRepoInfo,
  getRepoRoot,
  getCurrentBranch,
};
