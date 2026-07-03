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
                        <SlaBadge since={a.since} businessHours />
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
                    <span class="bar-val">{fmtDur(l.avgMs)} <small>({l.count})</small></span>
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
{/if}

<style>
    h1 {
        margin-bottom: 18px;
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

    .bar-key {
        font-size: 13px;
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

    .bar-val {
        font-size: 13px;
        font-weight: 700;
        color: var(--bme-ink);
        white-space: nowrap;
    }

    .bar-val small {
        color: var(--bme-muted);
        font-weight: 600;
    }

    .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
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

    .ag-meta { 
        font-size: 13px; 
        color: var(--bme-muted); 
    }

    @media (max-width: 860px) {
        .grid2 {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 480px) {
        .stats {
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
            grid-template-columns: auto 1fr auto; }

        .ag-meta { 
            grid-column: 1 / -1; 
        }
    }
</style>