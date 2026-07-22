<script lang="ts">
	import type { Boiler } from '$lib/types';
	import BoilerDesign from '$lib/components/BoilerDesign.svelte';
	import { grateFor, resolveSections, sampleSpecs } from '$lib/boiler-design';

	let { boiler } = $props<{ boiler: Boiler }>();

	const def = $derived(grateFor(boiler.code));
	const sections = $derived(resolveSections(def, []));

	const dbSpecs = $derived([
		{ label: 'Capacity', value: boiler.capacity },
		{ label: 'Pressure', value: boiler.pressure },
		{ label: 'Steam Temperature', value: boiler.steam_temperature },
		{ label: 'Fuel Type', value: boiler.fuel_type },
		{ label: 'Year Commissioned', value: boiler.year_commissioned?.toString() },
		{ label: 'Status', value: boiler.status }
	]);

	const extraSpecs = $derived(sampleSpecs(boiler.code));

	const specs = $derived([...dbSpecs.filter((s) => s.value), ...extraSpecs]);
</script>

<div>
	<h2 class="title">{boiler.code} {#if boiler.name}- {boiler.name}{/if}</h2>
	{#if boiler.description}<p class="desc">{boiler.description}</p>{/if}

	<div class="card design-card">
		<div class="design-head">
			<h3><span class="live-dot" aria-hidden="true"></span>Live Schematic</h3>
			<span class="hint">Hover or tap a section to view its readings</span>
		</div>
		<BoilerDesign {def} {sections} mode="dashboard" boilerCode={boiler.code} />
	</div>

	<div class="grid">
		{#each specs as s}
			<div class="card spec">
				<span class="k">{s.label}</span>
				<span class="v">{s.value}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.title {
		margin: 0 0 6px;
		font-size: 22px;
	}

	.desc {
		color: var(--bme-muted);
		margin: 0 0 20px;
		max-width: 60ch;
	}

	.design-card {
		padding: 16px 18px;
		margin-bottom: 20px;
	}
    
	.design-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.design-head h3 {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bme-darker-blue, #0c3358);
	}

	.design-head .hint {
		font-size: 12px;
		color: var(--bme-muted);
	}

	.live-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #e0342a;
		box-shadow: 0 0 0 0 rgba(224, 52, 42, 0.65);
		animation: live-blink 1.6s ease-in-out infinite;
	}

	@keyframes live-blink {
		0% {
			opacity: 1;
			box-shadow: 0 0 0 0 rgba(224, 52, 42, 0.55);
		}
		70% {
			opacity: 0.35;
			box-shadow: 0 0 0 6px rgba(224, 52, 42, 0);
		}
		100% {
			opacity: 1;
			box-shadow: 0 0 0 0 rgba(224, 52, 42, 0);
		}
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 14px;
	}

	.spec {
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.k {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--bme-muted);
	}

	.v {
		font-size: 18px;
		font-weight: 700;
		color: var(--bme-darker-blue, #0c3358);
	}

    @media (max-width: 640px) {
        .grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>