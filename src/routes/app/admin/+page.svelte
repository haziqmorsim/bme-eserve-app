<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    let { data } = $props();
    let working = $state<string | null>(null);

    async function review(quoteId: string, action: 'approve' | 'reject') {
        working = quoteId;
        await data.supabase.functions.invoke('approve-quote', { body: { quote_id: quoteId, action } });
        working = null;
        await invalidateAll();
    }
</script>

<h1>Quotation Requests</h1>

{#if data.quotes.length === 0}
    <div class="card empty">No quotation requests yet.</div>
{:else}
    {#each data.quotes as q (q.id)}
        <div class="card quote">
            <div class="qhead">
                <div>
                    <strong>{q.reference}</strong>
                    <span class="status {q.status}">{q.status}</span>
                </div>
                <small>{new Date(q.created_at).toLocaleString()}</small>
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

            {#if q.status === 'pending'}
                <div class="actions">
                    <button class="btn-primary" disabled={working === q.id} onclick={() => review(q.id, 'approve')}>
                        {working === q.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button class="btn-ghost" disabled={working === q.id} onclick={() => review(q.id, 'reject')}>
                        Reject
                    </button>
                </div>
            {/if}
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

    .actions { 
        display: flex; 
        gap: 10px; 
        margin-top: 16px; 
    }
</style>