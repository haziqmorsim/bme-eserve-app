<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import Stepper from "$lib/components/Stepper.svelte";
    import RequestFilters from "$lib/components/RequestFilters.svelte";
    import { emptyFilters, matches } from "$lib/filters";

    let { data } = $props();

    const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
    let myLevel = $derived(ROLE_LEVEL[data.profile?.role] ?? 0);
    let working = $state<string | null>(null);

    let filters = $state(emptyFilters());

    let groups = $derived(data.reviewGroups ?? []);
    let myQuotes = $derived(data.quotes ?? []);

    let filteredGroups = $derived(groups.filter((g: any) => matches(filters, {
        search: [g.quote?.reference, g.customer?.company, g.customer?.full_name],
        status: g.quote?.status,
        region: g.customer?.region,
        date: g.lastActivity
    })));

    let filteredQuotes = $derived(myQuotes.filter((q: any) => matches(filters, {
        search: [q.reference],
        status: q.status,
        region: q.region,
        date: q.created_at
    })));

    function levelLabel(l: number): string {
        return l === 1 ? 'Admin' : l === 2 ? 'Manager' : l === 3 ? 'COO' : `Level ${l}`;
    }
    function when(ts: string): string {
        return new Date(ts).toLocaleString();
    }

    function canReopen(q: any): boolean {
        if (myLevel === 2) return q.current_level > 2 || q.status === 'closed';
        if (myLevel === 3) return q.status === 'closed';
        return false;
    }

    async function reopen(q: any) {
        working = q.id;
        const { data: resp, error } = await data.supabase.functions.invoke('approve-quote', {
            body: { quote_id: q.id, action: 'reopen' }
        });
        working = null;

        if (error || resp?.error) {
            addToast(resp?.error ?? error?.message ?? 'Could not reopen this request.');
        } else {
            addToast(`${q.reference} reopened — sent back to ${resp.target_label}.`);
        }
        await invalidateAll();
    }
</script>

<h1>History</h1>

<RequestFilters bind:filters regions={data.regions} showRegion={data.isStaff} placeholder="Search by reference or customer..." />

{#if data.isStaff}
    <section class="block">
        <h2 class="block-title">Reviews History</h2>

        {#if groups.length === 0}
            <div class="card empty">You have not acted on any requests yet.</div>
        {:else if filteredGroups.length === 0}
            <div class="card empty">No reviews match your filters.</div>
        {:else}
            {#each filteredGroups as g (g.quote?.id)}
                <div class="card quote">
                    <div class="qhead">
                        <div>
                            <strong>{g.quote.reference}</strong>
                            <span class="status {g.quote.status}">{g.quote.status}</span>
                        </div>
                        <small>Last activity {when(g.lastActivity)}</small>
                    </div>

                    <div class="customer">
                        <p class="cust-info">Company: <strong>{g.customer.company ?? '—'}</strong></p>
                        <p class="cust-info">Name: <strong>{g.customer.full_name ?? '—'}</strong></p>
                    </div>

                    <table>
                        <thead>
                            <tr><th>Part Number</th><th>Part Name</th><th>Boiler</th><th>Quantity</th></tr>
                        </thead>
                        <tbody>
                            {#each g.quote?.quote_items ?? [] as it}
                                <tr>
                                    <td>{it.part_number}</td>
                                    <td class="name">{it.part_name}</td>
                                    <td>{it.boiler_code}</td>
                                    <td>{it.quantity}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>

                    <div class="timeline">
                        <span class="tl-title">Action history</span>
                        {#each g.actions ?? [] as a (a.id)}
                            <div class="tl-row">
                                <p class="tl-head">
                                    <strong>{levelLabel(a.level)}</strong>
                                    <span class="status {a.action === 'reopened' ? 'reopened' : 'closed'}">{a.action}</span>
                                    <span class="tl-when">{when(a.created_at)}</span>
                                </p>
                                <p class="tl-action"><strong>Action Taken:</strong> {a.action_taken ?? '—'}</p>
                            </div>
                        {/each}
                    </div>

                    <div class="meta">
                        <Stepper status={g.quote.status} level={g.quote.current_level} />

                        {#if canReopen(g.quote)}
                            <div class="meta-row">
                                <span class="reviewed">Reopening sends this request back to {levelLabel(myLevel - 1)}.</span>
                                <button class="btn-ghost" disabled={working === g.quote.id} onclick={() => reopen(g.quote)}>
                                    {working === g.quote.id ? 'Reopening...' : 'Reopen'}
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        {/if}
    </section>
{/if}

{#if data.isStaff || myQuotes.length > 0}
    <section class="block">
        <h2 class="block-title">Requests History</h2>

        {#if myQuotes.length === 0}
            <div class="card empty">You have not submitted any requests yet.</div>
        {:else if filteredQuotes.length === 0}
            <div class="card empty">No requests match your filters.</div>
        {:else}
            {#each filteredQuotes as q (q.id)}
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
                            {#each q.quote_items ?? [] as it}
                                <tr>
                                    <td>{it.part_number}</td>
                                    <td class="name">{it.part_name}</td>
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

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        text-align: center;
        color: var(--bme-muted);
        font-size: 12px;
        text-transform: uppercase;
        padding: 6px 8px;
    }

    td {
        text-align: center;
        padding: 8px;
        border-top: 1px solid var(--bme-border);
    }

    .name {
        text-align: left;
    }

    .timeline {
        margin-top: 16px;
        padding: 12px 14px;
        background-color: #eaeff3;
        border-radius: 8px;
    }

    .tl-title {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--bme-muted);
        margin-bottom: 10px;
    }

    .tl-row {
        padding-left: 12px;
        border-left: 2px solid var(--bme-border);
        margin-bottom: 12px;
    }

    .tl-row:last-child {
        margin-bottom: 0;
    }

    .tl-head {
        margin: 0 0 2px;
        font-size: 14px;
        color: var(--bme-ink);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .tl-when {
        font-size: 12.5px;
        font-weight: 400;
        color: var(--bme-muted);
    }

    .tl-action {
        margin: 0;
        font-size: 14px;
        color: var(--bme-ink);
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
        .quote {
            padding: 16px;
        }

        .qhead {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }

        .meta-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }

        table {
            font-size: 13px;
        }

        th, td {
            padding: 6px;
        }
    }
</style>