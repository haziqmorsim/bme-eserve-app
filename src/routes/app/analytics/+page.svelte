<script lang="ts">
    import SlaBadge from "$lib/components/SlaBadge.svelte";

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

    let maxHandle = $derived(Math.max(1, ...data.handlingPerLevel.map((l: any) => l.avgMs ?? 0)));
    let maxRegion = $derived(Math.max(1, ...data.volumeByRegion.map((r: any) => r.count)));
    let maxBoiler = $derived(Math.max(1, ...data.volumeByBoiler.map((b: any) => b.count)));
    let maxDaily = $derived(Math.max(1, ...data.dailyActivity.map((d: any) => d.count)));
    let maxUser = $derived(Math.max(1, ...data.topUsers.map((u: any) => u.count)));
    let maxPage = $derived(Math.max(1, ...data.topPages.map((p: any) => p.count)));

    const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', coo: 'COO', developer: 'Developer', customer: 'Customer' };
    function roleLabel(r: string | null): string {
        return r ? (ROLE_LABEL[r] ?? r) : '';
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

<h1>Analytics</h1>

{#if data.total === 0}
    <div class="card empty">No request data available yet.</div>
{:else}
    <div class="stats">
        <div class="card stat">
            <span class="stat-label">Total requests</span>
            <span class="stat-value">{data.total}</span>
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
                <span class="ag-l">On track</span>
                <span class="ag-t">&lt; 24h</span>
            </div>
            <div class="ag aging">
                <span class="ag-n">{data.openAging.aging}</span>
                <span class="ag-l">Aging</span>
                <span class="ag-t">&ge; 24h</span>
            </div>
            <div class="ag overdue">
                <span class="ag-n">{data.openAging.overdue}</span>
                <span class="ag-l">Overdue</span>
                <span class="ag-t">&ge; 48h</span>
            </div>
        </div>

        {#if data.agingList.length === 0}
            <p class="hint">No open requests yet.</p>
        {:else}
            <ol class="aging-list">
                {#each data.agingList as a (a.id)}
                    <li class="ag-row">
                        <span class="ag-ref">{a.reference} &middot; {a.boiler} ({a.region})</span>
                        <span class="ag-meta">{a.levelLabel}</span>
                        <span class="ag-sla"><SlaBadge since={a.since} businessHours /></span>
                    </li>
                {/each}
            </ol>
        {/if}
    </div>

    <div class="card section">
        <h2>Average handling time per level</h2>
        <div class="bars">
            {#each data.handlingPerLevel as l (l.level)}
                <div class="bar-row">
                    <span class="bar-e">{l.label}</span>
                    <div class="bar-track">
                        <div class="bar-fill blue" style="width: {Math.round(((l.avgMs ?? 0) / maxHandle) * 100)}%"></div>
                    </div>
                    <span class="bar-val">{fmtDur(l.avgMs)}</span>
                </div>
            {/each}
        </div>
    </div>

    <div class="grid2">
        <div class="card section">
            <h2>Requests by region</h2>
            {#if data.volumeByRegion.length === 0}
                <p class="hint">No regional data.</p>
            {:else}
                <div class="bars">
                    {#each data.volumeByRegion as r (r.name)}
                        <div class="bar-row">
                            <span class="bar-key">{r.name}</span>
                            <div class="bar-track">
                                <div class="bar-fill blue" style="width: {Math.round((r.count / maxRegion) * 100)}%"></div>
                            </div>
                            <span class="bar-val">{r.count}</span>
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
                    {#each data.volumeByBoiler as b (b.code)}
                        <div class="bar-row">
                            <span class="bar-key">{b.code}</span>
                            <div class="bar-track">
                                <div class="bar-fill blue" style="width: {Math.round((b.count / maxBoiler) * 100)}%"></div>
                            </div>
                            <span class="bar-val">{b.count}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="card section">
        <h2>User activity (last 30 days)</h2>
        <div class="ua-stats">
            <div class="ua"><span class="ua-n">{data.activitySummary.activeUsers}</span><span class="ua-l">Active users</span></div>
            <div class="ua"><span class="ua-n">{data.activitySummary.sessions}</span><span class="ua-l">Sessions</span></div>
            <div class="ua"><span class="ua-n">{data.activitySummary.pageViews}</span><span class="ua-l">Page views</span></div>
            <div class="ua"><span class="ua-n">{data.activitySummary.actions}</span><span class="ua-l">Review actions</span></div>
            <div class="ua"><span class="ua-n">{data.activitySummary.enquiries}</span><span class="ua-l">Enquiries</span></div>
        </div>

        <h3 class="ua-sub">Daily activity</h3>
        <div class="spark" role="img" aria-label="Daily activity for the last 14 days">
            {#each data.dailyActivity as d, i (i)}
                <div class="spark-col">
                    <div class="spark-bar" style="height: {Math.round((d.count / maxDaily) * 100)}%" title="{d.label}: {d.count}"></div>
                    <span class="spark-x">{d.label}</span>
                </div>
            {/each}
        </div>
    </div>

    <div class="grid2">
        <div class="card section">
            <h2>Most active users</h2>
            {#if data.topUsers.length === 0}
                <p class="hint">No activity recorded yet.</p>
            {:else}
                <div class="bars">
                    {#each data.topUsers as u, i (i)}
                        <div class="bar-row2">
                            <span class="bar-key">{u.name}{#if u.role} &nbsp; ({roleLabel(u.role)}){/if}</span>
                            <div class="bar-track">
                                <div class="bar-fill green" style="width: {Math.round((u.count / maxUser) * 100)}%"></div>
                            </div>
                            <span class="bar-val">{u.count}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="card section">
            <h2>Most visited pages</h2>
            {#if data.topPages.length === 0}
                <p class="hint">No page views recorded yet.</p>
            {:else}
                <div class="bars">
                    {#each data.topPages as pg, i (i)}
                        <div class="bar-row2">
                            <span class="bar-key">{pg.label}</span>
                            <div class="bar-track">
                                <div class="bar-fill green" style="width: {Math.round((pg.count / maxPage) * 100)}%"></div>
                            </div>
                            <span class="bar-val">{pg.count}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    <div class="card section">
        <h2>Recent activity</h2>
        {#if data.recentActivity.length === 0}
            <p class="hint">No recent records yet.</p>
        {:else}
            <ul class="feed">
                {#each data.recentActivity as ev, i (i)}
                    <li class="feed-row">
                        <span class="feed-dot {ev.kind}"></span>
                        <span class="feed-text"><strong>{ev.who}</strong> {ev.action} {#if ev.detail}<span class="feed-ref">{ev.detail}</span>{/if}</span>
                        <span class="feed-time">{ago(ev.ts)}</span>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}

<style>
    h1 {
        margin: 5px 0 15px;
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

    .stat-value.open {
        color: var(--bme-dark-blue);
    }

    .stat-value.closed {
        color: #2f5e18;
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
        margin: 0 0 14px;
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
        background: var(--bme-green);
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
        background: var(--bme-green);
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

    .bar-row2 {
        display: grid;
        grid-template-columns: 200px 1fr auto;
        align-items: center;
        gap: 12px;
    }

    .bar-e {
        font-size: 14px;
        font-weight: 600;
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

    .bar-fill.blue {
        background: var(--bme-dark-blue);
    }

    .bar-fill.green { 
        background: var(--bme-green); 
    }

    .bar-val {
        font-size: 13px;
        font-weight: 700;
        color: var(--bme-ink);
        white-space: nowrap;
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

    .aging-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin: 12px 0 16px;
    }

    .ag {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 14px 10px;
        border-radius: 10px;
    }

    .ag-n { 
        font-size: 26px; 
        font-weight: 700; 
        line-height: 1; 
    }

    .ag-l { 
        font-size: 13px; 
        font-weight: 700; 
        text-transform: uppercase; 
        letter-spacing: 0.02em; 
    }

    .ag-t {
        font-size: 13px;
        font-weight: 700;
    }

    .ag.ontrack { 
        background-color: #e4f3d8; 
        color: #2f5e18; 
    }

    .ag.aging   { 
        background-color: #fff3d6; 
        color: #97700a; 
    }

    .ag.overdue { 
        background-color: #fbe3e0; 
        color: #8e261b; 
    }

    .aging-list { 
        list-style: none; 
        margin: 0; 
        padding: 0; 
        counter-reset: ag; 
    }

    .ag-row {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--bme-border);
    }

    .ag-row::before {
        counter-increment: ag;
        content: counter(ag) ".";
        font-weight: 700;
        color: var(--bme-muted);
        font-size: 13px;
        min-width: 20px;
    }

    .ag-ref { 
        font-weight: 700; 
        color: var(--bme-ink); }

    .ag-sla { display: inline-flex; }

    .ag-meta { 
        font-size: 13px; 
        color: var(--bme-muted); 
    }

    .ua-stats {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .ua {
        background: var(--bme-sky);
        border-radius: 10px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        text-align: center;
    }

    .ua-n { font-size: 24px; font-weight: 700; color: var(--bme-dark-blue); }
    .ua-l { font-size: 12.5px; color: var(--bme-muted); }

    .ua-sub {
        margin: 6px 0 10px;
        color: var(--bme-ink);
    }

    .spark {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 130px;
        padding-top: 8px;
    }

    .spark-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        height: 100%;
        gap: 6px;
    }

    .spark-bar {
        width: 100%;
        max-width: 26px;
        min-height: 3px;
        background: var(--bme-dark-blue);
        border-radius: 4px 4px 0 0;
        transition: height var(--t-med) var(--ease);
    }

    .spark-x {
        font-size: 10.5px;
        color: var(--bme-muted);
        white-space: nowrap;
    }

    .feed {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
    }

    .feed-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid var(--bme-border);
    }

    .feed-row:first-child { border-top: none; }

    .feed-dot {
        flex: 0 0 auto;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--bme-muted);
    }

    .feed-dot.request { background: var(--bme-dark-blue); }
    .feed-dot.closed { background: var(--bme-green); }
    .feed-dot.reopened { background: var(--bme-orange); }
    .feed-dot.enquiry { background: var(--bme-teal); }
    .feed-dot.page_view { background: var(--bme-dark-blue); }
    .feed-dot.login { background: var(--bme-green); }

    .feed-text {
        flex: 1;
        font-size: 13.5px;
        color: var(--bme-ink);
        min-width: 0;
    }

    .feed-ref { color: var(--bme-dark-blue); font-weight: 600; }

    .feed-time {
        flex: 0 0 auto;
        font-size: 12px;
        color: var(--bme-muted);
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
            grid-template-columns: auto 1fr; 
            row-gap: 6px; 
            column-gap: 0; 
            align-items: start;
        }

        .ag-l, .ag-t {
            font-size: 12px;
        }

        .ag-meta { 
            grid-column: 2; 
        }

        .ag-sla { 
            grid-column: 2; 
        }
    }
    
    @media (max-width: 720px) {
        .ua-stats { 
            grid-template-columns: repeat(2, 1fr); 
        }

        .spark { 
            height: 104px; 
            overflow-x: auto;
            white-space: nowrap;
        }

        .spark-x { 
            font-size: 9px; 
        }
    }
</style>