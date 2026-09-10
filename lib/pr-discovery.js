/** Fork-aware PR discovery, using git configuration and the GitHub API. */
const { execFileSync } = require("node:child_process");
const { findPRForBranch, getRepository } = require("./comments");

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function parseRemote(url, apiUrl = process.env.GITHUB_API_URL || "https://api.github.com") {
  let host;
  try {
    host = new URL(apiUrl.trim()).hostname;
  } catch {
    throw new Error("GITHUB_API_URL must be a valid URL");
  }
  if (host === "api.github.com" || /^api\.[^.]+\.ghe\.com$/.test(host)) host = host.slice(4);
  const localApi = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  let remoteHost;
  let remotePath;
  if (url.includes("://")) {
    try {
      const remote = new URL(url);
      if (!["https:", "http:", "ssh:"].includes(remote.protocol)) return null;
      remoteHost = remote.hostname;
      remotePath = remote.pathname;
    } catch { return null; }
  } else {
    const scp = url.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
    if (!scp) return null;
    remoteHost = scp[1].toLowerCase();
    remotePath = scp[2];
  }
  // Retain the existing /git/owner/repo form used by hosted git proxies.
  const proxy = remotePath.match(/^\/git\/([^/]+)\/([^/]+?)\/?$/);
  const match = proxy || ((remoteHost === host || (localApi && remoteHost === "github.com")) && remotePath.match(/^\/?([^/]+)\/([^/]+?)\/?$/));
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function getDefaultRepository(readGit = git) {
  const names = readGit(["remote"]).split(/\r?\n/).filter(Boolean);
  const repositories = names.map((name) => ({ name, repo: parseRemote(readGit(["remote", "get-url", name])) })).filter((entry) => entry.repo);
  const origin = repositories.find((entry) => entry.name === "origin");
  if (origin) return origin.repo;
  const distinct = new Map(repositories.map(({ repo }) => [`${repo.owner}/${repo.repo}`.toLowerCase(), repo]));
  if (distinct.size > 1) throw new Error("Multiple GitHub repositories configured. Set GH_REPO=owner/repo for --pr.");
  return distinct.values().next().value || null;
}

function getBranchContext(readGit = git) {
  const branch = readGit(["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (!branch) throw new Error("Cannot discover a PR from detached HEAD. Use GH_REPO=owner/repo with --pr <number>.");
  const names = readGit(["remote"]).split(/\r?\n/).filter(Boolean);
  const remotes = new Map(names.map((name) => [name, parseRemote(readGit(["remote", "get-url", name]))]));
  const trackingRemote = readGit(["config", "--get", `branch.${branch}.remote`]);
  const pushRemote = readGit(["config", "--get", `branch.${branch}.pushRemote`])
    || readGit(["config", "--get", "remote.pushDefault"]);
  const remote = pushRemote || (trackingRemote !== "." && trackingRemote) || (remotes.has("origin") ? "origin" : names.length === 1 ? names[0] : "");
  const pushUrls = remote ? readGit(["remote", "get-url", "--push", "--all", remote]).split(/\r?\n/).filter(Boolean) : [];
  const pushRepos = pushUrls.map((url) => parseRemote(url));
  const identities = new Set(pushRepos.filter(Boolean).map((repo) => `${repo.owner}/${repo.repo}`.toLowerCase()));
  if (identities.size > 1 || pushRepos.some((repo) => !repo)) {
    throw new Error("Cannot select a unique GitHub push repository. Use GH_REPO=owner/repo with --pr <number>.");
  }
  const headRepo = pushRepos[0];
  if (!headRepo) throw new Error("Cannot determine the branch's GitHub remote. Configure its remote or origin, or use GH_REPO=owner/repo with --pr <number>.");
  return { branch, headBranch: branch, headRepo, repositories: [...remotes.values()].filter(Boolean) };
}

async function discoverPullRequest(context, target, token, proxyFetch) {
  const repositories = new Map();
  function add(repo) {
    if (repo) repositories.set(`${repo.owner}/${repo.repo}`.toLowerCase(), repo);
  }
  if (target) {
    add(target);
  } else {
    context.repositories.forEach(add);
    add(context.headRepo);
    // A fork can have an upstream PR even when no upstream remote is configured.
    const metadata = await getRepository(context.headRepo, token, proxyFetch);
    for (const repo of [metadata?.parent, metadata?.source]) {
      if (repo?.owner?.login && repo?.name) add({ owner: repo.owner.login, repo: repo.name });
    }
  }
  const matches = [];
  for (const repo of repositories.values()) {
    const pr = await findPRForBranch(repo.owner, repo.repo, context.headBranch, token, proxyFetch, context.headRepo, !target);
    if (pr) matches.push({ pr, repoInfo: repo });
  }
  if (matches.length > 1) {
    throw new Error("Multiple open PRs match this branch. Use GH_REPO=owner/repo and --pr <number> to select one.");
  }
  return matches[0] || null;
}

module.exports = { parseRemote, getDefaultRepository, getBranchContext, discoverPullRequest };
