<script lang="ts">
	import type { Boiler, Component, Part } from '$lib/types';
	import BoilerDesign from '$lib/components/BoilerDesign.svelte';
	import { grateFor, resolveSections } from '$lib/boiler-design';
	import { addItem } from '$lib/stores/quote';
	import { addToast } from '$lib/stores/toast';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { Funnel, Search, Check } from '@lucide/svelte';

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

	const def = $derived(grateFor(boiler.code, boiler.name));
	const sections = $derived(resolveSections(def, components));

	let activeKey = $state<string | null>(null);
	let search = $state('');
	let qty = $state<Record<string, number>>({});
	let lightbox = $state<Part | null>(null);

	const UNCATEGORISED = 'Uncategorised';
	let showUncategorised = $state(false);

	const uncategorisedId = $derived(
		components.find((c: Component) => (c.name ?? '') === UNCATEGORISED)?.id ?? null
	);

	const uncategorisedCount = $derived(
		uncategorisedId ? parts.filter((p: Part) => p.component_id === uncategorisedId).length : 0
	);

	let selected = $state<Set<string>>(new Set());
	let filterOpen = $state(false);
	let compSearch = $state('');

	const countByComponent = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const p of parts) {
			const id = (p as Part).component_id;
			if (id) m[id] = (m[id] ?? 0) + 1;
		}
		return m;
	});

	type ComponentGroup = { name: string; ids: string[]; count: number };

	const groupedComponents = $derived.by(() => {
		const q = compSearch.trim().toLowerCase();
		const byName = new Map<string, ComponentGroup>();

		for (const c of components as Component[]) {
			if (c.id === uncategorisedId) continue;
			const name = c.name ?? '';
			let g = byName.get(name);
			if (!g) {
				g = { name, ids: [], count: 0 };
				byName.set(name, g);
			}
			g.ids.push(c.id);
			g.count += countByComponent[c.id] ?? 0;
		}

		const list = [...byName.values()].filter((g) => !q || g.name.toLowerCase().includes(q));
		return list.sort((a, b) => a.name.localeCompare(b.name));
	});

	const selectedCount = $derived(selected.size);

	function onSectionSelect(key: string, componentIds: string[]) {
		selected = new Set(componentIds);
		activeKey = key;
	}

	$effect(() => {
		if (selected.size > 0) {
			const hit = sections.find(
				(s) =>
					s.componentIds.length > 0 &&
					s.componentIds.length === selected.size &&
					s.componentIds.every((id: string) => selected.has(id))
			);
			activeKey = hit ? hit.key : null;
		} else {
			activeKey = null;
		}
	});

	function isGroupChecked(ids: string[]) {
		return ids.length > 0 && ids.every((id) => selected.has(id));
	}

	function toggleGroup(ids: string[]) {
		const next = new Set(selected);
		const checked = isGroupChecked(ids);
		for (const id of ids) {
			if (checked) next.delete(id); else next.add(id);
		}
		selected = next;
	}

	function clearAllFilters() {
		selected = new Set();
	}

	const DESC_LINE_LIMIT = 5;
	let expandedDescriptions = $state<Set<string>>(new Set());

	function descLines(description: string): string[] {
		return (description ?? '').split('\n');
	}

	function toggleDescription(id: string) {
		const next = new Set(expandedDescriptions);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedDescriptions = next;
	}


	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return parts.filter((p: Part) => {
			const isUncat = uncategorisedId != null && p.component_id === uncategorisedId;

			if (showUncategorised !== isUncat) return false;

			if (!showUncategorised) {
				const inComp = selected.size === 0 || (p.component_id != null && selected.has(p.component_id));
				if (!inComp) return false;
			}
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

	const selectedNames = $derived.by(() => {
		const names = new Set<string>();
		for (const c of components as Component[]) {
			if (selected.has(c.id)) names.add(c.name ?? '');
		}
		return [...names];
	});

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
		addToast('Part added to cart list.')
	}
</script>

<svelte:window
	onkeydown={(e) => e.key === 'Escape' && (lightbox ? (lightbox = null) : (filterOpen = false))}
	onclick={(e) => {
		if (filterOpen && !(e.target as HTMLElement)?.closest?.('.filter-wrap')) filterOpen = false;
	}}
/>

<h2 class="title">{boiler.code}</h2>
{#if boiler.name}<p class="desc">{boiler.name}</p>{/if}
{#if boiler.description}<p class="desc">{boiler.description}</p>{/if}

<div class="explorer">
	<div class="design card">
		<div class="design-head">
			<h3><!-- <span class="live-dot" aria-hidden="true"></span> -->Boiler Schematic</h3>
			<span class="legend">Click a highlighted section to see its spare parts. Dimmed sections have no available parts.</span>
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

		<div class="category">
			<div class="filter-wrap">
				<button
					type="button"
					class="filter-trigger"
					class:on={selectedCount > 0}
					onclick={() => (filterOpen = !filterOpen)}
					aria-expanded={filterOpen} 
					disabled={showUncategorised}
				>
					<Funnel size={16} />
					<span>{selectedCount > 0 ? `Components (${selectedCount})` : 'Filter by component'}</span>
				</button>

				{#if filterOpen}
					<div class="filter-pop" transition:fade={{ duration: 120 }}>
						<div class="fp-search">
							<Search size={15} />
							<input type="search" placeholder="Search components…" bind:value={compSearch} />
						</div>

						<div class="fp-list">
							{#each groupedComponents as g (g.name)}
								<button type="button" class="fp-item" onclick={() => toggleGroup(g.ids)}>
									<span class="box" class:checked={isGroupChecked(g.ids)}>{#if isGroupChecked(g.ids)}<Check size={13} />{/if}</span>
									<span class="fp-name">{g.name}</span>
									<span class="fp-count">({g.count})</span>
								</button>
							{:else}
								<p class="fp-empty">No components match.</p>
							{/each}
						</div>

						<div class="fp-foot">
							<span class="fp-sel">{selectedCount} Selected</span>
							<button
								type="button"
								class="fp-clear"
								onclick={clearAllFilters}
								disabled={selectedCount === 0}
							>Clear All Filters</button>
						</div>
					</div>
				{/if}
			</div>
			<label class="uc-toggle">
				<input
					type="checkbox"
					bind:checked={showUncategorised}
					disabled={uncategorisedCount === 0}
					aria-label="Show uncategorised parts" />
				<span class="uc-label">Uncategorised Parts ({uncategorisedCount})</span>
				<span class="uc-track"><span class="uc-thumb"></span></span>
			</label>
		</div>

		{#if showUncategorised}
			<div class="crumb" in:fade={{ duration: 150 }}>
				Showing <strong>{filtered.length} uncategorised</strong> part{filtered.length === 1 ? '' : 's'}
			</div>
		{:else if selectedCount > 0}
			<div class="crumb" in:fade={{ duration: 150 }}>
				Showing <strong>{selectedNames.join(', ')}</strong> — {filtered.length} part{filtered.length === 1 ? '' : 's'}
			</div>
		{/if}

		{#if filtered.length === 0}
			<p class="hint" in:fade={{ duration: 150 }}>No parts match your selection.</p>
		{:else}
			<div class="parts">
				<!-- <p class="indicative">All prices are indicative.</p> -->
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
							{#if p.description}
								{@const lines = descLines(p.description)}
								{@const isLong = lines.length > DESC_LINE_LIMIT}
								{@const isExpanded = expandedDescriptions.has(p.id)}
								<div class="pdesc">{isLong && !isExpanded ? lines.slice(0, DESC_LINE_LIMIT).join('\n') : p.description}</div>
								{#if isLong}
									<button type="button" class="pdesc-toggle" onclick={() => toggleDescription(p.id)}>
										{isExpanded ? 'Show less' : 'Show more...'}
									</button>
								{/if}
							{/if}
							<!-- <div class="price">
								{priceLabel(p)}
							</div> -->
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
				<!-- <span class="lb-price">{priceLabel(lightbox)}</span> -->
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
		color: var(--bme-ink);
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

	/* .live-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--bme-red, #e0342a);
		box-shadow: 0 0 0 0 rgba(224, 52, 42, 0.65);
		animation: live-blink 1.6s ease-in-out infinite;
	} */

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

	.category {
		display: flex;
		gap: 10px;
	}

	.filter-wrap {
		position: relative;
	}

	.filter-trigger:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.filter-trigger:disabled:hover {
		border-color: var(--bme-border);
		cursor: default;
	}

	.uc-toggle {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		background: #fff;
		border: 1px solid var(--bme-border, #e2e8ef);
		color: var(--bme-ink, #1b2733);
		padding: 9px 16px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		user-select: none;
	}

	.uc-toggle input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	:root[data-theme='dark'] .uc-toggle {
		background-color: #1b2733;
	}

	.uc-track {
		position: relative;
		display: inline-block;
		width: 38px;
		height: 20px;
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--bme-border);
		cursor: pointer;
		transition: background 160ms ease;
	}

	.uc-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
		transition: transform 160ms ease;
	}

	.uc-toggle input:checked ~ .uc-track {
		background: var(--bme-dark-blue, #004b8d);
	}

	.uc-toggle input:checked ~ .uc-track .uc-thumb {
		transform: translateX(18px);
	}

	.uc-toggle input:focus-visible ~ .uc-track {
		outline: 2px solid var(--bme-dark-blue, #004b8d);
		outline-offset: 2px;
	}

	.uc-label {
		font-weight: 600;
		font-size: 14px;
		color: var(--bme-ink, #1b2733);
	}

	.uc-toggle input:disabled ~ .uc-label {
		color: var(--bme-muted);
	}

	.uc-toggle:has(input:disabled) {
		cursor: default;
		opacity: 0.6;
	}

	.filter-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--bme-surface, #ffffff);
		border: 1px solid var(--bme-border, #e2e8ef);
		color: var(--bme-ink, #1b2733);
		padding: 9px 16px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
	}

	.filter-trigger:hover {
		border-color: var(--bme-dark-blue, #10456e);
	}

	.filter-trigger.on {
		background: var(--bme-dark-blue, #10456e);
		color: #fff;
		border-color: var(--bme-dark-blue, #10456e);
	}

	.filter-pop {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 30;
		width: min(340px, 88vw);
		background: var(--bme-surface, #ffffff);
		border: 1px solid var(--bme-border, #e2e8ef);
		border-radius: 12px;
		box-shadow: 0 16px 40px rgba(12, 20, 30, 0.16);
		padding: 12px;
	}

	.fp-search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: 1px solid var(--bme-border, #e2e8ef);
		border-radius: 8px;
		color: var(--bme-muted);
	}

	.fp-search input {
		border: none;
		outline: none;
		flex: 1;
		font: inherit;
		color: var(--bme-ink, #1b2733);
		background: transparent;
	}

	.fp-list {
		max-height: 240px;
		overflow-y: auto;
		margin-top: 8px;
	}

	.fp-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		font: inherit;
		color: var(--bme-ink, #1b2733);
		padding: 9px 6px;
		text-align: left;
		border-radius: 6px;
	}

	.fp-item:hover {
		background: var(--bme-sky, #eef4fb);
	}

	.fp-name {
		flex: 1;
	}

	.fp-count {
		color: var(--bme-muted);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.box {
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		flex: 0 0 auto;
		border: 2px solid var(--bme-border, #cdd7e1);
		border-radius: 4px;
		color: #fff;
	}

	.box.checked {
		background: var(--bme-dark-blue, #10456e);
		border-color: var(--bme-dark-blue, #10456e);
	}

	.fp-empty {
		color: var(--bme-muted);
		font-size: 13px;
		padding: 12px 6px;
		margin: 0;
	}

	.fp-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 8px;
		padding-top: 10px;
		border-top: 1px solid var(--bme-border, #e2e8ef);
	}

	.fp-sel {
		font-size: 13px;
		color: var(--bme-muted);
	}

	.fp-clear {
		background: var(--bme-surface, #ffffff);
		color: var(--bme-dark-blue, #10456e);
		border: 1px solid var(--bme-dark-blue, #10456e);
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		font-size: 13px;
		padding: 8px 16px;
		border-radius: 8px;
		transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
	}

	.fp-clear:hover:not(:disabled) {
		background: var(--bme-dark-blue, #10456e);
		color: #fff;
	}

	.fp-clear:disabled {
		opacity: 0.45;
		cursor: default;
		border-color: var(--bme-border, #e2e8ef);
		color: var(--bme-muted);
	}

	.crumb {
		font-size: 13px;
		color: var(--bme-muted);
	}

	.hint {
		color: var(--bme-muted);
		padding: 24px 0;
	}

	/* .indicative {
		color: var(--bme-muted);
		margin: 0;
	} */

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

	.info {
		max-width: 75%;
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
		white-space: pre-line;
	}

	.pdesc-toggle {
		display: inline-block;
		margin-top: 4px;
		padding: 0;
		border: none;
		background: none;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--bme-dark-blue);
		cursor: pointer;
	}

	.pdesc-toggle:hover {
		text-decoration: underline;
	}

	/* .price {
		margin-top: 6px;
		font-weight: 700;
	} */

	.actions {
		display: flex;
		align-items: center;
		gap: 20px;
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

	/* .lb-price {
		margin-left: auto;
		font-weight: 700;
		color: var(--bme-darker-blue, #0c3358);
	} */

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

		.category {
			flex-direction: column;
		}

		.filter-trigger {
			width: 100%;
		}

		.actions {
			gap: 8px;
		}
	}
</style>