<script lang="ts">
    import { invalidateAll, goto } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import RequestFilters from "$lib/components/RequestFilters.svelte";
    import { emptyFilters, matches } from "$lib/filters";
    import SlaBadge from "$lib/components/SlaBadge.svelte";
    import { levelSince } from "$lib/sla";

    let { data } = $props();
    let working = $state<string | null>(null);
    let formError = $state<string | null>(null);
    let actionTaken = $state<Record<string, string>>({});
    let isDeveloper = $derived(data.profile?.role === 'developer');

    function attachList(q: any): { url: string; name: string }[] {
        if (Array.isArray(q.attachments) && q.attachments.length) return q.attachments;
        if (q.attachment_url) return [{ url: q.attachment_url, name: q.attachment_name ?? 'Download file' }];
        return [];
    }

    let filters = $state(emptyFilters());
    let filtered = $derived(data.quotes.filter((q: any) => matches(filters, {
        search: [q.reference, q.customer?.company, q.customer?.full_name],
        status: q.status,
        region: q.customer?.region,
        date: q.created_at
    })));

    function roleLabel(r: string): string {
        return r === 'admin' ? 'Admin' : r === 'manager' ? 'Manager' : r === 'coo' ? 'COO' : r;
    }
    function when(ts: string): string {
        return new Date(ts).toLocaleString();
    }

    function cancel(q: any) {
        actionTaken[q.id] = '';
        formError = null;
        goto('/app');
    }

    async function close(q: any) {
        formError = null;
        const text = (actionTaken[q.id] ?? '').trim();
        if (!text) { formError = q.id; return; }

        working = q.id;
        const { data: resp, error } = await data.supabase.functions.invoke('approve-quote', {
            body: { quote_id: q.id, action: 'close', action_taken: text }
        });
        working = null;

        if (error || resp?.error) {
            addToast(resp?.error ?? error?.message ?? 'Action could not be completed.');
        } else if (resp?.status === 'closed') {
            addToast(`${q.reference} closed.`);
        } else if (resp?.next_label) {
            addToast(`${q.reference} closed — forwarded to ${resp.next_label}.`);
        } else {
            addToast('Action recorded.');
        }

        await invalidateAll();
    }
</script>

<h1>Requests</h1>

<RequestFilters bind:filters regions={data.regions} showStatus={false} placeholder="Search by reference or customer..." />

