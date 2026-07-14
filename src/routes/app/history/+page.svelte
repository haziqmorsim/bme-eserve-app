<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import Stepper from "$lib/components/Stepper.svelte";
    import RequestFilters from "$lib/components/RequestFilters.svelte";
    import { emptyFilters, matches } from "$lib/filters";
    import Pagination from "$lib/components/admin/Pagination.svelte";
    import { untrack } from "svelte";

    let { data } = $props();

    const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
    let myLevel = $derived(ROLE_LEVEL[data.profile?.role] ?? 0);
    let working = $state<string | null>(null);
    let copied = $state<string | null>(null);

    async function copyCode(code: string) {
        try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
        copied = code;
        setTimeout(() => { if (copied === code) copied = null; }, 1500);
    }

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

    const PAGE_SIZE = 10;
    let tab = $state<'reviews' | 'requests'>(untrack(() => (data.isStaff ? 'reviews' : 'requests')));
    let reviewPage = $state(1);
    let requestPage = $state(1);

    $effect(() => {
        filters.q; filters.status; filters.region; filters.from; filters.to;
        reviewPage = 1;
        requestPage = 1;
    });

    let reviewPages = $derived(Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE)));
    let reviewCur = $derived(Math.min(reviewPage, reviewPages));
    let pagedGroups = $derived(filteredGroups.slice((reviewCur - 1) * PAGE_SIZE, reviewCur * PAGE_SIZE));

    let requestPages = $derived(Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE)));
    let requestCur = $derived(Math.min(requestPage, requestPages));
    let pagedQuotes = $derived(filteredQuotes.slice((requestCur - 1) * PAGE_SIZE, requestCur * PAGE_SIZE));

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

