<script lang="ts">
    import type { Boiler } from "$lib/types";
    import { logActivity } from "$lib/activity";

    let {
        boilers, 
        activeBoilerId, 
        customerNoBoilers = false, 
        supabase = null, 
        profile = null
    } = $props<{
        boilers: Boiler[];
        activeBoilerId: string | null;
        customerNoBoilers?: boolean;
        supabase?: any;
        profile?: any;
    }>();

    let search = $state('');

    let searchLogged = false;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;

    function onSearchInput() {
        clearTimeout(searchTimer);
        if (!search.trim()) {
            searchLogged = false;
            return;
        }
        if (searchLogged) return;
        searchTimer = setTimeout(() => {
            searchLogged = true;
            logActivity(
                supabase, 
                profile ? { id: profile.id, role: profile.role } : null, 
                { event_type: 'page_view', path: '/app', meta: { trigger: 'boiler_search'}}
            );
        }, 700);
    }

    let filtered = $derived(
        boilers.filter((b: Boiler) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return b.code.toLowerCase().includes(q) || (b.name || '').toLowerCase().includes(q);
        })
    );
</script>

<aside class="card sidebar">
    {#if customerNoBoilers}
        <p class="no-boilers">No boilers assigned yet.</p>
    {:else}
        <input
            type="search" 
            class="boiler-search" 
            placeholder="Search boilers..." 
            bind:value={search} 
            oninput={onSearchInput}
        />

        {#if filtered.length === 0}
            <p class="no-results">No boilers found.</p>
        {:else}
            <ul class="boilers">
                {#each filtered as boiler (boiler.id)}
                    <li>
                        <a href={`/app?boiler=${boiler.id}&tab=dashboard`} class:active={boiler.id === activeBoilerId}>
                            <strong>{boiler.code}</strong>
                            {#if boiler.name}<span>{boiler.name}</span>{/if}
                        </a>
                    </li>
                {/each}
            </ul>
        {/if}
    {/if}
</aside>

<style>
    .boiler-search {
        margin-bottom: 14px;
    }

    .no-boilers {
        color: var(--bme-muted);
        font-size: 13px;
        text-align: center;
    }

    .no-results {
        color: var(--bme-muted);
        font-size: 13px;
        padding: 8px 4px;
        margin: 0;
    }

    .sidebar {
        padding: 16px;
        height: 100%;
    }

    .boilers {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .boilers li a {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 9px 12px;
        border-radius: 8px;
        color: var(--bme-ink);
    }

    .boilers li a:hover {
        background: #eaeff3;
    }

    .boilers li a.active {
        background: var(--bme-darker-blue);
        color: #ffffff;
    }

    .boilers li a.active span {
        color: #eaeff3;
    }

    .boilers li a span {
        font-size: 12px;
        color: var(--bme-muted);
    }

    @media (max-width: 860px) {
        .sidebar {
            height: fit-content;
        }
    }
</style>