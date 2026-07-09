<script lang="ts">
    import { Search, Mail } from "@lucide/svelte";
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();
    let search = $state('');
    let tab = $state<'unreplied' | 'replied'>('unreplied');
    let busy = $state<Set<string>>(new Set());
    let isDeveloper = $derived(data.profile?.role === 'developer');

    let filtered = $derived(data.enquiries.filter((e: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [e.name, e.email, e.company, e.message].some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));

    let unreplied = $derived(filtered.filter((e: any) => !e.replied_at));
    let replied = $derived(filtered.filter((e: any) => e.replied_at));
    let list = $derived(tab === 'unreplied' ? unreplied : replied);

    function when(ts: string): string {
        return new Date(ts).toLocaleString();
    }

    async function markAsReplied(e: any) {
        if (busy.has(e.id)) return;
        busy = new Set(busy).add(e.id);

        const { error } = await data.supabase
            .from('enquiries')
            .update({ replied_at: new Date().toISOString() })
            .eq('id', e.id);

        const next = new Set(busy);
        next.delete(e.id);
        busy = next;

        if (error) {
            addToast(`Could not mark as replied: ${error.message}`);
            return;
        }
        await invalidateAll();
        addToast('Enquiry marked as replied.');
    }
</script>

<h1>Enquiries</h1>

<div class="searchbar card">
    <span class="search-ic"><Search size={16} /></span>
    <input type="search" placeholder="Search by name, e-mail, company, or message..." bind:value={search} />
</div>

{#if data.enquiries.length === 0}
    <div class="card empty">No enquiries have been received yet.</div>
{:else}
    <div class="tabbar">
        <button class="tab" class:active={tab === 'unreplied'} onclick={() => (tab = 'unreplied')}>Unreplied ({unreplied.length})</button>
        <button class="tab" class:active={tab === 'replied'} onclick={() => (tab = 'replied')}>Replied ({replied.length})</button>
    </div>
    {#if filtered.length === 0}
        <div class="card empty">
            {#if search.trim()}
                No enquiries matched your search.
            {:else if tab === 'unreplied'}
                No unreplied enquiries.
            {:else}
                No replied enquiries yet.
            {/if}
        </div>
    {:else}
        {#each list as e (e.id)}
            <div class="card enquiry">
                <div class="ehead">
                    <div>
                        <strong class="ename">{e.name}</strong>
                        {#if e.company}<span class="company">{e.company}</span>{/if}
                    </div>
                    <div class="emeta">
                        <small>{when(e.created_at)}</small>
                        {#if e.replied_at}<small class="replied-on">Marked as replied on {when(e.replied_at)}</small>{/if}
                    </div>
                </div>
                <p class="email"><Mail size={14} /> {e.email}</p>
                <p class="message">{e.message}</p>
                <div class="actions">
                    {#if !e.replied_at}
                        <a
                            href={isDeveloper ? undefined : `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(e.email)}&subject=${encodeURIComponent('Re: Your enquiry to Boilermech')}`}
                            target="_blank"
                            rel="noopener"
                            class="btn-primary reply"
                            class:disabled={isDeveloper}
                            aria-disabled={isDeveloper}
                            tabindex={isDeveloper ? -1 : undefined}>
                            Reply
                        </a>
                        <button class="mark-btn" onclick={() => markAsReplied(e)} disabled={isDeveloper || busy.has(e.id)}>
                            {busy.has(e.id) ? 'Saving…' : 'Mark as replied'}
                        </button>
                    {/if}
                </div>
                {#if isDeveloper}
                    <p class="hint">Read-only for the developer role.</p>
                {/if}
            </div>
        {/each}
    {/if}
{/if}

<style>
    h1 { 
        margin: 5px 0 15px;
    }
 
    .searchbar {
        position: relative;
        padding: 0;
        margin-bottom: 18px;
    }
 
    .search-ic {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--bme-muted);
        display: inline-flex;
        pointer-events: none;
    }
 
    .searchbar input {
        width: 100%;
        padding: 11px 14px 11px 36px;
        border: none;
        background: transparent;
    }

    .tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }

    .tab {
        padding: 9px 20px;
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

    .tab:hover {
        border-color: var(--bme-dark-blue);
    }
 
    .empty {
        padding: 36px;
        text-align: center;
        color: var(--bme-muted);
    }
 
    .enquiry {
        padding: 18px 20px;
        margin-bottom: 14px;
    }
 
    .ehead {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 6px;
    }
 
    .ename {
        font-size: 16px;
        color: var(--bme-ink);
    }
 
    .company {
        margin-left: 10px;
        font-size: 13px;
        color: var(--bme-muted);
    }

    .emeta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex: 0 0 auto;
    }
 
    .ehead small {
        flex: 0 0 auto;
        color: var(--bme-muted);
        font-size: 12.5px;
    }

    .emeta .replied-on {
        flex: 0 0 auto;
        color: var(--bme-muted);
        font-size: 12.5px;
        font-weight: 600;
    }
 
    .email {
        display: inline-flex;
        align-items: center;
        margin: 0;
        gap: 6px;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--bme-dark-blue);
        text-decoration: none;
    }
 
    .message {
        margin: 12px 0;
        font-size: 14px;
        color: var(--bme-ink);
        line-height: 1.55;
        white-space: pre-line;
    }
 
    .actions {
        margin-top: 14px;
        padding-top: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
 
    .reply.disabled {
        opacity: 0.55;
        pointer-events: none;
        cursor: default;
    }

    .reply {
        font-family: inherit;
        font-size: 14px;
        cursor: pointer;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        padding: 8px 12px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
    }

    .mark-btn {
        font-family: inherit;
        cursor: pointer;
        border: 1px solid var(--bme-dark-blue);
        background-color: #ffffff;
        color: var(--bme-dark-blue);
        border-radius: 8px;
        font-weight: 600;
        padding: 8px 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background-color var(--t-fast) var(--ease);
    }

    .mark-btn:hover:not(:disabled) {
        background-color: #eaeff3;
    }

    .mark-btn:disabled {
        opacity: 0.6;
        cursor: default;
    }

    .hint {
        margin: 10px 0 0;
        font-size: 13px;
        color: var(--bme-muted);
    }
 
    @media (max-width: 640px) {
        .enquiry { 
            padding: 16px; 
        }

        .ehead { 
            flex-direction: column; 
            align-items: flex-start; 
            gap: 4px; 
        }

        .emeta {
            align-items: flex-start;
        }
    }
</style>