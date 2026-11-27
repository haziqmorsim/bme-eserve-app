<script lang="ts">
	import type { Boiler, Component, Part } from '$lib/types';
	import Boiler3D from '$lib/components/Boiler3D.svelte';
	import Part3DViewer from '$lib/components/Part3DViewer.svelte';
	import { grateFor, resolveSections } from '$lib/boiler-design';
	import { SECTION_COLORS } from '$lib/boiler-3d/legend';
	import { addItem } from '$lib/stores/quote';
	import { addToast } from '$lib/stores/toast';
	import { hasImage, isPlaceholder, textLines } from '$lib/parts';
	import { tick } from 'svelte';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { Search, X, ChevronRight, ArrowLeft, Minus, Plus, Image as ImageIcon } from '@lucide/svelte';

	let {
		boiler,
		readings = [],
		components = [],
		parts = [],
		onadd
	}: {
		boiler: Boiler;
		readings?: any[];
		components?: Component[];
		parts?: Part[];
		onadd?: (part: Part, qty: number) => void;
	} = $props();

	const resolvedProject = $derived.by(() => {
		const d = $page.data as any;
		const ids = new Set(
			((d.boilerProjects ?? []) as any[]).filter((bp) => bp.boiler_id === boiler.id).map((bp) => bp.project_id)
		);
		if (!ids.size) return null;
		const matches = ((d.projects ?? []) as any[]).filter((p) => ids.has(p.id));
		if (!matches.length) return null;
		const active = d.activeProjectId as string | null;
		if (active && ids.has(active)) return matches.find((p) => p.id === active) ?? null;
		return [...matches].sort((a, b) => a.project_no.localeCompare(b.project_no))[0];
	});

	const def = $derived(grateFor(boiler.code, boiler.name));
	const sections = $derived(resolveSections(def, components));

	const UNCATEGORISED = 'Panel/Instrument';
	const PANEL_KEY = '__panel';
	const OTHER_KEY = '__other';

	type Group = { name: string; ids: string[]; parts: Part[] };
	type Sec = { key: string; label: string; color: string; groups: Group[]; partCount: number; in3d: boolean };

	const uncategorisedIds = $derived(
		new Set(components.filter((c: Component) => (c.name ?? '').trim() === UNCATEGORISED).map((c: Component) => c.id))
	);

	const ordered = $derived(
		[...parts].sort((a: Part, b: Part) => {
			const pa = isPlaceholder(a.part_number) ? 1 : 0;
			const pb = isPlaceholder(b.part_number) ? 1 : 0;
			if (pa !== pb) return pa - pb;
			return pa ? (a.name ?? '').localeCompare(b.name ?? '') : 0;
		})
	);

	const partsByComp = $derived.by(() => {
		const m = new Map<string, Part[]>();
		for (const p of ordered) {
			if (!p.component_id) continue;
			const list = m.get(p.component_id);
			if (list) list.push(p);
			else m.set(p.component_id, [p]);
		}
		return m;
	});

	const compById = $derived(new Map(components.map((c: Component) => [c.id, c])));

	function groupsFor(ids: string[]): Group[] {
		const byName = new Map<string, Group & { order: number }>();
		for (const id of ids) {
			const c = compById.get(id);
			if (!c) continue;
			const name = (c.name ?? '').trim() || 'Unnamed component';
			let g = byName.get(name);
			if (!g) {
				g = { name, ids: [], parts: [], order: c.sort_order ?? 0 };
				byName.set(name, g);
			}
			g.ids.push(id);
			g.parts.push(...(partsByComp.get(id) ?? []));
		}
		return [...byName.values()]
			.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
			.map(({ name, ids, parts }) => ({ name, ids, parts }));
	}

	const tree = $derived.by((): Sec[] => {
		const used = new Set<string>();
		const list: Sec[] = sections.map((s) => {
			const ids = s.componentIds.filter((id: string) => !uncategorisedIds.has(id));
			ids.forEach((id: string) => used.add(id));
			const groups = groupsFor(ids);
			return {
				key: s.key,
				label: s.label,
				color: SECTION_COLORS[s.key] ?? '#8a97a5',
				groups,
				partCount: groups.reduce((a, g) => a + g.parts.length, 0),
				in3d: true
			};
		});
		if (uncategorisedIds.size) {
			const groups = groupsFor([...uncategorisedIds]);
			list.push({ key: PANEL_KEY, label: 'Panel / Instrument', color: '#8a97a5', groups, partCount: groups.reduce((a, g) => a + g.parts.length, 0), in3d: false });
		}
		const rest = components.filter((c: Component) => !used.has(c.id) && !uncategorisedIds.has(c.id)).map((c: Component) => c.id);
		if (rest.length) {
			const groups = groupsFor(rest);
			list.push({ key: OTHER_KEY, label: 'Other components', color: '#8a97a5', groups, partCount: groups.reduce((a, g) => a + g.parts.length, 0), in3d: false });
		}
		return list;
	});

	let secKey = $state<string | null>(null);
	let groupName = $state<string | null>(null);
	let partId = $state<string | null>(null);
	let search = $state('');
	let qty = $state<Record<string, number>>({});
	let mediaView = $state<'3d' | 'photo'>('3d');

	const sec = $derived(tree.find((s) => s.key === secKey) ?? null);
	const group = $derived(sec?.groups.find((g) => g.name === groupName) ?? null);
	const part = $derived(partId ? (ordered.find((p: Part) => p.id === partId) ?? null) : null);
	const skipsGroups = $derived(!!sec && sec.key === PANEL_KEY && sec.groups.length === 1);
	const level = $derived(part ? 4 : group ? 3 : sec ? 2 : 1);
	const activeKey = $derived(sec?.in3d ? sec.key : null);
	const panelSec = $derived(tree.find((x) => x.key === PANEL_KEY) ?? null);

	const query = $derived(search.trim().toLowerCase());

	const results = $derived.by(() => {
		if (!query) return [];
		return ordered.filter((p: Part) => {
			const comp = compById.get(p.component_id);
			return (
				(p.part_number ?? '').toLowerCase().includes(query) ||
				(p.name ?? '').toLowerCase().includes(query) ||
				(p.description ?? '').toLowerCase().includes(query) ||
				(p.specifications ?? '').toLowerCase().includes(query) ||
				(comp?.name ?? '').toLowerCase().includes(query)
			);
		});
	});

	let bodyEl = $state<HTMLElement | null>(null);
	let panelEl = $state<HTMLElement | null>(null);

	async function afterNav() {
		await tick();
		if (bodyEl) bodyEl.scrollTop = 0;
		const el = panelEl;
		if (el && el.getBoundingClientRect().top < 0) {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function goHome() {
		secKey = null;
		groupName = null;
		partId = null;
		search = '';
		afterNav();
	}

	function goSection(key: string) {
		const s = tree.find((x) => x.key === key);
		secKey = key;
		groupName = s && s.key === PANEL_KEY && s.groups.length === 1 ? s.groups[0].name : null;
		partId = null;
		search = '';
		afterNav();
	}

	function goGroup(name: string) {
		groupName = name;
		partId = null;
		search = '';
		afterNav();
	}

	function goPart(p: Part) {
		const s = tree.find((x) => x.groups.some((g) => g.parts.some((q) => q.id === p.id)));
		if (s) {
			secKey = s.key;
			groupName = s.groups.find((g) => g.parts.some((q) => q.id === p.id))?.name ?? null;
		}
		partId = p.id;
		mediaView = '3d';
		search = '';
		afterNav();
	}

	function goBack() {
		if (search) search = '';
		else if (partId) partId = null;
		else if (groupName && !skipsGroups) groupName = null;
		else if (secKey) {
			secKey = null;
			groupName = null;
		}
		afterNav();
	}

	async function onSectionSelect(key: string) {
		if (key !== secKey || level !== 2) goSection(key);
		await tick();
		const el = panelEl;
		if (!el || window.matchMedia('(min-width: 861px)').matches) return;
		const top = el.getBoundingClientRect().top;
		if (top >= 0 && top < window.innerHeight * 0.6) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
	}

	function plural(n: number, word: string) {
		if (n === 1) return `${n} ${word}`;
		return `${n} ${word}${/(s|x|ch|sh)$/.test(word) ? 'es' : 's'}`;
	}

	function firstLine(v: string | null | undefined) {
		return textLines(v)[0] ?? '';
	}

	function setQty(id: string, v: number) {
		qty[id] = Math.max(1, Math.min(9999, Math.round(v) || 1));
	}

	function handleAdd(p: Part) {
		const q = qty[p.id] ?? 1;
		if (onadd) {
			onadd(p, q);
			return;
		}
		const componentName = compById.get(p.component_id)?.name ?? '';
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
		addToast(q > 1 ? `${q} × ${p.name} added to cart list.` : 'Part added to cart list.');
	}

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || level === 1) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest?.('.b3d')) return;
		goBack();
	}
