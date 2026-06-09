<script lang="ts">
    let { data } = $props();
</script>

<h1>Quote Requests History</h1>

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
                {#if q.status === 'approved'}
                    {#if q.reviewed_at}<span class="reviewed">Approved on { new Date(q.reviewed_at).toLocaleDateString()}</span>{/if}
                    {#if q.pdf_url}<a class="btn-primary pdf" href={q.pdf_url} target="_blank" rel="noopener">Download PDF</a>{/if}
                {:else if q.status === 'rejected'}
                    <span class="reviewed">
                        {#if q.reviewed_at}Reviewed on {new Date(q.reviewed_at).toLocaleDateString()}{:else}Not approved{/if}
                    </span>
                {:else}
                    <span class="reviewed">Awaiting review by admin.</span>
                {/if}
            </div>
        </div>
    {/each}
{/if}

<style>
    h1 {
        margin-bottom: 18px;
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
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 16px;
    }

    .reviewed {
        font-size: 13px;
        color: var(--bme-muted);
    }
</style>