<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import Stepper from "$lib/components/Stepper.svelte";

    let { data } = $props();

    const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
    let myLevel = $derived(ROLE_LEVEL[data.profile?.role] ?? 0);
    let working = $state<string | null>(null);

    function levelLabel(l: number): string {
        return l === 1 ? 'Admin' : l === 2 ? 'Manager' : l === 3 ? 'COO' : `Level ${l}`;
    }
    function when(ts: string): string {
        return new Date(ts).toLocaleString();
    }

    function canReopen(r: any): boolean {
        if (r.action !== 'closed') return false;
        if (myLevel === 2) return r.quotes.current_level > 2 || r.quotes.status === 'closed';
        if (myLevel === 3) return r.quotes.status === 'closed';
        return false;
    }

    async function reopen(r: any) {
        working = r.id;
        const { data: resp, error } = await data.supabase.functions.invoke('approve-quote', {
            body: { quote_id: r.quotes.id, action: 'reopen' }
        });
        working = null;

        if (error || resp?.error) {
            addToast(resp?.error ?? error?.message ?? 'Could not reopen this request.');
        } else {
            addToast(`${r.quotes.reference} reopened — sent back to ${resp.target_label}.`);
        }
        await invalidateAll();
    }
</script>

<h1>History</h1>

{#if data.isStaff}
    <section class="block">
        <h2 class="block-title">Reviews History</h2>

        {#if data.reviews.length === 0}
            <div class="card empty">You have not acted on any requests yet.</div>
        {:else}
            {#each data.reviews as r (r.id)}
                <div class="card quote">
                    <div class="qhead">
                        <div>
                            <strong>{r.quotes.reference}</strong>
                            <span class="status {r.quotes.status}">{r.quotes.status}</span>
                        </div>
                        <small>{r.action === 'reopened' ? 'Reopened' : 'Closed'} at {when(r.created_at)}</small>
                    </div>

                    <p class="decision">
                        Your action at <strong>{levelLabel(r.level)}</strong> level:
                        <span class="status {r.action === 'reopened' ? 'reopened' : 'closed'}">{r.action}</span>
                    </p>

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

                    <p class="action-taken"><strong>Action Taken:</strong> {r.action_taken ?? '—'}</p>

                    <div class="meta">
                        <Stepper status={r.quotes.status} level={r.quotes.current_level} />
                    </div>
                     {#if canReopen(r)}
                        <div class="meta-row">
                            <button class="btn-primary" disabled={working === r.id} onclick={() => reopen(r)}>
                                {working === r.id ? 'Reopening...' : 'Reopen'}
                            </button>
                            <p class="reviewed">Reopening sends this request back to {levelLabel(myLevel - 1)}.</p>
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </section>
{/if}

{#if data.isStaff || data.quotes.length > 0}
    <section class="block">
        <h2 class="block-title">Requests History</h2>

        {#if data.quotes.length === 0}
            <div class="card empty">You have not submitted any requests yet.</div>
        {:else}
            {#each data.quotes as q (q.id)}
                <div class="card quote">
                    <div class="qhead">
                        <div>
                            <strong>{q.reference}</strong>
                            <span class="status {q.status}">{q.status}</span>
                        </div>
                        <small>Submitted {when(q.created_at)}</small>
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
                        {#if data.isStaff}
                            <Stepper status={q.status} level={q.current_level} />
                        {/if}

                        <!-- <div class="meta-row">
                            {#if q.status === 'closed'}
                                <span class="reviewed">
                                    Closed{#if q.reviewed_at} on {new Date(q.reviewed_at).toLocaleDateString()}{/if}.
                                </span>
                            {:else}
                                <span class="reviewed">
                                    Open — currently with {q.current_level === 1 ? 'Admin' : q.current_level === 2 ? 'Manager' : 'COO'}.
                                </span>
                            {/if}
                        </div> -->
                    </div>
                </div>
            {/each}
        {/if}
    </section>
{/if}

<style>
    h1 { margin-bottom: 18px; }
    .block { margin-bottom: 28px; }

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

    .qhead .status { margin-left: 10px; }
    .status { text-transform: capitalize; }

    .decision {
        margin: 0 0 12px;
        font-size: 14px;
        color: var(--bme-ink);
    }

    .decision .status { margin-left: 4px; }

    .customer {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0 0 14px;
        font-size: 14px;
    }

    .cust-info { margin: 0; color: var(--bme-muted); }
    .cust-info strong { color: var(--bme-ink); }

    .action-taken {
        margin: 12px 0 0;
        font-size: 14px;
        color: var(--bme-ink);
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

    .notes { margin: 12px 0 0; color: var(--bme-muted); }

    .meta {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .meta-row {
        margin-top: 20px;
        gap: 12px;
    }

    .reviewed { font-size: 13px; color: var(--bme-muted); }

    .status.open { 
        background-color: #e7f0f8; 
        color: #004b8d; 
    }

    .status.closed { 
        background-color: #e4f3d8; 
        color: #2f5e18; 
    }

    .status.reopened {
        background-color: #fff3d6;
        color: #97700a;
    }

    @media (max-width: 640px) {
        .quote { padding: 16px; }
        .qhead { flex-direction: column; align-items: flex-start; gap: 6px; }
        .meta-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        table { font-size: 13px; }
        th, td { padding: 6px; }
    }
</style>