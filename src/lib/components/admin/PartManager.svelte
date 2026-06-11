<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";

    let { parts, components, boilers, supabase } = $props<{
        parts: any[]; components: any[]; boilers: any[]; supabase: SupabaseClient;
    }>();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});

    let boilerCode = $derived(Object.fromEntries(boilers.map((b: any) => [b.id, b.code])) as Record<string, string>);
    let formComponents = $derived(components.filter((c: any) => c.boiler_id === form.boiler_id));

    let filtered = $derived(parts.filter((p: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [p.part_number, p.name, p.components?.name, boilerCode[p.components?.boiler_id]]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return { boiler_id: boilers[0]?.id ?? '', component_id: '', part_number: '', name: '', description: '', price_min: '', price_max: '', stock_quantity: 0 };
    }
    function startNew() {
        form = blank();
        form.component_id = components.find((c: any) => c.boiler_id === form.boiler_id)?.id ?? '';
        err = ''; editing = 'new';
    }
    function startEdit(p: any) {
        form = {
            boiler_id: p.components?.boiler_id ?? '', component_id: p.component_id,
            part_number: p.part_number, name: p.name, description: p.description ?? '',
            price_min: p.price_min ?? '', price_max: p.price_max ?? '', stock_quantity: p.stock_quantity ?? 0
        };
        err = ''; editing = p.id;
    }
    function cancel() { editing = null; err = ''; }
    function onBoilerChange() {
        form.component_id = components.find((c: any) => c.boiler_id === form.boiler_id)?.id ?? '';
    }

    async function save() {
        if (!form.component_id) { err = 'Pick a boiler that has a component, then choose the component.'; return; }
        if (!form.part_number?.trim() || !form.name?.trim()) { err = 'Part number and name are required.'; return; }
        const min = form.price_min === '' ? null : Number(form.price_min);
        const max = form.price_max === '' ? null : Number(form.price_max);
        if (min !== null && max !== null && max < min) { err = 'Max price cannot be less than min price.'; return; }
        const qty = Math.max(0, Number(form.stock_quantity) || 0);

        busy = true; err = '';
        const payload = {
            component_id: form.component_id, part_number: form.part_number.trim(), name: form.name.trim(),
            description: form.description || null, price_min: min, price_max: max,
            stock_quantity: qty, in_stock: qty > 0
        };
        const resp = editing === 'new'
            ? await supabase.from('parts').insert(payload)
            : await supabase.from('parts').update(payload).eq('id', editing);
        busy = false;
        if (resp.error) { err = resp.error.message; return; }
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('parts').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        deleting = null;
        await invalidateAll();
    }

    function range(p: any) {
        if (p.price_min == null || p.price_max == null) return '—';
        return `RM${p.price_min} – RM${p.price_max}`;
    }
</script>

<div class="adm-bar">
    <input class="adm-search" type="search" placeholder="Search parts..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>Add Part</button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No parts found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Part #</th><th>Name</th><th>Boiler / Component</th><th>Price Range</th><th>Stock</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as p (p.id)}
                    <tr>
                        <td style="text-align: center; vertical-align: middle;"><strong>{p.part_number}</strong></td>
                        <td style="vertical-align: middle;">{p.name}</td>
                        <td style="text-align: center; vertical-align: middle;">{boilerCode[p.components?.boiler_id] ?? '—'} / {p.components?.name ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{range(p)}</td>
                        <td style="text-align: center; vertical-align: middle;">{p.stock_quantity}</td>
                        <td>
                            <div class="adm-actions">
                                <button class="adm-link" onclick={() => startEdit(p)}>Edit</button>
                                <button class="adm-link danger" onclick={() => (deleting = p)}>Delete</button>
                            </div>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

{#if total > 0}
    <Pagination {total} page={curPage} {pageSize} onpage={(p) => (page = p)} />
{/if}

{#if editing !== null}
    <Modal title={editing === 'new' ? 'Add Part' : 'Edit Part'} onclose={cancel}>
        <div class="adm-form">
            <label><span>Boiler *</span>
                <select bind:value={form.boiler_id} onchange={onBoilerChange}>
                    {#each boilers as b (b.id)}<option value={b.id}>{b.code}</option>{/each}
                </select>
            </label>
            <label><span>Component *</span>
                <select bind:value={form.component_id}>
                    {#each formComponents as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
                </select>
            </label>
            <label><span>Part Number *</span><input bind:value={form.part_number} placeholder="PB130-TB-001" /></label>
            <label><span>Name *</span><input bind:value={form.name} /></label>
            <label><span>Price Min (RM)</span><input type="number" min="0" bind:value={form.price_min} /></label>
            <label><span>Price Max (RM)</span><input type="number" min="0" bind:value={form.price_max} /></label>
            <label><span>Quantity In Stock</span><input type="number" min="0" bind:value={form.stock_quantity} /></label>
            <label class="full"><span>Description</span><textarea rows="2" bind:value={form.description}></textarea></label>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleting}
    <Modal title="Delete Part" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Delete part <strong>{deleting.part_number}</strong>?</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}