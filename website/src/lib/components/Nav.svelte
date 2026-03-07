<script>
	let scrolled = $state(false);

	function handleScroll() {
		scrolled = window.scrollY > 20;
	}
</script>

<svelte:window onscroll={handleScroll} />

<nav class:scrolled>
	<div class="nav-inner">
		<a href="/" class="wordmark">agent-reviews</a>
		<a
			href="https://github.com/pbakaus/agent-reviews"
			target="_blank"
			rel="noopener noreferrer"
			class="nav-link"
		>GitHub</a>
	</div>
</nav>

<style>
	nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		padding: 18px 32px;
		transition: background 0.3s, box-shadow 0.3s;
	}

	nav.scrolled {
		background: rgba(254, 252, 248, 0.92);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: 0 1px 0 var(--border);
	}

	.nav-inner {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.wordmark {
		font-family: var(--mono);
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	.wordmark:hover {
		color: var(--text);
	}

	.nav-link {
		font-size: 0.88rem;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.nav-link:hover {
		color: var(--text);
	}
</style>
