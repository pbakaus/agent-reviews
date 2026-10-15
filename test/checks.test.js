import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { evaluateChecks, waitForChecks, EXIT } = require('../lib/checks.js');

const run = (name, status, conclusion = null) => ({ name, status, conclusion, html_url: `https://ci/${name}` });

describe('evaluateChecks', () => {
  it('sorts check runs and commit statuses into passed, failed, pending and skipped, and names missing expected checks', () => {
    const result = evaluateChecks({
      runs: [
        run('build', 'completed', 'success'),
        run('lint', 'completed', 'neutral'),
        run('test', 'completed', 'failure'),
        run('e2e', 'completed', 'timed_out'),
        run('deploy', 'in_progress'),
        run('preview', 'completed', 'skipped'),
      ],
      statuses: [
        { context: 'Impeccable', state: 'success' },
        { context: 'license', state: 'error' },
        { context: 'coverage', state: 'pending' },
      ],
    }, ['Greptile Review', 'Impeccable']);
    const names = (list) => list.map((c) => c.name);
    expect(names(result.passed)).toEqual(['build', 'lint', 'Impeccable']);
    expect(names(result.failed)).toEqual(['test', 'e2e', 'license']);
    expect(names(result.pending)).toEqual(['deploy', 'coverage']);
    expect(names(result.skipped)).toEqual(['preview']);
    expect(result.missing).toEqual(['Greptile Review']);
  });
});

// A scripted PR: each poll takes the next state (the last one repeats); the clock advances on sleep.
function scripted(polls) {
  let t = 0;
  let i = 0;
  const current = () => polls[Math.min(i, polls.length - 1)];
  return {
    deps: {
      pr: async () => ({ state: 'open', draft: false, mergeable: true, mergeable_state: 'clean', number: 7, ...current().pr, head: { sha: current().sha ?? 'aaa' } }),
      checks: async () => ({ runs: current().runs ?? [], statuses: [] }),
      now: () => t,
      sleep: async (s) => { t += s * 1000; i += 1; },
    },
    elapsed: () => t / 1000,
  };
}

const ci = run('CI', 'completed', 'success');

describe('waitForChecks', () => {
  it.each([
    ['all checks pass and stay settled', [{ runs: [ci] }], {}, EXIT.ok, 'passed'],
    ['a check fails', [{ runs: [run('CI', 'completed', 'failure')] }], {}, EXIT.attention, 'failed'],
    ['the PR conflicts with its base', [{ pr: { mergeable: false, mergeable_state: 'dirty' } }], {}, EXIT.conflict, 'conflict'],
    ['no check ever registers', [{ runs: [] }], {}, EXIT.noChecks, 'no-checks'],
    ['checks never finish', [{ runs: [run('CI', 'queued')] }], { timeout: 120 }, EXIT.timeout, 'timeout'],
    ['an expected reviewer never reports', [{ runs: [ci] }], { expect: ['Greptile Review'] }, EXIT.attention, 'absent'],
    ['a draft does not wait for expected reviewers', [{ pr: { draft: true }, runs: [ci] }], { expect: ['Greptile Review'] }, EXIT.ok, 'passed'],
    ['the PR is merged meanwhile', [{ pr: { state: 'closed', merged: true } }], {}, EXIT.ok, 'merged'],
  ])('%s', async (_, polls, options, code, outcome) => {
    const { deps } = scripted(polls);
    const result = await waitForChecks(deps, { interval: 15, ...options });
    expect([result.code, result.outcome]).toEqual([code, outcome]);
  });

  it('waits for a reviewer that registers after CI finishes', async () => {
    const greptile = run('Greptile Review', 'completed', 'success');
    const { deps, elapsed } = scripted([
      { runs: [run('CI', 'in_progress')] },
      { runs: [ci] },
      { runs: [ci, run('Greptile Review', 'in_progress')] },
      { runs: [ci, greptile] },
    ]);
    const result = await waitForChecks(deps, { interval: 15, expect: ['Greptile Review'] });
    expect(result.outcome).toBe('passed');
    expect(result.checks.passed.map((c) => c.name)).toEqual(['CI', 'Greptile Review']);
    expect(elapsed()).toBeGreaterThanOrEqual(45);
  });

  it('restarts the settle window when a check appears already finished between polls', async () => {
    const { deps, elapsed } = scripted([
      { runs: [ci] },
      { runs: [ci] },
      { runs: [ci, run('late', 'completed', 'success')] },
    ]);
    const result = await waitForChecks(deps, { interval: 15 });
    expect(result.checks.passed.map((c) => c.name)).toEqual(['CI', 'late']);
    expect(elapsed()).toBeGreaterThanOrEqual(30 + 30);
  });

  it('names expected checks that never came when it times out', async () => {
    const { deps } = scripted([{ runs: [run('CI', 'queued')] }]);
    const result = await waitForChecks(deps, { interval: 15, timeout: 60, expect: ['Greptile Review'] });
    expect([result.outcome, result.absent]).toEqual(['timeout', ['Greptile Review']]);
  });

  it('keeps waiting for an expected reviewer that is the only check', async () => {
    const polls = Array.from({ length: 20 }, () => ({ runs: [] }));
    polls.push({ runs: [run('Greptile Review', 'completed', 'success')] });
    const { deps } = scripted(polls);
    const result = await waitForChecks(deps, { interval: 15, expect: ['Greptile Review'] });
    expect(result.outcome).toBe('passed');
  });

  it('does not report on a commit that was replaced while its checks were read', async () => {
    let head = 'old';
    const deps = {
      pr: async () => ({ state: 'open', draft: false, mergeable: true, number: 7, head: { sha: head } }),
      checks: async (sha) => {
        if (sha === 'old' && t >= 30000) head = 'new'; // pushed during the final read
        return { runs: [sha === 'old' ? ci : run('CI', 'completed', 'failure')], statuses: [] };
      },
      now: () => t,
      sleep: async (s) => { t += s * 1000; },
    };
    let t = 0;
    const result = await waitForChecks(deps, { interval: 15 });
    expect([result.sha, result.outcome]).toEqual(['new', 'failed']);
  });

  it('follows a new push and reports on the new head', async () => {
    const { deps } = scripted([
      { sha: 'old', runs: [run('CI', 'in_progress')] },
      { sha: 'new', runs: [run('CI', 'completed', 'failure')] },
    ]);
    const result = await waitForChecks(deps, { interval: 15 });
    expect([result.sha, result.outcome]).toEqual(['new', 'failed']);
  });
});
