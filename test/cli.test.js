import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { parseArgs, prepareReply } = require('../bin/agent-reviews.js');

describe('reply body files', () => {
  it('preserves exact UTF-8 content with either flag order and reply options', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reply-'));
    const file = join(dir, 'body with spaces.md');
    const body = '  Fixed café\n\n```js\n`quoted` $(command)\n```\n';
    writeFileSync(file, body);
    try {
      for (const args of [
        ['--reply', '123', '--body-file', file, '--resolve', '--json'],
        ['--body-file', file, '--json', '--resolve', '--reply', '123'],
      ]) {
        const options = parseArgs(args);
        prepareReply(options);
        expect(options.replyMessage).toBe(body);
        expect(options.replyTo).toBe('123');
        expect(options.resolve).toBe(true);
        expect(options.json).toBe(true);
      }
      for (const body of ['', ' \n\t']) {
        writeFileSync(file, body);
        expect(() => prepareReply(parseArgs(['--reply', '123', '--body-file', file]))).toThrow('non-empty');
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps positional messages working', () => {
    const options = parseArgs(['--reply', '123', 'Fixed!', '--resolve']);
    prepareReply(options);
    expect(options.replyMessage).toBe('Fixed!');
  });

  it.each([
    [['--reply', '123', '--body-file'], 'requires a path'],
    [['--reply', '123', '--body-file', '--json'], 'requires a path'],
    [['--body-file', 'body.md'], 'requires --reply'],
    [['--reply', '--body-file', 'body.md'], 'comment ID'],
    [['--reply', '123', 'text', '--body-file', 'body.md'], 'either a message'],
    [['--body-file', 'body.md', '--reply', '123', 'text'], 'either a message'],
    [['--reply', '123', '--body-file', 'a', '--body-file', 'b'], 'only be specified once'],
    [['--reply', '123', '--body-file', '/nonexistent/reply/body.md'], 'Cannot read body file'],
  ])('rejects invalid input before authentication: %j', (args, message) => {
    const result = spawnSync(process.execPath, ['bin/agent-reviews.js', ...args], {
      encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', PATH: '' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stderr).not.toContain('GitHub token');
    expect(result.stdout).toBe('');
  });
});

describe("strict argument parsing", () => {
  it.each([
    ["--reply", "123", "--typo", "reply.md"],
    ["--reply", "123", "Fixed", "--resolv"],
    ["--rply", "123", "Fixed"],
    ["--reply", "123", "Fixed", "extra"],
    ["456", "--reply", "Fixed"],
    ["unexpected"], ["--pr"], ["--pr", "--json"],
    ["--pr", "12oops"], ["--pr", "0"], ["--detail", "NaN"],
    ["--interval", "0"], ["--timeout", "1.5"],
    ["--reply", "bad-id", "Fixed"],
    ["--reply", "123", "Fixed", "--watch"],
    ["--resolve"], ["--bots-only", "--humans-only"],
    ["--pr", "1", "-p", "2"],
    ["--reply", "123", "", "--body-file", "body.md"],
  ])("fails before authentication and never prints a result: %j", (...args) => {
    const result = spawnSync(process.execPath, ["bin/agent-reviews.js", ...args], {
      encoding: "utf8", env: { ...process.env, GITHUB_TOKEN: "", GH_TOKEN: "", PATH: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Error:");
    expect(result.stderr).not.toContain("GitHub token");
    expect(result.stdout).toBe("");
  });

  it("preserves literal Markdown and option-like messages after --", () => {
    for (const body of ["- Fixed the issue\n- Added a test", "--resolve", "--"]) {
      const options = parseArgs(["--reply", "123", "--resolve", "--", body]);
      prepareReply(options);
      expect(options.replyMessage).toBe(body);
      expect(options.resolve).toBe(true);
    }
  });

  it("supports options between reply arguments", () => {
    const options = parseArgs(["--reply", "123", "--json", "Fixed", "--pr", "42"]);
    prepareReply(options);
    expect(options).toMatchObject({ replyTo: "123", replyMessage: "Fixed", prNumber: 42, json: true });
  });
});
