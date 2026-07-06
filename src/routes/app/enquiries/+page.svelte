<script lang="ts">
    import { Search, Mail } from "@lucide/svelte";

    let { data } = $props();
    let search = $state('');

    let filtered = $derived(data.enquiries.filter((e: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [e.name, e.email, e.company, e.message].some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));

    function when(ts: string): string {
        return new Date(ts).toLocaleString();
    }
</script>

<h1>Enquiries</h1>

<div class="searchbar card">
    <span class="search-ic"><Search size={16} /></span>
    <input type="search" placeholder="Search by name, e-mail, company, or message..." bind:value={search} />
</div>

{#if data.enquiries.length === 0}
    <div class="card empty">No enquiries have been received yet.</div>
{:else if filtered.length === 0}
    <div class="card empty">No enquiries match your search.</div>
{:else}
    {#each filtered as e (e.id)}
        <div class="card enquiry">
            <div class="ehead">
                <div>
                    <strong class="ename">{e.name}</strong>
                    {#if e.company}<span class="company">{e.company}</span>{/if}
                </div>
                <small>{when(e.created_at)}</small>
            </div>
            <a href="mailto:{e.email}" class="email"><Mail size={14} /> {e.email}</a>
            <p class="message">{e.message}</p>
            <div class="actions">
                <a href="mailto:{e.email}?subject=Re: Your enquiry to Boilermech" class="btn-primary reply">Reply</a>
            </div>
        </div>
    {/each}
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
 
    .ehead small {
        flex: 0 0 auto;
        color: var(--bme-muted);
        font-size: 12.5px;
    }
 
    .email {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--bme-dark-blue);
        text-decoration: none;
    }
 
    .email:hover { text-decoration: underline; }
 
    .message {
        margin: 12px 0 0;
        font-size: 14px;
        color: var(--bme-ink);
        line-height: 1.55;
        white-space: pre-line;
    }
 
    .actions {
        margin-top: 14px;
    }
 
    .reply {
        display: inline-block;
        text-decoration: none;
    }
 
    @media (max-width: 640px) {
        .enquiry { padding: 16px; }
        .ehead { flex-direction: column; align-items: flex-start; gap: 4px; }
    }
</style>