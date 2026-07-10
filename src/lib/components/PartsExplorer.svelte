<script lang="ts">
    import type { Component, Part, Boiler } from "$lib/types";
    import { SupabaseClient } from "@supabase/supabase-js";
    import { addItem } from "$lib/stores/quote";
    import { addToast } from "$lib/stores/toast";
    import { formatMoney } from "$lib/price";
    import BoilerDiagram from "./BoilerDiagram.svelte";

    let { boiler, components, supabase } = $props<{boiler: Boiler; components: Component[]; supabase: SupabaseClient;}>();

    let allParts = $state<Part[]>([]);
    let loading = $state(false);
    let activeComponentId = $state<string | null>(null);
    let search = $state('');
    let qty = $state<Record<string, number>>({});
    let loadedFor = $state<string | null>(null);
    let lightbox = $state<Part | null>(null);

    let compName = $derived(
        Object.fromEntries(components.map((c: Component) => [c.id, c.name])) as Record<string, string>
    );

    async function loadParts(comps: Component[]) {
        loading = true;
        allParts = [];
        activeComponentId = null;
        search = '';
        const ids = comps.map((c) => c.id);
        if (ids.length === 0) {
            loading = false;
            return;
        }
        const { data } = await supabase
            .from('parts')
            .select('*')
            .in('component_id', ids)
            .order('part_number', { ascending: true });
        allParts = (data ?? []) as Part[];
        loading = false;
    }

    $effect(() => {
        if (boiler && boiler.id !== loadedFor) {
            loadedFor = boiler.id;
            loadParts(components);
        }
    });

    let visibleParts = $derived(
        allParts.filter((p) => {
            const matchComp = !activeComponentId || p.component_id === activeComponentId;
            const q = search.trim().toLowerCase();
            const matchSearch =
                !q ||
                p.part_number.toLowerCase().includes(q) ||
                p.name.toLowerCase().includes(q) ||
                (p.description ?? '').toLowerCase().includes(q) ||
                (compName[p.component_id] ?? '').toLowerCase().includes(q);
            return matchComp && matchSearch;
        })
    );

    function selectComponent(id: string | null) {
        activeComponentId = id;
    }

    function add(p: Part) {
        addItem({
            partId: p.id,
            partNumber: p.part_number,
            partName: p.name,
            boilerCode: boiler.code,
            componentName: compName[p.component_id] ?? '',
            price: p.price ?? p.price_min ?? 0,
            priceMin: p.price ?? p.price_min ?? 0,
            priceMax: p.price ?? p.price_max ?? 0,
            quantity: qty[p.id] ?? 1
        });
        qty[p.id] = 1;
        addToast('Part added to quote list');
    }

    function priceLabel(p: Part): string {
        if (p.price != null) return `RM${formatMoney(p.price)}`;
        if (p.price_min != null && p.price_max != null) return `RM${formatMoney(p.price_min)} - RM${formatMoney(p.price_max)}`;
        return 'Price on request';
    }
</script>