</script>

<svelte:window onkeydown={onKey} />

<h2 class="title">
	{#if resolvedProject}
		{resolvedProject.project_no}{#if resolvedProject.name}&nbsp;({resolvedProject.name}){/if}
	{/if}
</h2>
{#if boiler.name}<p class="desc">{boiler.name}</p>{/if}

<div class="design card">
	<div class="design-head">
		<h3>Boiler Schematic</h3>
		<span class="legend">
			Drag to rotate, right-drag to move, scroll to zoom. Click a section on the boiler or in the list to see its components and spare parts.
		</span>
	</div>

	<div class="explorer">
		<div class="stage">
			<Boiler3D
				{def}
				{sections}
				mode="parts"
				boilerCode={boiler.code}
				imageUrl={boiler.design_image_url}
				{activeKey}
				{readings}
				extra={panelSec ? { key: panelSec.key, label: panelSec.label, color: panelSec.color } : null}
				extraActive={secKey === PANEL_KEY}
				onextra={() => onSectionSelect(PANEL_KEY)}
				onselect={onSectionSelect}
			/>
		</div>

		<aside class="pf" aria-label="Spare parts" bind:this={panelEl}>
			<div class="pf-top">
				<nav class="crumbs" aria-label="Breadcrumb">
					{#if level === 1 && !query}
						<span class="cur">Sections</span>
					{:else}
						<button type="button" onclick={goHome}>Sections</button>
					{/if}
					{#if sec}
						<ChevronRight size={13} class="sep" />
						{#if level === 2 || (skipsGroups && level === 3)}
							<span class="cur">{sec.label}</span>
						{:else}
							<button type="button" onclick={() => goSection(sec.key)}>{sec.label}</button>
						{/if}
					{/if}
					{#if group && !skipsGroups}
						<ChevronRight size={13} class="sep" />
						{#if level === 3}
							<span class="cur">{group.name}</span>
						{:else}
							<button type="button" onclick={() => goGroup(group.name)}>{group.name}</button>
						{/if}
					{/if}
					{#if part}
						<ChevronRight size={13} class="sep" />
						<span class="cur">{isPlaceholder(part.part_number) ? part.name : part.part_number}</span>
					{/if}
				</nav>
				<div class="searchbox">
					<Search size={16} />
					<input
						id="pf-search"
						type="search"
						placeholder="Search all parts…"
						aria-label="Search all parts"
						autocomplete="off"
						bind:value={search}
					/>
					{#if search}
						<button type="button" class="clear" onclick={() => (search = '')} aria-label="Clear search"><X size={15} /></button>
					{/if}
				</div>
			</div>

			<div class="pf-body" class:fit={level === 4 && !query} bind:this={bodyEl}>
				{#if query}
					<div class="head">
						<h3>Search results</h3>
						<p>{plural(results.length, 'match')} for “{search.trim()}” in all parts</p>
					</div>
					{#if results.length}
						<ul class="list">
							{#each results.slice(0, 80) as p (p.id)}
								{@render partRow(p, true)}
							{/each}
						</ul>
						{#if results.length > 80}<p class="small">Showing the first 80 matches. Add more words to narrow the search.</p>{/if}
					{:else}
						<p class="empty">No parts match. Try another word or part number.</p>
					{/if}
				{:else if level === 1}
					<div class="head">
						<h3>Boiler sections</h3>
						<p>Choose a section, or click one on the 3D boiler.</p>
					</div>
					<ul class="list">
						{#each tree as s (s.key)}
							<li>
								<button type="button" class="row" style:--c={s.color} disabled={s.groups.length === 0} onclick={() => goSection(s.key)}>
									<i class="bar"></i>
									<span class="tx">
										<b>{s.label}</b>
										<span class="meta">
											{s.groups.length ? `${plural(s.groups.length, 'component')} · ${plural(s.partCount, 'part')}` : 'No spare parts listed'}
										</span>
									</span>
									<ChevronRight size={18} class="chev" />
								</button>
							</li>
						{/each}
					</ul>
				{:else if level === 2 && sec}
					<button type="button" class="back" onclick={goBack}><ArrowLeft size={14} />All sections</button>
					<div class="head" style:--c={sec.color}>
						<h3><i class="sw"></i>{sec.label}</h3>
						<p>{plural(sec.groups.length, 'component')} · {plural(sec.partCount, 'part')}</p>
					</div>
					{#if sec.groups.length}
						<ul class="list">
							{#each sec.groups as g (g.name)}
								<li>
									<button type="button" class="row" style:--c={sec.color} onclick={() => goGroup(g.name)}>
										<i class="bar"></i>
										<span class="tx">
											<b>{g.name}</b>
											<span class="meta">{g.parts.length ? plural(g.parts.length, 'part') : 'No parts listed yet'}</span>
										</span>
										<ChevronRight size={18} class="chev" />
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="empty">No components are listed for this section yet.</p>
					{/if}
				{:else if level === 3 && sec && group}
					<button type="button" class="back" onclick={goBack}>
						<ArrowLeft size={14} />{skipsGroups ? 'All sections' : `All ${sec.label} components`}
					</button>
					<div class="head" style:--c={sec.color}>
						<h3><i class="sw"></i>{group.name}</h3>
						<p>{plural(group.parts.length, 'part')}</p>
					</div>
					{#if group.parts.length}
						<ul class="list">
							{#each group.parts as p (p.id)}
								{@render partRow(p, false)}
							{/each}
						</ul>
					{:else}
						<p class="empty">No parts are listed for this component yet.</p>
					{/if}
				{:else if level === 4 && part}
					{@const specs = textLines(part.specifications)}
					{@const img = hasImage(part.image_url)}
					<button type="button" class="back" onclick={goBack}>
						<ArrowLeft size={14} />All {group?.name ?? ''} parts
					</button>
					<div class="detail">
						<p class="eyebrow">Part</p>
						<h3 class="pname">{part.name}</h3>
						<span class="pn">
							{isPlaceholder(part.part_number) ? 'No part number' : `Part no. ${part.part_number}`}
						</span>

						<div class="media">
							{#if mediaView === '3d'}
								{#key part.id}
									<Part3DViewer
										photo={img ? part.image_url : null}
										name={part.name}
										description={part.description}
										component={compById.get(part.component_id)?.name ?? ''}
										alt={part.name}
									/>
								{/key}
							{:else if img}
								<img src={part.image_url} alt={part.name} />
							{:else}
								<div class="noimg"><ImageIcon size={34} /><span>No photo available yet.</span></div>
							{/if}
						</div>
						<div class="toggle" role="tablist" aria-label="Image view">
							<button type="button" role="tab" aria-selected={mediaView === '3d'} class:on={mediaView === '3d'} onclick={() => (mediaView = '3d')}>3D view</button>
							<button type="button" role="tab" aria-selected={mediaView === 'photo'} class:on={mediaView === 'photo'} onclick={() => (mediaView = 'photo')}>Photo</button>
						</div>

						<div class="buy">
							<div class="qty">
								<button type="button" onclick={() => setQty(part.id, (qty[part.id] ?? 1) - 1)} aria-label="Decrease quantity"><Minus size={15} /></button>
								<input
									id="pf-qty"
									type="number"
									min="1"
									value={qty[part.id] ?? 1}
									aria-label="Quantity of {part.name}"
									oninput={(e) => setQty(part.id, +e.currentTarget.value)}
								/>
								<button type="button" onclick={() => setQty(part.id, (qty[part.id] ?? 1) + 1)} aria-label="Increase quantity"><Plus size={15} /></button>
							</div>
							<button type="button" class="btn-primary add" onclick={() => handleAdd(part)}>Add</button>
						</div>

						<!-- <h4>Description</h4>
						<p class="text" class:blank={isPlaceholder(part.description)}>
							{isPlaceholder(part.description) ? 'No description yet.' : part.description}
						</p> -->

						<h4>Specifications</h4>
						{#if specs.length}
							<ul class="specs">
								{#each specs as line, i (i)}<li>{line}</li>{/each}
							</ul>
						{:else}
							<p class="text blank">No specifications yet.</p>
						{/if}
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>

{#snippet partRow(p: Part, showWhere: boolean)}
	<li class="part" in:fade={{ duration: 120 }}>
		<div class="ptx">
			<span class="pn" class:blank={isPlaceholder(p.part_number)}>
				{isPlaceholder(p.part_number) ? 'No part number' : p.part_number}
			</span>
			<b>{p.name}</b>
			{#if showWhere}
				<span class="where">{compById.get(p.component_id)?.name ?? ''}</span>
			{:else if firstLine(p.description)}
				<span class="where">{firstLine(p.description)}</span>
			{/if}
		</div>
		<button type="button" class="view" onclick={() => goPart(p)} aria-label="View details of {p.name}">View Details</button>
	</li>
{/snippet}

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

	.design {
		padding: 16px;
	}

	.design-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px 12px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.design-head h3 {
		margin: 0;
		font-size: 14px;
		color: var(--bme-darker-blue, #0c3358);
	}

	.design-head .legend {
		font-size: 12px;
		color: var(--bme-muted);
	}

	.explorer {
		--pf-min: 560px;
		--b3d-h: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 380px;
		gap: 14px;
		align-items: stretch;
	}

	.stage {
		min-width: 0;
		min-height: var(--pf-min);
	}

	.pf {
		min-width: 0;
		min-height: var(--pf-min);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--bme-border);
		border-radius: 12px;
		background: var(--bme-surface);
		overflow: hidden;
		scroll-margin-top: 10px;
	}

	.pf-top {
		padding: 12px 12px 10px;
		border-bottom: 1px solid var(--bme-border);
		background: var(--bme-surface-2);
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 3px;
		margin: 0 0 8px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--bme-muted);
		min-width: 0;
	}

	.crumbs button {
		padding: 2px 4px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--bme-dark-blue);
		font: inherit;
		cursor: pointer;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.crumbs button:hover {
		text-decoration: underline;
	}

	.crumbs .cur {
		padding: 2px 4px;
		color: var(--bme-ink);
		overflow-wrap: anywhere;
	}

	.crumbs :global(.sep) {
		color: var(--bme-muted);
		flex: none;
	}

	.searchbox {
		position: relative;
		display: flex;
		align-items: center;
		color: var(--bme-muted);
	}

	.searchbox :global(svg:first-child) {
		position: absolute;
		left: 11px;
		pointer-events: none;
	}

	.searchbox input {
		width: 100%;
		height: 40px;
		padding: 0 36px 0 36px;
		border: 1px solid var(--bme-border);
		border-radius: 9px;
		background: var(--bme-surface);
		color: var(--bme-ink);
		font-size: 14px;
	}

	.searchbox input::-webkit-search-cancel-button {
		display: none;
	}

	.searchbox input:focus {
		outline: none;
		border-color: var(--bme-dark-blue);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--bme-dark-blue) 18%, transparent);
	}

	.clear {
		position: absolute;
		right: 4px;
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--bme-muted);
		cursor: pointer;
	}

	.clear:hover {
		background: var(--bme-hover);
		color: var(--bme-ink);
	}

	.pf-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 12px;
		overscroll-behavior: contain;
	}

	@media (min-width: 861px) {
		.pf-body {
			max-height: 720px;
		}

		.pf-body.fit {
			max-height: none;
			overflow: visible;
		}
	}

	.head {
		margin: 0 0 10px;
	}

	.head h3 {
		margin: 0 0 3px;
		font-size: 17px;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--bme-ink);
	}

	.head p {
		margin: 0;
		font-size: 12.5px;
		color: var(--bme-muted);
	}

	.head .sw {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		background: var(--c);
		flex: none;
	}

	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 7px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 11px 10px 11px 11px;
		border: 1px solid var(--bme-border);
		border-radius: 9px;
		background: var(--bme-surface);
		color: var(--bme-ink);
		text-align: left;
		font: inherit;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease;
	}

	.row:hover:not(:disabled) {
		background: var(--bme-hover);
		border-color: color-mix(in srgb, var(--c) 55%, var(--bme-border));
	}

	.row:focus-visible,
	.view:focus-visible,
	.back:focus-visible,
	.toggle button:focus-visible {
		outline: 2px solid var(--bme-dark-blue);
		outline-offset: 1px;
	}

	.row:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.row .bar {
		width: 5px;
		align-self: stretch;
		border-radius: 3px;
		background: var(--c);
		flex: none;
	}

	.row .tx {
		flex: 1;
		min-width: 0;
	}

	.row b {
		display: block;
		font-size: 14.5px;
		font-weight: 650;
		line-height: 1.25;
	}

	.row .meta {
		display: block;
		margin-top: 3px;
		font-size: 12px;
		color: var(--bme-muted);
	}

	.row :global(.chev) {
		color: var(--bme-muted);
		flex: none;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin: 0 0 10px;
		padding: 3px 0;
		border: 0;
		background: none;
		color: var(--bme-dark-blue);
		font: 600 12.5px/1.2 inherit;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
	}

	.back:hover {
		text-decoration: underline;
	}

	.part {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 12px;
		border: 1px solid var(--bme-border);
		border-radius: 9px;
		background: var(--bme-surface);
	}

	.ptx {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pn {
		font: 600 11.5px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		color: var(--bme-dark-blue);
		overflow-wrap: anywhere;
	}

	.pn.blank {
		color: var(--bme-muted);
		font-family: inherit;
		font-weight: 500;
		font-style: italic;
	}

	.ptx b {
		font-size: 14px;
		font-weight: 650;
		line-height: 1.3;
		color: var(--bme-ink);
		overflow-wrap: anywhere;
	}

	.where {
		font-size: 12px;
		color: var(--bme-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.view {
		flex: none;
		height: 34px;
		padding: 0 12px;
		border: 1px solid color-mix(in srgb, var(--bme-dark-blue) 45%, transparent);
		border-radius: 7px;
		background: color-mix(in srgb, var(--bme-dark-blue) 8%, transparent);
		color: var(--bme-dark-blue);
		font: 600 12.5px/1 inherit;
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
	}

	.view:hover {
		background: color-mix(in srgb, var(--bme-dark-blue) 16%, transparent);
	}

	.empty {
		padding: 22px 8px;
		margin: 0;
		text-align: center;
		color: var(--bme-muted);
		font-size: 13.5px;
	}

	.small {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--bme-muted);
	}

	.eyebrow {
		margin: 0 0 2px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--bme-muted);
	}

	.detail .pname {
		margin: 0;
		font-size: 19px;
		line-height: 1.2;
		color: var(--bme-ink);
		overflow-wrap: anywhere;
	}

	.detail > .pn {
		display: block;
		margin: 4px 0 12px;
		font-size: 12.5px;
	}

	.media {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border: 1px solid var(--bme-border);
		border-radius: 10px;
		overflow: hidden;
		background: #fff;
	}

	.media > img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.noimg {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 8px;
		background: var(--bme-surface-2);
		color: var(--bme-muted);
		font-size: 13px;
	}

	.toggle {
		display: flex;
		gap: 2px;
		margin-top: 8px;
		padding: 3px;
		border-radius: 8px;
		background: var(--bme-light-grey);
	}

	.toggle button {
		flex: 1;
		height: 30px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--bme-muted);
		font: 600 12.5px/1 inherit;
		font-family: inherit;
		cursor: pointer;
	}

	.toggle button.on {
		background: var(--bme-surface);
		color: var(--bme-dark-blue);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.detail h4 {
		margin: 16px 0 5px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--bme-muted);
	}

	.text {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--bme-ink);
		white-space: pre-line;
	}

	.text.blank {
		color: var(--bme-muted);
		font-style: italic;
	}

	.specs {
		margin: 0;
		padding-left: 18px;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--bme-ink);
	}

	.buy {
		bottom: -12px;
		display: flex;
		gap: 10px;
		align-items: center;
		margin: 16px -12px -12px;
		padding: 12px;
		border-top: 1px solid var(--bme-border);
		background: var(--bme-surface);
	}

	.qty {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		overflow: hidden;
		flex: none;
	}

	.qty button {
		width: 36px;
		height: 38px;
		display: grid;
		place-items: center;
		border: 0;
		background: var(--bme-surface-2);
		color: var(--bme-ink);
		cursor: pointer;
	}

	.qty button:hover {
		background: var(--bme-hover);
	}

	.qty input {
		width: 52px;
		height: 38px;
		border: 0;
		background: transparent;
		color: var(--bme-ink);
		text-align: center;
		font-size: 14px;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.qty input::-webkit-inner-spin-button,
	.qty input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.add {
		flex: 1;
		height: 40px;
	}

	@media (max-width: 1180px) {
		.explorer {
			grid-template-columns: minmax(0, 1fr) 340px;
		}
	}

	@media (max-width: 860px) {
		.explorer {
			--b3d-h: 420px;
			grid-template-columns: 1fr;
		}

		.stage {
			min-height: 0;
		}

		.pf {
			max-height: 78vh;
			min-height: 320px;
		}
	}

	@media (max-width: 560px) {
		.design {
			padding: 12px;
		}

		.explorer {
			--b3d-h: 340px;
			gap: 10px;
		}

		.pf {
			max-height: 85vh;
		}

		.part {
			flex-wrap: wrap;
		}

		.view {
			width: 100%;
		}
	}
</style>