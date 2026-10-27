<script lang="ts">
    let {
        data,
        series,
        height = 200,
        colorOf = (i: number) => `var(--cat-${i + 1})`,
        caption = ''
    }: {
        data: { label: string; values: number[] }[];
        series: { label: string }[];
        height?: number;
        colorOf?: (i: number) => string;
        caption?: string;
    } = $props();

    let hover = $state<number | null>(null);
    let showTable = $state(false);

    const sum = (v: number[]) => v.reduce((s, n) => s + n, 0);

    function niceMax(n: number): number {
        if (n <= 4) return 4;
        const pow = Math.pow(10, Math.floor(Math.log10(n)));
        const steps = [1, 2, 2.5, 5, 10];
        for (const s of steps) if (s * pow >= n) return s * pow;
        return 10 * pow;
    }

    let totals = $derived(data.map((d) => sum(d.values)));
    let max = $derived(niceMax(Math.max(1, ...totals)));
    let seriesTotals = $derived(series.map((_, i) => sum(data.map((d) => d.values[i] ?? 0))));
    let labelEvery = $derived(Math.max(1, Math.ceil(data.length / 8)));
    let ticks = $derived([max, max / 2, 0]);
    let tipLeft = $derived(hover === null ? 0 : ((hover + 0.5) / Math.max(1, data.length)) * 100);
</script>

<div class="sc">
    <div class="legend" aria-label="Legend">
        {#each series as s, i (s.label)}
            <span class="lg"><i style="background:{colorOf(i)}"></i>{s.label}<b>{seriesTotals[i]}</b></span>
        {/each}
        <button type="button" class="tbl-btn" data-track-ignore onclick={() => (showTable = !showTable)}>
            {showTable ? 'Show chart' : 'Show table'}
        </button>
    </div>

    {#if showTable}
        <div class="tbl-wrap">
            <table>
                <thead>
                    <tr><th>Day</th>{#each series as s (s.label)}<th>{s.label}</th>{/each}<th>Total</th></tr>
                </thead>
                <tbody>
                    {#each data as d, di (d.label + di)}
                        <tr><td>{d.label}</td>{#each d.values as v, vi (vi)}<td>{v}</td>{/each}<td><b>{totals[di]}</b></td></tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <div class="plot" style="height:{height}px" role="img" aria-label={caption || 'Stacked column chart'}>
            <div class="grid">
                {#each ticks as t, i (i)}
                    <div class="gl" style="bottom:{(t / max) * 100}%"><span>{t}</span></div>
                {/each}
            </div>
            <div class="cols" onmouseleave={() => (hover = null)} role="presentation">
                {#each data as d, di (d.label + di)}
                    <div
                        class="col"
                        class:dim={hover !== null && hover !== di}
                        onmouseenter={() => (hover = di)}
                        onfocus={() => (hover = di)}
                        onblur={() => (hover = null)}
                        tabindex="-1"
                        role="presentation"
                    >
                        <div class="stack" style="height:{(totals[di] / max) * 100}%">
                            {#each d.values as v, vi (vi)}
                                {#if v > 0}
                                    <div class="seg" style="flex:{v} 1 0; background:{colorOf(vi)}"></div>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
            {#if hover !== null}
                <div class="tip" class:right={tipLeft > 60} style="left:{tipLeft}%">
                    <div class="tip-h">{data[hover].label} · <b>{totals[hover]}</b></div>
                    {#each series.map((s, i) => ({ s, i })).reverse() as { s, i } (s.label)}
                        {#if data[hover].values[i]}
                            <div class="tip-r"><i style="background:{colorOf(i)}"></i>{s.label}<span>{data[hover].values[i]}</span></div>
                        {/if}
                    {/each}
                    {#if !totals[hover]}<div class="tip-r muted">No activity</div>{/if}
                </div>
            {/if}
        </div>
        <div class="xl">
            {#each data as d, di (d.label + di)}
                <span>{di % labelEvery === 0 || (di === data.length - 1 && di % labelEvery >= labelEvery / 2) ? d.label : ''}</span>
            {/each}
        </div>
    {/if}
</div>

<style>
    .sc {
        position: relative;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 16px;
        margin-bottom: 12px;
        font-size: 12.5px;
        color: var(--bme-ink);
    }

    .lg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .lg i,
    .tip-r i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex: 0 0 auto;
    }

    .lg b {
        color: var(--bme-muted);
        font-weight: 600;
    }

    .tbl-btn {
        margin-left: auto;
        padding: 4px 10px;
        border: 1px solid var(--bme-border);
        border-radius: 6px;
        background: var(--bme-surface);
        color: var(--bme-ink);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }

    .plot {
        position: relative;
        margin-left: 30px;
    }

    .grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .gl {
        position: absolute;
        left: 0;
        right: 0;
        border-top: 1px solid var(--bme-border);
    }

    .gl span {
        position: absolute;
        left: -30px;
        top: -8px;
        width: 26px;
        text-align: right;
        font-size: 11px;
        color: var(--bme-muted);
        font-variant-numeric: tabular-nums;
    }

    .cols {
        position: absolute;
        inset: 0;
        display: flex;
        gap: 2px;
        align-items: stretch;
    }

    .col {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        align-items: flex-end;
        cursor: default;
        outline: none;
    }

    .col.dim .stack {
        opacity: 0.45;
    }

    .stack {
        width: 100%;
        max-width: 26px;
        margin: 0 auto;
        display: flex;
        flex-direction: column-reverse;
        gap: 2px;
        border-radius: 4px 4px 0 0;
        overflow: hidden;
        transition: opacity 120ms ease;
    }

    .seg {
        min-height: 2px;
    }

    .xl {
        display: flex;
        gap: 2px;
        margin: 6px 0 0 30px;
    }

    .xl span {
        flex: 1 1 0;
        min-width: 0;
        font-size: 10.5px;
        color: var(--bme-muted);
        text-align: center;
        white-space: nowrap;
        overflow: visible;
    }

    .tip {
        position: absolute;
        top: 0;
        transform: translateX(8px);
        z-index: 5;
        min-width: 170px;
        padding: 8px 10px;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        font-size: 12px;
        color: var(--bme-ink);
        pointer-events: none;
    }

    .tip.right {
        transform: translateX(calc(-100% - 8px));
    }

    .tip-h {
        margin-bottom: 4px;
        color: var(--bme-muted);
    }

    .tip-h b {
        color: var(--bme-ink);
    }

    .tip-r {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 1px 0;
    }

    .tip-r span {
        margin-left: auto;
        padding-left: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .muted {
        color: var(--bme-muted);
    }

    .tbl-wrap {
        max-height: 320px;
        overflow: auto;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
    }

    th,
    td {
        padding: 6px 8px;
        text-align: center;
        border-bottom: 1px solid var(--bme-border);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }

    th:first-child,
    td:first-child {
        text-align: left;
    }

    th {
        position: sticky;
        top: 0;
        background: var(--bme-surface-2);
        color: var(--bme-muted);
        font-weight: 600;
    }
</style>