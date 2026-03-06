---
name: resolve-human-reviews
description: Resolve human PR review comments on current PR. Fetches unanswered human comments, evaluates each piece of feedback, applies fixes, and replies to every comment with the outcome.
license: MIT
compatibility: Requires git, gh (GitHub CLI), and Node.js installed.
allowed-tools: Bash(npx agent-reviews *) Bash(pnpm dlx agent-reviews *) Bash(yarn dlx agent-reviews *) Bash(bunx agent-reviews *) Bash(git config *) Bash(git add *) Bash(git commit *) Bash(git push *)
metadata:
  author: pbakaus
  version: "1.0.1"
  homepage: https://github.com/pbakaus/agent-reviews
---

Automatically resolve human review comments on the current PR. Fetches unanswered human feedback, evaluates each comment, applies fixes where appropriate, and replies to every comment with the outcome.

## Prerequisites

All commands below use `npx agent-reviews`. If the project uses a different package manager, substitute the appropriate runner (e.g., `pnpm dlx agent-reviews` for pnpm, `yarn dlx agent-reviews` for Yarn, `bunx agent-reviews` for Bun). Honor the user's package manager preference throughout.

**Cloud environments only** (e.g., Codespaces, remote agents): verify git author identity so CI checks can map commits to the user. Run `git config --global --get user.email` and if empty or a placeholder, set it manually. Skip this check in local environments.

## Phase 1: FETCH & FIX (synchronous)

### Step 1: Fetch All Human Comments (Expanded)

Run `npx agent-reviews --humans-only --unanswered --expanded`

The CLI auto-detects the current branch, finds the associated PR, and authenticates via `gh` CLI or environment variables. If anything fails (no token, no PR, CLI not installed), it exits with a clear error message.

This shows only unanswered human comments with full detail: complete comment body (no truncation), diff hunk (code context), and all replies. Each comment shows its ID in brackets (e.g., `[12345678]`).

If zero comments are returned, print "No unanswered human comments found" and skip to Phase 2.

### Step 3: Process Each Unanswered Comment

For each comment from the expanded output:

#### A. Evaluate the Feedback

Read the referenced code and the reviewer's comment. Human reviewers are generally more accurate and context-aware than bots. Treat their feedback with appropriate weight. Determine:

1. **ACTIONABLE** - The reviewer identified a real issue or requested a concrete change
2. **DISCUSSION** - The comment raises a valid point but the right approach is unclear
3. **ALREADY ADDRESSED** - The concern has already been fixed or is no longer relevant

**Likely ACTIONABLE:**
- Reviewer points out a bug or logic error
- Reviewer requests a specific code change
- Reviewer identifies missing edge cases or error handling
- Reviewer flags a naming, API, or architectural concern with a clear fix
- Reviewer suggests a better approach with justification

**Likely DISCUSSION -- ask the user:**
- Reviewer suggests an architectural change you're unsure about
- Comment involves a tradeoff (performance vs readability, etc.)
- Reviewer's suggestion conflicts with patterns used elsewhere in the codebase
- The feedback is subjective (style, naming preferences) without team consensus
- You disagree with the feedback and want the author to weigh in

**Likely ALREADY ADDRESSED:**
- The code has been changed since the review was posted
- Another commit already fixed the issue
- The comment refers to code that no longer exists

#### B. Act on Evaluation

**If ACTIONABLE:** Fix the code. Track the comment ID and a brief description of the fix.

**If DISCUSSION:** Ask the user to consult the PR author. Apply their decision and track it.

**If ALREADY ADDRESSED:** Track the comment ID and note why.

Do NOT reply to comments yet. Replies happen after the commit (Step 5).

### Step 4: Commit and Push

After evaluating and fixing ALL unanswered comments:

1. Run your project's lint and type-check
2. Stage, commit, and push:
   ```bash
   git add -A
   git commit -m "fix: address PR review feedback

   {List of changes made, grouped by reviewer}"
   git push
   ```
3. Capture the commit hash from the output.

### Step 5: Reply to All Comments

Now that the commit hash exists, reply to every processed comment. The `--resolve` flag marks the review thread as resolved on GitHub.

**For each ACTIONABLE:**

Run `npx agent-reviews --reply <comment_id> "Fixed in {hash}. {Brief description of the fix}" --resolve`

**For each DISCUSSION (after user decision):**

Run `npx agent-reviews --reply <comment_id> "{Outcome}. {Explanation of the decision and any changes made}" --resolve`

**For each ALREADY ADDRESSED:**

Run `npx agent-reviews --reply <comment_id> "Already addressed. {Explanation of when/how this was fixed}" --resolve`

**DO NOT start Phase 2 until all replies are posted.**

---

## Phase 2: POLL FOR FOLLOW-UP COMMENTS (loop until quiet)

The watcher exits immediately when new comments are found (after a 5s grace period to catch batch posts). This means you run it in a loop: start watcher, process any comments it returns, restart watcher, repeat until the watcher times out with no new comments.

### Step 6: Start Watcher Loop

Repeat the following until the watcher exits with no new comments:

**6a.** Launch the watcher in the background:

Run `npx agent-reviews --watch --humans-only` as a background task.

**6b.** Wait for the background command to complete (default 10 minutes; override with `--timeout`).

**6c.** Check the output:

- **If new comments were found** (output contains `EXITING WITH NEW COMMENTS`):
  1. Use `--detail <id>` to read each new comment's full detail
  2. Process them exactly as in Phase 1, Steps 3-5 (evaluate, fix, commit, push, reply)
  3. **Go back to Step 6a** to restart the watcher

- **If no new comments** (output contains `WATCH COMPLETE`):
  Stop looping and move to the Summary Report.

---

## Summary Report

After both phases complete, provide a summary:

```text
## PR Review Resolution Summary

### Results
- Fixed: X issues
- Already addressed: X
- Discussion resolved: X
- Skipped per user: X

### By Reviewer
#### @reviewer-name
- {description} - Fixed in {commit}
- {description} - Already addressed

### Status
All review comments addressed. Watch completed.
```

## Important Notes

### Response Policy
- **Every comment gets a response** - No silent ignores
- Replies keep reviewers informed and unblock approvals
- Even "already addressed" comments deserve acknowledgement

### User Interaction
- Ask the user when the right approach is unclear
- Human reviewers often have context you don't - defer to the author when unsure
- It's better to ask than to make a change the author wouldn't approve

### Best Practices
- Human reviewers are generally more accurate than bots - default to trusting their feedback
- Keep fixes minimal and focused - don't refactor unrelated code
- Ensure type-check and lint pass before committing
- Group related fixes into a single commit
- If a reviewer suggests a specific code change, prefer their version unless it introduces issues
