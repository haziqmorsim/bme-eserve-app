<script lang="ts">
	import type { Boiler, Component, Part } from '$lib/types';
	import BoilerDesign from '$lib/components/BoilerDesign.svelte';
	import { grateFor, resolveSections } from '$lib/boiler-design';
	import { addItem } from '$lib/stores/quote';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	let {
		boiler,
		readings = [],
		components = [],
		parts = [],
		onadd
	} = $props<{
		boiler: Boiler;
		readings?: any[];
		components?: Component[];
		parts?: Part[];
		onadd?: (part: Part, qty: number) => void;
	}>();

	const def = $derived(grateFor(boiler.code));
	const sections = $derived(resolveSections(def, components));

	let activeComponentId = $state<string | null>(null);
	let activeKey = $state<string | null>(null);
	let search = $state('');
	let qty = $state<Record<string, number>>({});
	let lightbox = $state<Part | null>(null);

	$effect(() => {
		const hit = sections.find((s) => s.componentId && s.componentId === activeComponentId);
		activeKey = hit ? hit.key : null;
	});

	function selectComponent(id: string | null) {
		activeComponentId = id;
		search = '';
	}

	function onSectionSelect(componentId: string, key: string) {
		activeComponentId = componentId;
		activeKey = key;
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return parts.filter((p: Part) => {
			const inComp = !activeComponentId || p.component_id === activeComponentId;
			if (!inComp) return false;
			if (!q) return true;
			const comp = components.find((c: Component) => c.id === p.component_id);
			return (
				(p.part_number ?? '').toLowerCase().includes(q) ||
				(p.name ?? '').toLowerCase().includes(q) ||
				(p.description ?? '').toLowerCase().includes(q) ||
				(comp?.name ?? '').toLowerCase().includes(q)
			);
		});
	});

	const activeComponentName = $derived(
		activeComponentId ? components.find((c: Component) => c.id === activeComponentId)?.name : null
	);

	function priceLabel(p: Part) {
		if (p.price != null) return `RM${Number(p.price).toFixed(2)}`;
		if (p.price_min != null && p.price_max != null) {
			return `RM${Number(p.price_min).toFixed(2)} – RM${Number(p.price_max).toFixed(2)}`;
		}
		return 'Price on request';
	}

	function handleAdd(p: Part) {
		const q = qty[p.id] ?? 1;
		if (onadd) {
			onadd(p, q);
			return;
		}
		const componentName = components.find((c: Component) => c.id === p.component_id)?.name ?? '';
		addItem({
			partId: p.id,
			partNumber: p.part_number,
			partName: p.name,
			boilerCode: boiler.code,
			componentName,
			price: p.price ?? undefined,
			priceMin: p.price_min ?? p.price ?? 0,
			priceMax: p.price_max ?? p.price ?? 0,
			quantity: q
		});
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && lightbox && (lightbox = null)} />

