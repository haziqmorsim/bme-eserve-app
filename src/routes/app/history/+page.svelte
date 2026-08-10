<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import { addItem } from "$lib/stores/quote";
    import Stepper from "$lib/components/Stepper.svelte";
    import { Search, X } from "@lucide/svelte";
    import Pagination from "$lib/components/admin/Pagination.svelte";
    import { untrack } from "svelte";

    let { data } = $props();

    function attachList(q: any): { url: string; name: string }[] {
        if (Array.isArray(q.attachments) && q.attachments.length) return q.attachments;
        if (q.attachment_url) return [{ url: q.attachment_url, name: q.attachment_name ?? 'Download file' }];
        return [];
    }

    const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
    let myLevel = $derived(ROLE_LEVEL[data.profile?.role] ?? 0);
    let working = $state<string | null>(null);
    let copied = $state<string | null>(null);

    async function copyCode(code: string) {
        try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
        copied = code;
        setTimeout(() => { if (copied === code) copied = null; }, 1500);
    }

    let readding = $state<string | null>(null);

    async function requestAgain(q: any) {
        const items = q.quote_items ?? [];
        if (items.length === 0) {
            addToast('This request has no parts to add.');
            return;
        }

        readding = q.id;
        const ids = [...new Set(items.map((i: any) => i.part_id).filter(Boolean))];

        let current: any[] = [];
        if (ids.length) {
            const { data: rows, error } = await data.supabase
                .from('parts')
                .select('id, part_number, name, price, price_min, price_max, components(name)')
                .in('id', ids);

            if (error) {
                readding = null;
                addToast('Could not add these parts to your quote list. Please try again.');
                return;
            }
            current = rows ?? [];
        }

        const byId: Record<string, any> = {};
        for (const p of current) byId[p.id] = p;

        let added = 0;
        let missing = 0;

        for (const it of items) {
            const part = it.part_id ? byId[it.part_id] : null;
            if (!part) { missing++; continue; }

            const comp: any = part.components;
            const componentName = Array.isArray(comp) ? (comp[0]?.name ?? '') : (comp?.name ?? '');

            addItem({
                partId: part.id, 
                partNumber: part.part_number ?? it.part_number ?? '', 
                partName: part.name ?? it.part_name ?? '', 
                boilerCode: it.boiler_code ?? '', 
                componentName, 
                price: part.price ?? undefined, 
                priceMin: part.price_min ?? part.price ?? 0, 
                priceMax: part.price_max ?? part.price ?? 0, 
                quantity: it.quantity ?? 1
            });
            added++;
        }

        readding = null;

        if (added === 0) {
            addToast('None of these parts are currently available.');
        } else if (missing > 0) {
            addToast(`${added} part(s) added to your quote list. ${missing} part(s) are no longer available.`);
        } else {
            addToast(
                added === 1
                    ? '1 part added to your quote list.'
                    : `${added} parts added to your quote list.`
            );
        }
    }

    let search = $state('');

    function hit(values: (string | null | undefined)[]): boolean {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return values.some((v) => (v ?? '').toString().toLowerCase().includes(q));
    }

    let groups = $derived(data.reviewGroups ?? []);
    let myQuotes = $derived(data.quotes ?? []);

    let chats = $derived(data.chats ?? []);

    function itemText(q: any): string[] {
        return (q?.quote_items ?? []).flatMap((it: any) => [it.part_number, it.part_name, it.boiler_code]);
    }

    function chatText(c: any): string[] {
        return [...(c?.chat_messages ?? []).map((m: any) => m.content), c?.end_reason];
    }

    let filteredGroups = $derived(groups.filter((g: any) => hit([
        g.quote?.reference, 
        g.customer?.company, 
        g.customer?.full_name, 
        g.quote?.status, 
        ...itemText(g.quote)
    ])));

    let filteredQuotes = $derived(myQuotes.filter((q: any) => hit([
        q.reference, 
        q.notes, 
        q.status, 
        ...itemText(q)
    ])));

    let filteredChats = $derived(chats.filter((c: any) => hit(chatText(c))));

    const PAGE_SIZE = 10;
    let tab = $state<'reviews' | 'requests' | 'chats'>(untrack(() => (data.isStaff ? 'reviews' : 'requests')));
    let reviewPage = $state(1);
    let requestPage = $state(1);

    let searchPlaceholder = $derived(
        tab === 'chats'
            ? 'Search chat messages...'
            : tab === 'reviews'
                ? 'Search by reference, customer, status or part...'
                : 'Search by reference, notes, status or part...'
    );

    $effect(() => {
        search;
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

<div class="searchbar">
    <Search size={17} />
    <input
        type="search"
        bind:value={search}
        placeholder={searchPlaceholder}
        aria-label="Search history" />
    {#if search}
        <button class="clear" onclick={() => (search = '')} aria-label="Clear search">
            <X size={15} />
        </button>
    {/if}
</div>

<div class="tabbar">
    {#if data.isStaff}
        <button class="tab" class:active={tab === 'reviews'} onclick={() => { tab = 'reviews'; }}>Reviews</button>
    {/if}
    <button class="tab" class:active={tab === 'requests'} onclick={() => { tab = 'requests'; }}>Requests</button>
    <button class="tab" class:active={tab === 'chats'} onclick={() => { tab = 'chats'; }}>Chats</button>
</div>

{#if data.isStaff && tab === 'reviews'}
    <section class="block">

        {#if groups.length === 0}
            <div class="card empty">You have not acted on any requests yet.</div>
        {:else if filteredGroups.length === 0}
            <div class="card empty">No reviews match your search.</div>
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

{#if tab === 'requests'}
    <section class="block">

        <!-- {#if data.loyalty}
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
        {/if} -->

        {#if myQuotes.length === 0}
            <div class="card empty">You have not submitted any requests yet.</div>
        {:else if filteredQuotes.length === 0}
            <div class="card empty">No requests match your search.</div>
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

                    <div class="meta">
                        {#if data.isStaff}
                            <Stepper status={q.status} level={q.current_level} />
                        {/if}
                    </div>

                    <div class="qfoot">
                        <button
                            class="again"
                            onclick={() => requestAgain(q)}
                            disabled={readding === q.id || (q.quote_items ?? []).length === 0}>
                            {readding === q.id ? 'Adding...' : 'Request Again'}
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
        {#if filteredQuotes.length > 0}
            <Pagination total={filteredQuotes.length} page={requestCur} pageSize={PAGE_SIZE} onpage={(p) => (requestPage = p)} />
        {/if}
    </section>
{/if}

{#if tab === 'chats'}
    <section class="block">
        {#if chats.length === 0}
            <div class="card empty">You have no chatbot conversations yet.</div>
        {:else if filteredChats.length === 0}
            <div class="card empty">No conversations match your search.</div>
        {:else}
            {#each filteredChats as c (c.id)}
                <div class="card chat-session">
                    <div class="cs-head">
                        <div class="cs-times">
                            <span class="cs-label">Started</span>
                            <span class="cs-val">{when(c.started_at)}</span>
                        </div>
                        <div class="cs-times">
                            <span class="cs-label">Ended</span>
                            {#if c.ended_at}
                                <span class="cs-val">
                                    {when(c.ended_at)} {#if c.end_reason}<span class="cs-reason">({c.end_reason})</span>{/if}
                                </span>
                            {:else}
                                <span class="cs-val ongoing">Ongoing</span>
                            {/if}
                        </div>
                    </div>

                    {#if c.chat_messages.length === 0}
                        <p class="cs-empty">No messages in this conversation.</p>
                    {:else}
                        <div class="cs-thread">
                            {#each c.chat_messages as m (m.id)}
                                <div class="cm {m.role}">
                                    <div class="cm-bubble">
                                        <div class="cm-top">
                                            <span class="cm-who">{m.role === 'assistant' ? 'Assistant' : 'You'}</span>
                                            <span class="cm-time">{when(m.created_at)}</span>
                                        </div>
                                        {#if m.image_url}
                                            <a href={m.image_url} target="_blank" rel="noopener noreferrer" class="cm-img">
                                                <img src={m.image_url} alt="Uploaded in chat" />
                                            </a>
                                        {/if}
                                        {#if m.content}<p class="cm-text">{m.content}</p>{/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </section>
{/if}

<style>
    .qfoot {
        display: flex;
        justify-content: flex-end;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--bme-border);
    }

    .again {
        padding: 8px 18px;
        border: 1px solid var(--bme-dark-blue);
        border-radius: 8px;
        background: #ffffff;
        color: var(--bme-dark-blue);
        font: inherit;
        font-weight: 600;
        font-size: 13.5px;
        cursor: pointer;
        transition: background 140ms ease, color 140ms ease;
    }

    .again:hover:not(:disabled) {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .again:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .searchbar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        margin-bottom: 16px;
        background: #ffffff;
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        color: var(--bme-muted);
    }

    .searchbar:focus-within {
        border-color: var(--bme-dark-blue);
    }

    .searchbar input {
        flex: 1;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        font: inherit;
        color: var(--bme-ink);
    }

    .searchbar input::-webkit-search-cancel-button {
        display: none;
    }

    .clear {
        display: inline-grid;
        place-items: center;
        flex: 0 0 auto;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 50%;
        background: var(--bme-bg);
        color: var(--bme-muted);
        cursor: pointer;
    }

    .clear:hover {
        color: var(--bme-ink);
    }

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

    .attachment {
        margin: 6px 0 0;
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

    .chat-session {
        margin-bottom: 14px;
        padding: 14px;
    }

    .cs-head {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 32px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--bme-border);
        margin-bottom: 14px;
    }

    .cs-times {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .cs-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--bme-muted);
        font-weight: 600;
    }

    .cs-val {
        font-size: 14px;
        color: var(--bme-ink);
        font-weight: 600;
    }

    .cs-val.ongoing {
        color: var(--bme-green);
    }

    .cs-reason {
        color: var(--bme-muted);
        font-weight: 500;
        text-transform: capitalize;
    }

    .cs-empty {
        color: var(--bme-muted);
        margin: 0;
    }

    .cs-thread {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .cm {
        display: flex;
    }

    .cm.user {
        justify-content: flex-end;
    }

    .cm.assistant {
        justify-content: flex-start;
    }

    .cm-bubble {
        max-width: 78%;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--bme-border);
    }

    .cm.user .cm-bubble {
        background: var(--bme-sky);
        border-color: var(--bme-sky);
    }

    .cm.assistant .cm-bubble {
        background: var(--bme-light-grey);
    }

    .cm-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 4px;
    }

    .cm.user .cm-who {
        font-size: 12px;
        font-weight: 700;
        color: var(--bme-dark-blue);
    }

    .cm.assistant .cm-who {
        font-size: 12px;
        font-weight: 700;
        color: #000000;
    }

    .cm-time {
        font-size: 11px;
        color: var(--bme-muted);
    }

    .cm-text {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--bme-ink);
        white-space: pre-wrap;
        word-break: break-word;
    }

    .cm-img {
        display: block;
        margin-bottom: 6px;
    }

    .cm-img img {
        max-width: 200px;
        max-height: 200px;
        border-radius: 8px;
        display: block;
    }

    @media (max-width: 640px) {
        .tabbar {
            width: 100%;
            justify-content: space-between;
        }

        .tab {
            width: 30%;
        }

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

        .loy-tiers { 
            grid-template-columns: 1fr; 
        }
    }
</style>