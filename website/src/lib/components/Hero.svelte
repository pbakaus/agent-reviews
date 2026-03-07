<script>
	import Terminal from './Terminal.svelte';
</script>

<section class="hero">
	<div class="hero-inner">
		<div class="hero-text">
			<h1>
				Break the<br />bot review<br />
				<span class="doom">doom loop.</span>
			</h1>
			<p class="subtitle">
				You fix a round of review comments, push, and new ones appear.
				agent-reviews handles the entire cycle: triage, fix, reply, watch, repeat.
			</p>
			<p class="aside">
				Because nobody should spend their afternoon typing
				"Fixed in abc1234" forty-seven times.
			</p>
			<div class="actions">
				<a href="#install" class="cta">Install</a>
				<a
					href="https://github.com/pbakaus/agent-reviews"
					target="_blank"
					rel="noopener noreferrer"
					class="ghost"
				>GitHub</a>
			</div>
		</div>
		<div class="hero-terminal">
			<Terminal />
		</div>
	</div>
</section>

<style>
	.hero {
		padding: 150px 32px 100px;
	}

	.hero-inner {
		max-width: 1100px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 56px;
		align-items: center;
	}

	h1 {
		font-family: var(--serif);
		font-size: clamp(2.6rem, 5.5vw, 4.6rem);
		font-weight: 900;
		line-height: 1.02;
		letter-spacing: -0.03em;
		margin-bottom: 24px;
	}

	.doom {
		font-style: italic;
		position: relative;
		display: inline-block;
		overflow: hidden;
	}

	.doom::after {
		content: '';
		position: absolute;
		bottom: 4px;
		left: 0;
		width: 100%;
		height: 4px;
		background: var(--accent);
		border-radius: 2px;
		transform: translateX(-101%);
		animation: sweep 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes sweep {
		0% { transform: translateX(-101%); }
		35% { transform: translateX(0); }
		55% { transform: translateX(0); }
		90% { transform: translateX(101%); }
		100% { transform: translateX(101%); }
	}

	.doom:hover::after {
		animation: none;
		transform: translateX(0);
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-muted);
		line-height: 1.6;
		max-width: 440px;
		margin-bottom: 14px;
	}

	.aside {
		font-family: var(--serif);
		font-style: italic;
		font-size: 0.95rem;
		color: var(--text-faint);
		max-width: 380px;
		margin-bottom: 36px;
		line-height: 1.5;
	}

	.actions {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.cta {
		display: inline-block;
		padding: 12px 32px;
		background: var(--accent);
		color: #fef8f0;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition: background 0.15s, transform 0.1s;
	}

	.cta:hover {
		background: var(--accent-hover);
		color: #fef8f0;
		transform: translateY(-1px);
	}

	.ghost {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		padding: 12px 8px;
		transition: color 0.15s;
	}

	.ghost:hover {
		color: var(--text);
	}

	.hero-terminal {
		min-width: 0;
	}

	@media (max-width: 900px) {
		.hero {
			padding: 120px 24px 72px;
		}

		.hero-inner {
			grid-template-columns: 1fr;
			gap: 40px;
		}

		h1 {
			font-size: clamp(2.4rem, 10vw, 3.4rem);
		}
	}
</style>
