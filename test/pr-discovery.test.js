import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { getBranchContext, getDefaultRepository, parseRemote, discoverPullRequest } = require("../lib/pr-discovery");
const { findPRForBranch } = require("../lib/comments");
const fork = { owner: "contributor", repo: "project" };
const upstream = { owner: "organisation", repo: "project" };
const context = { branch: "feature", headBranch: "feature", headRepo: fork, repositories: [fork, upstream] };
const pr = { number: 123, head: { ref: "feature", repo: { full_name: "contributor/project" } } };
const response = (body, status = 200, link = null) => ({
  ok: status === 200, status, headers: { get: () => link }, json: async () => body,
});

function gitFixture(config = {}, remoteUrls = { origin: "git@github.com:contributor/project.git" }, pushUrls = {}) {
  return (args) => {
    if (args[0] === "symbolic-ref") return "feature";
    if (args.join(" ") === "remote") return Object.keys(remoteUrls).join("\n");
    if (args[0] === "remote") return (args.includes("--push") ? pushUrls[args.at(-1)] ?? remoteUrls[args.at(-1)] : remoteUrls[args[2]]) || "";
    return config[args[2]] || "";
  };
}

describe("branch repository detection", () => {
  it.each([
    "git@github.com:contributor/project.git", "https://github.com/contributor/project.git",
    "ssh://git@github.com/contributor/project.git", "http://proxy/git/contributor/project",
  ])("supports remote URL %s", (url) => expect(parseRemote(url)).toEqual(fork));
  it.each(["git@github.example.com:contributor/project.git", "https://github.example.com/contributor/project.git", "ssh://git@github.example.com:2222/contributor/project.git"])("supports configured enterprise host %s", (url) => {
    expect(parseRemote(url, "https://github.example.com/api/v3")).toEqual(fork);
  });
  it.each(["http://127.0.0.1:8080", "http://localhost:8080", "http://[::1]:8080"])("supports GitHub remotes with local API endpoints: %s", (apiUrl) => {
    expect(parseRemote("git@github.com:contributor/project.git", apiUrl)).toEqual(fork);
    expect(parseRemote("https://github.example.com/contributor/project", apiUrl)).toBeNull();
  });
  it("does not query repositories from unrelated hosts on the configured API", () => {
    expect(parseRemote("https://gitlab.com/contributor/project", "https://api.github.com")).toBeNull();
    expect(parseRemote("git@github.com:contributor/project.git", "https://github.example.com/api/v3")).toBeNull();
  });
  it("maps Enterprise Cloud API hosts to their git host", () => {
    expect(parseRemote("git@octocorp.ghe.com:contributor/project.git", "https://api.octocorp.ghe.com")).toEqual(fork);
    expect(parseRemote("https://octocorp.ghe.com/contributor/project", "https://api.octocorp.ghe.com")).toEqual(fork);
  });
  it("uses the push URL for head identity and retains the fetch URL as a base candidate", () => {
    const c = getBranchContext(gitFixture({}, { origin: "https://github.com/organisation/project" }, { origin: "https://github.com/contributor/project" }));
    expect(c.headRepo).toEqual(fork);
    expect(c.repositories).toEqual([upstream]);
  });
  it("rejects multiple push destinations instead of selecting a head arbitrarily", () => {
    expect(() => getBranchContext(gitFixture({}, { origin: "https://github.com/organisation/project" }, { origin: "https://github.com/contributor/project\nhttps://github.com/another/project" }))).toThrow("unique GitHub push repository");
  });
  it("uses origin when a branch has no tracking configuration", () => {
    expect(getBranchContext(gitFixture()).headRepo).toEqual(fork);
  });
  it("uses a differently named tracking remote", () => {
    const c = getBranchContext(gitFixture({ "branch.feature.remote": "contribution" }, {
      contribution: "https://github.com/contributor/project", upstream: "https://github.com/organisation/project",
    }));
    expect(c.headRepo).toEqual(fork);
    expect(c.repositories).toHaveLength(2);
  });
  it("prefers the push remote over the base branch tracking remote", () => {
    expect(getBranchContext(gitFixture({
      "branch.feature.remote": "upstream", "branch.feature.pushRemote": "origin",
    }, { origin: "https://github.com/contributor/project", upstream: "https://github.com/organisation/project" })).headRepo).toEqual(fork);
  });
  it("uses remote.pushDefault and keeps the current branch name", () => {
    expect(getBranchContext(gitFixture({
      "remote.pushDefault": "origin", "branch.feature.merge": "refs/heads/main",
    })).headBranch).toBe("feature");
  });
  it("rejects detached HEAD and ambiguous remote selection", () => {
    expect(() => getBranchContext(() => "")).toThrow("detached HEAD");
    expect(() => getBranchContext(gitFixture({}, {
      one: "https://github.com/a/b", two: "https://github.com/c/d",
    }))).toThrow("Cannot determine");
  });
});

