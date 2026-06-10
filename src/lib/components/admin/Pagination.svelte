<script lang="ts">
    let { total, page, pageSize, onpage } = $props<{
        total: number; page: number; pageSize: number; onpage: (p: number) => void;
    }>();

    let start = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
    let end = $derived(Math.min(page * pageSize, total));
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

    let items = $derived(buildItems(page, pages));

    function buildItems(current: number, totalPages: number): (number | '...')[] {
        const delta = 2;
        const range: number[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }
        const out: (number | '...')[] = [];
        let prev = 0;
        for (const i of range) {
            if (prev) {
                if (i - prev === 2) out.push(prev + 1);
                else if (i - prev > 2) out.push('...');
            }
            out.push(i);
            prev = i;
        }
        return out;
    }

    function go(p: number) {
        if (p >= 1 && p <= pages && p !== page) onpage(p);
    }
</script>

<div class="pager">
    <span class="pager-info">Showing {start}-{end} of {total} results</span>
    <div class="pager-btns">
        <button class="pg-btn" disabled={page <= 1} onclick={() => go(1)} aria-label="First page">«</button>
        <button class="pg-btn" disabled={page <= 1} onclick={() => go(page - 1)} aria-label="Previous page">‹</button>

        {#each items as it}
            {#if it === '...'}
                <span class="pg-ellipsis">…</span>
            {:else}
                <button class="pg-btn" class:active={it === page} aria-current={it === page ? 'page' : undefined} onclick={() => go(it)}>{it}</button>
            {/if}
        {/each}

        <button class="pg-btn" disabled={page >= pages} onclick={() => go(page + 1)} aria-label="Next page">›</button>
        <button class="pg-btn" disabled={page >= pages} onclick={() => go(pages)} aria-label="Last page">»</button>
    </div>
</div>