/**
 * GitHub API utilities for agent-reviews
 *
 * Handles authentication, proxy support, and repository detection.
 * Works in both local and cloud environments (HTTPS_PROXY, etc.).
 */

const { execSync, execFileSync } = require("node:child_process");
const { existsSync, readFileSync, mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Proxy-aware fetch (for cloud/corporate environments)
// ---------------------------------------------------------------------------

function parseHeaderMap(rawHeaders) {
  const lines = rawHeaders.split(/\r?\n/).filter(Boolean);
  const map = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    map.set(key, value);
  }
  return {
    get(name) {
      return map.get(String(name).toLowerCase()) || null;
    },
  };
}

function parseLastHeaderBlock(headerContent) {
  const blocks = headerContent
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (blocks[i].startsWith("HTTP/")) {
      return blocks[i];
    }
  }
  return "";
}

function createCurlFetch() {
  return async (url, options = {}) => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "agent-reviews-"));
    const headersFile = path.join(tempDir, "headers.txt");
    const bodyFile = path.join(tempDir, "body.txt");

    const args = [
      "--silent",
      "--show-error",
      "--location",
      "--dump-header",
      headersFile,
      "--output",
      bodyFile,
      "--request",
      options.method || "GET",
      "--write-out",
      "%{http_code}",
    ];

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        args.push("--header", `${key}: ${value}`);
      }
    }

    if (options.body) {
      args.push("--data", options.body);
    }

    args.push(String(url));

    try {
      const statusCodeRaw = execFileSync("curl", args, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const status = Number.parseInt(statusCodeRaw, 10);
      const body = readFileSync(bodyFile, "utf8");
      const headersRaw = readFileSync(headersFile, "utf8");
      const lastHeaderBlock = parseLastHeaderBlock(headersRaw);

      return {
        ok: status >= 200 && status < 300,
        status,
        headers: parseHeaderMap(lastHeaderBlock),
        async text() {
          return body;
        },
        async json() {
          return JSON.parse(body || "null");
        },
      };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function getProxyFetch() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxyUrl) {
    try {
      const { ProxyAgent, fetch: undiciFetch } = require("undici");
      const agent = new ProxyAgent(proxyUrl);
      return (url, options = {}) =>
        undiciFetch(url, { ...options, dispatcher: agent });
    } catch {
      return createCurlFetch();
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
 * 2. GH_TOKEN env var
 * 3. .env.local files in the repo root
 * 4. `gh auth token` CLI
 */
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  if (process.env.GH_TOKEN) {
    return process.env.GH_TOKEN;
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
  const envRepo = process.env.GH_REPO;
  if (envRepo) {
    const match = envRepo.match(/^([^/]+)\/([^/]+)$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

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
  parseHeaderMap,
  parseLastHeaderBlock,
};
