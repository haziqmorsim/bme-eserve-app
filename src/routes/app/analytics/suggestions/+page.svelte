<script lang="ts">
    import { Search, Undo2 } from "@lucide/svelte";
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();

    let search = $state('');
    let tab = $state<'pending' | 'reviewed' | 'all'>('pending');
    let busy = $state<Set<string>>(new Set());
    let picking = $state<string | null>(null);
    let pickQuery = $state('');

    const filtered = $derived(
        data.rows.filter((r: any) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return [r.query_text, r.suggested_part_number, r.actual_part_number, r.boiler_code]
                .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
        })
    );

    const list = $derived(
        tab === 'pending'
            ? filtered.filter((r: any) => r.outcome === 'pending') 
            : tab === 'reviewed' 
                ? filtered.filter((r: any) => r.outcome_source === 'staff') 
                : filtered
    );

    const pickMatches = $derived.by(() => {
        const q = pickQuery.trim().toLowerCase();
        if (!q) return data.parts.slice(0, 8);
        return data.parts
            .filter((p: any) => `${p.part_number} ${p.name}`.toLowerCase().includes(q))
            .slice(0, 8);
    })

    const when = (ts: string | null) => (ts ? new Date(ts).toLocaleString() : '\u2014');

    async function save(row: any, outcome: 'accepted' | 'rejected' | 'corrected', actualPartId: string | null) {
        if (busy.has(row.id)) return;
        busy = new Set(busy).add(row.id);

        const { error } = await data.supabase
            .from('part_suggestions')
            .update({
                outcome,
                actual_part_id: actualPartId,
                outcome_source: 'staff',
                outcme_at: new Date().toISOString(),
                reviewed_by: data.profile?.id ?? null
            })
            .eq('id', row.id);

        const next = new Set(busy);
        next.delete(row.id);
        busy = next;
        picking = null;
        pickQuery = '';

        if (error) {
            addToast(`Could not save review: ${error.message}`);
            return;
        }
        await invalidateAll();
        addToast('Review saved successfully.');
    }
</script>

<div class="head">
    <h1>Suggestion review</h1>
    <a href="/app/analytics">
        <button class="btn-primary"><Undo2 size={16} />Back to Analytics</button>
    </a>
</div>

<p class="intro">
    Confirm or correct the part the assistant suggested. Staff verdict are treated as ground truth and override the customer's own feedbacl.
</p>

<div class="searchbar card">
    <span class="search-ic"><Search size={16} /></span>
    <input type="search" placeholder="Search by message, parrt number, or boiler..." bind:value={search} />
</div>