describe("explicit PR repository selection", () => {
  it("works without branch information and with a uniquely named remote", () => {
    const read = gitFixture({}, { upstream: "https://github.com/organisation/project" });
    expect(getDefaultRepository((args) => {
      if (args[0] === "symbolic-ref") throw new Error("Must not inspect branch");
      return read(args);
    })).toEqual(upstream);
  });
  it("prefers origin and rejects ambiguous non-origin repositories", () => {
    expect(getDefaultRepository(gitFixture({}, { origin: "https://github.com/contributor/project", upstream: "https://github.com/organisation/project" }))).toEqual(fork);
    expect(() => getDefaultRepository(gitFixture({}, { one: "https://github.com/contributor/project", two: "https://github.com/organisation/project" }))).toThrow("Multiple GitHub repositories");
  });
});

describe("fork-aware lookup", () => {
  it("finds the upstream PR and returns the base repository for later operations", async () => {
    const calls = [];
    const result = await discoverPullRequest(context, null, "token", async (url) => {
      calls.push(url);
      return response(url.includes("/organisation/project/pulls") ? [pr] : url.includes("/pulls?") ? [] : {});
    });
    expect(result).toEqual({ pr, repoInfo: upstream });
    expect(calls.find((u) => u.includes("/organisation/"))).toContain("head=contributor%3Afeature");
  });
  it("discovers the parent even with only an origin remote", async () => {
    const result = await discoverPullRequest({ ...context, repositories: [fork] }, null, "token", async (url) => {
      if (!url.includes("/pulls?")) return response({ parent: { owner: { login: "organisation" }, name: "project" } });
      return response(url.includes("organisation") ? [pr] : []);
    });
    expect(result.repoInfo).toEqual(upstream);
  });
  it("honors GH_REPO without replacing the fork's head owner", async () => {
    const calls = [];
    const result = await discoverPullRequest(context, upstream, "token", async (url) => {
      calls.push(url);
      return response([pr]);
    });
    expect(result.repoInfo).toEqual(upstream);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/organisation/project/pulls?head=contributor%3Afeature");
  });
  it("requires explicit selection when a matching PR lacks head identity", async () => {
    await expect(discoverPullRequest(context, upstream, "token", async () => response([{ ...pr, head: { ref: "feature", repo: null } }]))).rejects.toThrow("deleted or inaccessible");
  });
  it("filters matching branch names from the wrong head repository", async () => {
    const result = await discoverPullRequest(context, upstream, "token", async () => response([
      { ...pr, head: { ...pr.head, repo: { full_name: "contributor/other-project" } } }, pr,
    ]));
    expect(result.pr).toEqual(pr);
  });
  it("rejects multiple PRs instead of selecting one to mutate", async () => {
    await expect(discoverPullRequest(context, null, "token", async (url) => response(url.includes("/pulls?") ? [pr] : {}))).rejects.toThrow("Multiple open PRs");
    await expect(discoverPullRequest(context, upstream, "token", async () => response([pr, { ...pr, number: 124 }]))).rejects.toThrow("Multiple open PRs");
  });
  it("encodes branch names and paginates before selecting", async () => {
    const calls = [];
    const found = await findPRForBranch("organisation", "project", "fix/a&b", "token", async (url) => {
      calls.push(url);
      return calls.length === 1 ? response([], 200, '<https://api.github.com/page2>; rel="next"')
        : response([{ ...pr, head: { ...pr.head, ref: "fix/a&b" } }]);
    }, fork);
    expect(found.number).toBe(123);
    expect(calls[0]).toContain("head=contributor%3Afix%2Fa%26b");
    expect(calls).toHaveLength(2);
  });
  it("tolerates inaccessible candidates but surfaces auth failures and explicit target failures", async () => {
    const found = await discoverPullRequest(context, null, "token", async (url) => {
      if (url.includes("organisation")) return response([pr]);
      return response({}, 404);
    });
    expect(found.pr).toEqual(pr);
    await expect(discoverPullRequest(context, null, "token", async () => response({}, 403))).rejects.toThrow("403");
    await expect(discoverPullRequest(context, upstream, "token", async () => response({}, 404))).rejects.toThrow("404");
  });
  it("supports same-repository PRs and returns null when none match", async () => {
    expect((await discoverPullRequest(context, fork, "token", async () => response([pr]))).repoInfo).toEqual(fork);
    expect(await discoverPullRequest(context, fork, "token", async () => response([]))).toBeNull();
  });
});
