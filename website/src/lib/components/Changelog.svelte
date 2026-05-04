<section class="changelog" id="changelog">
	<div class="changelog-inner">
		<h2 class="changelog-title">What's new</h2>

		<div class="changelog-list">
			<div class="changelog-entry">
				<div class="changelog-version-header">
					<span class="changelog-version">v1.0.2</span>
					<span class="changelog-date">May 4, 2026</span>
				</div>
				<ul class="changelog-items">
					<li>GitHub Enterprise Server support via <code>GITHUB_API_URL</code> env var (REST and GraphQL); optional <code>GITHUB_GRAPHQL_URL</code> for non-standard setups</li>
					<li>Gemini Code Assist <code>## Summary of Changes</code> comment is now filtered; inline severity-badged findings are preserved</li>
				</ul>
			</div>
			<div class="changelog-entry">
				<div class="changelog-version-header">
					<span class="changelog-version">v1.0.0</span>
					<span class="changelog-date">March 6, 2026</span>
				</div>
				<ul class="changelog-items">
					<li>Three skills: <code>/resolve-reviews</code>, <code>/resolve-agent-reviews</code>, <code>/resolve-human-reviews</code></li>
					<li>Thread resolution via <code>--resolve</code> flag (GraphQL <code>resolveReviewThread</code>)</li>
					<li>Expanded bot support: CodeRabbit, Sourcery, Codacy, SonarCloud, Copilot</li>
					<li>Agent-harness universal: works with Claude Code, Cursor, Codex, and any agent supporting <a href="https://agentskills.io" target="_blank" rel="noopener noreferrer">Agent Skills</a></li>
					<li>Watch mode exits on new comments with 5s grace period for batch posts</li>
					<li><code>--expanded</code> flag for full detail (body, diff hunk, replies) in list mode</li>
					<li><code>GH_TOKEN</code> / <code>GH_REPO</code> env vars for cloud and proxy environments</li>
					<li>Bot review body filtering and self-reply filtering to reduce noise</li>
				</ul>
			</div>
		</div>
	</div>
</section>

<style>
	.changelog {
		max-width: var(--col);
		margin: 0 auto;
		padding: 80px 32px;
	}

	.changelog-title {
		font-family: var(--serif);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin-bottom: 28px;
	}

	.changelog-list {
		display: flex;
		flex-direction: column;
	}

	.changelog-entry {
		padding: 20px 0;
		border-top: 1px solid var(--border);
	}

	.changelog-version-header {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}

	.changelog-version {
		font-family: var(--mono);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text);
	}

	.changelog-date {
		font-size: 0.82rem;
		color: var(--text-faint);
	}

	.changelog-items {
		margin: 0;
		padding-left: 20px;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.7;
	}

	.changelog-items li {
		margin-bottom: 4px;
	}

	.changelog-items code {
		font-size: 0.85em;
		background: rgba(0, 0, 0, 0.04);
		padding: 1px 5px;
		border-radius: 3px;
		color: var(--text);
	}

	.changelog-items a {
		color: var(--accent);
		text-decoration: none;
	}

	.changelog-items a:hover {
		text-decoration: underline;
	}

	@media (max-width: 680px) {
		.changelog {
			padding: 56px 24px;
		}
	}
</style>
