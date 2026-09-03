<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Plus } from "@lucide/svelte";

    let { users, supabase, projects = [], customerProjects = [] } = $props<{ users: any[]; supabase: SupabaseClient, projects?: any[], customerProjects?: any[] }>();

    const ROLES = [
        { value: 'customer', label: 'Customer' },
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Manager' },
        { value: 'coo', label: 'Chief Operating Officer (COO)' },
        { value: 'developer', label: 'Developer' }
    ];
    function roleLabel(r: string): string {
        return ROLES.find((x) => x.value === r)?.label ?? r ?? '—';
    }

    function lastSignIn(ts: string | null | undefined): string {
        if (!ts) return '—';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '—';
        const p2 = (n: number) => String(n).padStart(2, '0');
        return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    }

    let assignedByUser = $derived.by(() => {
        const m: Record<string, string[]> = {};
        for (const a of customerProjects) (m[a.user_id] ??= []).push(a.project_id);
        return m;
    });

    let sortedProjects = $derived(
        [...projects].sort((a: any, b: any) => (a.project_no ?? '').localeCompare(b.project_no ?? ''))
    );

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

    let filtered = $derived(users.filter((u: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [u.full_name, u.email, u.phone, u.company, roleLabel(u.role)]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return { full_name: '', email: '', password: '', phone: '', company: '', role: '', project_ids: [] };
    }
    function startNew() { form = blank(); err = ''; fieldErr = {}; editing = 'new'; }
    function startEdit(u: any) {
        form = {
            full_name: u.full_name ?? '', email: u.email ?? '', password: '',
            phone: u.phone ?? '', company: u.company ?? '', role: u.role ?? '',
            project_ids: [...(assignedByUser[u.id] ?? [])]
        };
        err = ''; fieldErr = {}; editing = u.id;
    }
    function cancel() { editing = null; err = ''; fieldErr = {}; }

    async function fnError(error: any, resp: any, fallback: string): Promise<string> {
        if (resp?.error) return resp.error;
        try {
            const body = await error?.context?.json?.();
            if (body?.error) return body.error;
        } catch { /* body not JSON */ }
        return error?.message ?? fallback;
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.full_name?.toString().trim()) e.full_name = 'Full name is required.';
        if (!form.email?.toString().trim()) e.email = 'E-mail is required.';
        if (editing === 'new' && !form.password) e.password = 'Temporary password is required.';
        if (!form.company?.toString().trim()) e.company = 'Company is required.';
        if (!form.role) e.role = 'Role is required.';
        if ((form.role || 'customer') === 'customer' && (form.project_ids ?? []).length === 0) {
            e.project_ids = 'At least one project is required.';
        }
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
        busy = true; err = '';

        const action = editing === 'new' ? 'create' : 'update';
        const body: any = {
            action, email: form.email.trim(), full_name: form.full_name || null,
            company: form.company || null, phone: form.phone || null,
            role: form.role || 'customer'
        };
        const isCustomer = (form.role || 'customer') === 'customer';
        body.project_ids = isCustomer ? (form.project_ids ?? []) : [];
        if (action === 'create') body.password = form.password;
        else body.id = editing;

        const { data: resp, error } = await supabase.functions.invoke('admin-users', { body });
        busy = false;
        if (error || resp?.error) { err = await fnError(error, resp, 'Operation failed.'); return; }
        addToast(action === 'create' ? 'User added successfully' : 'User updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true; err = '';
        const { data: resp, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'delete', id: deleting.id }
        });
        busy = false;
        if (error || resp?.error) { err = await fnError(error, resp, 'Delete failed.'); return; }
        addToast('User deleted successfully');
        deleting = null;
        await invalidateAll();
    }
</script>

<div class="adm-bar">
    <input class="adm-search" type="search" placeholder="Search users..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>
        <Plus size={16} /> Add User
    </button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No users found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Role</th><th>Last Sign In</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as u (u.id)}
                    <tr>
                        <td style="vertical-align: middle;"><strong>{u.full_name ?? '—'}</strong></td>
                        <td style="text-align: center; vertical-align: middle;">{u.email ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{u.phone ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{u.company ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{roleLabel(u.role)}</td>
                        <td style="text-align: center; vertical-align: middle;">{lastSignIn(u.last_sign_in_at)}</td>
                        <td>
                            <div class="adm-actions">
                                <button class="adm-link" onclick={() => startEdit(u)}>Edit</button>
                                <button class="adm-link danger" onclick={() => (deleting = u)}>Delete</button>
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
    <Modal title={editing === 'new' ? 'Add User' : 'Edit User'} onclose={cancel}>
        <div class="adm-form">
            <label>Full Name <span class="required">*</span><input bind:value={form.full_name} class:invalid={fieldErr.full_name} />
                {#if fieldErr.full_name}<span class="field-err">{fieldErr.full_name}</span>{/if}
            </label>
            <label>Email <span class="required">*</span><input type="email" bind:value={form.email} class:invalid={fieldErr.email} />
                {#if fieldErr.email}<span class="field-err">{fieldErr.email}</span>{/if}
            </label>
            {#if editing === 'new'}
                <label>Temporary Password <span class="required">*</span><input type="text" bind:value={form.password} class:invalid={fieldErr.password} />
                    {#if fieldErr.password}<span class="field-err">{fieldErr.password}</span>{/if}
                </label>
            {/if}
            <label><span>Phone Number</span><input bind:value={form.phone} placeholder="+60..." /></label>
            <label>Company Name <span class="required">*</span><input bind:value={form.company} class:invalid={fieldErr.company} />
                {#if fieldErr.company}<span class="field-err">{fieldErr.company}</span>{/if}
            </label>
            <label>Role <span class="required">*</span>
                <select bind:value={form.role} class:invalid={fieldErr.role}>
                    {#each ROLES as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
                </select>
                {#if fieldErr.role}<span class="field-err">{fieldErr.role}</span>{/if}
            </label>
        </div>
        <div class="project-actions">
            {#if (form.role || 'customer') === 'customer'}
                <div class="project-field">
                    <span class="pf-label">Project(s) <span class="required">*</span></span>
                    <div class="project-picker" class:invalid={fieldErr.project_ids}>
                        {#each sortedProjects as p (p.id)}
                            <label class="project-item">
                                <input type="checkbox" checked={(form.project_ids ?? []).includes(p.id)} onchange={() => toggleProject(p.id)} />
                                <span><strong>{p.project_no}</strong> {#if p.name} — {p.name}{/if}</span>
                            </label>
                        {/each}
                    </div>
                    <p class="project-hint">{(form.project_ids ?? []).length} selected.</p>
                    {#if fieldErr.project_ids}<span class="field-err">{fieldErr.project_ids}</span>{/if}
                </div>
            {/if}
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleting}
    <Modal title="Delete User" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete user <strong>{deleting.full_name ?? deleting.email}</strong>?</p>
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

    .project-actions {
        padding: 0 18px 18px;
    }

    .project-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .pf-label {
        font-weight: 600;
        font-size: 13px;
        color: var(--bme-ink);
    }

    .project-picker.invalid {
        border-color: var(--bme-red);
    }

    .project-picker {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow-y: auto;
        border: 1px solid var(--bme-border);
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

    .project-hint {
        margin: 5px 0;
        font-size: 12.5px;
        color: var(--bme-muted);
    }
</style>