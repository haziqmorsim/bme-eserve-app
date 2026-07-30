<script lang="ts">
    let { data } = $props();

    const regions = $derived(Object.entries(data.byRegion));
    const fmtQty = (n: number | null) => (n == null ? '—' : Number(n).toLocaleString());
    const fmtDate = (s: string | null) => s
        ? new Date(s).toLocaleDateString('en-MY', { year: 'numeric', month: 'long' }) 
        : "—";
</script>

<section class="wrap">
    <header>
        <h1>Regional demand forecast</h1>
        {#if data.period}
            <p class="sub">
                Projected for {fmtDate(data.period)}
                {#if data.generatedAt}· generated {new Date(data.generatedAt).toLocaleString('en-MY')}{/if}
            </p>
        {/if}
    </header>

    {#if regions.length === 0}
        <p class="empty">No forecasts yet. They appear after the weekly job runs.</p>
    {:else}
        {#each regions as [region, rows] (region)}
            <div class="region">
                <h2>{region}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Part</th>
                            <th class="num">Predicted</th>
                            <th class="num">Range</th>
                            <th class="num">History</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each rows as f (f.part_number + f.region_id)}
                            <tr>
                                <td>
                                    <span class="pn">{f.part_number ?? '—'}</span>
                                    <span class="nm">{f.part_name ?? '—'}</span>
                                </td>
                                <td class="num strong">{fmtQty(f.predicted_qty)}</td>
                                <td class="num muted">{fmtQty(f.lower_qty)}</td>
                                <td class="num muted">{fmtQty(f.history_months)}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/each}
    {/if}
</section>

<style>
    .wrap {
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
    }

    h1 {
        color: var(--bme-dark-blue, #004b8d);
        font-size: 1.4rem;
        margin: 0;
    }

    .sub {
        color: #6b7280;
        font-size: 0.85rem;
        margin: 0.25rem 0 1.5rem;
    }

    .region {
        margin-bottom: 1.75rem;
    }

    h2 {
        color: var(--bme-dark-blue, #004b8d);
        font-size: 1rem;
        border-bottom: 2px solid var(--bme-green, #6cb33f);
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
    }

    .num {
        text-align: right;
    }

    .strong {
        font-weight: 600;
        color: #1f2933;
    }

    .muted {
        color: #6b7280;
    }

    .pn {
        display: block;
        font-weight: 600;
    }

    .nm {
        display: block;
        color: #6b7280;
        font-size: 0.8rem;
    }

    .empty {
        color: #6b7280;
        padding: 2rem;
        text-align: center;
    }
</style>