<script lang="ts">
    import type { SortState } from "$lib/table-sort";

    let { label, key, sort, onsort } = $props<{
        label: string;
        key: string;
        sort: SortState;
        onsort: (key: string) => void;
    }>();

    let active = $derived(sort.key === key);
    let dir = $derived(active ? sort.dir : null);
</script>

<th aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
    <button type="button" class="sort-btn" class:active onclick={() => onsort(key)} title={`Sort by ${label}`}>
        <span>{label}</span>
        <svg class="arrows" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
            <path class="up" class:on={dir === 'asc'} d="M5 1 L9.5 6.5 L0.5 6.5 Z" />
            <path class="down" class:on={dir === 'desc'} d="M5 15 L0.5 9.5 L9.5 9.5 Z" />
        </svg>
    </button>
</th>

<style>
    .sort-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: 100%;
        padding: 0;
        margin: 0;
        background: none;
        border: 0;
        font: inherit;
        letter-spacing: inherit;
        text-transform: inherit;
        color: inherit;
        cursor: pointer;
        user-select: none;
    }
 
    .sort-btn:hover {
        color: var(--bme-ink, #1b2733);
    }
 
    .sort-btn:focus-visible {
        outline: 2px solid var(--bme-dark-blue, #004a8f);
        outline-offset: 3px;
        border-radius: 4px;
    }
 
    .sort-btn.active {
        color: var(--bme-ink, #1b2733);
    }
 
    .arrows {
        flex-shrink: 0;
    }
 
    .arrows path {
        fill: currentColor;
        opacity: 0.28;
        transition: opacity 0.12s;
    }
 
    .sort-btn:hover .arrows path {
        opacity: 0.45;
    }
 
    .arrows path.on,
    .sort-btn:hover .arrows path.on {
        opacity: 1;
    }
</style>