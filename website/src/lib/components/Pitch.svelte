<section class="pitch">
	<div class="row">
		<h2 class="row-label">The CLI</h2>
		<div class="row-content">
			<p class="lead">
				A purpose-built interface for PR review comments.
				Think <a href="https://agent-browser.dev/" target="_blank" rel="noopener noreferrer">agent-browser</a>,
				but for code reviews.
			</p>
			<p>
				The <code>gh</code> CLI wasn't designed for review comments. Agents
				get the syntax wrong, miss pagination, can't detect reply status,
				and burn tokens parsing verbose output. agent-reviews fixes all of that
				with compact, structured output that works for both humans and LLMs.
			</p>
		<dl class="features">
				<div class="feature">
					<dt>Compact output</dt>
					<dd>Minimal text, structured for agents. JSON mode for scripting.</dd>
				</div>
				<div class="feature">
					<dt>Smart filtering</dt>
					<dd>Bot vs. human, answered vs. unanswered, resolved vs. pending. Filters out meta-comments automatically.</dd>
				</div>
				<div class="feature">
					<dt>Reply + resolve</dt>
					<dd>Reply to any comment and resolve its thread in one command.</dd>
				</div>
				<div class="feature">
					<dt>Watch mode</dt>
					<dd>Poll for new comments after a push. Exits when bots go quiet.</dd>
				</div>
			</dl>
		</div>
	</div>

	<div class="compare">
		<div class="compare-panel gh">
			<div class="compare-label">gh api <span class="muted">repos/.../pulls/414/comments</span></div>
			<pre class="compare-code">[
  {"{"}
    "id": 2870136380,
    "path": "scripts/provision-branch.js",
    "position": 42,
    "body": "### Hardcoded step label wrong\nin CI seed mode\n\n**Low Severity**\n\n`seedDemoData` has a hardcoded\n`logStep(\"8/10\", ...)` which is\ncorrect for local mode's 10-step\nprocess, but in CI mode the total\nsteps changed to 8...",
    "user": {"{"} "login": "cursor[bot]" {"}"},
    "created_at": "2025-12-19T14:23:01Z",
    "updated_at": "2025-12-19T14:23:01Z",
    "html_url": "https://github.com/..."
  {"}"},
  ... 21 more comments
  <span class="gh-warn">// no reply status, no filtering,</span>
  <span class="gh-warn">// no pagination handling</span>
]</pre>
		</div>
		<div class="compare-panel ar">
			<div class="compare-label">agent-reviews <span class="muted">-a --bots-only</span></div>
			<pre class="compare-code"><span class="ar-bright">Found 22 comments</span>

<span class="ar-id">[2870136380]</span> <span class="ar-type">CODE</span> by <span class="ar-bot">cursor[bot]</span> <span class="ar-no">&#9675; no reply</span>
  <span class="ar-dim">provision-branch.js:42</span>
  <span class="ar-dim">Hardcoded step label wrong in CI seed...</span>

<span class="ar-id">[2870136382]</span> <span class="ar-type">CODE</span> by <span class="ar-bot">cursor[bot]</span> <span class="ar-no">&#9675; no reply</span>
  <span class="ar-dim">provision-branch.js:87</span>
  <span class="ar-dim">Hardcoded "4/6" wrong when seed increases</span>

<span class="ar-id">[2870138016]</span> <span class="ar-type">CODE</span> by <span class="ar-bot">codex[bot]</span> <span class="ar-yes">&#10003; replied</span>
  <span class="ar-dim">provision-branch.js:112</span>
  <span class="ar-dim">Fail CI when preview seeding incomplete</span>
  <span class="ar-dim">&#9492; 1 reply</span></pre>
		</div>
	</div>

	<hr />

	<div class="row">
		<h2 class="row-label">The skills</h2>
		<div class="row-content">
			<p>
				The CLI is powerful on its own, but the skills are the killer feature.
				Install one, type a slash command, and walk away. Your agent uses the
				CLI under the hood to handle the full review cycle:
			</p>
			<dl class="outcomes">
				<div class="outcome">
					<dt>True positive</dt>
					<dd>Fixes the bug, commits, replies with the commit hash.</dd>
				</div>
				<div class="outcome">
					<dt>False positive</dt>
					<dd>Replies "Won't fix" with an explanation of why.</dd>
				</div>
				<div class="outcome">
					<dt>Uncertain</dt>
					<dd>Asks you before touching anything.</dd>
				</div>
			</dl>
			<p>
				Then it watches. When bots post new comments after your push
				(they always do), it processes those too. The loop continues until
				no new comments appear for 10 minutes.
			</p>

			<div class="skills">
				<div class="skill">
					<code>/resolve-reviews</code>
					<span>All comments, human and bot.</span>
				</div>
				<div class="skill">
					<code>/resolve-agent-reviews</code>
					<span>Bot comments only.</span>
				</div>
				<div class="skill">
					<code>/resolve-human-reviews</code>
					<span>Human comments only.</span>
				</div>
			</div>
		</div>
	</div>

	<hr />

	<div class="row">
		<h2 class="row-label">Works with</h2>
		<div class="row-content">
			<p>
				<strong>Review bots:</strong> Copilot, CodeRabbit, Cursor Bugbot, Sourcery, Codacy, SonarCloud.
			</p>
			<p>
				<strong>AI agents:</strong> Claude Code, Cursor, Codex, and any agent supporting
				<a href="https://agentskills.io" target="_blank" rel="noopener noreferrer">Agent Skills</a>.
			</p>
		</div>
	</div>
