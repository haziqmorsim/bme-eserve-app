<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";

    let { customers, regions, supabase } = $props<{ customers: any[]; regions: any[]; supabase: SupabaseClient }>();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});

    let filtered = $derived(customers.filter((c: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [c.full_name, c.email, c.phone, c.company, c.regions?.name]
            .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let total = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

    $effect(() => { search; page = 1; });

    function blank() {
        return { full_name: '', email: '', password: '', phone: '', company: '', region_id: regions[0]?.id ?? '' };
    }
    function startNew() { form = blank(); err = ''; editing = 'new'; }
    function startEdit(c: any) {
        form = {
            full_name: c.full_name ?? '', email: c.email ?? '', password: '',
            phone: c.phone ?? '', company: c.company ?? '', region_id: c.region_id ?? ''
        };
        err = ''; editing = c.id;
    }
    function cancel() { editing = null; err = ''; }

    async function save() {
        if (!form.email?.trim()) { err = 'Email is required.'; return; }
        if (editing === 'new' && !form.password) { err = 'An initial password is required for a new customer.'; return; }
        busy = true; err = '';

        const action = editing === 'new' ? 'create' : 'update';
        const body: any = {
            action, email: form.email.trim(), full_name: form.full_name || null,
            company: form.company || null, phone: form.phone || null, region_id: form.region_id || null
        };
        if (action === 'create') body.password = form.password;
        else body.id = editing;

        const { data: resp, error } = await supabase.functions.invoke('admin-users', { body });
        busy = false;
        if (error || resp?.error) { err = resp?.error ?? error?.message ?? 'Operation failed.'; return; }
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true; err = '';
        const { data: resp, error } = await supabase.functions.invoke('admin-users', {
            body: { action: 'delete', id: deleting.id }
        });
        busy = false;
        if (error || resp?.error) { err = resp?.error ?? error?.message ?? 'Delete failed.'; return; }
        deleting = null;
        await invalidateAll();
    }
</script>

<div class="adm-bar">
    <input class="adm-search" type="search" placeholder="Search customers..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>Add Customer</button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
    {#if total === 0}
        <div class="adm-empty">No customers found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Region</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as c (c.id)}
                    <tr>
                        <td style="text-align: center; vertical-align: middle;"><strong>{c.full_name ?? '—'}</strong></td>
                        <td style="text-align: center; vertical-align: middle;">{c.email ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{c.phone ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{c.company ?? '—'}</td>
                        <td style="text-align: center; vertical-align: middle;">{c.regions?.name ?? '—'}</td>
                        <td>
                            <div class="adm-actions">
                                <button class="adm-link" onclick={() => startEdit(c)}>Edit</button>
                                <button class="adm-link danger" onclick={() => (deleting = c)}>Delete</button>
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
    <Modal title={editing === 'new' ? 'Add Customer' : 'Edit Customer'} onclose={cancel}>
        <div class="adm-form">
            <label><span>Full Name</span><input bind:value={form.full_name} /></label>
            <label><span>Email *</span><input type="email" bind:value={form.email} /></label>
            {#if editing === 'new'}
                <label><span>Initial Password *</span><input type="text" bind:value={form.password} placeholder="Temporary password" /></label>
            {/if}
            <label><span>Phone</span><input bind:value={form.phone} placeholder="+60..." /></label>
            <label><span>Company</span><input bind:value={form.company} /></label>
            <label><span>Region</span>
                <select bind:value={form.region_id}>
                    <option value="">— none —</option>
                    {#each regions as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
                </select>
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
    <Modal title="Delete Customer" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Delete customer <strong>{deleting.email ?? deleting.full_name}</strong>? This permanently removes their account.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}