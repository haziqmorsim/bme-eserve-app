<script lang="ts">
    import ForecastTrendChart from "./ForecastTrendChart.svelte";
    import { Undo2 } from "@lucide/svelte";

    let { data } = $props();

    /* -------- Section 1: regional demand forecast -------- */
    const regions = $derived(Object.entries(data.byRegion));
    const fmtQty = (n: number | null) => (n == null ? '\u2014' : Number(n).toLocaleString());
    const fmtDate = (s: string | null) => s
        ? new Date(s + 'T00:00:00Z').toLocaleDateString('en-MY', { year: 'numeric', month: 'long' }) 
        : '\u2014';

    /* -------- Section 2: predictive replacement schedule -------- */
    let showLater = $state(false);

    const visible = $derived(
        showLater ? data.replacements : data.replacements.filter((i) => i.bucket !== 'later')
    );

    const fmtDay = (s: string) => 
        new Date(s + 'T00:00:00').toLocaleDateString('en-MY', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });

    const dueLabel = (d: number) => {
        if (d < 0) return `${Math.abs(d)} days overdue`;
        if (d === 0) return 'Due today';
        if (d === 1) return 'Due tomorrow';
        return `in ${d} days`;
    };

    const months = (d: number) => (d / 30.44).toFixed(1);
</script>

<div class="head">
    <h1>Forecasts</h1>
    <a href="/app/analytics">
        <button class="btn-primary"><Undo2 size={16} /> Back to Analytics</button>
    </a>
</div>

