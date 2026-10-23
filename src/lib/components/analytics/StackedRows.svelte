<script lang="ts">
    let {
        rows,
        series,
        colorOf = (i: number) => `var(--cat-${i + 1})`,
        showLegend = true,
        empty = 'No data yet.'
    }: {
        rows: { name: string; sub?: string | null; values: number[] }[];
        series: { label: string }[];
        colorOf?: (i: number) => string;
        showLegend?: boolean;
        empty?: string;
    } = $props();

    let hover = $state<number | null>(null);
    const sum = (v: number[]) => v.reduce((s, n) => s + n, 0);
    let totals = $derived(rows.map((r) => sum(r.values)));
    let max = $derived(Math.max(1, ...totals));
    let used = $derived(series.map((_, i) => rows.some((r) => (r.values[i] ?? 0) > 0)));
</script>

{#if rows.length === 0}
    <p class="empty">{empty}</p>
{:else}
    {#if showLegend}
        <div class="legend">
            {#each series as s, i (s.label)}
                {#if used[i]}<span class="lg"><i style="background:{colorOf(i)}"></i>{s.label}</span>{/if}
            {/each}
        </div>
    {/if}
    <div class="rows">
        {#each rows as r, ri (r.name + ri)}
            <div
                class="row"
                onmouseenter={() => (hover = ri)}
                onmouseleave={() => (hover = null)}
                role="presentation"
            >
                <span class="name" title={r.name}>{r.name}{#if r.sub}<small>&nbsp;({r.sub})</small>{/if}</span>
                <span class="track">
                    <span class="bar" style="width:{(totals[ri] / max) * 100}%">
                        {#each r.values as v, vi (vi)}
                            {#if v > 0}<span class="seg" style="flex:{v} 1 0; background:{colorOf(vi)}"></span>{/if}
                        {/each}
                    </span>
                </span>
                <span class="val">{totals[ri]}</span>
                {#if hover === ri}
                    <div class="tip">
                        {#each series as s, i (s.label)}
                            {#if r.values[i]}
                                <div class="tip-r"><i style="background:{colorOf(i)}"></i>{s.label}<span>{r.values[i]}</span></div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .empty {
        margin: 0;
        font-size: 13px;
        color: var(--bme-muted);
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin-bottom: 12px;
        font-size: 12px;
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

    .rows {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .row {
        position: relative;
        display: grid;
        grid-template-columns: minmax(110px, 190px) 1fr auto;
        align-items: center;
        gap: 12px;
    }

    .name {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--bme-ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .name small {
        font-weight: 400;
        color: var(--bme-muted);
    }

    .track {
        display: block;
        min-width: 0;
    }

    .bar {
        display: flex;
        gap: 2px;
        height: 14px;
        min-width: 4px;
        border-radius: 0 4px 4px 0;
        overflow: hidden;
    }

    .seg {
        min-width: 2px;
    }

    .val {
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
        font-variant-numeric: tabular-nums;
    }

    .tip {
        position: absolute;
        right: 40px;
        top: calc(100% + 4px);
        z-index: 5;
        min-width: 180px;
        padding: 8px 10px;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        font-size: 12px;
        color: var(--bme-ink);
        pointer-events: none;
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
    }

    @media (max-width: 480px) {
        .row {
            grid-template-columns: 1fr auto;
            gap: 4px 10px;
        }

        .name {
            grid-column: 1 / -1;
        }
    }
</style>