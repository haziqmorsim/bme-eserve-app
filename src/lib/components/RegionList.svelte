<script lang="ts">
    import type { Region, Boiler } from "$lib/types";
    let { regions, activeBoilerId } = $props<{ regions: Region[]; activeBoilerId: string | null }>();

    let search = $state('');

    let filtered = $derived(
        regions.map((region: Region) => {
            const q = search.trim().toLowerCase();
            if (!q) return region;

            const regionMatch = region.name.toLowerCase().includes(q);
            const boilers = (region.boilers ?? []).filter((b: Boiler) =>
                regionMatch || 
                b.code.toLowerCase().includes(q) || 
                (b.name || '').toLowerCase().includes(q)
            );
            return { ...region, boilers };
        })
        .filter((region: Region) => (region.boilers ?? []).length > 0)
    )
</script>

<aside class="card sidebar">
    <input type="search" class="boiler-search" placeholder="Search boilers..." bind:value={search} />
    {#each filtered as region (region.id)}
    <details class="region">
        <summary>{region.name}</summary>
        <ul>
            {#each region.boilers ?? [] as boiler (boiler.id)}
            <li>
                <a href={`/app?boiler=${boiler.id}&tab=dashboard`} class:active={boiler.id === activeBoilerId}>
                <strong>{boiler.code}</strong>
                {#if boiler.name}<span>{boiler.name}</span>{/if}
                </a>
            </li>
            {/each}
        </ul>
    </details>
    {/each}
    {#if filtered.length === 0}
        <p class="no-results">No boilers found.</p>
    {/if}
</aside>

<style>
    .boiler-search {
        margin-bottom: 14px;
    }

    .no-results {
        color: var(--bme-muted);
        font-size: 13px;
        padding: 8px 4px;
        margin: 0;
    }

    .sidebar {
        padding: 16px; 
        height: fit-content;
    }

    .region {
        margin-bottom: 8px;
    }

    .region summary {
        cursor: pointer;
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 700;
        color: var(--bme-darker-blue);
        padding: 8px 4px;
        border-bottom: 1px solid var(--bme-border);
        user-select: none;
    }

    .region summary::-webkit-details-marker {
        display: none;
    }

    .region summary:hover {
        color: var(--bme-dark-blue);
    }

    .region summary::after {
        content: '';
        width: 7px;
        height: 7px;
        border-right: 2px solid var(--bme-muted);
        border-bottom: 2px solid var(--bme-muted);
        transform: rotate(-45deg);
        transition: transform 0.15s;
    }

    .region[open] summary::after {
        transform: rotate(45deg);
    }
    
    .region ul {
        list-style: none; 
        margin: 6px 0 0; 
        padding: 0;
    }

    .region li a {
        display: flex; 
        flex-direction: column; 
        gap: 1px;
        padding: 9px 12px; 
        border-radius: 8px; 
        color: var(--bme-ink);
    }

    .region li a:hover { 
        background: #eaeff3; 
    }

    .region li a.active { 
        background: var(--bme-darker-blue); 
        color: #fff; 
    
    }

    .region li a.active span { 
        color: #eaeff3; 
    }

    .region li a span { 
        font-size: 12px; 
        color: var(--bme-muted);
    }
</style>