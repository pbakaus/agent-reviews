<footer>
	<div class="footer-inner">
		<span><a href="https://github.com/pbakaus" target="_blank" rel="noopener noreferrer">Paul Bakaus</a></span>
		<span class="links">
			<a href="https://github.com/pbakaus/agent-reviews" target="_blank" rel="noopener noreferrer">GitHub</a>
			<a href="https://www.npmjs.com/package/agent-reviews" target="_blank" rel="noopener noreferrer">npm</a>
			<span class="mit">MIT</span>
		</span>
	</div>
</footer>

<style>
	footer {
		max-width: var(--col);
		margin: 0 auto;
		padding: 48px 32px 36px;
	}

	.footer-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 24px;
		border-top: 1px solid var(--border);
		font-size: 0.84rem;
		color: var(--text-faint);
	}

	a {
		color: var(--text-faint);
		text-decoration: none;
	}

	a:hover {
		color: var(--text-muted);
	}

	.links {
		display: flex;
		gap: 20px;
		align-items: center;
	}

	.mit {
		color: var(--text-faint);
	}

	@media (max-width: 480px) {
		.footer-inner {
			flex-direction: column;
			gap: 12px;
		}
	}
</style>
