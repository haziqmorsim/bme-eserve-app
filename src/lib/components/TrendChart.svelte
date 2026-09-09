<script lang="ts">
    import type { TrendPoint, TrendSeries } from '$lib/telemetry';

    let {
        series = [],
        height = 150,
        fill = true,
        yTicks = 5,
        tickHours = 1
    } = $props<{
        series?: TrendSeries[];
        height?: number;
        fill?: boolean;
        yTicks?: number;
        tickHours?: number;
    }>();

    const PAD_L = 40;
    const PAD_R = 16;
    const PAD_T = 10;
    const PAD_B = 22;

    const TICK_PX = 96;
    const MIN_W = 640;

    let vh = $derived(height);

    let spanHours = $derived.by(() => {
        if (basePoints.length < 2) return 24;
        const a = new Date(basePoints[0].t).getTime();
        const b = new Date(basePoints[basePoints.length - 1].t).getTime();
        return Math.max(0.5, (b - a) / 3600000);
    });

    let VW = $derived(
        Math.max(MIN_W, Math.round(PAD_L + PAD_R + (spanHours / Math.max(tickHours, 0.5)) * TICK_PX))
    );

    let plotW = $derived(VW - PAD_L - PAD_R);
    let plotH = $derived(vh - PAD_T - PAD_B);

    let basePoints = $derived.by(() => {
        let longest: TrendPoint[] = [];
        for (const s of series) if ((s.points?.length ?? 0) > longest.length) longest = s.points;
        return longest;
    });

    let n = $derived(basePoints.length);

    let bounds = $derived.by(() => {
        let lo = Infinity, hi = -Infinity;
        for (const s of series) for (const p of s.points ?? []) {
            if (p.v < lo) lo = p.v;
            if (p.v > hi) hi = p.v;
        }
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
        if (lo === hi) return { lo: lo - 1, hi: hi + 1 };
        const pad = (hi - lo) * 0.08;
        return { lo: lo - pad, hi: hi + pad };
    });

    const xAt = (i: number, count: number) => PAD_L + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
    const yAt = (v: number) => {
        const { lo, hi } = bounds;
        return PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
    };

    function linePath(pts: TrendPoint[]): string {
        if (!pts.length) return '';
        return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, pts.length).toFixed(2)},${yAt(p.v).toFixed(2)}`).join(' ');
    }

    function areaPath(pts: TrendPoint[]): string {
        if (!pts.length) return '';
        const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i, pts.length).toFixed(2)},${yAt(p.v).toFixed(2)}`).join(' ');
        const x0 = xAt(0, pts.length).toFixed(2);
        const x1 = xAt(pts.length - 1, pts.length).toFixed(2);
        const yBase = (PAD_T + plotH).toFixed(2);
        return `${top} L${x1},${yBase} L${x0},${yBase} Z`;
    }

    let yLabels = $derived.by(() => {
        const { lo, hi } = bounds;
        const out: { y: number; text: string }[] = [];
        for (let i = 0; i < yTicks; i++) {
            const v = lo + ((hi - lo) * i) / (yTicks - 1);
            const abs = Math.abs(v);
            out.push({ y: yAt(v), text: abs >= 100 ? v.toFixed(0) : abs >= 10 ? v.toFixed(0) : v.toFixed(1) });
        }
        return out;
    });

    const hhmm = (iso: string) => {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    let tStart = $derived(basePoints.length ? new Date(basePoints[0].t).getTime() : 0);
    let tEnd = $derived(basePoints.length ? new Date(basePoints[basePoints.length - 1].t).getTime() : 0);

    const xAtTime = (ms: number) =>
        tEnd === tStart ? PAD_L + plotW / 2 : PAD_L + ((ms - tStart) / (tEnd - tStart)) * plotW;

    let xLabels = $derived.by(() => {
        if (n < 2) return [];
        const step = Math.max(1, Math.round(tickHours));
        const stepMs = step * 3600000;
        const d = new Date(tStart);
        d.setMinutes(0, 0, 0);
        let ms = d.getTime();
        if (ms < tStart) ms += 3600000;
        let guard = 0;
        while (new Date(ms).getHours() % step !== 0 && ms <= tEnd && guard++ < 24) {
            ms += 3600000;
        }
        const out: { x: number; text: string }[] = [];
        for (; ms <= tEnd; ms += stepMs) {
            out.push({ x: xAtTime(ms), text: hhmm(new Date(ms).toISOString()) });
        }
        return out;
    });

    let hoverIdx = $state<number | null>(null);

    function onMove(e: PointerEvent) {
        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        if (!rect.width || n < 2) return;
        const vx = ((e.clientX - rect.left) / rect.width) * VW;
        const ratio = (vx - PAD_L) / plotW;
        const idx = Math.round(ratio * (n - 1));
        hoverIdx = Math.max(0, Math.min(n - 1, idx));
    }

    const clearHover = () => (hoverIdx = null);

    let hoverX = $derived(hoverIdx === null ? 0 : xAt(hoverIdx, n));
    let tipLeft = $derived(hoverX > VW * 0.62);
</script>

<div class="tc">
    <div class="scroll">
    <svg
        viewBox={`0 0 ${VW} ${vh}`}
        width={VW}
        height={vh}
        role="img"
        aria-label={series.map((s: TrendSeries) => s.label).join(', ')}
        onpointermove={onMove}
        onpointerleave={clearHover}
    >
        <defs>
            {#each series as s (s.key)}
                <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color={s.colour} stop-opacity="0.30" />
                    <stop offset="100%" stop-color={s.colour} stop-opacity="0" />
                </linearGradient>
            {/each}
        </defs>

        {#each yLabels as g (g.text + g.y)}
            <line class="grid" x1={PAD_L} y1={g.y} x2={VW - PAD_R} y2={g.y} />
            <text class="axis" x={PAD_L - 6} y={g.y + 3} text-anchor="end">{g.text}</text>
        {/each}

        {#each xLabels as g, i (i)}
            <text class="axis" x={g.x} y={vh - 6} text-anchor="middle">{g.text}</text>
        {/each}

        {#if fill && series.length === 1}
            <path d={areaPath(series[0].points)} fill={`url(#g-${series[0].key})`} />
        {/if}

        {#each series as s (s.key)}
            <path class="ln" d={linePath(s.points)} stroke={s.colour} />
        {/each}

        {#if hoverIdx !== null}
            <line class="cross" x1={hoverX} y1={PAD_T} x2={hoverX} y2={PAD_T + plotH} />
            {#each series as s (s.key)}
                {#if s.points[hoverIdx]}
                    <circle cx={hoverX} cy={yAt(s.points[hoverIdx].v)} r="4" fill={s.colour} stroke="var(--bme-surface)" stroke-width="1.5" />
                {/if}
            {/each}
        {/if}
    </svg>

    {#if hoverIdx !== null && basePoints[hoverIdx]}
        <div class="tip" class:left={tipLeft} style={`left:${hoverX}px`}>
            <span class="tip-t">{hhmm(basePoints[hoverIdx].t)}</span>
            {#each series as s (s.key)}
                {#if s.points[hoverIdx]}
                    <span class="tip-r">
                        <span class="dot" style={`background:${s.colour}`}></span>
                        <span class="tip-l">{s.label}</span>
                        <span class="tip-v">{s.points[hoverIdx].v}{s.unit ? ` ${s.unit}` : ''}</span>
                    </span>
                {/if}
            {/each}
        </div>
    {/if}
    </div>
</div>

<style>
    .tc {
        position: relative;
        width: 100%;
    }

    .scroll {
        overflow-x: auto;
        overflow-y: hidden;
        position: relative;
        scrollbar-width: thin;
    }

    svg {
        display: block;
        max-width: none;
        touch-action: pan-x;
    }

    .grid {
        stroke: var(--bme-border);
        stroke-width: 1;
        opacity: 0.5;
    }

    .axis {
        fill: var(--bme-muted);
        font-size: 10px;
        font-family: inherit;
    }

    .ln {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
    }

    .cross {
        stroke: var(--bme-muted);
        stroke-width: 1;
        stroke-dasharray: 3 3;
    }

    .tip {
        position: absolute;
        top: 6px;
        transform: translateX(10px);
        pointer-events: none;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
        white-space: nowrap;
        z-index: 2;
    }

    .tip.left {
        transform: translateX(-100%) translateX(-10px);
    }

    .tip-t {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--bme-ink);
    }

    .tip-r {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: 0 0 auto;
    }

    .tip-l {
        color: var(--bme-muted);
    }

    .tip-v {
        margin-left: auto;
        font-weight: 700;
        color: var(--bme-ink);
    }
</style>