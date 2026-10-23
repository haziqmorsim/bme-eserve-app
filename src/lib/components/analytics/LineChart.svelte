<script lang="ts">
    let {
        data,
        series,
        height = 200,
        colorOf = (i: number) => `var(--line-${i + 1})`,
        caption = ''
    }: {
        data: { label: string; values: number[] }[];
        series: { label: string }[];
        height?: number;
        colorOf?: (i: number) => string;
        caption?: string;
    } = $props();

    let width = $state(600);
    let hover = $state<number | null>(null);

    const PAD_L = 32;
    const PAD_R = 10;
    const PAD_T = 10;
    const PAD_B = 22;

    function niceMax(n: number): number {
        if (n <= 4) return 4;
        const pow = Math.pow(10, Math.floor(Math.log10(n)));
        for (const s of [1, 2, 2.5, 5, 10]) if (s * pow >= n) return s * pow;
        return 10 * pow;
    }

    let max = $derived(niceMax(Math.max(1, ...data.flatMap((d) => d.values))));
    let innerW = $derived(Math.max(10, width - PAD_L - PAD_R));
    let innerH = $derived(height - PAD_T - PAD_B);
    let x = $derived((i: number) => PAD_L + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW));
    let y = $derived((v: number) => PAD_T + innerH - (v / max) * innerH);
    let paths = $derived(
        series.map((_, si) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.values[si] ?? 0).toFixed(1)}`).join(''))
    );
    let labelEvery = $derived(Math.max(1, Math.ceil(data.length / 7)));

    function onMove(e: PointerEvent) {
        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * width;
        const i = Math.round(((px - PAD_L) / innerW) * (data.length - 1));
        hover = Math.max(0, Math.min(data.length - 1, i));
    }
</script>

<div class="lc" bind:clientWidth={width}>
    <div class="legend">
        {#each series as s, i (s.label)}
            <span class="lg"><i style="background:{colorOf(i)}"></i>{s.label}</span>
        {/each}
    </div>
    <svg
        viewBox="0 0 {width} {height}"
        width="100%"
        {height}
        role="img"
        aria-label={caption || 'Line chart'}
        onpointermove={onMove}
        onpointerleave={() => (hover = null)}
    >
        {#each [0, 0.5, 1] as f (f)}
            <line class="grid" x1={PAD_L} x2={width - PAD_R} y1={y(max * f)} y2={y(max * f)} />
            <text class="tick" x={PAD_L - 6} y={y(max * f) + 4} text-anchor="end">{Math.round(max * f)}</text>
        {/each}
        {#each data as d, i (i)}
            {#if i % labelEvery === 0 || i === data.length - 1}
                <text class="tick" x={x(i)} y={height - 6} text-anchor="middle">{d.label}</text>
            {/if}
        {/each}
        {#each paths as p, si (si)}
            <path d={p} fill="none" stroke={colorOf(si)} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {/each}
        {#if hover !== null}
            <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + innerH} />
            {#each series as _, si (si)}
                <circle cx={x(hover)} cy={y(data[hover].values[si] ?? 0)} r="4.5" fill={colorOf(si)} class="dot" />
            {/each}
        {/if}
    </svg>
    {#if hover !== null}
        <div class="tip" class:right={x(hover) > width * 0.6} style="left:{(x(hover) / width) * 100}%">
            <div class="tip-h">{data[hover].label}</div>
            {#each series as s, si (s.label)}
                <div class="tip-r"><i style="background:{colorOf(si)}"></i>{s.label}<span>{data[hover].values[si] ?? 0}</span></div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .lc {
        position: relative;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin-bottom: 6px;
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
        width: 12px;
        height: 3px;
        border-radius: 2px;
    }

    svg {
        display: block;
        overflow: visible;
        touch-action: pan-y;
    }

    .grid {
        stroke: var(--bme-border);
        stroke-width: 1;
    }

    .tick {
        font-size: 10.5px;
        fill: var(--bme-muted);
        font-variant-numeric: tabular-nums;
    }

    .cross {
        stroke: var(--bme-muted);
        stroke-width: 1;
        stroke-dasharray: 3 3;
    }

    .dot {
        stroke: var(--bme-surface);
        stroke-width: 2;
    }

    .tip {
        position: absolute;
        top: 24px;
        transform: translateX(10px);
        z-index: 5;
        min-width: 150px;
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
        transform: translateX(calc(-100% - 10px));
    }

    .tip-h {
        margin-bottom: 4px;
        color: var(--bme-muted);
    }

    .tip-r {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .tip-r span {
        margin-left: auto;
        padding-left: 12px;
        font-weight: 600;
    }
</style>