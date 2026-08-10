<script lang="ts">
    import { Search } from "@lucide/svelte";
    import { emptyFilters, isActive, type Filters } from "$lib/filters";

    let {
        filters = $bindable(), 
        regions = [], 
        showStatus = true, 
        showRegion = true, 
        placeholder = "Search by reference..."
    } = $props<{
        filters: Filters;
        regions?: { id?: string; name: string; }[];
        showStatus?: boolean;
        showRegion?: boolean;
        placeholder?: string;
    }>();

    let active = $derived(isActive(filters));

    function clear() {
        filters = emptyFilters();
    }
</script>

<div class="filters card">
    <div class="search">
        <span class="search-ic"><Search size={16} /></span>
        <input type="search" {placeholder} bind:value={filters.q} />
    </div>

    {#if showStatus}
        <label class="f">
            <span>Status</span>
            <select bind:value={filters.status}>
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
            </select>
        </label>
    {/if}

    <!-- {#if showRegion}
        <label class="f">
            <span>Region</span>
            <select bind:value={filters.region}>
                <option value="all">All regions</option>
                {#each regions as r (r.name)}
                    <option value={r.name}>{r.name}</option>
                {/each}
            </select>
        </label>
    {/if} -->

    <label class="f">
        <span>From</span>
        <input type="date" bind:value={filters.from} max={filters.to || undefined} />
    </label>

    <label class="f">
        <span>To</span>
        <input type="date" bind:value={filters.to} min={filters.from || undefined} />
    </label>

    {#if active}
        <button class="clear" onclick={clear} aria-label="Clear filters">
            Reset filters
        </button>
    {/if}
</div>

<style>
    .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        padding: 14px 16px;
        margin-bottom: 18px;
    }
 
    .search {
        position: relative;
        flex: 1 1 220px;
        min-width: 180px;
    }
 
    .search-ic {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--bme-muted);
        display: inline-flex;
        pointer-events: none;
    }
 
    .search input {
        width: 100%;
        padding-left: 32px;
    }
 
    .f {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
 
    .f span {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--bme-muted);
        font-weight: 600;
    }
 
    .f select,
    .f input {
        padding: 8px 10px;
    }
 
    .clear {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 38px;
        padding: 0 14px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        background: #ffffff;
        color: var(--bme-red);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }
 
    .clear:hover { 
        border-color: var(--bme-red); 
    }
 
    @media (max-width: 640px) {
        .filters { 
            gap: 10px; 
        }

        .f, .search { 
            flex: 1 1 100%; 
        }

        .f select, .f input { 
            width: 100%; 
        }
    }
</style>