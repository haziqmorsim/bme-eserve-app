<script lang="ts">
    let {
        items,
        colorOf = (i: number) => `var(--cat-${i + 1})`,
        centerLabel = 'total',
        empty = 'No data yet.'
    }: {
        items: { label: string; value: number }[];
        colorOf?: (i: number) => string;
        centerLabel?: string;
        empty?: string;
    } = $props();

    const R = 54;
    const C = 2 * Math.PI * R;
    const GAP = 2;

    let hover = $state<number | null>(null);
    let total = $derived(items.reduce((s, it) => s + it.value, 0));
    let slices = $derived.by(() => {
        let offset = 0;
        return items.map((it) => {
            const len = total ? (it.value / total) * C : 0;
            const slice = { len: Math.max(0, len - (items.length > 1 ? GAP : 0)), offset };
            offset += len;
            return slice;
        });
    });
    const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
</script>

{#if total === 0}
    <p class="empty">{empty}</p>
{:else}
    <div class="donut">
        <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Donut chart">
            <circle cx="70" cy="70" r={R} class="track" />
            {#each slices as s, i (i)}
                {#if s.len > 0}
                    <circle
                        cx="70"
                        cy="70"
                        r={R}
                        fill="none"
                        stroke={colorOf(i)}
                        stroke-width={hover === i ? 22 : 18}
                        stroke-dasharray="{s.len} {C - s.len}"
                        stroke-dashoffset={-s.offset}
                        transform="rotate(-90 70 70)"
                        class:dim={hover !== null && hover !== i}
                        role="presentation"
                        onmouseenter={() => (hover = i)}
                        onmouseleave={() => (hover = null)}
                    />
                {/if}
            {/each}
            <text x="70" y="68" text-anchor="middle" class="c-val">{hover === null ? total : items[hover].value}</text>
            <text x="70" y="86" text-anchor="middle" class="c-lbl">
                {hover === null ? centerLabel : `${pct(items[hover].value)}%`}
            </text>
        </svg>
        <ul class="list">
            {#each items as it, i (it.label)}
                <li
                    class:active={hover === i}
                    onmouseenter={() => (hover = i)}
                    onmouseleave={() => (hover = null)}
                >
                    <i style="background:{colorOf(i)}"></i>
                    <span class="lbl">{it.label}</span>
                    <span class="num">{it.value}</span>
                    <span class="pct">{pct(it.value)}%</span>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<style>
    .empty {
        margin: 0;
        font-size: 13px;
        color: var(--bme-muted);
    }

    .donut {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
    }

    svg {
        flex: 0 0 auto;
    }

    .track {
        fill: none;
        stroke: var(--bme-surface-2);
        stroke-width: 18;
    }

    circle {
        transition: stroke-width 120ms ease, opacity 120ms ease;
    }

    circle.dim {
        opacity: 0.4;
    }

    .c-val {
        font-size: 22px;
        font-weight: 700;
        fill: var(--bme-ink);
    }

    .c-lbl {
        font-size: 11px;
        fill: var(--bme-muted);
    }

    .list {
        flex: 1 1 160px;
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: var(--bme-ink);
    }

    li {
        display: grid;
        grid-template-columns: 10px 1fr auto 40px;
        align-items: center;
        gap: 8px;
        padding: 2px 4px;
        border-radius: 6px;
    }

    li.active {
        background: var(--bme-surface-2);
    }

    li i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
    }

    .num {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .pct {
        text-align: right;
        color: var(--bme-muted);
        font-variant-numeric: tabular-nums;
    }

    .lbl {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 640px) {
        .donut {
            flex-wrap: nowrap;
            gap: 10px;
        }

        svg {
            width: 92px;
            height: 92px;
        }

        .list {
            flex: 1 1 0;
            min-width: 0;
            gap: 4px;
            font-size: 12px;
        }

        li {
            grid-template-columns: 8px minmax(0, 1fr) auto 34px;
            gap: 5px;
            padding: 2px 2px;
        }

        li i {
            width: 8px;
            height: 8px;
        }
    }
</style>