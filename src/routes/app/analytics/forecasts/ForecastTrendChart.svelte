<script lang="ts">
    type HistoryPoint = { month: string; qty: number };

    let {
        history = [] as HistoryPoint[], 
        predicted = 0, 
        lower = null as number | null,
        upper = null as number | null, 
        width = 260, 
        height = 64 
    } = $props();

    const PAD = { top: 8, right: 8, bottom: 8, left: 8 };

    const totalPoints = $derived(history.length + 1);

    // Y domain spans only the values actually present (plus the range band), so
    // the series is vertically centred in the box instead of being pinned to
    // the top edge whenever the data sits near its own maximum.
    const domain = $derived.by(() => {
        const vals = [...history.map((h) => h.qty), predicted];
        if (lower != null) vals.push(lower);
        if (upper != null) vals.push(upper);
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        if (hi === lo) return { lo: lo - 1, hi: hi + 1 };   // flat -> centre it
        const pad = (hi - lo) * 0.15;                        // breathing room
        return { lo: lo - pad, hi: hi + pad };
    });

    const innerW = $derived(width - PAD.left - PAD.right);
    const innerH = $derived(height - PAD.top - PAD.bottom);

    const xAt = $derived((i: number) => totalPoints <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (totalPoints - 1)) * innerW);
    const yAt = $derived((v: number) =>
        PAD.top + innerH - ((v - domain.lo) / (domain.hi - domain.lo)) * innerH
    );

    const observedPts = $derived(history.map((h, i) => ({ x: xAt(i), y: yAt(h.qty), ...h })));
    const forecastPt = $derived({ x: xAt(totalPoints - 1), y: yAt(predicted) });

    const linePath = $derived(
        observedPts.length 
            ? observedPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') 
            : ''
    );

    const forecastPath = $derived(
        observedPts.length 
            ? `M${observedPts[observedPts.length - 1].x.toFixed(1)},${observedPts[observedPts.length -1].y.toFixed(1)} ` + 
              `L${forecastPt.x.toFixed(1)},${forecastPt.y.toFixed(1)}` 
            : ''
    );

    const bandTop = $derived(upper != null ? yAt(upper) : null);
    const bandBottom = $derived(lower != null ? yAt(lower) : null);

    const fmtMonth = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-MY', { month: 'short', year: '2-digit' });
</script>

{#if history.length === 0}
    <span class="no-data">no history</span>
{:else}
    <svg 
        {width} 
        {height} 
        viewBox="0 0 {width} {height}" 
        role="img" 
        aria-label="Demand trend: {history.length} observed months, forecast {predicted}"
    >
        <!-- {#if bandTop != null && bandBottom != null && bandBottom - bandTop > 0.5}
            <rect 
                x={forecastPt.x - 4} 
                y={bandTop} 
                width="8" 
                height={Math.max(1, bandBottom - bandTop)} 
                fill="var(--bme-green, #6cb33f)" 
                opacity="0.18" 
                rx="2"
            />
        {/if} -->

        <path 
            d={linePath} 
            fill="none" 
            stroke="var(--bme-dark-blue, #004b8d)" 
            stroke-width="2" 
            stroke-linejoin="round" 
            stroke-linecap="round" 
        />

        <path 
            d={forecastPath} 
            fill="none" 
            stroke="var(--bme-green, #6cb33f)" 
            stroke-width="2" 
            stroke-dasharray="4 3" 
            stroke-linecap="round"
        />

        {#each observedPts as p (p.month)}
            <circle cx={p.x} cy={p.y} r="2.5" fill="var(--bme-dark-blue, #004b8d)">
                <title>{fmtMonth(p.month)}: {p.qty}</title>
            </circle>
        {/each}

        <circle cx={forecastPt.x} cy={forecastPt.y} r="3.5" fill="#ffffff" stroke="var(--bme-green, #6cb33f)" stroke-width="2">
            <title>Forecast: {predicted}</title>
        </circle>
    </svg>
{/if}

<style>
    svg {
        display: block;
        overflow: hidden;
        margin: 0 auto;
    }

    .no-data {
        color: #9ca3af;
        font-size: 0.75rem;
        font-style: italic;
    }
</style>