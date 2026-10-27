<script lang="ts">
    let {
        maps,
        cols,
        rows
    }: {
        maps: { label: string; moves: number[]; clicks: number[]; samples: number }[];
        cols: number;
        rows: number;
    } = $props();

    let selected = $state(0);
    let mode = $state<'moves' | 'clicks'>('moves');

    let current = $derived(maps[Math.min(selected, maps.length - 1)]);
    let cells = $derived(current ? current[mode] : []);
    let max = $derived(Math.max(1, ...cells));
    let totalCount = $derived(cells.reduce((s, n) => s + n, 0));

    function fill(n: number): string {
        if (!n) return 'var(--bme-surface-2)';
        const pct = Math.round(18 + (n / max) * 82);
        return `color-mix(in oklab, var(--seq) ${pct}%, var(--bme-surface))`;
    }
</script>

{#if maps.length === 0}
    <p class="empty">No pointer data yet. It appears once users browse pages with a mouse.</p>
{:else}
    <div class="controls">
        <label>
            <span>Page</span>
            <select bind:value={selected} data-track-ignore>
                {#each maps as m, i (m.label)}
                    <option value={i}>{m.label} - {m.samples} visit(s)</option>
                {/each}
            </select>
        </label>
        <div class="seg" role="group" aria-label="Heatmap type">
            <button type="button" data-track-ignore class:on={mode === 'moves'} onclick={() => (mode = 'moves')}>Mouse movement</button>
            <button type="button" data-track-ignore class:on={mode === 'clicks'} onclick={() => (mode = 'clicks')}>Clicks</button>
        </div>
    </div>

    <div class="screen" style="grid-template-columns: repeat({cols}, 1fr); aspect-ratio: {cols * 1.6} / {rows}">
        {#each cells as n, i (i)}
            <div class="cell" style="background:{fill(n)}" title="{n} {mode === 'moves' ? 'mouse samples' : 'clicks'}"></div>
        {/each}
    </div>
    <div class="foot">
        <span>Top of screen ↑ · {totalCount} {mode === 'moves' ? 'mouse samples' : 'clicks'}</span>
        <span class="scale">Less <i></i> More</span>
    </div>
{/if}

<style>
    .empty {
        margin: 0;
        font-size: 13px;
        color: var(--bme-muted);
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px 16px;
        margin-bottom: 12px;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1 1 200px;
    }

    label span {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--bme-muted);
        font-weight: 600;
    }

    select {
        padding: 7px 10px;
    }

    .seg {
        display: inline-flex;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        overflow: hidden;
    }

    .seg button {
        padding: 7px 12px;
        border: none;
        background: var(--bme-surface);
        color: var(--bme-muted);
        font: inherit;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
    }

    .seg button.on {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .screen {
        max-width: 760px;
        margin: 0 auto;
        display: grid;
        gap: 2px;
        width: 100%;
        padding: 2px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        background: var(--bme-surface);
    }

    .cell {
        border-radius: 3px;
        min-height: 8px;
    }

    .foot {
        max-width: 760px;
        margin-left: auto;
        margin-right: auto;
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        font-size: 11.5px;
        color: var(--bme-muted);
    }

    .scale {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .scale i {
        width: 80px;
        height: 8px;
        border-radius: 4px;
        background: linear-gradient(90deg, color-mix(in oklab, var(--seq) 18%, var(--bme-surface)), var(--seq));
    }
</style>