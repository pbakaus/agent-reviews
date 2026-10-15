---
name: resolve-reviews
description: Resolve all PR review comments (human and bot) on current PR. Fetches unanswered comments, evaluates each one, fixes real issues, dismisses false positives, and replies to every comment with the outcome.
license: MIT
compatibility: Requires git, gh (GitHub CLI), and Node.js installed.
allowed-tools: Bash(npx agent-reviews *) Bash(pnpm dlx agent-reviews *) Bash(yarn dlx agent-reviews *) Bash(bunx agent-reviews *) Bash(git config *) Bash(git add *) Bash(git commit *) Bash(git push *)
metadata:
  author: pbakaus
  version: "1.3.0"
  homepage: https://github.com/pbakaus/agent-reviews
---

Automatically resolve all review comments (both human and bot) on the current PR. Uses a two-phase workflow: fix all existing issues, then poll for new ones until quiet.

## Prerequisites

All commands below use `npx agent-reviews`. If the project uses a different package manager, substitute the appropriate runner (e.g., `pnpm dlx agent-reviews` for pnpm, `yarn dlx agent-reviews` for Yarn, `bunx agent-reviews` for Bun). Honor the user's package manager preference throughout.

**Cloud environments only** (e.g., Codespaces, remote agents): verify git author identity so CI checks can map commits to the user. Run `git config --global --get user.email` and if empty or a placeholder, set it manually. Skip this check in local environments.

## Phase 1: FETCH & FIX (synchronous)

### Step 1: Fetch All Comments (Expanded)

Run `npx agent-reviews --unanswered --expanded`

The CLI auto-detects the current branch, finds the associated PR, and authenticates via `gh` CLI or environment variables. If anything fails (no token, no PR, CLI not installed), it exits with a clear error message.

This shows all unanswered comments (both human and bot) with full detail: complete comment body (no truncation), diff hunk (code context), and all replies. Each comment shows its ID in brackets (e.g., `[12345678]`).

If zero comments are returned, print "No unanswered comments found" and skip to Phase 2.

### Step 3: Process Each Unanswered Comment

For each comment from the expanded output, apply the appropriate evaluation based on whether the author is a bot or a human.

#### For Bot Comments

Read the referenced code and determine:

1. **TRUE POSITIVE** - A real bug that needs fixing
2. **FALSE POSITIVE** - Not actually a bug (intentional behavior, bot misunderstanding)
3. **UNCERTAIN** - Not sure; ask the user

**Likely TRUE POSITIVE:**
- Code obviously violates stated behavior
- Missing null checks on potentially undefined values
- Type mismatches or incorrect function signatures
- Logic errors in conditionals
- Missing error handling for documented failure cases

**Likely FALSE POSITIVE:**
- Bot doesn't understand the framework/library patterns
- Code is intentionally structured that way (with comments explaining why)
- Bot is flagging style preferences, not bugs
- The "bug" is actually a feature or intentional behavior
- Bot misread the code flow

#### For Human Comments

Read the referenced code and the reviewer's comment. Human reviewers are generally more accurate and context-aware than bots. Determine:

1. **ACTIONABLE** - The reviewer identified a real issue or requested a concrete change
2. **DISCUSSION** - The comment raises a valid point but the right approach is unclear
3. **ALREADY ADDRESSED** - The concern has already been fixed or is no longer relevant

**Likely ACTIONABLE:**
- Reviewer points out a bug or logic error
- Reviewer requests a specific code change
- Reviewer identifies missing edge cases or error handling

**Likely DISCUSSION -- ask the user:**
- Reviewer suggests an architectural change you're unsure about
- Comment involves a tradeoff (performance vs readability, etc.)
- The feedback is subjective without team consensus

#### When UNCERTAIN -- ask the user

For both bot and human comments:
- The fix would require architectural changes
- You're genuinely unsure if the behavior is intentional
- Multiple valid interpretations exist
- The fix could have unintended side effects

#### Act on Evaluation

**If TRUE POSITIVE / ACTIONABLE:** Fix the code. Track the comment ID and a brief description of the fix.

**If FALSE POSITIVE:** Do NOT change the code. Track the comment ID and the reason it's not a real bug.

**If DISCUSSION:** Ask the user to consult the PR author. Apply their decision and track it.

**If ALREADY ADDRESSED:** Track the comment ID and note why.

**If UNCERTAIN:** Ask the user. If they say skip, track it as skipped.

Do NOT reply to comments yet. Replies happen after the commit (Step 5).

### Step 4: Commit and Push

After evaluating and fixing ALL unanswered comments:

1. Run your project's lint and type-check
2. Stage, commit, and push:
   ```bash
   git add -A
   git commit -m "fix: address PR review findings

   {List of changes made, grouped by reviewer/bot}"
   git push
   ```
3. Capture the commit hash from the output.

### Step 5: Reply to All Comments

Before posting to an inline review comment, fetch `npx agent-reviews --detail <comment_id>` and inspect the latest replies. PR-level issue comments and review summaries have no threaded reply list; an empty list for these types is not evidence that no outcome was recorded. The CLI skips replies to those types. Record that skip and do not create a replacement top-level comment or use another tool to bypass it. If the same outcome is already recorded, do not post it again. On a resumed session, use the fresh unanswered list instead of replaying a prior session's work queue. Revisit a decision only when new discussion or a user request calls for it.

For multiline or complex replies, write the exact reply text to a uniquely named UTF-8 file in a temporary directory outside the repository and use `npx agent-reviews --reply <comment_id> --body-file <path_to_reply_file>` (adding `--resolve` only where appropriate below). The CLI accepts absolute and relative paths; prefer an absolute path for the outside-repository temporary file. Use the file path directly, without shell command substitution. Do not also pass a positional message. Remove the temporary file after the reply succeeds; keep reply files outside the repository even if posting fails so later `git add -A` commands cannot commit them.

