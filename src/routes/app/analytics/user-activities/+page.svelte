<script lang="ts">
	import SearchFilter from '$lib/components/SearchFilter.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import StackedColumns from '$lib/components/analytics/StackedColumns.svelte';
	import StackedRows from '$lib/components/analytics/StackedRows.svelte';
	import LineChart from '$lib/components/analytics/LineChart.svelte';
	import DonutChart from '$lib/components/analytics/DonutChart.svelte';
	import RadialGauge from '$lib/components/analytics/RadialGauge.svelte';
	import FunnelChart from '$lib/components/analytics/FunnelChart.svelte';
	import Heatmap from '$lib/components/analytics/Heatmap.svelte';
	import { emptyFilters, isActive, matches } from '$lib/filters';

	let { data } = $props();

	const KIND_INDEX: Record<string, number> = {
		views: 1,
		interactions: 2,
		requests: 3,
		enquiries: 4,
		updates: 5,
		signins: 6
	};

	let s = $derived(data.summary);

	function fmtDuration(seconds: number | null): string {
		if (seconds === null || seconds === undefined) return '—';
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const r = seconds % 60;
		if (m < 60) return `${m}m ${String(r).padStart(2, '0')}s`;
		return `${Math.floor(m / 60)}h ${m % 60}m`;
	}

	function fmtOffset(ms: number): string {
		return `+${fmtDuration(Math.round(ms / 1000))}`;
	}

	let tiles = $derived([
		{ value: s.uniqueVisitors, label: 'Unique visitors', hint: 'Signed-in users + signed-out visitors' },
		{ value: s.activeUsers, label: 'Active users', hint: 'Signed-in users with any activity' },
		{ value: s.sessions, label: 'Sessions', hint: 'Visits, ending after 30 min idle' },
		{ value: s.pageViews, label: 'Page views', hint: 'Pages opened inside the portal' },
		{ value: fmtDuration(s.avgTimeOnPage), label: 'Avg. time on page', hint: 'While the tab is visible' },
		{ value: s.bounceRate === null ? '—' : `${s.bounceRate}%`, label: 'Bounce rate', hint: 'Sessions with one page only' },
		{ value: s.avgScroll === null ? '—' : `${s.avgScroll}%`, label: 'Avg. scroll depth', hint: 'How far down pages are read' },
		{ value: s.clicks, label: 'Clicks', hint: 'Buttons and links clicked' },
		{ value: s.reviewActions, label: 'Review actions', hint: 'Requests closed or reopened' },
		{ value: s.enquiries, label: 'Enquiries', hint: 'Enquiry forms received' }
	]);

	let maxClick = $derived(Math.max(1, ...data.topClicks.map((c: any) => c.count)));

	const FEED_PAGE_SIZE = 20;
	let filters = $state(emptyFilters());
	let feedPage = $state(1);

	let filteredFeed = $derived(
		(data.recentActivity ?? []).filter((ev: any) =>
			matches(filters, { search: [ev.who, ev.action, ev.detail], date: ev.ts })
		)
	);

	$effect(() => {
		filters.q;
		filters.from;
		filters.to;
		feedPage = 1;
	});

	let feedPages = $derived(Math.max(1, Math.ceil(filteredFeed.length / FEED_PAGE_SIZE)));
	let feedCur = $derived(Math.min(feedPage, feedPages));
	let pagedFeed = $derived(
		filteredFeed.slice((feedCur - 1) * FEED_PAGE_SIZE, feedCur * FEED_PAGE_SIZE)
	);

	function fullDate(ts: string): string {
		return new Date(ts).toLocaleString();
	}

	function ago(ts: string): string {
		const diff = Date.now() - new Date(ts).getTime();
		const m = Math.round(diff / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		const d = Math.floor(h / 24);
		if (d < 30) return `${d}d ago`;
		return new Date(ts).toLocaleDateString();
	}
</script>

<div class="ua-root">
	{#if !data.trackingReady}
		<div class="card notice">
			Behaviour tracking is not fully set up yet. Run migration
			<code>0097_activity_behaviour_tracking.sql</code> so sessions, visitors, funnels and heatmaps can be
			recorded. The charts below only use older activity data until then.
		</div>
	{/if}

	<div class="card section">
		<h2>User activity (last {data.windowDays} days)</h2>
		<div class="ua-stats">
			{#each tiles as t, i (t.label)}
				<div class="ua" style="--tile:var(--tile-{i + 1})" title={t.hint}>
					<span class="ua-n">{t.value}</span>
					<span class="ua-l">{t.label}</span>
				</div>
			{/each}
		</div>

		<h3 class="ua-sub">Daily activity by behaviour</h3>
		<StackedColumns
			data={data.dailyActivity}
			series={data.series}
			caption="Daily activity for the last {data.windowDays} days, split by type of behaviour"
		/>
	</div>

	<div class="grid2">
		<div class="card section">
			<h2>Most active users</h2>
			<StackedRows rows={data.topUsers} series={data.series} empty="No activity recorded yet." />
		</div>
		<div class="card section">
			<h2>Most visited pages</h2>
			<StackedRows rows={data.topPages} series={data.series} empty="No page visits recorded yet." />
		</div>
	</div>

	<div class="card section">
		<h2>Traffic &amp; engagement</h2>
		<p class="hint">Unique visitors and sessions per day.</p>
		<LineChart
			data={data.visitorTrend}
			series={[{ label: 'Unique visitors' }, { label: 'Sessions' }]}
			caption="Unique visitors and sessions per day"
		/>

		<div class="gauges">
			<RadialGauge value={s.bounceRate} label="Bounce rate" hint="Sessions that left after one page" />
			<RadialGauge value={s.avgScroll} label="Avg. scroll depth" hint="How far down a page users scroll" />
			<RadialGauge value={s.conversionRate} label="Cart conversion" hint="Sessions that added to the cart and then submitted a request" />
		</div>
	</div>

	<div class="grid2">
		<div class="card section">
			<h2>Traffic sources</h2>
			<p class="hint">How visitors arrived (first page of each visit).</p>
			<DonutChart items={data.trafficSources} centerLabel="visits" empty="No visits recorded yet." />
		</div>
		<div class="card section">
			<h2>Devices</h2>
			<p class="hint">Screen size when the visit started.</p>
			<DonutChart items={data.devices} centerLabel="visits" empty="No visits recorded yet." />
		</div>
	</div>

	<div class="card section">
		<h2>Page engagement</h2>
		{#if data.pageEngagement.length === 0}
			<p class="hint">No page visits recorded yet.</p>
		{:else}
			<div class="tbl-wrap">
				<table class="eng">
					<thead>
						<tr>
							<th>Page</th>
							<th>Views</th>
							<th>Users</th>
							<th>Avg. time</th>
							<th>Avg. scroll</th>
							<th>Exit rate</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pageEngagement as p (p.label)}
							<tr>
								<td>{p.label}</td>
								<td>{p.views}</td>
								<td>{p.users}</td>
								<td>{fmtDuration(p.avgTime)}</td>
								<td>
									{#if p.avgScroll === null}—{:else}
										<span class="mini"><i style="width:{p.avgScroll}%"></i></span>{p.avgScroll}%
									{/if}
								</td>
								<td>{p.exitRate === null ? '—' : `${p.exitRate}%`}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="foot-note">Exit rate is the share of a page's views that were the last page of a session (drop-off point).</p>
		{/if}
	</div>

	<div class="grid2">
		<div class="card section">
			<h2>Checkout funnel</h2>
			<p class="hint">Sessions reaching each step of the spare-parts request flow.</p>
			<FunnelChart steps={data.checkoutFunnel} unit="sessions" empty="No spare-parts visits recorded yet." />
		</div>
		<div class="card section">
			<h2>Enquiry (lead) funnel</h2>
			<p class="hint">Visitors on the public enquiry form.</p>
			<FunnelChart steps={data.leadFunnel} unit="visitors" empty="No enquiry form visits recorded yet." />
		</div>
	</div>

	<div class="grid2">
		<div class="card section">
			<h2>Top clicks &amp; CTAs</h2>
			{#if data.topClicks.length === 0}
				<p class="hint">No clicks recorded yet.</p>
			{:else}
				<div class="clicks">
					{#each data.topClicks as c, i (c.label + c.page + i)}
						<div class="click-row">
							<span class="click-key" title="{c.label} · {c.page}">
								{c.label}
								{#if c.cta}<em class="cta">CTA</em>{/if}
								<small>{c.page}</small>
							</span>
							<span class="click-track"><i style="width:{(c.count / maxClick) * 100}%"></i></span>
							<span class="click-val">{c.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card section">
			<h2>Custom events</h2>
			<div class="ev-tiles">
				<div class="ev"><span class="ev-n">{data.customEvents.imageViews}</span><span class="ev-l">Image views</span></div>
				<div class="ev"><span class="ev-n">{data.customEvents.downloads}</span><span class="ev-l">File downloads</span></div>
				<div class="ev"><span class="ev-n">{data.customEvents.cartAdds}</span><span class="ev-l">Added to cart</span></div>
				<div class="ev"><span class="ev-n">{data.customEvents.ctaClicks}</span><span class="ev-l">CTA clicks</span></div>
			</div>
			<div class="ev-lists">
				<div>
					<h4>Most viewed part images</h4>
					{#if data.customEvents.topImages.length === 0}
						<p class="hint">None yet.</p>
					{:else}
						<ol>
							{#each data.customEvents.topImages as it (it.label)}
								<li><span>{it.label}</span><b>{it.count}</b></li>
							{/each}
						</ol>
					{/if}
				</div>
				<div>
					<h4>Most downloaded files</h4>
					{#if data.customEvents.topDownloads.length === 0}
						<p class="hint">None yet.</p>
					{:else}
						<ol>
							{#each data.customEvents.topDownloads as it (it.label)}
								<li><span title={it.label}>{it.label}</span><b>{it.count}</b></li>
							{/each}
						</ol>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="card section">
		<h2>Mouse &amp; click heatmap</h2>
		<p class="hint">
			Where the pointer rested or clicked, relative to the visible screen. Each square is one part of the
			screen; darker means more activity.
		</p>
		<Heatmap maps={data.heatmaps} cols={data.heatCols} rows={data.heatRows} />
	</div>

	<div class="card section">
		<h2>Session journeys</h2>
		<p class="hint">
			Step-by-step replay of the most recent visits: pages opened, buttons clicked, cart actions and time
			spent.
		</p>
		{#if data.journeys.length === 0}
			<p class="hint">No tracked sessions yet.</p>
		{:else}
			<div class="journeys">
				{#each data.journeys as j (j.id)}
					<details class="journey">
						<summary>
							<strong>{j.who}</strong>{#if j.role}<small> ({j.role})</small>{/if}
							<span class="j-meta">
								{fullDate(j.start)} · {fmtDuration(Math.round(j.durationMs / 1000))} · {j.pages}
								{j.pages === 1 ? 'page' : 'pages'}
							</span>
						</summary>
						<ol class="steps">
							{#each j.steps as st, i (i)}
								<li>
									<span class="st-dot" style="background:{KIND_INDEX[st.kind] ? `var(--cat-${KIND_INDEX[st.kind]})` : 'var(--bme-border)'}"></span>
									<span class="st-time">{fmtOffset(st.offset)}</span>
									<span class="st-lbl">{st.label}</span>
								</li>
							{/each}
							{#if j.more}<li class="st-more">…and {j.more} more steps</li>{/if}
						</ol>
					</details>
				{/each}
			</div>
		{/if}
	</div>

	<div class="card section">
		<h2>Recent activity (last {data.windowDays} days)</h2>

		<div class="feed-filter">
			<SearchFilter
				bind:filters
				showStatus={false}
				showRegion={false}
				placeholder="Search by name or activity..."
			/>
		</div>

		{#if data.recentActivity.length === 0}
			<p class="hint">No recent records yet.</p>
		{:else if filteredFeed.length === 0}
			<p class="hint">No activity matches your filters.</p>
		{:else}
			<p class="feed-count">
				{filteredFeed.length}
				{filteredFeed.length === 1 ? 'activity' : 'activities'}{isActive(filters) ? ' found' : ''}
				{#if data.eventsCapped}<span class="feed-cap"> · showing the most recent records only</span>{/if}
			</p>
			<ul class="feed">
				{#each pagedFeed as ev, i (`${ev.ts}-${i}`)}
					<li class="feed-row">
						<span class="feed-dot {ev.kind}"></span>
						<span class="feed-text"
							><strong>{ev.who}</strong>
							{ev.action}
							{#if ev.detail}<span class="feed-ref">{ev.detail}</span>{/if}</span
						>
						<span class="feed-time" title={fullDate(ev.ts)}>{ago(ev.ts)}</span>
					</li>
				{/each}
			</ul>
			<div class="feed-pager">
				<Pagination
					total={filteredFeed.length}
					page={feedCur}
					pageSize={FEED_PAGE_SIZE}
					onpage={(p: number) => (feedPage = p)}
					compact
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.ua-root {
		--cat-1: #2a78d6;
		--cat-2: #eb6834;
		--cat-3: #1baf7a;
		--cat-4: #eda100;
		--cat-5: #e87ba4;
		--cat-6: #6250d6;
		--line-1: #2a78d6;
		--line-2: #eb6834;
		--seq: #2a78d6;
		--funnel-1: #184f95;
		--funnel-2: #256abf;
		--funnel-3: #3987e5;
		--funnel-4: #6da7ec;
		--tile-1: #2a78d6;
		--tile-2: #6250d6;
		--tile-3: #0f8b8d;
		--tile-4: #1baf7a;
		--tile-5: #eb6834;
		--tile-6: #e34948;
		--tile-7: #eda100;
		--tile-8: #e87ba4;
		--tile-9: #008300;
		--tile-10: #8d6e63;
	}

	:global(:root[data-theme='dark']) .ua-root {
		--cat-1: #3987e5;
		--cat-2: #d95926;
		--cat-3: #199e70;
		--cat-4: #c98500;
		--cat-5: #d55181;
		--cat-6: #9085e9;
		--line-1: #3987e5;
		--line-2: #d95926;
		--seq: #3987e5;
		--funnel-1: #6da7ec;
		--funnel-2: #5598e7;
		--funnel-3: #3987e5;
		--funnel-4: #256abf;
		--tile-1: #3987e5;
		--tile-2: #9085e9;
		--tile-3: #2bb3b5;
		--tile-4: #199e70;
		--tile-5: #d95926;
		--tile-6: #e66767;
		--tile-7: #c98500;
		--tile-8: #d55181;
		--tile-9: #3fa33f;
		--tile-10: #bc9d92;
	}

	h2 {
		margin-top: 5px;
	}

	.section {
		padding: 18px 20px;
		margin: 0 0 4px;
		color: var(--bme-ink);
	}

	.notice {
		padding: 12px 16px;
		margin-bottom: 8px;
		font-size: 13.5px;
		color: var(--bme-ink);
		border-left: 4px solid var(--bme-amber);
	}

	.hint {
		margin: 0 0 14px;
		font-size: 13px;
		color: var(--bme-muted);
	}

	.ua-sub {
		margin: 4px 0 12px;
		font-size: 16px;
	}

	.ua-stats {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
		margin-bottom: 22px;
	}

	.ua {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 10px;
		border-top: 4px solid var(--tile);
		background: color-mix(in srgb, var(--tile) 9%, var(--bme-surface));
		text-align: left;
	}

	.ua-n {
		font-size: 24px;
		font-weight: 700;
		color: var(--bme-ink);
		line-height: 1.15;
	}

	.ua-l {
		font-size: 12.5px;
		color: var(--bme-muted);
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin: 0 0 4px;
		gap: 5px;
	}

	.grid2 .section {
		margin-bottom: 0;
	}

	.gauges {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--bme-border);
	}

	.tbl-wrap {
		overflow-x: auto;
	}

	.eng {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.eng th,
	.eng td {
		padding: 8px 10px;
		text-align: center;
		border-bottom: 1px solid var(--bme-border);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.eng th:first-child,
	.eng td:first-child {
		text-align: left;
		font-weight: 600;
	}

	.eng th {
		font-size: 11.5px;
		text-transform: uppercase;
		color: var(--bme-muted);
		font-weight: 600;
	}

	.mini {
		display: inline-block;
		width: 48px;
		height: 6px;
		margin-right: 8px;
		vertical-align: middle;
		background: var(--bme-surface-2);
		border-radius: 3px;
		overflow: hidden;
	}

	.mini i {
		display: block;
		height: 100%;
		background: var(--seq);
		border-radius: 3px;
	}

	.foot-note {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--bme-muted);
	}

	.clicks {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.click-row {
		display: grid;
		grid-template-columns: minmax(120px, 210px) 1fr auto;
		align-items: center;
		gap: 12px;
	}

	.click-key {
		font-size: 13px;
		font-weight: 600;
		color: var(--bme-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.click-key small {
		display: block;
		font-weight: 400;
		color: var(--bme-muted);
	}

	.cta {
		margin-left: 4px;
		padding: 0 5px;
		border: 1px solid var(--bme-border);
		border-radius: 4px;
		font-size: 10px;
		font-style: normal;
		font-weight: 700;
		color: var(--bme-muted);
	}

	.click-track {
		display: block;
		height: 12px;
	}

	.click-track i {
		display: block;
		height: 100%;
		min-width: 3px;
		background: var(--cat-2);
		border-radius: 0 4px 4px 0;
	}

	.click-val {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.ev-tiles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 16px;
	}

	.ev {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		background: var(--bme-surface-2);
	}

	.ev-n {
		font-size: 20px;
		font-weight: 700;
	}

	.ev-l {
		font-size: 12px;
		color: var(--bme-muted);
	}

	.ev-lists {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.ev-lists h4 {
		margin: 0 0 8px;
		font-size: 13px;
	}

	.ev-lists ol {
		margin: 0;
		padding-left: 18px;
		font-size: 13px;
	}

	.ev-lists li {
		padding: 2px 0;
	}

	.ev-lists li span {
		display: inline-block;
		max-width: calc(100% - 40px);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: bottom;
	}

	.ev-lists li b {
		float: right;
		font-variant-numeric: tabular-nums;
	}

	.journeys {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.journey {
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		background: var(--bme-surface);
	}

	.journey summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		padding: 10px 12px;
		font-size: 13.5px;
		cursor: pointer;
	}

	.journey summary small {
		color: var(--bme-muted);
	}

	.j-meta {
		margin-left: auto;
		font-size: 12px;
		color: var(--bme-muted);
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 4px 12px 12px;
		border-top: 1px solid var(--bme-border);
	}

	.steps li {
		display: grid;
		grid-template-columns: 10px 70px 1fr;
		align-items: center;
		gap: 10px;
		padding: 5px 0;
		font-size: 13px;
	}

	.st-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.st-time {
		font-size: 12px;
		color: var(--bme-muted);
		font-variant-numeric: tabular-nums;
	}

	.st-lbl {
		min-width: 0;
		overflow-wrap: break-word;
	}

	.st-more {
		display: block !important;
		color: var(--bme-muted);
		font-size: 12px;
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.feed-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px solid var(--bme-border);
	}

	.feed-row:first-child {
		border-top: none;
	}

	.feed-dot {
		flex: 0 0 auto;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--bme-muted);
	}

	.feed-dot.request {
		background: var(--bme-dark-blue);
	}

	.feed-dot.closed {
		background: var(--bme-dark-green);
	}

	.feed-dot.reopened {
		background: var(--bme-orange);
	}

	.feed-dot.enquiry {
		background: var(--bme-purple);
	}

	.feed-dot.page_view {
		background: var(--bme-dark-blue);
	}

	.feed-dot.login {
		background: var(--bme-green);
	}

	.feed-dot.logout {
		background: var(--bme-muted);
	}

	.feed-dot.replied {
		background: #e0509f;
	}

	:global(:root[data-theme='dark']) .feed-dot.replied {
		background: #f07cb8;
	}

	.feed-dot.converted {
		background: #8d6e63;
	}

	:global(:root[data-theme='dark']) .feed-dot.converted {
		background: #bc9d92;
	}

	.feed-dot.profile {
		background: var(--bme-light-blue);
	}

	.feed-dot.added {
		background: var(--bme-green);
	}

	.feed-dot.edited {
		background: var(--bme-amber);
	}

	.feed-dot.deleted {
		background: var(--bme-red);
	}

	.feed-dot.settings {
		background: #5b5fc7;
	}

	:global(:root[data-theme='dark']) .feed-dot.settings {
		background: #8b8fe8;
	}

	.feed-filter :global(.filters) {
		margin-bottom: 14px;
		box-shadow: none;
	}

	.feed-count {
		margin: 0 0 6px;
		font-size: 12.5px;
		color: var(--bme-muted);
	}

	.feed-cap {
		font-style: italic;
	}

	.feed-pager :global(.pager) {
		margin-top: 14px;
	}

	.feed-text {
		flex: 1;
		font-size: 13.5px;
		color: var(--bme-ink);
		min-width: 0;
	}

	.feed-ref {
		color: var(--bme-dark-blue);
		font-weight: 600;
		overflow-wrap: break-word;
	}

	.feed-time {
		flex: 0 0 auto;
		font-size: 12px;
		color: var(--bme-muted);
	}

	@media (max-width: 1100px) {
		.ua-stats {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 860px) {
		.grid2 {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.ua-stats {
			grid-template-columns: repeat(2, 1fr);
		}

		.gauges {
			grid-template-columns: 1fr 1fr;
		}

		.ev-tiles {
			grid-template-columns: repeat(2, 1fr);
		}

		.ev-lists {
			grid-template-columns: 1fr;
		}

		.click-row {
			grid-template-columns: 1fr auto;
			gap: 4px 10px;
		}

		.click-key {
			grid-column: 1 / -1;
		}

		.steps li {
			grid-template-columns: 10px 58px 1fr;
		}
	}
</style>