<div class="tabbar">
    {#if data.isStaff}
        <button class="tab" class:active={tab === 'reviews'} onclick={() => { tab = 'reviews'; }}>Reviews</button>
    {/if}
    <button class="tab" class:active={tab === 'requests'} onclick={() => { tab = 'requests'; }}>Requests</button>
</div>

{#if data.isStaff && tab === 'reviews'}
    <section class="block">

        {#if groups.length === 0}
            <div class="card empty">You have not acted on any requests yet.</div>
        {:else if filteredGroups.length === 0}
            <div class="card empty">No reviews match your filters.</div>
        {:else}
            {#each pagedGroups as g (g.quote?.id)}
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
        {#if filteredGroups.length > 0}
            <Pagination total={filteredGroups.length} page={reviewCur} pageSize={PAGE_SIZE} onpage={(p) => (reviewPage = p)} />
        {/if}
    </section>
{/if}

{#if !data.isStaff || tab === 'requests'}
    <section class="block">

        {#if data.loyalty}
            <div class="card loyalty bme-animate-in">
                <div class="loy-head">
                    <div>
                        <h3 class="loy-title">Loyalty Rewards</h3>
                        <p class="loy-sub">Earn discount coupons as you submit more requests.</p>
                    </div>
                    <div class="loy-count"><span class="loy-n">{data.loyalty.count}</span><span class="loy-l">requests</span></div>
                </div>

                {#if data.loyalty.nextTier}
                    <div class="loy-progress">
                        <div class="loy-bar"><div class="loy-fill" style="width:{data.loyalty.progressPct}%"></div></div>
                        <p class="loy-next">{data.loyalty.toNext} more request{data.loyalty.toNext === 1 ? '' : 's'} to unlock a <strong>{data.loyalty.nextTier.percent}%</strong> coupon.</p>
                    </div>
                {:else}
                    <p class="loy-max">You have unlocked the maximum {data.loyalty.currentPercent}% loyalty discount. Thank you!</p>
                {/if}

                <div class="loy-tiers">
                    {#each data.loyalty.tiers as t (t.percent)}
                        <div class="loy-tier" class:earned={t.earned}>
                            <div class="loy-tier-top">
                                <span class="loy-pct">{t.percent}%</span>
                                <span class="loy-req">{t.threshold} requests</span>
                            </div>
                            {#if t.earned}
                                <button
                                    class="loy-code"
                                    class:used={t.used}
                                    onclick={() => copyCode(t.code)}
                                    disabled={t.used}
                                    title={t.used ? 'This coupon has been used' : 'Click to copy'}>
                                    {copied === t.code ? 'Copied!' : t.code}
                                </button>
                                {#if t.used}
                                    <span class="loy-used">The discount coupon has been used</span>
                                {/if}
                            {:else}
                                <span class="loy-locked">Locked</span>
                            {/if}
                        </div>
                    {/each}
                </div>
                <p class="loy-note">To use the discount coupons, paste it in the quotes page for your next quotation request.</p>
            </div>
        {/if}

        {#if myQuotes.length === 0}
            <div class="card empty">You have not submitted any requests yet.</div>
        {:else if filteredQuotes.length === 0}
            <div class="card empty">No requests match your filters.</div>
        {:else}
            {#each pagedQuotes as q (q.id)}
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
                    </div>
                </div>
            {/each}
        {/if}
        {#if filteredQuotes.length > 0}
            <Pagination total={filteredQuotes.length} page={requestCur} pageSize={PAGE_SIZE} onpage={(p) => (requestPage = p)} />
        {/if}
    </section>
{/if}

<style>
    .tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .tab {
        padding: 9px 22px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        font-weight: 700;
        background-color: #ffffff;
        color: var(--bme-muted);
        cursor: pointer;
        transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
    }

    .tab.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
        border-color: var(--bme-dark-blue);
    }

    .block :global(.pager) {
        margin-top: 16px;
    }

    h1 {
        margin: 5px 0 15px;
    }

    .block-title {
        font-size: 20px;
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

    .loyalty {
        padding: 20px;
        margin-bottom: 16px;
        border: 1px solid var(--bme-border);
    }

    .loy-head { 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start; 
        gap: 16px; 
    }
    
    .loy-title { 
        margin: 0; 
        font-size: 16px; 
        color: var(--bme-darker-green); 
    }
    
    .loy-sub { 
        margin: 4px 0 0; 
        font-size: 13px; 
        color: var(--bme-muted); 
    }
    
    .loy-count { 
        text-align: center; 
        flex-shrink: 0; 
    }
    
    .loy-n { 
        display: block; 
        font-size: 30px; 
        font-weight: 700; 
        line-height: 1; 
        color: var(--bme-darker-blue); 
    }
    
    .loy-l { 
        font-size: 11px; 
        text-transform: uppercase; 
        letter-spacing: 0.03em; 
        color: var(--bme-muted); 
    }

    .loy-progress { 
        margin: 16px 0 4px; 
    }

    .loy-bar { 
        height: 10px; 
        border-radius: 999px; 
        background: #e2ebe0; 
        overflow: hidden; 
    }

    .loy-fill {
        height: 100%; 
        border-radius: 999px;
        background: linear-gradient(90deg, var(--bme-green), var(--bme-teal));
        transition: width var(--t-slow) var(--ease);
    }

    .loy-next { 
        margin: 8px 0 0; 
        font-size: 13px; 
        color: var(--bme-ink); 
    }

    .loy-max { 
        margin: 14px 0 0; 
        font-size: 14px; 
        font-weight: 600; 
        color: var(--bme-dark-green); 
    }

    .loy-code:disabled { 
        cursor: default; 
        opacity: 0.55; 
        text-decoration: line-through; 
    }

    .loy-used { 
        display: block; 
        margin-top: 6px; 
        font-size: 11.5px; 
        font-weight: 600; 
        color: var(--bme-muted); 
    }

    .loy-tiers { 
        display: grid; 
        grid-template-columns: repeat(3, 1fr); 
        gap: 10px; 
        margin-top: 16px; 
    }

    .loy-tier {
        border: 1px solid var(--bme-border); 
        border-radius: 10px; padding: 12px; 
        background: #fff;
        transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
    }

    .loy-tier.earned { 
        border-color: var(--bme-green); 
        box-shadow: 0 4px 14px rgba(108, 179, 63, 0.18); 
    }

    .loy-tier:hover { 
        transform: translateY(-2px); 
    }

    .loy-tier-top { 
        display: flex; 
        align-items: baseline; 
        justify-content: space-between; 
        gap: 8px; 
        margin-bottom: 8px; 
    }
    
    .loy-pct { 
        font-size: 20px; 
        font-weight: 700; 
        color: var(--bme-darker-blue); 
    }
    
    .loy-req { 
        font-size: 11px; 
        color: var(--bme-muted); 
    }

    .loy-code {
        width: 100%; 
        font-family: ui-monospace, Menlo, Consolas, monospace; 
        font-weight: 700; 
        font-size: 13px;
        letter-spacing: 0.03em; 
        color: var(--bme-darker-green); 
        background: var(--bme-mint);
        border: 1px dashed var(--bme-green); 
        border-radius: 8px; 
        padding: 7px;
    }

    .loy-code:hover { 
        background: #dff0d0; 
    }

    .loy-locked { 
        display: block; 
        text-align: center; 
        font-size: 12px; 
        color: var(--bme-muted); 
        border: 1px dashed var(--bme-muted);
        border-radius: 8px;
        padding: 7px; 
    }
    
    .loy-note { 
        margin: 14px 0 0; 
        font-size: 11.5px; 
        color: var(--bme-muted); 
    }

    @media (max-width: 640px) {
        .loy-tiers { 
            grid-template-columns: 1fr; 
        }
    }

</style>