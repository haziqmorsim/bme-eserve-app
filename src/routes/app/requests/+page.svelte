<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    let { data } = $props();
    let working = $state<string | null>(null);
    let priceError = $state<string | null>(null);
    let prices = $state<Record<string, string>>({});

    $effect(() => {
        for (const q of data.quotes) {
            for (const it of q.quote_items) {
                if (prices[it.id] === undefined) {
                    prices[it.id] = it.unit_price != null ? String(it.unit_price) : '';
                }
            }
        }
    });

    function priceOf(q: any, it: any): number {
        const raw = q.status === 'pending' ? prices[it.id] : it.unit_price;
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    function lineTotal(q: any, it: any): number {
        return priceOf(q, it) * it.quantity;
    }
    function grandTotal(q: any): number {
        return q.quote_items.reduce((sum: number, it: any) => sum + lineTotal(q, it), 0);
    }
    function money(n: number): string {
        return 'RM ' + n.toFixed(2);
    }

    async function review(q: any, action: 'approve' | 'reject') {
        priceError = null;
        if (action === 'approve') {
            for (const it of q.quote_items) {
                const raw = prices[it.id];
                if (raw === undefined || raw === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0) {
                    priceError = q.id;
                    return;
                }
            }
        }
        working = q.id;
        const body: any = { quote_id: q.id, action };
        if (action === 'approve') {
            body.prices = {};
            for (const it of q.quote_items) body.prices[it.id] = Number(prices[it.id]);
        }
        await data.supabase.functions.invoke('approve-quote', { body });
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
                    <strong class="reference">{q.reference}</strong>
                    <span class="status {q.status}">{q.status}</span>
                </div>
                <small>{new Date(q.created_at).toLocaleString()}</small>
            </div>

            <div class="customer">
                {#if q.customer.company || q.customer.full_name}
                    <p class="cus-info">{#if q.customer.company}Company: <strong>{q.customer.company}</strong>{/if}</p>
                    <p class="cus-info">{#if q.customer.full_name}Name: <strong>{q.customer.full_name}</strong>{/if}</p>
                {:else}
                    <span>Unknown customer</span>
                {/if}
            </div>

            <table>
                <colgroup>
                    <col class="c-part" />
                    <col class="c-name" />
                    <col class="c-boiler" />
                    <col class="c-qty" />
                    <col class="c-unit" />
                    <col class="c-amt" />
                </colgroup>
                <thead>
                    <tr>
                        <th>Part Number</th>
                        <th>Part Name</th>
                        <th>Boiler</th>
                        <th class="num">Quantity</th>
                        <th class="num">Unit Price (RM)</th>
                        <th class="num">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {#each q.quote_items as it}
                        <tr>
                            <td>{it.part_number}</td>
                            <td>{it.part_name}</td>
                            <td>{it.boiler_code}</td>
                            <td class="num">{it.quantity}</td>
                            <td class="num">
                                {#if q.status === 'pending'}
                                    <input
                                        class="price-input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        bind:value={prices[it.id]}
                                    />
                                {:else}
                                    {money(priceOf(q, it))}
                                {/if}
                            </td>
                            <td class="num">{money(lineTotal(q, it))}</td>
                        </tr>
                    {/each}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" class="num total-label">Total</td>
                        <td class="num total-val">{money(grandTotal(q))}</td>
                    </tr>
                </tfoot>
            </table>

            {#if q.notes}<p class="notes"><em>Notes:</em> {q.notes}</p>{/if}

            {#if priceError === q.id}
                <p class="price-err">Enter a valid price (0 or more) for every part before approving.</p>
            {/if}

            {#if q.status === 'pending'}
                <div class="actions">
                    <button class="btn-primary" disabled={working === q.id} onclick={() => review(q, 'approve')}>
                        {working === q.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button class="btn-ghost" disabled={working === q.id} onclick={() => review(q, 'reject')}>
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
        margin-left: 8px;
    }

    .cus-info {
        margin: 0;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        table-layout: fixed;
    }

    .c-part { width: 16%; }
    .c-name { width: 30%; }
    .c-boiler { width: 12%; }
    .c-qty { width: 10%; }
    .c-unit { width: 18%; }
    .c-amt { width: 14%; }

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
        overflow-wrap: break-word;
    }

    th.num, td.num {
        text-align: right;
        white-space: nowrap;
    }

    .price-input {
        width: 100%;
        max-width: 130px;
        text-align: right;
        padding: 6px 8px;
        margin: 0;
    }

    .total-label {
        font-weight: 700;
        color: var(--bme-ink);
        border-top: 2px solid var(--bme-border);
    }

    .total-val {
        font-weight: 700;
        color: var(--bme-dark-blue);
        border-top: 2px solid var(--bme-border);
    }

    .price-err {
        color: var(--bme-red);
        margin: 12px 0 0;
        font-size: 14px;
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

    @media (max-width: 640px) {
        .quote { padding: 16px; }
        .qhead { flex-direction: column; align-items: flex-start; gap: 6px; }
        .actions { flex-wrap: wrap; }
        table { font-size: 13px; }
        th, td { padding: 6px; }
        .price-input { width: 90px; }
    }
</style>