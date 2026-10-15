/**
 * Waiting for a PR's checks on its head commit
 *
 * Review bots (Greptile, Cursor Bugbot, Copilot, ...) and CI report as check
 * runs or commit statuses, so a commit's review is finished when its checks
 * are. waitForChecks polls until every check on the head commit has finished,
 * stops early when nothing will run (a conflict with the base branch), and
 * waits a short settle window for checks that register late.
 */

const USER_AGENT = "agent-reviews";
const API_BASE = (process.env.GITHUB_API_URL || "https://api.github.com")
  .trim()
  .replace(/\/+$/, "");

const PASS = new Set(["success", "neutral"]);
const SKIP = new Set(["skipped"]);

// Exit codes, also returned as result.code
const EXIT = { ok: 0, attention: 1, conflict: 2, timeout: 3, noChecks: 4 };

async function getJson(url, token, proxyFetch) {
  const response = await proxyFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status} (${url.replace(API_BASE, "")})`);
  return response.json();
}

async function fetchPullRequest(owner, repo, prNumber, token, proxyFetch) {
  return getJson(`${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, token, proxyFetch);
}

/** Check runs (latest per name) and commit statuses (latest per context) for a commit. */
async function fetchCommitChecks(owner, repo, sha, token, proxyFetch) {
  const base = `${API_BASE}/repos/${owner}/${repo}/commits/${sha}`;
  const runs = [];
  for (let page = 1; ; page++) {
    const data = await getJson(`${base}/check-runs?filter=latest&per_page=100&page=${page}`, token, proxyFetch);
    runs.push(...(data.check_runs || []));
    if (runs.length >= (data.total_count || 0) || !(data.check_runs || []).length) break;
  }
  const statuses = [];
  for (let page = 1; ; page++) {
    const combined = await getJson(`${base}/status?per_page=100&page=${page}`, token, proxyFetch);
    statuses.push(...(combined.statuses || []));
    if (statuses.length >= (combined.total_count || 0) || !(combined.statuses || []).length) break;
  }
  return { runs, statuses };
}

/**
 * Sorts a commit's checks into passed, failed, pending and skipped, and names
 * the expected checks that have not reported. Pure; the shape is what
 * fetchCommitChecks returns.
 */
function evaluateChecks({ runs, statuses }, expect = []) {
  const checks = [];
  for (const run of runs) {
    let state;
    if (run.status !== "completed") state = "pending";
    else if (PASS.has(run.conclusion)) state = "pass";
    else if (SKIP.has(run.conclusion)) state = "skip";
    else state = "fail";
    checks.push({ name: run.name, state, conclusion: run.conclusion || run.status, url: run.html_url || run.details_url || null });
  }
  for (const status of statuses) {
    const state = status.state === "success" ? "pass" : status.state === "pending" ? "pending" : "fail";
    checks.push({ name: status.context, state, conclusion: status.state, url: status.target_url || null });
  }
  const by = (state) => checks.filter((c) => c.state === state);
  const names = new Set(checks.map((c) => c.name));
  return {
    total: checks.length,
    passed: by("pass"),
    failed: by("fail"),
    pending: by("pending"),
    skipped: by("skip"),
    missing: expect.filter((name) => !names.has(name)),
  };
}

/**
 * Polls until the head commit's checks are settled, then returns what needs
 * attention. Everything that touches time or the network is injected.
 *
 * deps: { pr: () => Promise<pull>, checks: (sha) => Promise<{runs, statuses}>,
 *         now: () => ms, sleep: (seconds) => Promise }
 * options: { interval, timeout, expect, settle, checksGrace, expectGrace } (seconds)
 */
async function waitForChecks(deps, options = {}) {
  const interval = options.interval ?? 15;
  const timeout = options.timeout ?? 1800;
  const expect = options.expect ?? [];
  const settle = options.settle ?? 30; // late registrations: a reviewer that starts when CI ends
  const checksGrace = options.checksGrace ?? 180; // no check at all this long after a push: none is coming
  const expectGrace = options.expectGrace ?? 600; // an expected check still missing this long after the rest finished

  const start = deps.now();
  let sha = null;
  let shaSince = start;
  let settledSince = null;
  let seen = "";
  let evaluation = null;
  let pr = null;

  const done = (code, outcome, extra = {}) => ({
    code,
    outcome,
    sha,
    pr,
    checks: evaluation,
    absent: [],
    ...extra,
  });

  for (;;) {
    pr = await deps.pr();
    if (pr.head.sha !== sha) {
      sha = pr.head.sha;
      shaSince = deps.now();
      settledSince = null;
      seen = "";
    }
    if (pr.state !== "open") return done(EXIT.ok, pr.merged ? "merged" : "closed");
    // GitHub computes mergeability lazily; null means not yet known.
    if (pr.mergeable === false && pr.mergeable_state === "dirty") return done(EXIT.conflict, "conflict");

    const expected = pr.draft ? [] : expect; // review bots usually skip drafts
    evaluation = evaluateChecks(await deps.checks(sha), expected);
    const elapsed = (deps.now() - shaSince) / 1000;
    // A check that appeared since the last poll restarts the settle window, even if it already finished.
    const names = [...evaluation.passed, ...evaluation.failed, ...evaluation.pending, ...evaluation.skipped]
      .map((c) => c.name).sort().join("\n");
    if (names !== seen) settledSince = null;
    seen = names;

    if (evaluation.total === 0) {
      // An expected reviewer may be the only check, and may come late.
      if (elapsed >= (expected.length ? Math.max(checksGrace, expectGrace) : checksGrace)) {
        return done(EXIT.noChecks, "no-checks", { absent: evaluation.missing });
      }
    } else if (evaluation.pending.length === 0) {
      settledSince ??= deps.now();
      const settled = (deps.now() - settledSince) / 1000;
      if (evaluation.missing.length === 0 && settled >= settle) {
        return done(evaluation.failed.length ? EXIT.attention : EXIT.ok, evaluation.failed.length ? "failed" : "passed");
      }
      if (evaluation.missing.length && settled >= expectGrace) {
        return done(EXIT.attention, evaluation.failed.length ? "failed" : "absent", { absent: evaluation.missing });
      }
    } else {
      settledSince = null;
    }

    if ((deps.now() - start) / 1000 >= timeout) return done(EXIT.timeout, "timeout", { absent: evaluation.missing });
    await deps.sleep(interval);
  }
}

module.exports = { EXIT, fetchPullRequest, fetchCommitChecks, evaluateChecks, waitForChecks };