Now that the commit hash exists, reply to every processed comment. The `--resolve` flag marks the review thread as resolved on GitHub. Use it only when closing the conversation (false positives, discussions concluded, already-addressed, user-skipped), not for fresh fixes that reviewers should still verify.

**For each TRUE POSITIVE / ACTIONABLE** (we fixed it; leave the thread open so reviewers can verify):

Run `npx agent-reviews --reply <comment_id> "Fixed in {hash}. {Brief description of the fix}"`

**For each FALSE POSITIVE** (closing the conversation):

Run `npx agent-reviews --reply <comment_id> "Won't fix: {reason}. {Explanation of why this is intentional or not applicable}" --resolve`

**For each DISCUSSION (after user decision)** (the decision concludes the thread):

Run `npx agent-reviews --reply <comment_id> "{Outcome}. {Explanation of the decision and any changes made}" --resolve`

**For each ALREADY ADDRESSED** (nothing more to do):

Run `npx agent-reviews --reply <comment_id> "Already addressed. {Explanation of when/how this was fixed}" --resolve`

**For each SKIPPED** (user chose not to address it):

Run `npx agent-reviews --reply <comment_id> "Skipped per user request" --resolve`

**Non-threadable comments:** If a comment was posted as a PR-level issue comment or review-summary submission (not an inline review comment on a specific line), the CLI cannot post a threaded reply and will print `⊘ Skipped reply: comment is not part of a review thread`. That's expected. Record the outcome in the summary and move on; do not retry.

**DO NOT start Phase 2 until all replies are posted.**

---

## Phase 2: WAIT FOR THE HEAD COMMIT'S CHECKS (loop until clean)

Most review bots (Greptile, Cursor Bugbot, CodeRabbit and others) report as a check on the commit, beside CI, so a review is finished when the commit's checks are. `--wait-checks` waits for exactly that, then prints only what needs you.

### Step 6: Wait, then act on the report

Repeat until a pass exits 0:

**6a.** Run `npx agent-reviews --wait-checks --unanswered` as a background task, and carry on with other work until it finishes. Never poll with `gh pr checks --watch`, sleep loops or repeated listings.

Add `--expect "<check name>"` for each reviewer that registers its check late (for example one that starts only after a preview deploys), so the wait does not end before it reports. Expected checks are not waited for on a draft PR, since review bots usually skip drafts.

**6b.** Read the report. The first line names the commit and the outcome; below it are failed checks with links, expected checks that never reported, unanswered inline comments, and PR-level comments. PR-level comments (issue comments, review summaries) have no thread to reply in, so they are listed on every run: process only IDs you have not handled in this run. The exit code says what to do:

- **0**: every check passed and no comment waits. Move to the Summary Report.
- **1**: a check failed, an expected check never reported, or inline comments wait. Process comments exactly as in Phase 1, Steps 3-5 (evaluate, fix, commit, push, reply). A failed check is a finding too: read its log (`gh run view <id> --log-failed` for GitHub Actions; for a review bot or an external status, open its link), fix it, commit and push. Then **go back to Step 6a**. If the only problem is an expected check that never reported, do not wait again: name it in the Summary Report and stop.
- **2**: the PR conflicts with its base branch, so CI will not run. Merge or rebase the base branch, push, and go back to Step 6a.
- **3**: timed out with checks still running (default 30 minutes; `--timeout <seconds>`). Report which checks are pending.
- **4**: no check registered on the commit. Report it; the repository may have no CI for this branch.

If you push while it waits, it follows the new head commit on its own.

**Round cap.** Each pass through 6b that ends in a fix push is a round. If new findings keep landing on lines your own earlier fix commits changed, each fix is opening the next edge case, and more patches will not converge. After the second such round, stop: do not push another fix. Report the remaining findings to the user together with what each fix round changed, and suggest reviewing the design as a whole (for example with an adversarial design review) before continuing. Findings on code the earlier fixes did not touch do not count toward the cap.

A reviewer that posts without a check (Copilot, for example) is the one case for the comment watcher. After a clean `--wait-checks`, run `npx agent-reviews --watch --unanswered --timeout 180` once. If it returns findings, process them as in Phase 1, Steps 3-5, and **go back to Step 6a**, so the new commit's checks are waited for too.

---

## Summary Report

After both phases complete, provide a summary:

```text
## PR Review Resolution Summary

### Results
- Fixed: X issues
- Already addressed: X
- Won't fix (false positives): X
- Discussion resolved: X
- Skipped per user: X

### By Reviewer/Bot
#### cursor[bot]
- {description} - Fixed in {commit}
- {description} - Won't fix: {reason}

#### @reviewer-name
- {description} - Fixed in {commit}

### Status
All findings addressed. Every check on the head commit passed.
```

## Important Notes

### Response Policy
- **Every comment gets a response** - No silent ignores
- For bots: responses help train them and prevent re-raised false positives
- For humans: replies keep reviewers informed and unblock approvals

### User Interaction
- Ask the user when uncertain about a finding
- Don't guess on architectural or business logic questions
- It's better to ask than to make a wrong fix or wrong dismissal
- Human reviewers often have context you don't - defer to the author when unsure

### Best Practices
- Verify findings before fixing - bots have false positives, humans rarely do
- Keep fixes minimal and focused - don't refactor unrelated code
- Ensure type-check and lint pass before committing
- Group related fixes into a single commit
- Copilot `suggestion` blocks often contain ready-to-use fixes
- If a human reviewer suggests a specific code change, prefer their version unless it introduces issues