<div class="explorer">
    <div class="card design">
        <h3>Boiler Design</h3>
        <BoilerDiagram {components} {activeComponentId} onselect={selectComponent} />
        <p class="diagram-hint">Click a section of the boiler to view its spare parts.</p>
    </div>

    <div class="right">
        <input
            class="search"
            type="search"
            placeholder="Search parts by name, number or component..."
            bind:value={search}
        />

        <div class="tabs">
            <button class="comp" class:active={activeComponentId === null} onclick={() => selectComponent(null)}>
                All Parts
            </button>
            {#each components as c (c.id)}
                <button class="comp" class:active={activeComponentId === c.id} onclick={() => selectComponent(c.id)}>
                    {c.name}
                </button>
            {/each}
        </div>

        {#if loading}
            <p class="hint">Loading parts...</p>
        {:else if allParts.length === 0}
            <p class="hint">No parts listed for this boiler yet.</p>
        {:else if visibleParts.length === 0}
            <p class="hint">No parts match your search.</p>
        {:else}
            <div class="parts">
                {#each visibleParts as p (p.id)}
                    <div class="card part bme-animate-in">
                        <div class="info">
                            <div class="pn">{p.part_number}</div>
                            <div class="pname">{p.name} <span class="tag">{compName[p.component_id]}</span></div>
                            {#if p.description}<div class="pdesc">{p.description}</div>{/if}
                            <div class="price">{priceLabel(p)}</div>
                        </div>
                        <div class="actions">
                            {#if p.image_url}
                                <button class="thumb" onclick={() => (lightbox = p)} title="View image" aria-label="View image of {p.name}">
                                    <img src={p.image_url} alt={p.name} loading="lazy" />
                                </button>
                            {/if}
                            <input type="number" min="1" value={qty[p.id] ?? 1} oninput={(e) => (qty[p.id] = Math.max(1, +e.currentTarget.value))} />
                            <button class="btn-primary" onclick={() => add(p)}>Add</button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

{#if lightbox}
    <div class="lightbox" onclick={() => (lightbox = null)} role="presentation">
        <div class="lightbox-inner bme-pop-in">
            <img src={lightbox.image_url} alt={lightbox.name} />
            <div class="lightbox-cap">
                <strong>{lightbox.part_number}</strong> <span>{lightbox.name}</span>
                <span class="lb-price">{priceLabel(lightbox)}</span>
            </div>
        </div>
        <button class="lightbox-close" onclick={() => (lightbox = null)} aria-label="Close">&times;</button>
    </div>
{/if}

<style>
    .explorer { 
        display: grid; 
        grid-template-columns: 1fr 1.2fr; 
        gap: 20px; 
        align-items: start; 
    }

    .design { 
        padding: 16px; 
    }

    .design h3 { 
        margin: 0 0 12px; 
        font-size: 14px; 
        color: var(--bme-muted); 
    }

    .search {
        border-radius: 0;
    }

    .tabs { 
        display: flex; 
        flex-wrap: wrap; 
        gap: 8px; 
        margin-bottom: 16px; 
    }

    .comp {
        background: #fff; 
        border: 1px solid var(--bme-border);
        color: var(--bme-ink); 
        padding: 9px 16px; 
        border-radius: 8px;
    }

    .comp:hover { 
        border-color: var(--bme-darker-blue); 
    }

    .comp.active { 
        background: var(--bme-darker-blue); 
        color: #fff; 
        border-color: var(--bme-darker-blue); 
    }

    .hint { 
        color: var(--bme-muted); 
        padding: 24px 0; 
    }

    .parts { 
        display: flex; 
        flex-direction: column; 
        gap: 12px; 
    }

    .part { 
        padding: 16px; 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        gap: 16px; 
    }

    .pn { 
        font-size: 12px; 
        font-weight: 700; 
        color: var(--bme-darker-green); 
    }

    .pname { 
        font-weight: 600; 
    }

    .pdesc { 
        font-size: 13px; 
        color: var(--bme-muted); 
        margin-top: 2px; 
    }

    .price {
        margin-top: 6px;
        font-weight: 700;
        color: var(--bme-darker-blue);
    }

    .actions { 
        display: flex; 
        align-items: center; 
        gap: 8px; 
        flex-shrink: 0; 
    }

    .actions input {
        width: 64px; 
        text-align: center; 
    }

    @media (max-width: 860px) { 
        .explorer { 
            grid-template-columns: 1fr; 
        } 
    }

    .diagram-hint {
        margin: 12px 0 0;
        font-size: 12px;
        color: var(--bme-muted);
        text-align: center;
    }

    .search {
        margin-bottom: 14px;
    }

    .tag {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #eaeff3;
        color: var(--bme-muted);
        font-size: 11px;
        font-weight: 600;
        vertical-align: middle;
    }

    @media (max-width: 640px) {
        .part { flex-direction: column; align-items: stretch; }
        .part .actions { justify-content: space-between; }
        .comp { padding: 8px 14px; }
        .design { padding: 12px; }
    }
    .thumb {
        flex-shrink: 0;
        width: 66px;
        height: 66px;
        margin-right: 10px;
        padding: 0;
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--bme-surface-2);
        cursor: pointer;
        transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
    }

    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .thumb:hover {
        transform: scale(1.06);
        border-color: var(--bme-teal);
        box-shadow: 0 6px 16px rgba(23, 135, 156, 0.22);
    }

    .part {
        border-left: 3px solid transparent;
    }

    .part:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(16, 36, 62, 0.10);
        border-left-color: var(--bme-green);
    }

    .lightbox {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: rgba(16, 36, 62, 0.72);
        display: grid;
        place-items: center;
        padding: 24px;
        animation: bmeFadeInUp var(--t-fast) var(--ease);
    }

    .lightbox-inner {
        background: #fff;
        border-radius: 14px;
        overflow: hidden;
        max-width: min(460px, 92vw);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
    }

    .lightbox-inner img {
        width: 100%;
        height: auto;
        display: block;
        max-height: 68vh;
        object-fit: contain;
        background: var(--bme-surface-2);
    }

    .lightbox-cap {
        padding: 12px 16px;
        font-size: 14px;
        color: var(--bme-ink);
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: baseline;
    }

    .lightbox-cap span { 
        color: var(--bme-muted); 
    }

    .lb-price {
        margin-left: auto;
        font-weight: 700;
        color: var(--bme-darker-blue) !important;
    }

    .lightbox-close {
        position: fixed;
        top: 18px;
        right: 22px;
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        font-size: 24px;
        line-height: 1;
    }

    .lightbox-close:hover { 
        background: rgba(255, 255, 255, 0.30); 
    }
</style>