import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const cli = resolve("bin/agent-reviews.js");

describe("fork CLI integration", () => {
  it.each(["list", "reply", "explicit", "push-url"])("routes %s to the upstream repository", async (mode) => {
    const directory = mkdtempSync(join(tmpdir(), "agent-reviews-fork-"));
    const requests = [];
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      requests.push({ url: req.url, method: req.method, body });
      res.setHeader("Content-Type", "application/json");
      const path = req.url.split("?")[0];
      let result;
      if (path === "/repos/contributor/project") {
        result = { parent: { owner: { login: "organisation" }, name: "project" } };
      } else if (path === "/repos/contributor/project/pulls") {
        result = [];
      } else if (path === "/repos/organisation/project/pulls") {
        result = [{ number: 123, html_url: "https://github.com/organisation/project/pull/123", head: { ref: "feature", repo: { full_name: "contributor/project" } } }];
      } else if (path === "/repos/organisation/project/pulls/123/comments/456/replies") {
        result = { id: 789, html_url: "https://github.com/organisation/project/pull/123#reply" };
      } else if (["/repos/organisation/project/pulls/123/comments", "/repos/organisation/project/pulls/123/reviews", "/repos/organisation/project/issues/123/comments"].includes(path)) {
        result = [];
      } else {
        res.statusCode = 404;
        result = { message: "Unexpected endpoint" };
      }
      res.end(JSON.stringify(result));
    });
    try {
      execFileSync("git", ["init", "--initial-branch=feature", directory], { stdio: "ignore" });
      execFileSync("git", ["-C", directory, "remote", "add", "origin", "https://127.0.0.1/contributor/project.git"]);
      if (mode === "push-url") {
        execFileSync("git", ["-C", directory, "remote", "set-url", "origin", "https://127.0.0.1/organisation/project.git"]);
        execFileSync("git", ["-C", directory, "remote", "set-url", "--push", "origin", "https://127.0.0.1/contributor/project.git"]);
      }
      await new Promise((done, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", done);
      });
      const args = mode === "reply" ? ["--reply", "456", "Fixed", "--json"] : ["--json", ...(mode === "explicit" ? ["--pr", "123"] : [])];
      const output = await new Promise((done, reject) => {
        const child = spawn(process.execPath, [cli, ...args], {
          cwd: directory,
          env: { ...process.env, GITHUB_TOKEN: "test-token", GH_REPO: mode === "explicit" ? "organisation/project" : "", GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, HTTPS_PROXY: "", https_proxy: "" },
        });
        let stdout = "", stderr = "";
        child.stdout.on("data", (data) => stdout += data);
        child.stderr.on("data", (data) => stderr += data);
        child.on("error", reject);
        child.on("close", (status) => done({ status, stdout, stderr }));
      });
      expect(output.status, output.stderr).toBe(0);
      const data = JSON.parse(output.stdout);
      if (mode === "reply") {
        expect(data.replied).toBe(true);
        expect(requests.find((r) => r.method === "POST")).toMatchObject({ url: "/repos/organisation/project/pulls/123/comments/456/replies", body: '{"body":"Fixed"}' });
      } else {
        expect(data).toEqual([]);
        expect(requests.some((r) => r.url.startsWith("/repos/organisation/project/issues/123/comments"))).toBe(true);
      }
      if (mode === "explicit") expect(requests).toHaveLength(3);
    } finally {
      await new Promise((done) => server.close(done));
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
