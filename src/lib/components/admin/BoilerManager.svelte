<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
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
    let fieldErr = $state<Record<string, string>>({});

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
            region_id: '', code: '', name: '', capacity: '', pressure: '',
            steam_temperature: '', fuel_type: '', year_commissioned: '', status: '',
            description: '', design_image_url: ''
        };
    }
    function startNew() { form = blank(); err = ''; fieldErr = {}; editing = 'new'; }
    function startEdit(b: any) { form = { ...b }; err = ''; fieldErr = {}; editing = b.id; }
    function cancel() { editing = null; err = ''; fieldErr = {}; }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.region_id) e.region_id = 'Region is required.';
        if (!form.code?.toString().trim()) e.code = 'Code is required.';
        if (!form.name?.toString().trim()) e.name = 'Name is required.';
        if (!form.capacity?.toString().trim()) e.capacity = 'Capacity is required.';
        if (!form.pressure?.toString().trim()) e.pressure = 'Pressure is required.';
        if (!form.steam_temperature?.toString().trim()) e.steam_temperature = 'Steam temperature is required.';
        if (!form.fuel_type?.toString().trim()) e.fuel_type = 'Fuel type is required.';
        if (!form.year_commissioned?.toString().trim()) e.year_commissioned = 'Year commissioned is required.';
        if (!form.status?.toString().trim()) e.status = 'Status is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
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
        addToast(editing === 'new' ? 'Boiler added successfully' : 'Boiler updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('boilers').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        addToast('Boiler deleted successfully');
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
            <label>Region <span class="required">*</span>
                <select bind:value={form.region_id} class:invalid={fieldErr.region_id}>
                    {#each regions as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
                </select>
                {#if fieldErr.region_id}<span class="field-err">{fieldErr.region_id}</span>{/if}
            </label>
            <label>Boiler Code <span class="required">*</span><input bind:value={form.code} placeholder="PB130" class:invalid={fieldErr.code} />
                {#if fieldErr.code}<span class="field-err">{fieldErr.code}</span>{/if}
            </label>
            <label>Boiler Name <span class="required">*</span><input bind:value={form.name} class:invalid={fieldErr.name} />
                {#if fieldErr.name}<span class="field-err">{fieldErr.name}</span>{/if}
            </label>
            <label>Capacity <span class="required">*</span><input bind:value={form.capacity} placeholder="25 t/h" class:invalid={fieldErr.capacity} />
                {#if fieldErr.capacity}<span class="field-err">{fieldErr.capacity}</span>{/if}
            </label>
            <label>Pressure <span class="required">*</span><input bind:value={form.pressure} placeholder="21 barg" class:invalid={fieldErr.pressure} />
                {#if fieldErr.pressure}<span class="field-err">{fieldErr.pressure}</span>{/if}
            </label>
            <label>Steam Temperature <span class="required">*</span><input bind:value={form.steam_temperature} placeholder="395 °C" class:invalid={fieldErr.steam_temperature} />
                {#if fieldErr.steam_temperature}<span class="field-err">{fieldErr.steam_temperature}</span>{/if}
            </label>
            <label>Fuel Type <span class="required">*</span><input bind:value={form.fuel_type} class:invalid={fieldErr.fuel_type} />
                {#if fieldErr.fuel_type}<span class="field-err">{fieldErr.fuel_type}</span>{/if}
            </label>
            <label>Year Commissioned <span class="required">*</span><input type="number" bind:value={form.year_commissioned} class:invalid={fieldErr.year_commissioned} />
                {#if fieldErr.year_commissioned}<span class="field-err">{fieldErr.year_commissioned}</span>{/if}
            </label>
            <label>Status <span class="required">*</span><input bind:value={form.status} class:invalid={fieldErr.status} />
                {#if fieldErr.status}<span class="field-err">{fieldErr.status}</span>{/if}
            </label>
            <label class="full">Design Image URL<input bind:value={form.design_image_url} /></label>
            <label class="full">Description<textarea rows="2" bind:value={form.description}></textarea></label>
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
            <p>Are you sure you want to delete boiler <strong>{deleting.code}</strong>? This also removes its components and parts.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}