<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Search, Plus, Trash2 } from "@lucide/svelte";
    import { untrack } from "svelte";
    import { RowSelection } from "$lib/selection.svelte";
    import RowCheckbox from "./RowCheckbox.svelte";
    import BulkDeleteModal from "./BulkDeleteModal.svelte";
    import { nextSort, sortRows, type SortState } from "$lib/table-sort";
    import SortHeader from "./SortHeader.svelte";
    import { logAction, activityLabel } from "$lib/activity";

    let { projects, supabase }: { 
        projects: any[]; 
        supabase: SupabaseClient 
    } = $props();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});
    let fieldErr = $state<Record<string, string>>({});

    let sort = $state<SortState>({ key: 'project_no', dir: 'asc' });
    const sortBy = {
        project_no: (p: any) => p.project_no,
        name: (p: any) => p.name,
        location: (p: any) => p.location
    };
    function setSort(key: string) { sort = nextSort(sort, key); }

    let filtered = $derived(
        sortRows(
            projects.filter((p: any) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return [p.project_no, p.name, p.location]
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

    const sel = new RowSelection();
    let bulkDeleting = $state(false);
    let pageIds = $derived(paged.map((r: any) => r.id));
    let allOnPage = $derived(pageIds.length > 0 && pageIds.every((id: string) => sel.has(id)));
    let someOnPage = $derived(pageIds.some((id: string) => sel.has(id)));
    let selectedItems = $derived(projects.filter((r: any) => sel.has(r.id)));
    $effect(() => {
        const valid = new Set<string>(projects.map((r: any) => r.id));
        untrack(() => sel.prune(valid));
    });
    $effect(() => {
        search;
        untrack(() => sel.clear());
    });

    function blank() {
        return { project_no: '', name: '', location: ''};
    }
    function startNew() {
        form = blank();
        err = '';
        fieldErr = {};
        editing = 'new';
    }

    function startEdit(p: any) {
        form = { ...p };
        err = '';
        fieldErr = {};
        editing = p.id;
    }

    function cancel() {
        if (busy) return;
        editing = null;
        err = '';
        fieldErr = {};
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        const no = form.project_no?.toString().trim();
        if (!no) e.project_no = 'Project no. is required.';
        else if (projects.some((p: any) => p.id !== editing && (p.project_no ?? '').toLowerCase() === no.toLowerCase())) {
            e.project_no = 'This project no. is already in use';
        }
        if (!form.name?.toString().trim()) e.name = 'Project name is required.';
        if (!form.location?.toString().trim()) e.location = 'Location is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
        busy = true;
        err = '';
        const payload = {
            project_no: form.project_no.trim(), 
            name: form.name.trim(), 
            location: form.location.trim()
        };
        const resp = editing === 'new' 
            ? await supabase.from('projects').insert(payload) 
            : await supabase.from('projects').update(payload).eq('id', editing);
        if (resp.error) {
            busy = false;
            err = resp.error.message;
            return;
        }
        logAction(editing === 'new' ? 'project_created' : 'project_updated', { name: activityLabel(payload.name ? `${payload.project_no} – ${payload.name}` : payload.project_no) });
        const message = editing === 'new' ? 'Project added successfully' : 'Project updated successfully';
        try {
            await invalidateAll();
        } finally {
            busy = false;
        }
        editing = null;
        addToast(message);
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('projects').delete().eq('id', deleting.id);
        if (error) {
            busy = false;
            err = error.message;
            return;
        }
        logAction('project_deleted', { name: activityLabel(deleting.name ? `${deleting.project_no} – ${deleting.name}` : deleting.project_no) });
        try {
            await invalidateAll();
        } finally {
            busy = false;
        }
        deleting = null;
        addToast('Project deleted successfully');
    }

    async function confirmBulkDelete() {
        busy = true;
        err = '';
        const items = [...selectedItems];
        const { data: removed, error } = await supabase
            .from('projects')
            .delete()
            .in('id', items.map((x: any) => x.id))
            .select('id');
        if (error) {
            busy = false;
            err = error.message;
            return;
        }
        const gone = new Set<string>((removed ?? []).map((r: any) => r.id));
        for (const x of items.filter((i: any) => gone.has(i.id))) {
            logAction('project_deleted', { name: activityLabel(x.name ? `${x.project_no} – ${x.name}` : x.project_no) });
        }
        try {
            await invalidateAll();
        } finally {
            busy = false;
        }
        sel.clear();
        bulkDeleting = false;
        reportBulk(gone.size, items.length);
    }

    function reportBulk(done: number, asked: number) {
        if (done === 0) {
            addToast('No projects were deleted. You may not have permission.', 'error');
        } else if (done < asked) {
            addToast(`${done} of ${asked} projects deleted. The rest could not be deleted.`, 'error', 9000);
        } else {
            addToast(`${done} ${done === 1 ? 'project' : 'projects'} deleted successfully`);
        }
    }

</script>

<div class="adm-bar">
    <div class="searchbar card">
        <span class="search-ic"><Search size={16} /></span>
        <input type="search" class="adm-search" placeholder="Search projects..." bind:value={search} />
    </div>
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        {#if sel.count > 0}
            <button class="btn-danger" style="display: inline-flex; align-items: center; gap: 8px;" onclick={() => { err = ''; bulkDeleting = true; }}>
                <Trash2 size={16} /> Delete selected ({sel.count})
            </button>
        {/if}
        <button class="btn-primary" onclick={startNew}>
            <Plus size={16} /> Add Project
        </button>
    </div>
</div>

<div class="card" style="padding: 14px; overflow: hidden;">
    {#if total === 0}
        <div class="adm-empty">No projects found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">
                        <RowCheckbox
                            checked={allOnPage}
                            indeterminate={someOnPage && !allOnPage}
                            label="Select all rows on this page"
                            onchange={(on) => sel.setMany(pageIds, on)}
                        />
                    </th>
                    <SortHeader label="Project No." key="project_no" {sort} onsort={setSort} />
                    <SortHeader label="Project Name" key="name" {sort} onsort={setSort} />
                    <SortHeader label="Location" key="location" {sort} onsort={setSort} />
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each paged as p (p.id)}
                    <tr style={sel.has(p.id) ? 'background: var(--bme-hover);' : undefined}>
                        <td style="width: 40px; text-align: center; vertical-align: middle;">
                            <RowCheckbox
                                checked={sel.has(p.id)}
                                label="Select {p.project_no}"
                                onchange={(on) => sel.toggle(p.id, on)}
                            />
                        </td>
                        <td style="text-align: center; vertical-align: middle;"><strong>{p.project_no}</strong></td>
                        <td style="vertical-align: middle;">{p.name}</td>
                        <td style="text-align: center; vertical-align: middle;">{p.location ?? '-'}</td>
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
    <Pagination {total} page={curPage} {pageSize} onpage={(p) => (page = p)} compact />
{/if}

{#if editing !== null}
    <Modal title={editing === 'new' ? 'Add Project' : 'Edit Project'} onclose={cancel}>
        <div class="adm-form">
            <label>Project No. <span class="required">*</span>
                <input bind:value={form.project_no} placeholder="PB0001" class:invalid={fieldErr.project_no} />
                {#if fieldErr.project_no}<span class="field-err">{fieldErr.project_no}</span>{/if}
            </label>
            <label class="full">Project Name <span class="required">*</span>
                <input bind:value={form.name} placeholder="Boilermech Sdn Bhd" class:invalid={fieldErr.name} />
                {#if fieldErr.name}<span class="field-err">{fieldErr.name}</span>{/if}
            </label>
            <label>Location <span class="required">*</span>
                <input bind:value={form.location} placeholder="Subang Jaya" class:invalid={fieldErr.location} />
                {#if fieldErr.location}<span class="field-err">{fieldErr.location}</span>{/if}
            </label>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleting}
    <Modal title="Delete Project" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete project <strong>{deleting.project_no}</strong>? Any boilers assigned to it will lose that assignment.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if bulkDeleting}
    <BulkDeleteModal
        title="Delete Selected Projects"
        noun="project"
        labels={selectedItems.map((x: any) => x.project_no)}
        note="Any boilers assigned to these projects will lose that assignment."
        {busy}
        {err}
        onconfirm={confirmBulkDelete}
        onclose={() => (bulkDeleting = false)}
    />
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

    @media (max-width: 640px) {
        .adm-bar {
            display: flex;
        }

        .searchbar {
            width: 100%;
        }

        .btn-primary {
            margin-left: auto;
        }
    }
</style>