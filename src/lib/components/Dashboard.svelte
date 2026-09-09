<script lang="ts">
	import type { Boiler } from '$lib/types';
	import BoilerDesign from '$lib/components/BoilerDesign.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import { grateFor, resolveSections } from '$lib/boiler-design';
	import { addItem } from '$lib/stores/quote';
	import { addToast } from '$lib/stores/toast';
	import type { SectionReadingRow } from '$lib/boiler-design';
	import {
		levelFor, pointsByMetric, seriesFor, GROUP_LABELS,
		type MetricRow, type TelemetryRow, type RulRow, type AlertItem
	} from '$lib/telemetry';

	let {
		boiler,
		readings = [],
		metrics = [],
		telemetry = [],
		rul = [],
		motors = [],
		maintenance = []
	} = $props<{
		boiler: Boiler;
		readings?: SectionReadingRow[];
		metrics?: MetricRow[];
		telemetry?: TelemetryRow[];
		rul?: RulRow[];
		motors?: any[];
		maintenance?: any[];
	}>();

	type SubTab = 'overview' | 'trends' | 'motors' | 'alerts' | 'analytics' | 'maintenance';
	let sub = $state<SubTab>('overview');

	const INTERVALS = [
		{ value: 1, label: '1 hour' },
		{ value: 3, label: '3 hours' },
		{ value: 12, label: '12 hours' },
		{ value: 24, label: '24 hours' }
	];
	let tickHours = $state(1);

	const def = $derived(grateFor(boiler.code, boiler.name));
	const sections = $derived(resolveSections(def, []));
	const sectionLabel = (key: string | null) =>
		(key ? def.sections.find((s: any) => s.key === key)?.label : null) ?? 'General';

	const byMetric = $derived(pointsByMetric(telemetry));

	const latest = $derived.by(() => {
		const out: Record<string, { v: number; t: string }> = {};
		for (const m of metrics as MetricRow[]) {
			const pts = byMetric[m.metric_key];
			if (pts?.length) {
				const last = pts[pts.length - 1];
				out[m.metric_key] = { v: last.v, t: last.t };
			}
		}
		return out;
	});

	const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

	const overviewCards = $derived.by(() => {
		const cards = (metrics as MetricRow[]).map((m) => {
			const l = latest[m.metric_key];
			return {
				key: m.metric_key,
				label: m.label,
				value: l ? `${fmt(l.v)} ${m.unit}`.trim() : '—',
				level: l ? levelFor(l.v, m) : ('normal' as const),
				colour: m.colour
			};
		});
		cards.push({
			key: 'fuel_type',
			label: 'Fuel Type',
			value: boiler.fuel_type ?? '—',
			level: 'normal' as const,
			colour: 'var(--bme-muted)'
		});
		return cards;
	});

	const alerts = $derived.by(() => {
		const out: AlertItem[] = [];
		for (const m of metrics as MetricRow[]) {
			const l = latest[m.metric_key];
			if (!l) continue;
			const level = levelFor(l.v, m);
			if (level === 'normal') continue;
			out.push({
				metric_key: m.metric_key,
				label: m.label,
				unit: m.unit,
				value: l.v,
				level,
				sectionKey: m.section_key,
				sectionLabel: sectionLabel(m.section_key),
				minNormal: Number(m.min_normal),
				maxNormal: Number(m.max_normal),
				at: l.t
			});
		}
		return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'attention' ? -1 : 1));
	});

	const groups = $derived.by(() => {
		const map = new Map<string, MetricRow[]>();
		for (const m of metrics as MetricRow[]) {
			if (!m.group_key) continue;
			if (!map.has(m.group_key)) map.set(m.group_key, []);
			map.get(m.group_key)!.push(m);
		}
		return [...map.entries()].map(([key, ms]) => ({
			key,
			label: GROUP_LABELS[key] ?? key,
			series: ms.map((m) => seriesFor(m, byMetric[m.metric_key] ?? []))
		}));
	});

	const rulRows = $derived.by(() =>
		[...(rul as RulRow[])]
			.map((r) => ({ ...r, label: sectionLabel(r.section_key) }))
			.sort((a, b) => a.rul_percent - b.rul_percent)
	);

	const rulLevel = (p: number) => (p < 25 ? 'attention' : p < 50 ? 'warning' : 'normal');

	const when = (iso: string) => new Date(iso).toLocaleString();

	const motorLevel = (m: any) => {
		const ratios = [
			Number(m.vibration) / Number(m.vibration_limit || 1),
			Number(m.current_a) / Number(m.current_rating_a || 1),
			Number(m.power_kw) / Number(m.power_rating_kw || 1)
		];
		const worst = Math.max(...ratios);
		if (worst >= 1) return 'attention';
		if (worst >= 0.85) return 'warning';
		return 'normal';
	};

	const vibLevel = (m: any) => {
		const r = Number(m.vibration) / Number(m.vibration_limit || 1);
		return r >= 1 ? 'attention' : r>= 0.85 ? 'warning' : 'normal';
	};

	const money = (n: number | null) => {
		if (n === null || n === undefined) return '—';
		return n >= 1000 ? `RM${Math.round(n / 100) / 10}k` : `RM${Math.round(n)}`;
	};

	const dueDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

	let adding = $state<string | null>(null);

	function addMaintenancePart(row: any) {
		const p = row.parts;
		if (!p) {
			addToast('This item is not linked to a catalogue part yet. Please contact us to order it.');
			return;
		}
		adding = row.id;
		addItem({
			partId: p.id,
			partNumber: p.part_number,
			partName: p.name,
			boilerCode: boiler.code,
			componentName: p.components?.name ?? 'Maintenance',
			price: p.price ?? 'undefined',
			priceMin: p.price_min ?? p.price ?? 0,
			priceMax: p.price_max ?? p.price ?? 0,
			quantity: 1
		});
		addToast(`${p.name} added to cart.`);
		setTimeout(() => (adding = null), 900);
	}

	const hasData = $derived(metrics.length > 0 && telemetry.length > 0);
