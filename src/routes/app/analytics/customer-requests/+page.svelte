<script lang="ts">
	import SlaBadge from '$lib/components/SlaBadge.svelte';

	let { data } = $props();

	function fmtDur(ms: number | null): string {
		if (ms == null) return '—';
		const mins = Math.round(ms / 60_000);
		if (mins < 60) return `${mins}m`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
		const d = Math.floor(h / 24);
		const rh = h % 24;
		return rh ? `${d}d ${rh}h` : `${d}d`;
	}

	function pct(n: number, total: number): number {
		return total > 0 ? Math.round((n / total) * 100) : 0;
	}

	let maxBoiler = $derived(Math.max(1, ...data.volumeByBoiler.map((b: any) => b.count)));
	let maxProject = $derived(Math.max(1, ...data.volumeByProject.map((p: any) => p.count)));
	let maxComponent = $derived(Math.max(1, ...data.volumeByComponent.map((c: any) => c.count)));
	let maxPart = $derived(Math.max(1, ...data.volumeByPart.map((p: any) => p.count)));
</script>

{#if data.total === 0}
	<div class="card empty">No request data available yet.</div>
{:else}
	<div class="cr-root">
	<div class="stats">
		<div class="card stat">
			<span class="stat-label">Total requests</span>
			<span class="stat-value total">{data.total}</span>
			<span class="stat-sub">+{data.newThisWeek} this week</span>
		</div>
		<div class="card stat">
			<span class="stat-label">Open requests</span>
			<span class="stat-value open">{data.open}</span>
			<span class="stat-sub">{pct(data.open, data.total)}% of total</span>
		</div>
		<div class="card stat">
			<span class="stat-label">Closed requests</span>
			<span class="stat-value closed">{data.closed}</span>
			<span class="stat-sub">{pct(data.closed, data.total)}% of total</span>
		</div>
		<div class="card stat">
			<span class="stat-label">Avg. resolution</span>
			<span class="stat-value">{fmtDur(data.avgResolutionMs)}</span>
			<span class="stat-sub">Submitted &rarr; Closed</span>
		</div>
	</div>

	<div class="card section">
		<h2>Open vs closed requests</h2>
		<div class="split" role="img" aria-label="{data.open} open, {data.closed} closed">
			{#if data.open > 0}
				<div class="split-open" style="width: {pct(data.open, data.total)}%"></div>
			{/if}
			{#if data.closed > 0}
				<div class="split-closed" style="width: {pct(data.closed, data.total)}%"></div>
			{/if}
		</div>
		<div class="legend">
			<span><i class="sw open"></i> Open · {data.open}</span>
			<span><i class="sw closed"></i> Closed · {data.closed}</span>
		</div>
	</div>

	<div class="card section">
		<h2>Open request aging</h2>
		<div class="aging-stats">
			<div class="ag ontrack">
				<span class="ag-n">{data.openAging.onTrack}</span>
				<span class="ag-l">On track · &lt; {data.slaThresholds.warnHours}h</span>
			</div>
			<div class="ag aging">
				<span class="ag-n">{data.openAging.aging}</span>
				<span class="ag-l">Aging · &ge; {data.slaThresholds.warnHours}h</span>
			</div>
			<div class="ag overdue">
				<span class="ag-n">{data.openAging.overdue}</span>
				<span class="ag-l">Overdue · &ge; {data.slaThresholds.overdueHours}h</span>
			</div>
		</div>

		{#if data.agingList.length === 0}
			<p class="hint">No open requests yet.</p>
		{:else}
			<ol class="aging-list">
				{#each data.agingList as a (a.id)}
					<li class="ag-row">
						<span class="ag-ref">{a.reference} &middot; {a.boiler}</span>
						<span class="ag-sla"><SlaBadge since={a.since} weekdays /></span>
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	<div class="grid2">
		<div class="card section">
			<h2>Requests by project</h2>
			{#if data.volumeByProject.length === 0}
				<p class="hint">No project data.</p>
			{:else}
				<div class="bars">
					{#each data.volumeByProject as p, i (p.code)}
						<div class="bar-row">
							<span class="bar-key" title={p.name}>{p.code}</span>
							<div class="bar-track">
								<div
									class="bar-fill"
									style="width: {Math.round((p.count / maxProject) * 100)}%; background: var(--cat-{(i % 5) + 1})"
								></div>
							</div>
							<span class="bar-val">{p.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div class="card section">
			<h2>Requests by boiler</h2>
			{#if data.volumeByBoiler.length === 0}
				<p class="hint">No boiler data.</p>
			{:else}
				<div class="bars">
					{#each data.volumeByBoiler as b, i (b.code)}
						<div class="bar-row">
							<span class="bar-key">{b.code}</span>
							<div class="bar-track">
								<div
									class="bar-fill"
									style="width: {Math.round((b.count / maxBoiler) * 100)}%; background: var(--cat-{(i % 5) + 1})"
								></div>
							</div>
							<span class="bar-val">{b.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div class="card section">
			<h2>Requests by component</h2>
			{#if data.volumeByComponent.length === 0}
				<p class="hint">No component data.</p>
			{:else}
				<ol class="part-list">
					{#each data.volumeByComponent as c, i (c.name)}
						<li class="part-row">
							<span class="part-name" title={c.name}>{c.name}</span>
							<span class="bar-val">{c.count}</span>
							<div class="bar-track">
								<div
									class="bar-fill"
									style="width: {Math.round((c.count / maxComponent) * 100)}%; background: var(--cat-{(i % 5) + 1})"
								></div>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
		<div class="card section">
			<h2>Requests by part</h2>
			{#if data.volumeByPart.length === 0}
				<p class="hint">No part data.</p>
			{:else}
				<ol class="part-list">
					{#each data.volumeByPart as p, i (p.name)}
						<li class="part-row">
							<span class="part-name" title={p.name}>{p.name}</span>
							<span class="bar-val">{p.count}</span>
							<div class="bar-track">
								<div
									class="bar-fill"
									style="width: {Math.round((p.count / maxPart) * 100)}%; background: var(--cat-{(i % 5) + 1})"
								></div>
							</div>
						</li>
					{/each}
				</ol>
				<p class="hint">
					Top {data.volumeByPart.length} of {data.partsTotal} requested parts, counted across all boilers.
				</p>
			{/if}
		</div>
	</div>
	</div>
{/if}

<style>
	/* Chart colours, shared with the User activities page (colour-blind validated order). */
	.cr-root {
		--cat-1: #2a78d6;
		--cat-2: #eb6834;
		--cat-3: #1baf7a;
		--cat-4: #eda100;
		--cat-5: #e87ba4;
		--tile-red: #e34948;
	}

	:global(:root[data-theme='dark']) .cr-root {
		--cat-1: #3987e5;
		--cat-2: #d95926;
		--cat-3: #199e70;
		--cat-4: #c98500;
		--cat-5: #d55181;
		--tile-red: #e66767;
	}

	h2 {
		margin-top: 5px;
	}

	.empty {
		padding: 40px;
		text-align: center;
		color: var(--bme-muted);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 18px;
	}

	.stat {
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--bme-muted);
		font-weight: 600;
	}

	.stat-value {
		font-size: 30px;
		font-weight: 700;
		color: var(--bme-ink);
		line-height: 1.1;
	}

	.stat-value.total {
		color: #6250d6;
	}

	:root[data-theme="dark"] .stat-value.total {
		color: #9085e9;
	}

	.stat-value.open {
		color: var(--bme-dark-blue);
	}

	.stat-value.closed {
		color: #2f5e18;
	}

	:root[data-theme='dark'] .stat-value.closed {
		color: #9adf6c;
	}

	.stat-sub {
		font-size: 12px;
		color: var(--bme-muted);
	}

	.section {
		padding: 18px 20px;
		margin: 0 0 4px;
		color: var(--bme-ink);
	}

	.hint {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--bme-muted);
	}

	.split {
		display: flex;
		height: 22px;
		width: 100%;
		border-radius: 6px;
		overflow: hidden;
		background: var(--bme-border);
		margin: 10px 0 12px;
	}

	.split-open {
		background: var(--bme-dark-blue);
	}

	.split-closed {
		background: var(--bme-dark-green);
	}

	.legend {
		display: flex;
		gap: 18px;
		font-size: 13px;
		color: var(--bme-muted);
	}

	.legend .sw {
		display: inline-block;
		width: 11px;
		height: 11px;
		border-radius: 3px;
		margin-right: 6px;
		vertical-align: middle;
	}

	.legend .sw.open {
		background: var(--bme-dark-blue);
	}

	.legend .sw.closed {
		background: var(--bme-dark-green);
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.bar-row {
		display: grid;
		grid-template-columns: 90px 1fr auto;
		align-items: center;
		gap: 12px;
	}

	.bar-key {
		font-size: 14px;
		font-weight: 600;
		color: var(--bme-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar-track {
		height: 14px;
		background: var(--bme-bg);
		border-radius: 999px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 999px;
		min-width: 3px;
		transition: width 0.3s ease;
	}

	.bar-val {
		font-size: 13px;
		font-weight: 700;
		color: var(--bme-ink);
		white-space: nowrap;
	}

	.grid2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0 0 4px;
		gap: 5px;
	}

	.grid2 .section {
		margin-bottom: 0;
	}

	.part-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.part-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 4px 12px;
	}

	.part-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--bme-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.part-row .bar-track {
		grid-column: 1 / -1;
	}

	.aging-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin: 12px 0 16px;
	}

	.ag {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 10px;
		border-top: 4px solid var(--tile);
		background: color-mix(in srgb, var(--tile) 9%, var(--bme-surface));
		text-align: left;
	}

	.ag-n {
		font-size: 24px;
		font-weight: 700;
		color: var(--bme-ink);
		line-height: 1.15;
	}

	.ag-l {
		font-size: 12.5px;
		color: var(--bme-muted);
	}

	.ag.ontrack {
		--tile: var(--cat-3);
	}

	.ag.aging {
		--tile: var(--cat-4);
	}

	.ag.overdue {
		--tile: var(--tile-red);
	}

	.aging-list {
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: ag;
	}

	.ag-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bme-border);
	}

	.ag-row::before {
		counter-increment: ag;
		content: counter(ag) '.';
		font-weight: 700;
		color: var(--bme-muted);
		min-width: 20px;
	}

	.ag-ref {
		font-weight: 700;
		color: var(--bme-ink);
	}

	.ag-sla {
		display: inline-flex;
	}

	@media (max-width: 860px) {
		.grid2 {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
			gap: 6px;
		}

		.stat {
			padding: 10px 7px;
		}

		.stat-label {
			font-size: 9.5px;
			letter-spacing: 0;
		}

		.stat-value {
			font-size: 18px;
		}

		.stat-sub {
			font-size: 10px;
		}

		.bar-row {
			grid-template-columns: 76px 1fr auto;
			gap: 8px;
		}

		.ag-row {
			grid-template-columns: auto auto 1fr;
			row-gap: 6px;
			column-gap: 8px;
			align-items: start;
		}

		.ag-l {
			font-size: 12px;
		}

		.ag-ref {
			grid-column: 2 / -1;
		}

		.ag-sla {
			grid-column: 3;
			justify-self: start;
			align-self: center;
		}
	}
</style>