{#if data.rows.length === 0}
    <div class="card empty">No suggestions have been recorded yet.</div>
{:else}
    <div class="tabbar">
        <button class="tab" class:active={tab === 'pending'} onclick={() => tab = 'pending'}>
            Unresolved ({data.counts.pending})
        </button>
        <button class="tab" class:active={tab === 'reviewed'} onclick={() => tab = 'reviewed'}>
            Staff reviewed ({data.counts.reviewed})
        </button>
        <button class="tab" class:active={tab === 'all'} onclick={() => tab = 'all'}>
            All ({data.counts.total})
        </button>
    </div>

    {#if list.length === 0}
        <div class="card empty">Nothing in this tab.</div>
    {:else}
        <div class="rows">
            {#each list as r (r.id)}
                <div class="card row">
                    <div class="meta">
                        <span class="chan">{r.channel}</span>
                        <span class="when">{when(r.created_at)}</span>
                        {#if r.boiler_code}<span class="boiler">{r.boiler_code}</span>{/if}
                        <span class="badge-out {r.outcome}">{r.outcome}</span>
                        {#if r.outcome_source}<span class="src">via {r.outcome_source}</span>{/if}
                    </div>

                    <p class="query">{r.query_text}</p>

                    <div class="suggested">
                        <span class="lbl">Assistant suggested</span>
                        {#if r.suggested_part_number}
                            <strong>{r.suggested_part_number}</strong>
                            {#if r.model_confidence}<span class="conf">{r.model_confidence}</span>{/if}
                        {:else}
                            <em>no specific parts</em>
                        {/if}
                    </div>

                    {#if r.actual_part_number}
                        <div class="suggested actual">
                            <span class="lbl">Correct part</span>
                            <strong>{r.actual_part_number}</strong>
                            <span class="pname">{r.actual_part_name}</span>
                        </div>
                    {/if}

                    {#if picking === r.id}
                        <div class="picker">
                            <input type="search" placeholder="Search the catalogue..." bind:value={pickQuery} />
                            <div class="pick-list">
                                {#each pickMatches as p (p.id)}
                                    <button class="pick" onclick={() => save(r, 'corrected', p.id)}>
                                        <strong>{p.part_number}</strong> <span>{p.name}</span>
                                    </button>
                                {/each}
                                {#if pickMatches.length === 0}
                                    <p class="nomatch">No matching parts.</p>
                                {/if}
                            </div>
                            <button class="cancel" onclick={() => { picking = null; pickQuery = '' }}>Cancel</button>
                        </div>
                    {:else}
                        <div class="actions">
                            <button class="act ok" disabled={busy.has(r.id) || !r.suggested_part_id} onclick={() => save(r, 'accepted', r.suggested_part_id)}>Suggestion was correct</button>
                            <button class="act fix" disabled={busy.has(r.id)} onclick={() => (picking = r.id)}>Correct it...</button>
                            <button class="act no" disabled={busy.has(r.id)} onclick={() => save(r, 'rejected', null)}>No part applies</button>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
{/if}

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 6px;
    }

    h1 {
        margin: 5px 0 10px;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .intro {
        color: var(--bme-muted);
        font-size: 0.85rem;
        line-height: 1.5;
        margin: 0 0 18px;
    }

    .searchbar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        margin-bottom: 20px;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        color: var(--bme-muted);
    }

    .searchbar:focus-within {
        border-color: var(--bme-dark-blue);
    }

    .search-ic {
        display: flex;
        flex: 0 0 auto;
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
        font-size: 14px;
        font-family: inherit;
        background-color: var(--bme-surface);
        color: var(--bme-muted);
        cursor: pointer;
        transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
    }

    .tab.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
        border-color: var(--bme-dark-blue);
    }

    .rows {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .row {
        padding: 18px 20px;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.72rem;
        color: var(--bme-muted);
        margin-bottom: 10px;
    }

    .chan, .boiler {
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-weight: 700;
        background: var(--bme-surface-2);
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
    }

    .when {
        color: var(--bme-muted);
    }

    .src {
        color: var(--bme-muted);
        font-style: italic;
    }

    .badge-out {
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-weight: 700;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        background: var(--bme-surface-2);
        color: var(--bme-muted);
    }

    .badge-out.accepted {
        background: #e8f2e0;
        color: #3f6212;
    }

    :root[data-theme='dark'] .badge-out.accepted {
        background: #1e3212;
        color: #9adf6c;
    }

    .badge-out.corrected {
        background: #fef3c7;
        color: #92400e;
    }

    :root[data-theme='dark'] .badge-out.corrected {
        background: #3a2f0f;
        color: #ffcc66;
    }

    .badge-out.rejected {
        background: #fde8e8;
        color: #9b1c1c;
    }

    :root[data-theme='dark'] .badge-out.rejected {
        background: #3a1c18;
        color: #ff9d8f;
    }

    .query {
        margin: 0 0 12px;
        font-size: 1rem;
        color: var(--bme-ink);
        line-height: 1.5;
    }

    .suggested {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.9rem;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: var(--bme-surface-2);
        border-radius: 8px;
    }

    .suggested strong {
        color: var(--bme-ink);
    }

    .suggested em {
        color: var(--bme-muted);
    }

    .suggested.actual strong {
        color: var(--bme-green);
    }

    .lbl {
        color: var(--bme-muted);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .pname {
        color: var(--bme-muted);
    }

    .conf {
        font-size: 0.7rem;
        text-transform: uppercase;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        color: var(--bme-muted);
        padding: 0.05rem 0.4rem;
        border-radius: 4px;
    }

    .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
    }

    .act {
        border: 1px solid var(--bme-border);
        background: var(--bme-surface);
        border-radius: 6px;
        padding: 0.45rem 0.85rem;
        font-size: 0.83rem;
        font-family: inherit;
        cursor: pointer;
        color: var(--bme-ink);
        transition: border-color var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease);
    }

    .act:hover:not(:disabled) {
        background: var(--bme-hover);
    }

    .act:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .act.ok:hover:not(:disabled) {
        border-color: var(--bme-green);
    }

    .act.no:hover:not(:disabled) {
        border-color: #c1121f;
    }

    :root[data-theme='dark'] .act.no:hover:not(:disabled) {
        border-color: #ff9d8f;
    }

    .picker {
        margin-top: 12px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        padding: 12px;
        background: var(--bme-surface-2);
    }

    .picker input {
        width: 100%;
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--bme-border);
        border-radius: 6px;
        font-size: 0.85rem;
        margin-bottom: 8px;
        background: var(--bme-surface);
        color: var(--bme-ink);
    }

    .pick-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .pick {
        display: block;
        width: 100%;
        text-align: left;
        border: none;
        background: none;
        padding: 0.45rem 0.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
        font-family: inherit;
        color: var(--bme-ink);
        cursor: pointer;
    }

    .pick:hover {
        background: var(--bme-hover);
    }

    .pick span {
        color: var(--bme-muted);
        margin-left: 0.4rem;
    }

    .nomatch {
        color: var(--bme-muted);
        font-size: 0.8rem;
        padding: 0.4rem 0.5rem;
        margin: 0;
    }

    .cancel {
        margin-top: 8px;
        border: none;
        background: none;
        color: var(--bme-muted);
        font-size: 0.8rem;
        font-family: inherit;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
    }

    .cancel:hover {
        color: var(--bme-ink);
        text-decoration: underline;
    }

    .empty {
        text-align: center;
        color: var(--bme-muted);
        padding: 2.5rem 1.5rem;
    }
</style>