<section class="wrap">
    <header>
        <h2>Regional demand forecast</h2>
        {#if data.period}
            <p class="sub">
                Projected for {fmtDate(data.period)}
                {#if data.forecastGeneratedAt}· Generated at {new Date(data.forecastGeneratedAt).toLocaleString('en-MY')}{/if}
            </p>
        {/if}
        <div class="legend">
            <span><i class="swatch solid"></i>Observed monthly demand</span>
            <span><i class="swatch dashed"></i>WMA forecast</span>
            <span><i class="swatch band"></i>Range</span>
        </div>
    </header>

    {#if regions.length === 0}
        <p class="empty">No forecasts yet. They appear after the weekly job runs.</p>
    {:else}
        {#each regions as [region, rows] (region)}
            <div class="region">
                <h3>{region}</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: center;">Part</th>
                            <th class="chart-col">Trend</th>
                            <th class="num">Predicted</th>
                            <th class="num">Range</th>
                            <th class="num">History</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each rows as f (f.part_number + f.region_id)}
                            <tr>
                                <td style="width: 30%;">
                                    <span class="pn">{f.part_number ?? '\u2014'}</span>
                                    <span class="nm">{f.part_name ?? '\u2014'}</span>
                                </td>
                                <td class="chart-col">
                                    <ForecastTrendChart
                                        history={f.history} 
                                        predicted={f.predicted_qty} 
                                        lower={f.lower_qty} 
                                        upper={f.upper_qty}
                                    />
                                </td>
                                <td class="num strong">
                                    {fmtQty(f.predicted_qty)}
                                    <svg
                                        class="dir {f.direction}"
                                        viewBox="0 0 24 24"
                                        role="img"
                                        aria-label={f.direction === 'up'
                                            ? 'Trending up'
                                            : f.direction === 'down'
                                              ? 'Trending down'
                                              : 'Trend flat'}
                                    >
                                        {#if f.direction === 'up'}
                                            <path d="M12 20 V5 M5 12 L12 5 L19 12" />
                                        {:else if f.direction === 'down'}
                                            <path d="M12 4 V19 M5 12 L12 19 L19 12" />
                                        {:else}
                                            <path d="M4 12 H19 M12 5 L19 12 L12 19" />
                                        {/if}
                                    </svg>
                                </td>
                                <td class="num muted">{fmtQty(f.lower_qty)} - {fmtQty(f.upper_qty)}</td>
                                <td class="num">
                                    <span class="hist" class:thin={f.history_months < 3}>
                                        {f.history_months} month(s)
                                    </span> 
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/each}
    {/if}
</section>

<section class="wrap">
    <header>
        <h2>Predicted replacements</h2>
        <p class="sub">
            Estimated from past order intervals for each boiler and part.
            {#if data.replacementGeneratedAt}
                · Generated at {new Date(data.replacementGeneratedAt).toLocaleString('en-MY')}
            {/if}
        </p>

        <div class="counts">
            <span class="pill overdue">{data.counts.overdue} overdue</span>
            <span class="pill due_soon">{data.counts.due_soon} within 30 days</span>
            <span class="pill upcoming">{data.counts.upcoming} within 90 days</span>
            <span class="pill later">{data.counts.later} later</span>
        </div>

        <p class="caveat">
            These are estimates, not commitments. Confirm with the customer before reacting on a low-confidence row.
        </p>
    </header>

    {#if data.replacements.length === 0}
        <p class="empty">No predictions yet. They appear after the weekly job runs.</p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Customer</th>
                    <th>Boiler</th>
                    <th>Part</th>
                    <th>Last Ordered</th>
                    <th class="num">Cycle</th>
                    <th>Next Due</th>
                    <th>Confidence</th>
                </tr>
            </thead>
            <tbody>
                {#each visible as r (r.user_id + r.boiler_code + r.part_number)}
                    <tr class={r.bucket}>
                        <td>
                            <span class="strong">{r.company ?? r.customer_name ?? 'Unknown'}</span>
                            <span class="nm">{r.region_name ?? ''}</span>
                        </td>
                        <td class="mono">{r.boiler_code}</td>
                        <td>
                            <span class="strong">{r.part_number ?? ''}</span>
                            <span class="nm">{r.part_name ?? ''}</span>
                        </td>
                        <td class="muted">{fmtDay(r.last_ordered_on)}</td>
                        <td class="num muted">~{months(r.interval_days)} month(s)</td>
                        <td>
                            <span class="due">{fmtDay(r.next_due_on)}</span>
                            <span class="nm {r.bucket}">{dueLabel(r.daysUntil)}</span>
                        </td>
                        <td>
                            <span class="conf {r.confidence}">{r.confidence}</span>
                            <span class="nm">{r.interval_samples} samples / {r.asset_orders} orders</span>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>

        {#if data.counts.later > 0}
            <button class="toggle" onclick={() => (showLater = !showLater)}>
                {showLater ? 'Hide' : 'Show'} {data.counts.later} due beyond 90 days
            </button>
        {/if}
    {/if}
</section>

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 14px;
    }

    h1 {
        margin: 5px 0 15px;
    }

    a {
        display: block;
        width: max-content;
        margin-left: auto;
        margin-bottom: 10px;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .wrap {
        max-width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background-color: var(--bme-surface);
    }

    .wrap + .wrap {
        margin-top: 1.5rem;
    }

    h2 {
        color: var(--bme-dark-blue, #004b8d);
        font-size: 1.4rem;
        margin: 0;
    }

    .sub {
        color: var(--bme-muted);
        font-size: 0.85rem;
        margin: 0.25rem 0 0.75rem;
    }

    .legend {
        display: flex;
        gap: 1.1rem;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
        font-size: 0.75rem;
        color: var(--bme-muted);
    }

    .legend span {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
    }

    .swatch { 
        width: 16px; 
        height: 0; 
        display: inline-block; 
    }

    .swatch.solid { 
        border-top: 2px solid var(--bme-dark-blue, #004b8d); 
    }

    .swatch.dashed { 
        border-top: 2px dashed var(--bme-green, #6CB33F); 
    }

    .swatch.band { 
        height: 10px; 
        background: var(--bme-green, #6CB33F); 
        opacity: 0.18;
        border-radius: 2px; 
        width: 8px; 
    }

    .region {
        margin-bottom: 1.75rem;
    }

    h3 {
        color: var(--bme-dark-blue, #004b8d);
        font-size: 1rem;
        border-bottom: 2px solid var(--bme-muted);
        padding-bottom: 0.3rem;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }

    th, td {
        text-align: left;
        padding: 0.5rem 0.6rem;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: middle;
    }

    .num {
        text-align: center;
    }

    .chart-col {
        width: 20%;
        text-align: center;
    }

    .strong {
        font-weight: 600;
        color: var(--bme-ink);
    }

    .muted {
        color: var(--bme-muted);
    }

    .pn {
        display: block;
        font-weight: 600;
    }

    .nm {
        display: block;
        color: var(--bme-muted);
        font-size: 0.8rem;
    }

    .dir { 
        margin-left: 0.3rem; 
        width: 15px;
        height: 15px;
        vertical-align: -2px;
        fill: none;
        stroke: currentColor;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .dir.up { 
        color: var(--bme-green, #6cb33f); 
    }

    .dir.down { 
        color: #c1121f; 
    }

    :root[data-theme='dark'] .dir.down {
        color: #ff9d8f;
    }

    .dir.flat { 
        color: var(--bme-muted); 
    }

    .hist { 
        color: var(--bme-muted); 
    }

    .hist.thin { 
        color: #b45309; 
        font-weight: 600; 
    }

    :root[data-theme='dark'] .hist.thin {
        color: #ffcc66;
    }

    .empty {
        color: var(--bme-muted);
        padding: 2rem;
        text-align: center;
    }

    .caveat {
        color: var(--bme-muted);
        font-size: 0.78rem;
        font-style: italic;
        margin: 0 0 1.25rem;
    }

    .counts {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.75rem;
    }

    .pill {
        font-size: 0.75rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: var(--bme-surface-2);
        color: var(--bme-muted);
    }

    .pill.overdue {
        background: #fde8e8;
        color: #9b1c1c;
    }

    :root[data-theme='dark'] .pill.overdue {
        background: #3a1c18;
        color: #ff9d8f;
    }

    .pill.due_soon {
        background: #fef3c7;
        color: #92400e;
    }

    :root[data-theme='dark'] .pill.due_soon {
        background: #3a2f0f;
        color: #ffcc66;
    }

    .pill.upcoming {
        background: #e8f2e0;
        color: #3f6212;
    }

    :root[data-theme='dark'] .pill.upcoming {
        background: #1e3212;
        color: #9adf6c;
    }

    tr.overdue {
        background: #fef6f6;
    }

    :root[data-theme='dark'] tr.overdue {
        background: #2a1614;
    }

    tr.due_soon {
        background: #fffbeb;
    }

    :root[data-theme='dark'] tr.due_soon {
        background: #2a2410;
    }

    .nm.overdue {
        color: #9b1c1c;
        font-weight: 600;
    }

    :root[data-theme='dark'] .nm.overdue {
        color: #ff9d8f;
    }

    .nm.due_soon {
        color: #92400e;
        font-weight: 600;
    }

    :root[data-theme='dark'] .nm.due_soon {
        color: #ffcc66;
    }

    .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.82rem;
    }

    .due {
        display: block;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .conf {
        display: inline-block;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-weight: 600;
    }

    .conf.high {
        background: #e8f2e0;
        color: #3f6212;
    }

    :root[data-theme='dark'] .conf.high {
        background: #1e3212;
        color: #9adf6c;
    }

    .conf.medium {
        background: #fef3c7;
        color: #92400e;
    }

    :root[data-theme='dark'] .conf.medium {
        background: #3a2f0f;
        color: #ffcc66;
    }

    .conf.low {
        background: var(--bme-surface-2);
        color: var(--bme-muted);
    }

    .toggle {
        margin-top: 1rem;
        background: none;
        border: 1px solid var(--bme-border);
        border-radius: 6px;
        padding: 0.4rem 0.8rem;
        font-size: 0.82rem;
        color: var(--bme-ink);
        cursor: pointer;
    }

    .toggle:hover {
        background: var(--bme-hover);
    }

    @media (max-width: 820px) {
        .chart-col {
            display: none;
        }
    }

    @media (max-width: 860px) {
        .mono {
            display: none;
        }
    }
</style>