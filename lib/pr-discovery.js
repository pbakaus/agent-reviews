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

function parseRemote(url) {
  const match = url.match(/^(?:git@github\.com:|https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)\/?$/)
    || url.match(/\/git\/([^/]+)\/([^/]+?)\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
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
  const headRepo = remotes.get(remote);
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

module.exports = { parseRemote, getBranchContext, discoverPullRequest };
