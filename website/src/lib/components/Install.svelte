<script>
	let copied = $state('');

	async function copy(text, id) {
		await navigator.clipboard.writeText(text);
		copied = id;
		setTimeout(() => (copied = ''), 2000);
	}
</script>

<section class="install-section" id="install">
	<div class="install-inner">
		<h2>Install</h2>

		<div class="method">
			<div class="method-head">
				<h3>Agent Skills</h3>
				<em class="rec">recommended</em>
			</div>
			<p>Install once, then use <code>/resolve-agent-reviews</code> as a slash command.</p>
			<div class="cmd">
				<code>npx skills add pbakaus/agent-reviews</code>
				<button onclick={() => copy('npx skills add pbakaus/agent-reviews', 'skill')}>
					{copied === 'skill' ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>

		<div class="method">
			<h3>CLI</h3>
			<p>For direct terminal use. List, filter, reply to, and watch comments.</p>
			<div class="cmd">
				<code>npm install -g agent-reviews</code>
				<button onclick={() => copy('npm install -g agent-reviews', 'cli')}>
					{copied === 'cli' ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>

		<p class="note">
			Authenticates via <code>gh</code> CLI or <code>GITHUB_TOKEN</code>.
			Works locally, in Codespaces, and in remote agent environments.
		</p>
	</div>
</section>

<style>
	.install-section {
		background: var(--dark);
		padding: 80px 32px;
		color: var(--dark-text);
	}

	.install-inner {
		max-width: var(--col);
		margin: 0 auto;
	}

	h2 {
		font-family: var(--serif);
		font-size: 1.8rem;
		font-weight: 900;
		color: #f0ece4;
		letter-spacing: -0.02em;
		margin-bottom: 40px;
	}

	.method {
		margin-bottom: 36px;
	}

	.method-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}

	h3 {
		font-size: 1.05rem;
		font-weight: 600;
		color: #f0ece4;
		margin-bottom: 6px;
	}

	.rec {
		font-family: var(--serif);
		font-style: italic;
		font-size: 0.8rem;
		color: var(--accent);
	}

	.method p {
		color: var(--dark-muted);
		font-size: 0.95rem;
		margin-bottom: 14px;
	}

	.cmd {
		display: flex;
		align-items: center;
		gap: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 14px 16px;
	}

	.cmd code {
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--dark-text);
		background: transparent;
		padding: 0;
		flex: 1;
		overflow-x: auto;
	}

	.cmd button {
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--dark-muted);
		cursor: pointer;
		padding: 5px 14px;
		border-radius: 4px;
		font-family: var(--sans);
		font-size: 0.78rem;
		font-weight: 500;
		transition: color 0.15s, background 0.15s;
	}

	.cmd button:hover {
		color: var(--dark-text);
		background: rgba(255, 255, 255, 0.1);
	}

	.note {
		font-size: 0.85rem;
		color: var(--dark-muted);
		margin-top: 8px;
	}

	.note code {
		font-size: 0.82em;
		background: rgba(255, 255, 255, 0.06);
		color: var(--dark-text);
	}

	@media (max-width: 600px) {
		.install-section {
			padding: 56px 24px;
		}

		.cmd {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}

		.cmd code {
			font-size: 0.78rem;
		}

		.cmd button {
			align-self: flex-start;
		}
	}
</style>
