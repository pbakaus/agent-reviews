---
name: agent-reviews
description: Review and fix PR review bot findings on current PR, loop until resolved
allowed-tools: Bash(node scripts/agent-reviews.js *), Bash(gh *), Bash(git *), Read, Glob, Grep, Edit, Write, AskUserQuestion, Task, TaskOutput
---

Automatically review, fix, and respond to findings from PR review bots on the current PR. Uses a deterministic two-phase workflow: first fix all existing issues, then poll once for new ones.

## Phase 1: FETCH & FIX (synchronous)

### Step 1: Identify Current PR

```bash
gh pr view --json number,url,headRefName
```

If no PR exists, notify the user and exit.

### Step 2: Fetch All Bot Comments

```bash
node scripts/agent-reviews.js --bots-only --json
```

Parse the JSON output. Count how many have `hasAnyReply: false` (unanswered).

If zero unanswered comments, print "No unanswered bot comments found" and skip to Phase 2.

### Step 3: Process Each Unanswered Comment

For each comment where `hasAnyReply === false`:

#### A. Get Full Detail

```bash
node scripts/agent-reviews.js --detail <comment_id>
```

This shows the full comment body (no truncation), the diff hunk (code context), and all replies. Use this instead of `gh` CLI for comment details.

For structured data, use:
```bash
node scripts/agent-reviews.js --detail <comment_id> --json
```

#### B. Evaluate the Finding

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

#### C. Handle Based on Evaluation

**If TRUE POSITIVE:**
1. Fix the code
2. Run type-check and lint to verify the fix
3. Reply to the comment:
   ```bash
   node scripts/agent-reviews.js --reply <comment_id> "✅ **Fixed in commit {hash}**

   {Brief description of the fix}"
   ```

**If FALSE POSITIVE:**
1. Do NOT change the code
2. Reply to the comment:
   ```bash
   node scripts/agent-reviews.js --reply <comment_id> "⚠️ **Won't fix - {reason}**

   {Explanation of why this is intentional or not applicable}"
   ```

**If user chose to skip:**
```bash
node scripts/agent-reviews.js --reply <comment_id> "⏭️ Skipped per user request"
```

### Step 4: Commit and Push

After processing ALL unanswered comments (not one at a time):

1. Run your project's lint and type-check
2. Stage, commit, and push:
   ```bash
   git add -A
   git commit -m "fix: address PR review bot findings

   {List of bugs fixed, grouped by bot}"
   git push
   ```

**DO NOT start Phase 2 until all current issues are fixed and pushed.**

---

## Phase 2: POLL FOR NEW COMMENTS (10-minute inactivity timeout)

### Step 5: Start Watcher

Launch the watcher in the background. It polls every 30 seconds and exits after 10 minutes of inactivity (no new comments):

```bash
node scripts/agent-reviews.js --watch --bots-only
```

This runs as a background task.

**CRITICAL: DO NOT cancel the background task early. Let it complete its full cycle.**

### Step 6: Wait for Results

Use `TaskOutput` to wait for the watcher to complete (blocks up to 12 minutes).

### Step 7: Process New Comments (if any)

If the watcher found new comments:
1. Process them exactly as in Phase 1, Steps 3-4
2. Use `--detail <id>` to read each new comment

If no new comments were found, move to the summary.

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
