<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";

    let { users, regions, supabase, boilers = [], assignments = [] } = $props<{ users: any[]; regions: any[]; supabase: SupabaseClient, boilers?: any[], assignments?: any[] }>();

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

    let assignedByUser = $derived.by(() => {
        const m: Record<string, string[]> = {};
        for (const a of assignments) (m[a.user_id] ??= []).push(a.boiler_id);
        return m;
    });

    let regionBoilers = $derived(boilers.filter((b: any) => b.region_id && b.region_id === form.region_id));

    function toggleBoiler(id: string) {
        const set = new Set<string>(form.boiler_ids ?? []);
        if (set.has(id)) set.delete(id); else set.add(id);
        form.boiler_ids = [...set];
    }

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});

    let filtered = $derived(users.filter((u: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [u.full_name, u.email, u.phone, u.company, roleLabel(u.role), u.regions?.name]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return { full_name: '', email: '', password: '', phone: '', company: '', role: 'customer', region_id: regions[0]?.id ?? '', boiler_ids: [] };
    }
    function startNew() { form = blank(); err = ''; editing = 'new'; }
    function startEdit(u: any) {
        form = {
            full_name: u.full_name ?? '', email: u.email ?? '', password: '',
            phone: u.phone ?? '', company: u.company ?? '', role: u.role ?? 'customer',
            region_id: u.region_id ?? '', boiler_ids: [...(assignedByUser[u.id] ?? [])]
        };
        err = ''; editing = u.id;
    }
    function cancel() { editing = null; err = ''; }

    async function fnError(error: any, resp: any, fallback: string): Promise<string> {
        if (resp?.error) return resp.error;
        try {
            const body = await error?.context?.json?.();
            if (body?.error) return body.error;
        } catch { /* body not JSON */ }
        return error?.message ?? fallback;
    }

    async function save() {
        if (!form.email?.trim()) { err = 'Email is required.'; return; }
        if (editing === 'new' && !form.password) { err = 'An initial password is required for a new user.'; return; }
        busy = true; err = '';

        const action = editing === 'new' ? 'create' : 'update';
        const body: any = {
            action, email: form.email.trim(), full_name: form.full_name || null,
            company: form.company || null, phone: form.phone || null,
            role: form.role || 'customer', region_id: form.region_id || null
        };
        const isCustomer = (form.role || 'customer') === 'customer';
        const regionBoilerIds = new Set(boilers.filter((b: any) => b.region_id === form.region_id).map((b: any) => b.id));
        body.boiler_ids = isCustomer ? (form.boiler_ids ?? []).filter((id: string) => regionBoilerIds.has(id)) : [];
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
    <button class="btn-primary" onclick={startNew}>Add User</button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No users found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Role</th><th>Region</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as u (u.id)}
                    <tr>
                        <td style="vertical-align: middle;"><strong>{u.full_name ?? '—'}</strong></td>
                        <td style="text-align: center; vertical-align: middle;">{u.email ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{u.phone ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{u.company ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{roleLabel(u.role)}</td>
                        <td style="text-align: center; vertical-align: middle;">{u.regions?.name ?? '—'}</td>
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
            <label>Full Name <span class="required">*</span><input bind:value={form.full_name} /></label>
            <label>Email <span class="required">*</span><input type="email" bind:value={form.email} /></label>
            {#if editing === 'new'}
                <label>Initial Password <span class="required">*</span><input type="text" bind:value={form.password} placeholder="Temporary password" /></label>
            {/if}
            <label><span>Phone</span><input bind:value={form.phone} placeholder="+60..." /></label>
            <label><span>Company</span><input bind:value={form.company} /></label>
            <label>Role <span class="required">*</span>
                <select bind:value={form.role}>
                    {#each ROLES as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
                </select>
            </label>
            <label><span>Region</span>
                <select bind:value={form.region_id}>
                    <option value="">— none —</option>
                    {#each regions as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
                </select>
            </label>
            {#if (form.role || 'customer') === 'customer'}
                <div class="boiler-field">
                    <span class="bf-label">Boilers</span>
                    {#if !form.region_id}
                        <p class="boiler-hint">No boilers in this region yet.</p>
                    {:else}
                        <div class="boiler-picker">
                            {#each regionBoilers as b (b.id)}
                                <label class="boiler-item">
                                    <input type="checkbox" checked={(form.boiler_ids ?? []).includes(b.id)} onchange={() => toggleBoiler(b.id)} />
                                    <span><strong>{b.code}</strong> {#if b.name} — {b.name}{/if}</span>
                                </label>
                            {/each}
                        </div>
                        <p class="boiler-hint">{(form.boiler_ids ?? []).filter((id: string) => regionBoilers.some((b: any) => b.id === id)).length} selected.</p>
                    {/if}
                </div>
            {/if}
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
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
    .boiler-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .bf-label {
        font-weight: 600;
        font-size: 14px;
        color: var(--bme-ink);
    }

    .boiler-picker {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow-y: auto;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        padding: 8px 10px;
        background: var(--bme-surface, #ffffff);
    }

    .boiler-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 5px 4px;
        font-size: 13.5px;
        cursor: pointer;
    }

    .boiler-item input {
        width: auto;
        margin: 0;
        cursor: pointer;
    }

    .boiler-hint {
        margin: 0;
        font-size: 12.5px;
        color: var(--bme-muted);
    }
</style>