<h2 class="title">{boiler.code} {#if boiler.name}- {boiler.name}{/if}</h2>
{#if boiler.description}<p class="desc">{boiler.description}</p>{/if}

<div class="explorer">
	<div class="design card">
		<div class="design-head">
			<h3><span class="live-dot" aria-hidden="true"></span>Live Schematic</h3>
			<span class="legend">Click a highlighted section to see its spare parts. Dimmed sections have no catalogued parts.</span>
		</div>
		<BoilerDesign {def} {sections} mode="parts" boilerCode={boiler.code} {activeKey} {readings} onselect={onSectionSelect} />
	</div>

	<div class="side">
		<input
			class="search"
			type="search"
			placeholder="Search part number, name, description…"
			bind:value={search}
		/>

		<div class="tabs">
			<button class="comp" class:active={activeComponentId === null} onclick={() => selectComponent(null)}>
				All Parts
			</button>
			{#each components as c (c.id)}
				<button class="comp" class:active={activeComponentId === c.id} onclick={() => selectComponent(c.id)}>
					{c.name}
				</button>
			{/each}
		</div>

		{#if activeComponentName}
			<div class="crumb" in:fade={{ duration: 150 }}>
				Showing <strong>{activeComponentName}</strong> parts
			</div>
		{/if}

		{#if filtered.length === 0}
			<p class="hint" in:fade={{ duration: 150 }}>No parts match your selection.</p>
		{:else}
			<div class="parts">
				{#each filtered as p (p.id)}
					<div
						class="part card"
						in:fly={{ y: 8, duration: 220 }}
						out:fade={{ duration: 120 }}
						animate:flip={{ duration: 220 }}
					>
						<div class="info">
							<div class="pn">{p.part_number}</div>
							<div class="pname">{p.name}</div>
							{#if p.description}<div class="pdesc">{p.description}</div>{/if}
							<div class="price">
								{priceLabel(p)}
							</div>
						</div>
						<div class="actions">
							{#if p.image_url}
								<button
									type="button"
									class="thumb"
									onclick={() => (lightbox = p)}
									title="View image"
									aria-label="View image of {p.name}"
								>
									<img src={p.image_url} alt={p.name} loading="lazy" />
								</button>
							{/if}
							<input
								type="number"
								min="1"
								value={qty[p.id] ?? 1}
								oninput={(e) => (qty[p.id] = Math.max(1, +e.currentTarget.value))}
							/>
							<button class="btn-primary" onclick={() => handleAdd(p)}>Add</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if lightbox}
	<div class="lightbox" onclick={() => (lightbox = null)} role="presentation" transition:fade={{ duration: 150 }}>
		<div class="lightbox-inner" onclick={(e) => e.stopPropagation()} role="presentation">
			<img src={lightbox.image_url} alt={lightbox.name} />
			<div class="lightbox-cap">
				<strong>{lightbox.part_number}</strong> <span>{lightbox.name}</span>
				<span class="lb-price">{priceLabel(lightbox)}</span>
			</div>
		</div>
		<button class="lightbox-close" onclick={() => (lightbox = null)} aria-label="Close">&times;</button>
	</div>
{/if}

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

	.explorer {
		align-items: start;
	}

	.design {
		padding: 16px;
	}

	.design h3 {
		margin: 0 0 12px;
		font-size: 14px;
		color: var(--bme-muted);
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

	.design-head .legend {
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

	.side {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.search {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--bme-border, #e2e8ef);
		border-radius: 10px;
		font-size: 14px;
	}

	.search:focus {
		outline: none;
		border-color: var(--bme-dark-blue, #10456e);
		box-shadow: 0 0 0 3px rgba(16, 69, 110, 0.12);
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.comp {
		background: #fff;
		border: 1px solid var(--bme-border, #e2e8ef);
		color: var(--bme-ink, #1b2733);
		padding: 9px 16px;
		border-radius: 999px;
		cursor: pointer;
		transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
	}

	.comp:hover {
		border-color: var(--bme-dark-blue, #10456e);
	}
	.comp.active {
		background: var(--bme-dark-blue, #10456e);
		color: #fff;
		border-color: var(--bme-dark-blue, #10456e);
	}

	.crumb {
		font-size: 13px;
		color: var(--bme-muted);
	}

	.hint {
		color: var(--bme-muted);
		padding: 24px 0;
	}

	.parts {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.part {
		padding: 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.pn {
		font-size: 12px;
		font-weight: 700;
		color: var(--bme-darker-blue, #0c3358);
	}

	.pname {
		font-weight: 600;
	}

	.pdesc {
		font-size: 13px;
		color: var(--bme-muted);
		margin-top: 2px;
	}

	.price {
		margin-top: 6px;
		font-weight: 700;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.actions input {
		width: 64px;
		text-align: center;
		padding: 8px;
		border: 1px solid var(--bme-border, #e2e8ef);
		border-radius: 8px;
	}

	.thumb {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 1px solid var(--bme-border, #e2e8ef);
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		background: #f4f6f8;
		flex-shrink: 0;
		transition: border-color 140ms ease, transform 140ms ease;
	}

	.thumb:hover {
		border-color: var(--bme-dark-blue, #10456e);
		transform: scale(1.05);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(12, 20, 30, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.lightbox-inner {
		background: #fff;
		border-radius: 14px;
		overflow: hidden;
		max-width: min(560px, 90vw);
		max-height: 85vh;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
	}

	.lightbox-inner img {
		width: 100%;
		max-height: 60vh;
		object-fit: contain;
		background: #f4f6f8;
		display: block;
	}

	.lightbox-cap {
		padding: 14px 18px;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
	}

	.lightbox-cap strong {
		color: var(--bme-darker-blue, #0c3358);
		font-size: 13px;
	}

	.lightbox-cap span {
		font-size: 14px;
		color: var(--bme-ink, #1b2733);
	}

	.lb-price {
		margin-left: auto;
		font-weight: 700;
		color: var(--bme-darker-blue, #0c3358);
	}

	.lightbox-close {
		position: absolute;
		top: 22px;
		right: 28px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.lightbox-close:hover {
		background: rgba(255, 255, 255, 0.28);
	}

	@media (max-width: 860px) {
		.explorer {
			grid-template-columns: 1fr;
		}
	}
</style>