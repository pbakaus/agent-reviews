<script>
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>agent-reviews -- Break the bot review doom loop</title>
</svelte:head>

<Nav />
{@render children()}
