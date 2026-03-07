<script>
	import { onMount } from 'svelte';

	let visibleLines = $state(0);
	let mounted = $state(false);
	let terminalBody;

	const lines = [
		{ text: '$ git push', cls: 'cmd' },
		{ text: 'remote: Resolving deltas... done.', cls: 'dim' },
		{ text: '', cls: 'blank' },
		{ text: '  3 new review comments', cls: 'label' },
		{ text: '  x  CodeRabbit   Null check missing on user.email', cls: 'err' },
		{ text: '  x  Copilot      SQL injection risk in query()', cls: 'err' },
		{ text: '  x  Cursor       Unused import \'lodash\'', cls: 'err' },
		{ text: '', cls: 'blank' },
		{ text: '  ... you fix all three, push again:', cls: 'dim' },
		{ text: '', cls: 'blank' },
		{ text: '$ git push', cls: 'cmd' },
		{ text: '', cls: 'blank' },
		{ text: '  2 new review comments', cls: 'label' },
		{ text: '  x  CodeRabbit   Missing error handler in catch', cls: 'err' },
		{ text: '  x  SonarCloud   Cognitive complexity too high', cls: 'err' },
		{ text: '', cls: 'blank' },
		{ text: '  this never ends...', cls: 'sigh' },
		{ text: '', cls: 'blank' },
		{ text: '  ----', cls: 'rule' },
		{ text: '', cls: 'blank' },
		{ text: '$ /resolve-agent-reviews', cls: 'cmd-go' },
		{ text: '', cls: 'blank' },
		{ text: '  Fetching unanswered bot comments... found 5', cls: 'cyan' },
		{ text: '', cls: 'blank' },
		{ text: '  ok  Fixed: null check on user.email       -> a1b2c3d', cls: 'ok' },
		{ text: '  ok  Fixed: SQL injection in query()       -> a1b2c3d', cls: 'ok' },
		{ text: '  --  Won\'t fix: style preference            (not a bug)', cls: 'skip' },
		{ text: '  ok  Fixed: error handler in catch          -> e5f6g7h', cls: 'ok' },
		{ text: '  ok  Fixed: reduce complexity               -> e5f6g7h', cls: 'ok' },
		{ text: '', cls: 'blank' },
		{ text: '  Watching for new comments...', cls: 'cyan' },
		{ text: '  No new comments. Watch complete.', cls: 'dim' },
		{ text: '', cls: 'blank' },
		{ text: '  All findings addressed.', cls: 'done' },
	];

	const delays = lines.map((line) => {
		if (line.cls === 'blank') return 80;
		if (line.cls === 'rule') return 700;
		if (line.cls === 'cmd' || line.cls === 'cmd-go') return 600;
		if (line.cls === 'sigh') return 1000;
		if (line.cls === 'done') return 500;
		if (line.cls === 'dim' && line.text.includes('...')) return 500;
		if (line.cls === 'label') return 400;
		return 220;
	});

	async function runAnimation() {
		visibleLines = 0;
		for (let i = 0; i < lines.length; i++) {
			await new Promise((r) => setTimeout(r, delays[i]));
			visibleLines = i + 1;
			if (terminalBody) {
				terminalBody.scrollTop = terminalBody.scrollHeight;
			}
		}
		await new Promise((r) => setTimeout(r, 4000));
		if (mounted) runAnimation();
	}

	onMount(() => {
		mounted = true;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					runAnimation();
					observer.disconnect();
				}
			},
			{ threshold: 0.2 }
		);
		if (terminalBody) observer.observe(terminalBody);
		return () => { mounted = false; observer.disconnect(); };
	});
</script>

<div class="terminal" bind:this={terminalBody}>
	{#each lines as line, i}
		{#if i < visibleLines}
			<div class="line {line.cls}">
				{#if line.cls === 'blank'}&nbsp;{:else}{line.text}{/if}
			</div>
		{/if}
	{/each}
	{#if visibleLines > 0}
		<span class="cursor" class:blink={visibleLines >= lines.length}>_</span>
	{/if}
</div>

<style>
	.terminal {
		background: var(--dark);
		border-radius: 10px;
		font-family: var(--mono);
		font-size: 0.78rem;
		line-height: 1.8;
		height: 480px;
		overflow-y: auto;
		scrollbar-width: none;
		color: var(--dark-text);
		padding: 22px 24px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.04),
			0 16px 48px rgba(0, 0, 0, 0.1);
	}

	.terminal::-webkit-scrollbar {
		display: none;
	}

	.line {
		white-space: pre;
		animation: lineIn 0.12s ease-out;
	}

	@keyframes lineIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.cmd { color: #f0ece4; font-weight: 600; }
	.cmd-go { color: #7ee68a; font-weight: 600; }
	.dim { color: var(--dark-muted); }
	.label { color: var(--dark-text); font-weight: 500; }
	.err { color: #f5827a; }
	.sigh { color: #e6c860; font-style: italic; }
	.rule { color: var(--dark-muted); letter-spacing: 0.2em; }
	.cyan { color: #78c8de; }
	.ok { color: #7ee68a; }
	.skip { color: var(--dark-muted); }
	.done { color: #7ee68a; font-weight: 700; }

	.cursor {
		color: var(--dark-text);
		font-weight: 600;
	}

	.cursor.blink {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	@media (max-width: 900px) {
		.terminal {
			font-size: 0.72rem;
			height: 380px;
			padding: 18px 20px;
		}
	}
</style>
