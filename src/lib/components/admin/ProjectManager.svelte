<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Plus } from "@lucide/svelte";

    let { projects, supabase } = $props<{ projects: any[]; supabase: SupabaseClient }>();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});
    let fieldErr = $state<Record<string, string>>({});

    let filtered = $derived(projects.filter((p: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [p.project_no, p.name, p.location]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

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
        busy = false;
        if (resp.error) {
            err = resp.error.message;
            return;
        }
        addToast(editing === 'new' ? 'Project added successfully' : 'Project updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('projects').delete().eq('id', deleting.id);
        busy = false;
        if (error) {
            err = error.message;
            return;
        }
        addToast('Project deleted successfully');
        deleting = null;
        await invalidateAll();
    }
</script>

<div class="adm-bar">
    <input type="search" class="adm-search" placeholder="Search projects..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>
        <Plus size={16} /> Add Project
    </button>
</div>

<div class="card" style="padding: 14px; overflow: hidden;">
    {#if total === 0}
        <div class="adm-empty">No projects found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Project No.</th><th>Project Name</th><th>Location</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as p (p.id)}
                    <tr>
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
    <Pagination {total} page={curPage} {pageSize} onpage={(p) => (page = p)} />
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
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
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

<style>
    .adm-bar .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
</style>