{#if data.quotes.length === 0}
    <div class="card empty">No requests are awaiting your action.</div>
{:else if filtered.length === 0}
    <div class="card empty">No requests match your filters.</div>
{:else}
    {#each filtered as q (q.id)}
        <div class="card quote">
            <div class="qhead">
                <div>
                    <strong class="reference">{q.reference}</strong>
                    <span class="status {q.status}">{q.status}</span>
                    <span class="sla-wrap"><SlaBadge since={levelSince(q)} weekdays /></span>
                </div>
                <small>{when(q.created_at)}</small>
            </div>

            <div class="customer">
                {#if q.customer.company || q.customer.full_name}
                    {#if q.customer.company}<p class="cus-info">Company: <strong>{q.customer.company}</strong></p>{/if}
                    {#if q.customer.full_name}<p class="cus-info">Name: <strong>{q.customer.full_name}</strong></p>{/if}
                {:else}
                    <span>Unknown customer</span>
                {/if}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Part Number</th>
                        <th>Part Name</th>
                        <th>Boiler</th>
                        <th>Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    {#each q.quote_items as it}
                        <tr>
                            <td>{it.part_number}</td>
                            <td class="name">{it.part_name}</td>
                            <td>{it.boiler_code}</td>
                            <td>{it.quantity}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>

            {#if q.notes}<p class="notes"><em>Customer notes:</em> {q.notes}</p>{/if}
            {#if attachList(q).length}
                <div class="attachment">
                    <em>Attachment{attachList(q).length > 1 ? 's' : ''}:</em>
                    <ul class="attach-links">
                        {#each attachList(q) as a (a.url)}
                            <li><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a></li>
                        {/each}
                    </ul>
                </div>
            {/if}

            {#if q.approvals.length}
                <div class="prior">
                    <span class="prior-title">Earlier actions</span>
                    {#each q.approvals as a}
                        <div class="prior-row">
                            <p class="prior-head">
                                <span class="prior-who">
                                    <strong>{roleLabel(a.role)}</strong>
                                    <span class="status {a.action === 'reopened' ? 'reopened' : 'closed'}">{a.action}</span>
                                </span>
                                <span class="prior-when">{when(a.created_at)}</span>
                            </p>
                            <p class="prior-action"><strong>Action Taken:</strong> {a.action_taken ?? '—'}</p>
                        </div>
                    {/each}
                </div>
            {/if}

            <label class="action-field">
                <p class="field-label">Action Taken ({data.levelLabel}) <span class="req">*</span></p>
                <textarea
                    rows="3"
                    placeholder="Describe the action you have taken..."
                    bind:value={actionTaken[q.id]}
                    disabled={data.isDeveloper}
                ></textarea>
            </label>

            {#if formError === q.id}
                <p class="form-err">Action Taken is required before closing this request.</p>
            {/if}

            <div class="actions">
                <button class="btn-primary" disabled={data.isDeveloper || working === q.id} onclick={() => close(q)}>
                    {working === q.id ? 'Processing...' : 'Close'}
                </button>
                <button class="btn-ghost" disabled={data.isDeveloper || working === q.id} onclick={() => cancel(q)}>
                    Cancel
                </button>
            </div>
            {#if isDeveloper}
                <p class="hint">Read-only for the developer role.</p>
            {/if}
        </div>
    {/each}
{/if}

<style>
    h1 { 
        margin: 5px 0 15px; 
    }

    .lead {
        margin: 0 0 18px;
        color: var(--bme-muted);
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
    
    .sla-wrap { 
        margin-left: 10px; 
    }
    
    .reference { 
        font-size: 18px; 
    }
    
    .status { 
        text-transform: capitalize; 
    }

    .customer {
        margin-bottom: 14px;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .customer strong { 
        color: var(--bme-ink); 
    }
    
    .customer span { 
        color: var(--bme-muted); 
    }
    
    .cus-info { 
        margin: 0; 
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
        overflow-wrap: break-word;
    }

    .name {
        text-align: left;
    }

    .notes {
        margin: 12px 0;
        color: var(--bme-muted);
    }

    .attachment {
        margin: 0 0 12px;
        color: var(--bme-muted);
    }

    .attachment a {
        color: var(--bme-dark-blue);
        font-weight: 600;
        word-break: break-all;
    }

    .attach-links {
        margin: 4px 0 0;
        padding-left: 18px;
    }

    .attach-links li {
        margin: 2px 0;
    }

    .prior {
        margin-top: 14px;
        padding: 12px 14px;
        background-color: #eaeff3;
        border-radius: 8px;
    }

    .prior-title {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--bme-muted);
        margin-bottom: 8px;
    }

    .prior-row { 
        margin: 0 0 10px; 
    }

    .prior-row:last-child { 
        margin-bottom: 0; 
    }

    .prior-head {
        margin: 0 0 2px;
        font-size: 14px;
        color: var(--bme-ink);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .prior-who {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .prior-when {
        color: var(--bme-muted);
        font-size: 12.5px;
        font-weight: 400;
    }

    .prior-action {
        margin: 0;
        font-size: 14px;
        color: var(--bme-ink);
    }

    .action-field {
        display: block;
        margin-top: 16px;
    }

    .field-label {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .req { 
        color: var(--bme-red); 
    }

    .action-field textarea {
         width: 100%; 
        }

    .form-err {
        color: var(--bme-red);
        margin: 10px 0 0;
        font-size: 14px;
    }

    .actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
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
    
    textarea:disabled {
        opacity: 0.6;
    }

    .btn-primary:disabled {
        background: var(--bme-dark-blue);
        opacity: 0.6;
        cursor: default;
    }

    .btn-ghost:disabled {
        opacity: 0.6;
        cursor: default;
    }

    .hint {
        margin: 10px 0 0;
        font-size: 13px;
        color: var(--bme-muted);
    }

    @media (max-width: 640px) {
        .quote { 
            padding: 16px; 
        }
        
        .qhead { 
            flex-direction: column; 
            align-items: flex-start; 
            gap: 8px; 
        }

        .qhead > div { 
            display: flex; 
            flex-wrap: wrap; 
            align-items: center; 
            gap: 8px; 
        }

        .qhead > div .status { 
            margin-left: 0; 
        }

        .sla-wrap { 
            flex-basis: 100%; 
            margin-left: 0; 
        }

        .qhead small { 
            margin-top: 4px; 
        }
        
        .prior-head { 
            flex-direction: column; 
            align-items: flex-start; 
            gap: 2px; 
        }
        
        .prior-when { 
            order: -1; 
        }
        
        .actions { 
            flex-wrap: wrap; 
        }
        
        table { 
            font-size: 13px; 
        }
        
        th, td { 
            padding: 6px; 
        }
    }
</style>