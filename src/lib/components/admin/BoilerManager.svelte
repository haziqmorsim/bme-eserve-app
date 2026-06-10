<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";

    let { boilers, regions, supabase } = $props<{ boilers: any[]; regions: any[]; supabase: SupabaseClient }>();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});

    let filtered = $derived(boilers.filter((b: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [b.code, b.name, b.regions?.name, b.capacity, b.status, b.fuel_type]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return {
            region_id: regions[0]?.id ?? '', code: '', name: '', capacity: '', pressure: '',
            steam_temperature: '', fuel_type: '', year_commissioned: '', status: 'Operational',
            description: '', design_image_url: ''
        };
    }
    function startNew() { form = blank(); err = ''; editing = 'new'; }
    function startEdit(b: any) { form = { ...b }; err = ''; editing = b.id; }
    function cancel() { editing = null; err = ''; }

    async function save() {
        if (!form.code?.trim() || !form.region_id) { err = 'Region and code are required.'; return; }
        busy = true; err = '';
        const payload = {
            region_id: form.region_id, code: form.code.trim(), name: form.name || null,
            capacity: form.capacity || null, pressure: form.pressure || null,
            steam_temperature: form.steam_temperature || null, fuel_type: form.fuel_type || null,
            year_commissioned: form.year_commissioned ? Number(form.year_commissioned) : null,
            status: form.status || null, description: form.description || null,
            design_image_url: form.design_image_url || null
        };
        const resp = editing === 'new'
            ? await supabase.from('boilers').insert(payload)
            : await supabase.from('boilers').update(payload).eq('id', editing);
        busy = false;
        if (resp.error) { err = resp.error.message; return; }
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('boilers').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        deleting = null;
        await invalidateAll();
    }
</script>

<div class="adm-bar">
    <input class="adm-search" type="search" placeholder="Search boilers..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>Add Boiler</button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No boilers found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Code</th><th>Name</th><th>Region</th><th>Capacity</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as b (b.id)}
                    <tr>
                        <td style="text-align: center; vertical-align: middle;"><strong>{b.code}</strong></td>
                        <td style="vertical-align: middle;">{b.name ?? '-'}</td>
                        <td style="text-align: center; vertical-align: middle;">{b.regions?.name ?? '-'}</td>
                        <td style="text-align: center; vertical-align: middle;">{b.capacity ?? '-'}</td>
                        <td style="text-align: center; vertical-align: middle;">{b.status ?? '-'}</td>
                        <td>
                            <div class="adm-actions">
                                <button class="adm-link" onclick={() => startEdit(b)}>Edit</button>
                                <button class="adm-link danger" onclick={() => (deleting = b)}>Delete</button>
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
    <Modal title={editing === 'new' ? 'Add Boiler' : 'Edit Boiler'} onclose={cancel}>
        <div class="adm-form">
            <label><span>Region *</span>
                <select bind:value={form.region_id}>
                    {#each regions as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
                </select>
            </label>
            <label><span>Code *</span><input bind:value={form.code} placeholder="PB130" /></label>
            <label><span>Name</span><input bind:value={form.name} /></label>
            <label><span>Capacity</span><input bind:value={form.capacity} placeholder="25 t/h" /></label>
            <label><span>Pressure</span><input bind:value={form.pressure} placeholder="21 barg" /></label>
            <label><span>Steam Temperature</span><input bind:value={form.steam_temperature} placeholder="395 C" /></label>
            <label><span>Fuel Type</span><input bind:value={form.fuel_type} /></label>
            <label><span>Year Commissioned</span><input type="number" bind:value={form.year_commissioned} /></label>
            <label><span>Status</span><input bind:value={form.status} /></label>
            <label class="full"><span>Design Image URL</span><input bind:value={form.design_image_url} /></label>
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
    <Modal title="Delete Boiler" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Delete boiler <strong>{deleting.code}</strong>? This also removes its components and parts.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}