</section>

<style>
	.pitch {
		max-width: var(--col);
		margin: 0 auto;
		padding: 96px 32px;
	}

	.row {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 40px;
		align-items: start;
	}

	.row-label {
		font-family: var(--serif);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.3;
		padding-top: 2px;
	}

	.row-content p {
		color: var(--text-muted);
		line-height: 1.65;
		margin-bottom: 8px;
	}

	.row-content p:last-child {
		margin-bottom: 0;
	}

	.row-content .lead {
		color: var(--text);
		font-size: 1.05rem;
		font-weight: 500;
		margin-bottom: 12px;
	}

	.row-content strong {
		color: var(--text);
		font-weight: 600;
	}

	hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 48px 0;
	}

	/* Before/after comparison */
	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin: 32px -80px 0;
	}

	.compare-panel {
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.compare-label {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
		padding: 10px 16px;
		letter-spacing: 0.02em;
	}

	.compare-label .muted {
		font-weight: 400;
		opacity: 0.5;
	}

	.compare-panel.gh .compare-label {
		background: #2a2028;
		color: #b8a8a8;
	}

	.compare-panel.ar .compare-label {
		background: #1a2420;
		color: #a8c8b8;
	}

	.compare-code {
		font-family: var(--mono);
		font-size: 0.7rem;
		line-height: 1.7;
		padding: 14px 16px 20px;
		margin: 0;
		overflow-x: auto;
		white-space: pre;
		scrollbar-width: thin;
		flex: 1;
	}

	.compare-panel.gh .compare-code {
		background: #1e1a1e;
		color: #c4b0b0;
	}

	.compare-panel.ar .compare-code {
		background: #141e1a;
		color: #b0c4b8;
	}

	.gh-warn {
		color: #a08060;
		font-style: italic;
	}

	.ar-bright { color: #d0cbc2; font-weight: 600; }
	.ar-id { color: #d0cbc2; font-weight: 700; }
	.ar-type { color: #78c8de; }
	.ar-bot { color: #e6c860; }
	.ar-no { color: #f5827a; }
	.ar-yes { color: #7ee68a; }
	.ar-dim { color: #706a60; }

	/* CLI features */
	.features {
		margin: 24px 0 4px;
	}

	.feature {
		display: flex;
		gap: 16px;
		align-items: baseline;
		padding: 10px 0;
	}

	.feature + .feature {
		border-top: 1px solid var(--border);
	}

	.features dt {
		font-family: var(--serif);
		font-weight: 700;
		font-size: 0.92rem;
		white-space: nowrap;
		min-width: 120px;
		color: var(--text);
	}

	.features dd {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	/* Skill outcomes */
	.outcomes {
		margin: 20px 0 24px;
	}

	.outcome {
		display: flex;
		gap: 16px;
		align-items: baseline;
		padding: 10px 0;
	}

	.outcome + .outcome {
		border-top: 1px solid var(--border);
	}

	.outcomes dt {
		font-family: var(--serif);
		font-weight: 700;
		font-size: 0.92rem;
		white-space: nowrap;
		min-width: 110px;
		color: var(--text);
	}

	.outcomes dd {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	/* Skills list */
	.skills {
		display: flex;
		flex-direction: column;
		margin-top: 28px;
	}

	.skill {
		display: flex;
		align-items: baseline;
		gap: 16px;
		padding: 12px 0;
	}

	.skill + .skill {
		border-top: 1px solid var(--border);
	}

	.skill code {
		font-size: 0.88rem;
		font-weight: 600;
		background: transparent;
		padding: 0;
		min-width: 210px;
		color: var(--text);
	}

	.skill span {
		color: var(--text-muted);
		font-size: 0.95rem;
	}

	.pop {
		font-family: var(--serif);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--accent);
		margin-left: auto;
		white-space: nowrap;
	}

	@media (max-width: 680px) {
		.row {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.feature, .outcome {
			flex-direction: column;
			gap: 2px;
		}

		.compare {
			grid-template-columns: 1fr;
			margin-left: 0;
			margin-right: 0;
		}

		.features dt, .outcomes dt { min-width: auto; }

		.skill {
			flex-wrap: wrap;
			gap: 4px 16px;
		}

		.skill code { min-width: auto; }
		.pop { margin-left: 0; }
	}
</style>