</script>

<div>
	<h2 class="title">{boiler.code}</h2>
	{#if boiler.name}<p class="desc">{boiler.name}</p>{/if}

	<div class="subtabs">
		<button class="stab" class:active={sub === 'overview'} onclick={() => (sub = 'overview')}>Overview</button>
		<button class="stab" class:active={sub === 'trends'} onclick={() => (sub = 'trends')}>Trends</button>
		<button class="stab" class:active={sub === 'motors'} onclick={() => (sub = 'motors')}>Motors</button>
		<button class="stab" class:active={sub === 'alerts'} onclick={() => (sub = 'alerts')}>
			Alerts{#if alerts.length}<span class="pill">{alerts.length}</span>{/if}
		</button>
		<button class="stab" class:active={sub === 'analytics'} onclick={() => (sub = 'analytics')}>Analytics</button>
		<button class="stab" class:active={sub === 'maintenance'} onclick={() => (sub = 'maintenance')}>
			Maintenance{#if maintenance.length}<span class="pill">{maintenance.length}</span>{/if}
		</button>
	</div>

	{#if sub === 'overview'}
		<div class="card design-card">
			<div class="design-head">
				<h3>Boiler Schematic</h3>
				<span class="hint">Hover or tap a section to view its readings.</span>
			</div>
			<BoilerDesign {def} {sections} mode="dashboard" boilerCode={boiler.code} {readings} />
		</div>

		{#if !hasData}
			<div class="card empty">No telemetry has been recorded for this boiler yet.</div>
		{:else}
			<div class="grid">
				{#each overviewCards as c (c.key)}
					<div class="card spec" class:warn={c.level === 'warning'} class:att={c.level === 'attention'}>
						<span class="k">{c.label}</span>
						<span class="v" style={`color:${c.colour}`}>{c.value}</span>
					</div>
				{/each}
			</div>
		{/if}

	{:else if sub === 'trends'}
		{#if !hasData}
			<div class="card empty">No telemetry has been recorded for this boiler yet.</div>
		{:else}
			<div class="toolbar">
				<p class="lead">Last 24 hours. Hover any chart to read the exact value at that time.</p>
				<label class="ivl">
					<span>Interval</span>
					<select bind:value={tickHours}>
						{#each INTERVALS as i (i.value)}<option value={i.value}>{i.label}</option>{/each}
					</select>
				</label>
			</div>
			<div class="charts">
				{#each metrics as m (m.metric_key)}
					<div class="card chart">
						<h4 style={`color:${m.colour}`}>{m.label}{m.unit ? ` ${m.unit}` : ''}</h4>
						<TrendChart series={[seriesFor(m, byMetric[m.metric_key] ?? [])]} height={150} {tickHours} />
					</div>
				{/each}
			</div>
		{/if}

		<h3 class="sect">Remaining Useful Life</h3>
		{#if rulRows.length === 0}
			<div class="card empty">No remaining-life estimates for this boiler yet.</div>
		{:else}
			<div class="card pad">
				{#each rulRows as r (r.section_key)}
					<div class="rul">
						<div class="rul-top">
							<span class="rul-name">{r.label}</span>
							<span class="rul-val {rulLevel(r.rul_percent)}">{r.rul_percent}% · ~{r.rul_days} days</span>
						</div>
						<div class="bar"><div class="fill {rulLevel(r.rul_percent)}" style={`width:${r.rul_percent}%`}></div></div>
						{#if r.last_service}<span class="rul-sub">Last serviced {new Date(r.last_service).toLocaleDateString()}</span>{/if}
					</div>
				{/each}
			</div>
		{/if}

	{:else if sub === 'motors'}
			{#if motors.length === 0}
				<div class="card empty">No motor data has been recorded for this boiler yet.</div>
			{:else}
				<p class="lead">Rotating equipment, measured against each drive's own rating.</p>
				<div class="motors">
					{#each motors as m (m.id)}
						<div class="card motor {motorLevel(m)}">
							<div class="m-head">
								<div>
									<span class="m-name">{m.name}</span>
									<span class="m-code">{m.code}</span>
								</div>
								<span class="m-dot {motorLevel(m)}" aria-label={motorLevel(m)}></span>
							</div>
							<div class="m-grid">
								<div class="m-cell">
									<span class="m-k">VIB</span>
									<span class="m-v {vibLevel(m)}">{Number(m.vibration).toFixed(1)}</span>
									<span class="m-sub">mm/s</span>
								</div>
								<div class="m-cell">
									<span class="m-k">AMP</span>
									<span class="m-v">{Math.round(Number(m.current_a))}</span>
									<span class="m-sub">{Math.round(Number(m.current_rating_a))}</span>
								</div>
								<div class="m-cell">
									<span class="m-k">kW</span>
									<span class="m-v">{Math.round(Number(m.power_kw))}</span>
									<span class="m-sub">{Math.round(Number(m.power_rating_kw))}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

	{:else if sub === 'maintenance'}
		{#if maintenance.length === 0}
			<div class="card empty">Nothing is due for replacement on this boiler right now.</div>
		{:else}
			<div class="toolbar">
				<p class="lead">{maintenance.length} item{maintenance.length === 1 ? '' : 's'} past their replacement date.</p>
			</div>
			<div class="mt-list">
				{#each maintenance as row (row.id)}
					<div class="card mt-row">
						<span class="mt-date">{row.due_on}</span>
						<span class="mt-part">{row.part_name}</span>
						<span class="mt-reason">{row.reason}</span>
						<span class="mt-overdue">{dueDays(row.due_on)} d overdue</span>
						<span class="mt-hrs">{row.est_hours ? `${Math.round(row.est_hours)}h` : '—'}</span>
						<!-- <span class="mt-cost">{money(row.est_cost)}</span> -->
						 <button class="mt-add" onclick={() => addMaintenancePart(row)} disabled={adding === row.id || !row.parts} title={row.parts ? 'Add this part to cart' : 'Not linked to a catalogue part'}>
							{adding === row.id? 'Added' : 'Add'}
						 </button>
					</div>
				{/each}
			</div>
		{/if}

	{:else if sub === 'alerts'}
		{#if !hasData}
			<div class="card empty">No telemetry has been recorded for this boiler yet.</div>
		{:else if alerts.length === 0}
			<div class="card empty">All metrics are within their normal range.</div>
		{:else}
			<div class="toolbar">
				<p class="lead">Metrics currently outside their normal operating range.</p>
			</div>
			<div class="alerts">
				{#each alerts as a (a.metric_key)}
					<div class="card alert {a.level}">
						<span class="dot {a.level}" aria-hidden="true"></span>
						<div class="a-body">
							<div class="a-line">
								<span class="a-sect">{a.sectionLabel}</span>
								<span class="a-sep">·</span>
								<span class="a-metric">{a.label}</span>
								<span class="a-val">{fmt(a.value)} {a.unit}</span>
							</div>
							<span class="a-sub">
								Normal range {a.minNormal}–{a.maxNormal} {a.unit} · {when(a.at)}
							</span>
						</div>
						<span class="a-tag {a.level}">{a.level}</span>
					</div>
				{/each}
			</div>
		{/if}

	{:else}
		{#if !hasData}
			<div class="card empty">No telemetry has been recorded for this boiler yet.</div>
		{:else}
			<div class="toolbar">
				<p class="lead">Related metrics plotted together over the last 24 hours.</p>
				<label class="ivl">
					<span>Interval</span>
					<select bind:value={tickHours}>
						{#each INTERVALS as i (i.value)}<option value={i.value}>{i.label}</option>{/each}
					</select>
				</label>
			</div>
			<div class="stack">
				{#each groups as g (g.key)}
					<div class="card chart">
						<h4>{g.label}</h4>
						<div class="legend">
							{#each g.series as s (s.key)}
								<span class="lg"><span class="dot" style={`background:${s.colour}`}></span>{s.label}</span>
							{/each}
						</div>
						<TrendChart series={g.series} height={190} fill={false} {tickHours} />
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.title { margin: 0 0 6px; font-size: 22px; }
	.desc { color: var(--bme-muted); margin: 0 0 16px; max-width: 60ch; }
	.lead { color: var(--bme-muted); font-size: 13px; margin: 0; }

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	.ivl { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; }
	.ivl span { font-size: 12.5px; font-weight: 600; color: var(--bme-muted); white-space: nowrap; }
	.ivl select { width: auto; min-width: 130px; padding: 7px 10px; font-size: 13px; }

	.subtabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }

	.stab {
		position: relative;
		overflow: visible;
		display: inline-flex; align-items: center; gap: 7px;
		padding: 8px 18px; border: 1px solid var(--bme-border); border-radius: 8px;
		background: var(--bme-surface); color: var(--bme-muted);
		font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
		transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
	}

	.stab.active { background: var(--bme-dark-blue); border-color: var(--bme-dark-blue); color: #ffffff; }

	.pill {
		position: absolute;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		top: 0;
		right: 0;
		min-width: 20px;
		height: 20px;
		transform: translate(50%, -50%);
		pointer-events: none;
		background: var(--bme-red); color: #ffffff;
		font-size: 12px; font-weight: 700; line-height: 1;
		padding: 0 6px; border-radius: 999px;
	}

	.design-card { padding: 16px 18px; margin-bottom: 20px; }
	.design-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
	.design-head h3 { margin: 0; font-size: 14px; color: var(--bme-dark-blue); }
	.design-head .hint { font-size: 12px; color: var(--bme-muted); }

	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
	.spec { padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; border-left: 3px solid transparent; }
	/* .spec.warn { border-left-color: var(--bme-amber); }
	.spec.att { border-left-color: var(--bme-red); } */
	.k { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--bme-muted); }
	.v { font-size: 18px; font-weight: 700; }

	.charts { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
	.stack { display: flex; flex-direction: column; gap: 14px; }
	.chart { padding: 14px 16px; }
	.chart h4 { margin: 0 0 10px; font-size: 13px; font-weight: 700; }

	.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 8px; }
	.lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--bme-muted); }
	.dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }

	.sect { font-size: 15px; margin: 26px 0 12px; color: var(--bme-dark-blue); }
	.pad { padding: 6px 18px 14px; }

	.rul { padding: 12px 0; border-bottom: 1px solid var(--bme-border); }
	.rul:last-child { border-bottom: none; }
	.rul-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 7px; flex-wrap: wrap; }
	.rul-name { font-size: 13.5px; font-weight: 600; color: var(--bme-ink); }
	.rul-val { font-size: 12.5px; font-weight: 700; }
	.rul-val.normal { color: var(--bme-green); }
	.rul-val.warning { color: var(--bme-amber); }
	.rul-val.attention { color: var(--bme-red); }
	.rul-sub { display: block; margin-top: 6px; font-size: 11.5px; color: var(--bme-muted); }

	.bar { height: 8px; border-radius: 999px; background: var(--bme-border); overflow: hidden; }
	.fill { height: 100%; border-radius: 999px; }
	.fill.normal { background: var(--bme-green); }
	.fill.warning { background: var(--bme-amber); }
	.fill.attention { background: var(--bme-red); }

	.alerts { display: flex; flex-direction: column; gap: 10px; }
	.alert { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-left: 3px solid transparent; }
	/* .alert.warning { border-left-color: var(--bme-amber); }
	.alert.attention { border-left-color: var(--bme-red); } */

	.alert .dot {
		width: 10px; height: 10px; margin-top: 7px;
		align-self: flex-start;
		animation: pulse 1.8s ease-in-out infinite;
	}
	.alert .dot.warning { background: var(--bme-amber); }
	.alert .dot.attention { background: var(--bme-red); }

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		55% { opacity: 0.3; }
	}

	.a-body { flex: 1; min-width: 0; }
	.a-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
	.a-sect { font-weight: 700; font-size: 13.5px; color: var(--bme-ink); }
	.a-sep { color: var(--bme-muted); }
	.a-metric { font-size: 13.5px; color: var(--bme-ink); }
	.a-val { font-weight: 700; font-size: 13.5px; color: var(--bme-ink); }
	.a-sub { display: block; margin-top: 4px; font-size: 12px; color: var(--bme-muted); }

	.a-tag {
		flex: 0 0 auto; font-size: 10.5px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.03em;
		padding: 3px 8px; border-radius: 4px;
	}
	.a-tag.warning { background: #fff3d6; color: #97700a; }
	.a-tag.attention { background: #fbe3e0; color: #8e261b; }

	:root[data-theme='dark'] .a-tag.warning { background: #3a2f0f; color: #ffcc66; }
	:root[data-theme='dark'] .a-tag.attention { background: #3a1c18; color: #ff9d8f; }

	.motors { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
	.motor { padding: 14px 16px; border-left: 3px solid transparent; }
	/* .motor.warning { border-left-color: var(--bme-amber); }
	.motor.attention { border-left-color: var(--bme-red); } */
 
	.m-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
	.m-name { display: block; font-size: 14px; font-weight: 700; color: var(--bme-ink); }
	.m-code { display: block; margin-top: 2px; font-size: 11px; color: var(--bme-muted); }
 
	.m-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; margin-top: 3px; }
	.m-dot.normal { background: var(--bme-green); }
	.m-dot.warning { background: var(--bme-amber); }
	.m-dot.attention { background: var(--bme-red); }
 
	.m-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--bme-border); border-radius: 8px; overflow: hidden; }
	.m-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border-right: 1px solid var(--bme-border); }
	.m-cell:last-child { border-right: none; }
	.m-k { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--bme-muted); }
	.m-v { font-size: 19px; font-weight: 700; color: var(--bme-ink); line-height: 1.1; }
	.m-v.normal { color: var(--bme-green); }
	.m-v.warning { color: var(--bme-amber); }
	.m-v.attention { color: var(--bme-red); }
	.m-sub { font-size: 10.5px; color: var(--bme-muted); }

	.mt-list { display: flex; flex-direction: column; gap: 8px; }
 
	.mt-row {
		display: grid;
		grid-template-columns: 96px minmax(120px, 1.4fr) minmax(110px, 1.2fr) auto 46px 78px;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
	}
 
	.mt-date { font-size: 12px; color: var(--bme-muted); font-variant-numeric: tabular-nums; }
	.mt-part { font-size: 13.5px; font-weight: 700; color: var(--bme-ink); }
	.mt-reason { font-size: 13px; color: var(--bme-muted); }
	.mt-overdue { font-size: 11.5px; font-weight: 700; color: var(--bme-red); white-space: nowrap; }
	.mt-hrs { font-size: 12.5px; color: var(--bme-muted); text-align: right; }
	.mt-cost { font-size: 12.5px; font-weight: 700; color: var(--bme-amber); text-align: right; }
 
	.mt-add {
		padding: 7px 12px; border-radius: 8px; border: 1px solid var(--bme-dark-blue);
		background: var(--bme-dark-blue); color: #ffffff;
		font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
	}
	.mt-add:hover:not(:disabled) { background: var(--bme-darker-blue); }
	.mt-add:disabled { opacity: 0.5; cursor: not-allowed; }

	.empty { padding: 2rem 1.5rem; text-align: center; color: var(--bme-muted); }

	@media (max-width: 860px) {
		.mt-row {
			grid-template-columns: 1fr auto;
			row-gap: 6px;
		}
		.mt-date { grid-column: 1 / -1; }
		.mt-part { grid-column: 1; }
		.mt-reason { grid-column: 1; }
		.mt-overdue, .mt-hrs, .mt-cost { grid-column: 2; text-align: right; }
		.mt-add { grid-column: 1 / -1; }
	}

	@media (max-width: 640px) {
		.grid { grid-template-columns: repeat(2, 1fr); }
		.charts { grid-template-columns: 1fr; }
		.motors { grid-template-columns: 1fr; }
	}
</style>