<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Plus } from "@lucide/svelte";

    let { boilers, supabase, projects = [], boilerProjects = [] } = $props<{
        boilers: any[];
        supabase: SupabaseClient;
        projects?: any[];
        boilerProjects?: any[];
    }>();

    let projectsByBoiler = $derived.by(() => {
        const m: Record<string, string[]> = {};
        for (const bp of boilerProjects) (m[bp.boiler_id] ??= []).push(bp.project_id);
        return m;
    });

    function toggleProject(id: string) {
        const set = new Set<string>(form.project_ids ?? []);
        if (set.has(id)) set.delete(id); else set.add(id);
        form.project_ids = [...set];
    }

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
        return [b.code, b.name, b.capacity, b.status, b.fuel_type]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return {
            code: '', name: '', capacity: '', pressure: '',
            steam_temperature: '', fuel_type: '', year_commissioned: '', status: '',
            description: '', design_image_url: '', project_ids: []
        };
    }
    function startNew() { form = blank(); err = ''; fieldErr = {}; editing = 'new'; }
    function startEdit(b: any) {
        form = { ...b, project_ids: [...(projectsByBoiler[b.id] ?? [])] };
        err = ''; fieldErr = {}; editing = b.id;
    }
    function cancel() { editing = null; err = ''; fieldErr = {}; }

    function validate(): boolean {
        const e: Record<string, string> = {};
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

    async function syncProjects(boilerId: string): Promise<string | null> {
        const wanted: string[] = form.project_ids ?? [];
        const del = await supabase.from('boiler_projects').delete().eq('boiler_id', boilerId);
        if (del.error) return del.error.message;
        if (wanted.length) {
            const rows = wanted.map((project_id: string) => ({ boiler_id: boilerId, project_id }));
            const ins = await supabase.from('boiler_projects').insert(rows);
            if (ins.error) return ins.error.message;
        }
        return null;
    }

    async function save() {
        if (!validate()) return;
        busy = true; err = '';
        const payload = {
            code: form.code.trim(), name: form.name || null,
            capacity: form.capacity || null, pressure: form.pressure || null,
            steam_temperature: form.steam_temperature || null, fuel_type: form.fuel_type || null,
            year_commissioned: form.year_commissioned ? Number(form.year_commissioned) : null,
            status: form.status || null, description: form.description || null,
            design_image_url: form.design_image_url || null
        };

        let boilerId: string | null = editing === 'new' ? null : editing;
        if (editing === 'new') {
            const resp = await supabase.from('boilers').insert(payload).select('id').single();
            if (resp.error) { busy = false; err = resp.error.message; return; }
            boilerId = resp.data.id;
        } else {
            const resp = await supabase.from('boilers').update(payload).eq('id', editing);
            if (resp.error) { busy = false; err = resp.error.message; return; }
        }

        if (!boilerId) { busy = false; err = 'Something went wrong saving the boiler.'; return; }

        const projErr = await syncProjects(boilerId);
        busy = false;
        if (projErr) { err = projErr; return; }
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
    <button class="btn-primary" onclick={startNew}>
        <Plus size={16} /> Add Boiler
    </button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No boilers found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Code</th><th>Name</th><th>Capacity</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as b (b.id)}
                    <tr>
                        <td style="text-align: center; vertical-align: middle;"><strong>{b.code}</strong></td>
                        <td style="vertical-align: middle;">{b.name ?? '-'}</td>
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
            <label class="full">Description<textarea rows="2" bind:value={form.description}></textarea></label>
            <div class="project-field">
                <span class="bf-label">Project(s)</span>
                <div class="project-picker">
                    {#if projects.length === 0}
                        <p class="project-empty">No projects have been added yet.</p>
                    {:else}
                        {#each projects as p (p.id)}
                            <label class="project-item">
                                <input type="checkbox" checked={(form.project_ids ?? []).includes(p.id)} onchange={() => toggleProject(p.id)} />
                                <span><strong>{p.project_no}</strong> — {p.name} {#if p.location}<span class="pj-loc">({p.location})</span>{/if}</span>
                            </label>
                        {/each}
                    {/if}
                </div>
                <p class="project-hint">{(form.project_ids ?? []).length} selected.</p>
            </div>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleting}
    <Modal title="Delete Boiler" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete boiler <strong>{deleting.code}</strong>? This also removes its components, parts, and project assignments.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

<style>
    .adm-bar .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .project-field {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .bf-label {
        font-weight: 600;
        font-size: 13px;
        color: var(--bme-ink, #1b2733);
    }

    .project-picker {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid var(--bme-border, #e2e8ef);
        border-radius: 8px;
        padding: 8px 10px;
        background: var(--bme-surface, #ffffff);
    }

    .project-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 5px 4px;
        font-size: 13.5px;
        cursor: pointer;
    }

    .project-item input {
        width: auto;
        margin: 0;
        cursor: pointer;
    }

    .pj-loc {
        color: var(--bme-muted);
    }

    .project-empty {
        color: var(--bme-muted);
        font-size: 13px;
        margin: 4px;
    }

    .project-hint {
        margin: 5px 0 0;
        font-size: 12.5px;
        color: var(--bme-muted);
    }
</style>