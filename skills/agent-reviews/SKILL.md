---
name: agent-reviews
description: Review and fix PR review bot findings on current PR, loop until resolved. Fetches unanswered bot comments, evaluates each finding, fixes real bugs, dismisses false positives, and replies to every comment with the outcome.
license: MIT
compatibility: Requires git and gh (GitHub CLI) installed. Designed for Claude Code.
allowed-tools: Bash(node scripts/agent-reviews.js *) Bash(gh pr view *)
metadata:
  author: pbakaus
  version: "0.6.0"
  homepage: https://github.com/pbakaus/agent-reviews
---

Automatically review, fix, and respond to findings from PR review bots on the current PR. Uses a deterministic two-phase workflow: first fix all existing issues, then poll once for new ones.

**Path note:** All `scripts/agent-reviews.js` references below are relative to this skill's directory (next to this SKILL.md file). Run them with `node`.

## Phase 1: FETCH & FIX (synchronous)

### Step 1: Identify Current PR

```bash
gh pr view --json number,url,headRefName
```

If no PR exists, notify the user and exit.

### Step 2: Fetch All Bot Comments (Expanded)

Run `scripts/agent-reviews.js --bots-only --unanswered --expanded`

This shows only unanswered bot comments with full detail: complete comment body (no truncation), diff hunk (code context), and all replies. Each comment shows its ID in brackets (e.g., `[12345678]`).

If zero comments are returned, print "No unanswered bot comments found" and skip to Phase 2.

### Step 3: Process Each Unanswered Comment

For each comment from the expanded output:

#### A. Evaluate the Finding

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

**When UNCERTAIN — use `AskUserQuestion`:**
- The fix would require architectural changes
- You're genuinely unsure if the behavior is intentional
- The "bug" relates to business logic you don't fully understand
- Multiple valid interpretations exist
- The fix could have unintended side effects

#### B. Act on Evaluation

**If TRUE POSITIVE:** Fix the code. Track the comment ID and a brief description of the fix.

**If FALSE POSITIVE:** Do NOT change the code. Track the comment ID and the reason it's not a real bug.

**If UNCERTAIN:** Use `AskUserQuestion`. If the user says skip, track it as skipped.

Do NOT reply to comments yet. Replies happen after the commit (Step 5).

### Step 4: Commit and Push

After evaluating and fixing ALL unanswered comments:

1. Run your project's lint and type-check
2. Stage, commit, and push:
   ```bash
   git add -A
   git commit -m "fix: address PR review bot findings

   {List of bugs fixed, grouped by bot}"
   git push
   ```
3. Capture the commit hash from the output.

### Step 5: Reply to All Comments

Now that the commit hash exists, reply to every processed comment:

**For each TRUE POSITIVE:**

Run `scripts/agent-reviews.js --reply <comment_id> "Fixed in {hash}. {Brief description of the fix}"`

**For each FALSE POSITIVE:**

Run `scripts/agent-reviews.js --reply <comment_id> "Won't fix: {reason}. {Explanation of why this is intentional or not applicable}"`

**For each SKIPPED:**

Run `scripts/agent-reviews.js --reply <comment_id> "Skipped per user request"`

**DO NOT start Phase 2 until all replies are posted.**

---

## Phase 2: POLL FOR NEW COMMENTS (loop until quiet)

The watcher exits immediately when new comments are found (after a 5s grace period to catch batch posts). This means you run it in a loop: start watcher, process any comments it returns, restart watcher, repeat until the watcher times out with no new comments.

### Step 6: Start Watcher Loop

Repeat the following until the watcher exits with no new comments:

**6a.** Launch the watcher in the background:

Run `scripts/agent-reviews.js --watch --bots-only` as a background task.

**6b.** Use `TaskOutput` to wait for the watcher to complete (blocks up to 12 minutes).

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

```
## PR Review Bot Resolution Summary

### Results
- Fixed: X bugs
- Already fixed: X bugs
- Won't fix (false positives): X
- Skipped per user: X

### By Bot
#### cursor[bot]
- BUG-001: {description} - Fixed in {commit}
- BUG-002: {description} - Won't fix: {reason}

#### Copilot
- {description} - Fixed in {commit}

### Status
✅ All findings addressed. Watch completed.
```

## Important Notes

### Response Policy
- **Every finding gets a response** - No silent ignores
- Responses help train bots and document decisions
- "Won't fix" responses prevent the same false positive from being re-raised

### User Interaction
- Use `AskUserQuestion` when uncertain about a finding
- Don't guess on architectural or business logic questions
- It's better to ask than to make a wrong fix or wrong dismissal

### Best Practices
- Verify findings before fixing - bots have false positives
- Keep fixes minimal and focused - don't refactor unrelated code
- Ensure type-check and lint pass before committing
- Group related fixes into a single commit
- Copilot `suggestion` blocks often contain ready-to-use fixes
