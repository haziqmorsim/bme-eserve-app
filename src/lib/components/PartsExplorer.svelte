<script lang="ts">
    import type { Component, Part, Boiler } from "$lib/types";
    import { SupabaseClient } from "@supabase/supabase-js";
    import { addItem } from "$lib/stores/quote";
    import BoilerDiagram from "./BoilerDiagram.svelte";

    let { boiler, components, supabase } = $props<{boiler: Boiler; components: Component[]; supabase: SupabaseClient;}>();

    let allParts = $state<Part[]>([]);
    let loading = $state(false);
    let activeComponentId = $state<string | null>(null); // null = All
    let search = $state('');
    let qty = $state<Record<string, number>>({});
    let loadedFor = $state<string | null>(null);

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
            quantity: qty[p.id] ?? 1
        });
        qty[p.id] = 1;
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
                    <div class="card part">
                        <div class="info">
                            <div class="pn">{p.part_number}</div>
                            <div class="pname">{p.name} <span class="tag">{compName[p.component_id]}</span></div>
                            {#if p.description}<div class="pdesc">{p.description}</div>{/if}
                            {#if !p.in_stock}<div class="avail">made to order</div>{/if}
                        </div>
                        <div class="actions">
                            <input type="number" min="1" value={qty[p.id] ?? 1} oninput={(e) => (qty[p.id] = Math.max(1, +e.currentTarget.value))} />
                            <button class="btn-primary" onclick={() => add(p)}>Add</button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

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
        color: var(--bme-green-darker); 
    }

    .pname { 
        font-weight: 600; 
    }

    .pdesc { 
        font-size: 13px; 
        color: var(--bme-muted); 
        margin-top: 2px; 
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
</style>