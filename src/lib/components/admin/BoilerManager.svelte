<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Search, Plus } from "@lucide/svelte";
    import { nextSort, sortRows, type SortState } from "$lib/table-sort";
    import SortHeader from "./SortHeader.svelte";
    import { hasImage } from "$lib/parts";
    import { BOILER_IMAGE_BUCKET, boilerImageSources, grateFor } from "$lib/boiler-design";
    import { logAction, activityLabel } from "$lib/activity";

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
    let uploading = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);

    let defaultDef = $derived(grateFor(form.code ?? '', form.name ?? ''));
    let defaultSources = $derived(boilerImageSources(defaultDef, null));
    let previewSources = $derived(boilerImageSources(defaultDef, form.design_image_url));
    let previewFailed = $state<string[]>([]);
    let previewSrc = $derived(
        previewSources.find((u) => !previewFailed.includes(u)) ?? previewSources[previewSources.length - 1]
    );
    let customImageFailed = $derived(
        hasImage(form.design_image_url) && previewFailed.includes(form.design_image_url.trim())
    );
    function onPreviewError() {
        if (previewSrc && !previewFailed.includes(previewSrc) && previewSrc !== previewSources[previewSources.length - 1]) {
            previewFailed = [...previewFailed, previewSrc];
        }
    }
    function isDefaultImage(url: string | null | undefined): boolean {
        return hasImage(url) && defaultSources.includes((url ?? '').trim());
    }

    let sort = $state<SortState>({ key: 'code', dir: 'asc' });
    const sortBy = {
        code: (b: any) => b.code,
        name: (b: any) => b.name,
        description: (b: any) => b.description
    };
    function setSort(key: string) { sort = nextSort(sort, key); }

    let filtered = $derived(
        sortRows(
            boilers.filter((b: any) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return [b.code, b.name, b.description]
                    .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
            }),
            sort,
            sortBy
        )
    );
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; sort; page = 1; });

    function blank() {
        return {
            code: '', name: '', capacity: '', pressure: '',
            steam_temperature: '', fuel_type: '', year_commissioned: '', status: '',
            description: '', design_image_url: '', project_ids: []
        };
    }
    function startNew() { form = blank(); err = ''; fieldErr = {}; previewFailed = []; editing = 'new'; }
    function startEdit(b: any) {
        form = {
            ...b,
            description: b.description ?? '',
            design_image_url: b.design_image_url ?? '',
            project_ids: [...(projectsByBoiler[b.id] ?? [])]
        };
        err = ''; fieldErr = {}; previewFailed = []; editing = b.id;
    }
    function cancel() { editing = null; err = ''; fieldErr = {}; }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.code?.toString().trim()) e.code = 'Code is required.';
        if (!form.name?.toString().trim()) e.name = 'Name is required.';
        if (form.year_commissioned !== '' && form.year_commissioned != null) {
            const y = Number(form.year_commissioned);
            if (!Number.isInteger(y)) e.year_commissioned = 'Year commissioned must be a whole number.';
        }
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
            status: form.status || null, description: form.description?.trim() || null,
            design_image_url: hasImage(form.design_image_url) ? form.design_image_url.trim() : null
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
        logAction(editing === 'new' ? 'boiler_created' : 'boiler_updated', { name: activityLabel(payload.code) });
        addToast(editing === 'new' ? 'Boiler added successfully' : 'Boiler updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function onPickImage(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { err = 'Please select an image file.'; input.value = ''; return; }
        if (file.size > 5 * 1024 * 1024) { err = 'Image must be 5 MB or smaller.'; input.value = ''; return; }

        uploading = true;
        err = '';
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `uploads/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BOILER_IMAGE_BUCKET).upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });
        if (upErr) { uploading = false; err = upErr.message; input.value = ''; return; }
        const { data: pub } = supabase.storage.from(BOILER_IMAGE_BUCKET).getPublicUrl(path);
        form.design_image_url = pub.publicUrl;
        previewFailed = [];
        uploading = false;
        input.value = '';
    }

    function removeImage() {
        form.design_image_url = '';
        previewFailed = [];
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('boilers').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        logAction('boiler_deleted', { name: activityLabel(deleting.code) });
        addToast('Boiler deleted successfully');
        deleting = null;
        await invalidateAll();
    }
</script>

<div class="adm-bar">
    <div class="searchbar card">
        <span class="search-ic"><Search size={16} /></span>
        <input class="adm-search" type="search" placeholder="Search boilers..." bind:value={search} />
    </div>
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
                <tr>
                    <SortHeader label="Boiler Code" key="code" {sort} onsort={setSort} />
                    <SortHeader label="Boiler Name" key="name" {sort} onsort={setSort} />
                    <SortHeader label="Description" key="description" {sort} onsort={setSort} />
                    <!--<th>Capacity</th><th>Status</th>-->
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each paged as b (b.id)}
                    <tr>
                        <td style="text-align: center; vertical-align: middle;"><strong>{b.code}</strong></td>
                        <td style="vertical-align: middle;">{b.name ?? '-'}</td>
                        <td style="vertical-align: middle;">{b.description ?? '-'}</td>
                        <!-- <td style="text-align: center; vertical-align: middle;">{b.capacity ?? '-'}</td>
                        <td style="text-align: center; vertical-align: middle;">{b.status ?? '-'}</td> -->
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
            <!-- <label>Capacity <span class="required">*</span><input bind:value={form.capacity} placeholder="25 t/h" class:invalid={fieldErr.capacity} />
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
            </label> -->
            <label class="full">Description<textarea rows="2" bind:value={form.description}></textarea></label>
            <div class="full img-field">
                <span class="img-label">Boiler Image</span>
                <div class="img-row">
                    <div class="img-preview">
                        {#key previewSrc}
                            <img src={previewSrc} alt="Boiler preview" onerror={onPreviewError} />
                        {/key}
                    </div>
                    <div class="img-actions">
                        <input type="file" accept="image/*" bind:this={fileInput} onchange={onPickImage} style="display:none" />
                        <button type="button" class="btn-ghost" onclick={() => fileInput?.click()} disabled={uploading}>
                            {uploading ? 'Uploading...' : hasImage(form.design_image_url) ? 'Replace Image' : 'Upload Image'}
                        </button>
                        {#if hasImage(form.design_image_url)}
                            <button type="button" class="btn-ghost danger" onclick={removeImage} disabled={uploading}>Remove Image</button>
                        {/if}
                    </div>
                </div>
                <p class="img-hint">
                    {#if customImageFailed}
                        This image could not be loaded, so the standard {defaultDef.label} schematic is shown instead.
                    {:else if !hasImage(form.design_image_url)}
                        No image set. The standard {defaultDef.label} schematic is used.
                    {:else if isDefaultImage(form.design_image_url)}
                        Standard {defaultDef.label} schematic.
                    {:else}
                        The section hotspots follow the {defaultDef.label} layout, so use a schematic drawn the same way.
                    {/if}
                </p>
            </div>
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
    .searchbar {
        width: 280px;
        position: relative;
        padding: 0;
        border-radius: 10px;
    }

    .searchbar:focus-within {
        border-color: var(--bme-dark-blue);
    }

    .searchbar input {
        width: 100%;
        padding: 11px 14px 11px 36px;
        border: none;
        background: transparent;
    }

    .searchbar input::-webkit-search-cancel-button {
        display: none;
    }

    .search-ic {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--bme-muted);
        display: inline-flex;
        pointer-events: none;
    }

    .adm-bar .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .img-field {
        grid-column: 1 / -1;
        margin-top: 4px;
    }

    .img-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
        margin-bottom: 10px;
    }

    .img-row {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .img-preview {
        width: 120px;
        height: 72px;
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
        display: grid;
        place-items: center;
        flex-shrink: 0;
    }

    .img-preview img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .img-actions {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }

    .img-hint {
        margin: 8px 0 0;
        font-size: 12.5px;
        color: var(--bme-muted);
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
        margin-bottom: 5px;
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

    @media (max-width: 640px) {
        .searchbar {
            width: 200px;
        }
    }
</style>