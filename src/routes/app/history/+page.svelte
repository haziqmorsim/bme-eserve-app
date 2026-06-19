<script lang="ts">
    import Stepper from "$lib/components/Stepper.svelte";
    let { data } = $props();

    function levelLabel(l: number): string {
        return l === 1 ? 'Admin' : l === 2 ? 'Manager' : l === 3 ? 'COO' : `Level ${l}`;
    }
</script>

<h1>History</h1>

{#if data.isStaff}
    <section class="block">
        <h2 class="block-title">Reviews History</h2>

        {#if data.reviews.length === 0}
            <div class="card empty">You have not reviewed any quotation requests yet.</div>
        {:else}
            {#each data.reviews as r (r.id)}
                <div class="card quote">
                    <div class="qhead">
                        <div>
                            <strong>{r.quotes.reference}</strong>
                            <span class="status {r.quotes.status}">{r.quotes.status}</span>
                        </div>
                        <small>Reviewed {new Date(r.created_at).toLocaleString()}</small>
                    </div>

                    <!-- <p class="decision">
                        Your decision at <strong>{levelLabel(r.level)}</strong> level:
                        <span class="status {r.action === 'approved' ? 'approved' : 'rejected'}">{r.action}</span>
                    </p> -->

                    <div class="customer">
                        <p class="cust-info">Company: <strong>{r.customer.company ?? '—'}</strong></p>
                        <p class="cust-info">Name: <strong>{r.customer.full_name ?? '—'}</strong></p>
                    </div>

                    <table>
                        <thead>
                            <tr><th>Part Number</th><th>Part Name</th><th>Boiler</th><th>Quantity</th></tr>
                        </thead>
                        <tbody>
                            {#each r.quotes.quote_items as it}
                                <tr>
                                    <td>{it.part_number}</td>
                                    <td>{it.part_name}</td>
                                    <td>{it.boiler_code}</td>
                                    <td>{it.quantity}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                    <p><strong>Remarks:</strong> {#if r.remarks}<span class="remark"> {r.remarks}</span>{/if}</p>

                    <div class="meta">
                        <Stepper status={r.quotes.status} level={r.quotes.current_level} />
                    </div>
                </div>
            {/each}
        {/if}
    </section>
{/if}

{#if data.isStaff || data.quotes.length > 0}
    <section class="block">
        <h2 class="block-title">Requests History</h2>

        {#if data.quotes.length === 0}
            <div class="card empty">You have not submitted any quotation requests yet.</div>
        {:else}
            {#each data.quotes as q (q.id)}
                <div class="card quote">
                    <div class="qhead">
                        <div>
                            <strong>{q.reference}</strong>
                            <span class="status {q.status}">{q.status}</span>
                        </div>
                        <small>Submitted {new Date(q.created_at).toLocaleString()}</small>
                    </div>
                    <table>
                        <thead>
                            <tr><th>Part Number</th><th>Part Name</th><th>Boiler</th><th>Quantity</th></tr>
                        </thead>
                        <tbody>
                            {#each q.quote_items as it}
                                <tr>
                                    <td>{it.part_number}</td>
                                    <td>{it.part_name}</td>
                                    <td>{it.boiler_code}</td>
                                    <td>{it.quantity}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>

                    {#if q.notes}<p class="notes"><em>Notes:</em> {q.notes}</p>{/if}

                    <div class="meta">
                        <Stepper status={q.status} level={q.current_level} />

                        <div class="meta-row">
                            {#if q.status === 'approved'}
                                {#if q.reviewed_at}<span class="reviewed">Approved on {new Date(q.reviewed_at).toLocaleDateString()}</span>{/if}
                                {#if q.pdf_url}<a class="btn-primary pdf" href={q.pdf_url} target="_blank" rel="noopener">Download PDF</a>{/if}
                            {:else if q.status === 'rejected'}
                                <span class="reviewed">
                                    {#if q.reviewed_at}Not approved — reviewed on {new Date(q.reviewed_at).toLocaleDateString()}{:else}Not approved{/if}
                                </span>
                            {:else}
                                <span class="reviewed">
                                    Awaiting {q.current_level === 1 ? 'Admin' : q.current_level === 2 ? 'Manager' : 'COO'} review.
                                </span>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </section>
{/if}

<style>
    h1 {
        margin-bottom: 18px;
    }

    .block {
        margin-bottom: 28px;
    }

    .block-title {
        font-size: 16px;
        color: var(--bme-ink);
        margin: 0 0 12px;
    }

    .empty {
        padding: 36px;
        text-align: center;
        color: var(--bme-muted);
    }

    .quote {
        padding: 20px;
        margin-bottom: 16px;
    }

    .qhead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .qhead .status {
        margin-left: 10px;
    }

    .status {
        text-transform: capitalize;
    }

    .decision {
        margin: 0 0 10px;
        font-size: 14px;
        color: var(--bme-ink);
    }

    /* .decision .status {
        margin: 0 4px;
    } */

    .customer {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0 0 14px;
        font-size: 14px;
    }

    .cust-info {
        margin: 0;
        color: var(--bme-muted);
    }

    .cust-info strong {
        color: var(--bme-ink);
    }

    .remark {
        color: var(--bme-muted);
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        text-align: left;
        color: var(--bme-muted);
        font-size: 12px;
        text-transform: uppercase;
        padding: 6px 8px;
    }

    td {
        padding: 8px;
        border-top: 1px solid var(--bme-border);
    }

    .notes {
        margin: 12px 0 0;
        color: var(--bme-muted);
    }

    .meta {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .reviewed {
        font-size: 13px;
        color: var(--bme-muted);
    }

    @media (max-width: 640px) {
        .quote { padding: 16px; }
        .qhead { flex-direction: column; align-items: flex-start; gap: 6px; }
        .meta-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        table { font-size: 13px; }
        th, td { padding: 6px; }
    }
</style>