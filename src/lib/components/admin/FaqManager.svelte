<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { ChevronUp, ChevronDown } from "@lucide/svelte";

    let { faqs, supabase } = $props<{ faqs: any[]; supabase: SupabaseClient }>();

    const pageSize = 20;
    let search = $state('');
    let page = $state(1);
    let editing = $state<string | 'new' | null>(null);
    let deleting = $state<any | null>(null);
    let busy = $state(false);
    let err = $state('');
    let form = $state<any>({});
    let fieldErr = $state<Record<string, string>>({});
    let moving = $state<string | null>(null);
    let ordered = $derived([...faqs].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));

    let filtered = $derived(ordered.filter((f: any) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [f.question, f.answer].some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
    }));
    let count = $derived(filtered.length);
    let pages = $derived(Math.max(1, Math.ceil(count / pageSize)));
    let curPage = $derived(Math.min(page, pages));
    let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));
    
    $effect(() => { search; page = 1; });

    function blank() {
        const maxOrder = faqs.reduce((m: number, f: any) => Math.max(m, f.sort_order ?? 0), 0);
        return {
            question: '', 
            answer: '', 
            sort_order: maxOrder + 1, 
            is_published: true
        };
    }

    function startNew() {
        form = blank();
        err = '';
        fieldErr = {};
        editing = 'new';
    }

    function startEdit(f: any) {
        form = { ...f };
        err = '';
        fieldErr = {};
        editing = f.id;
    }

    function cancel() {
        editing = null;
        err = '';
        fieldErr = {};
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.question?.toString().trim()) e.question = 'Question is required.';
        if (!form.answer?.toString().trim()) e.answer = 'Answer is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
        busy = true;
        err = '';
        const payload = {
            question: form.question.trim(), 
            answer: form.answer.trim(), 
            sort_order: Number(form.sort_order) || 0, 
            is_published: !!form.is_published
        };
        const resp = editing === 'new' 
            ? await supabase.from('faqs').insert(payload) 
            : await supabase.from('faqs').update(payload).eq('id', editing);
        busy = false;
        if (resp.error) { err = resp.error.message; return; }
        addToast(editing === 'new' ? 'Question added successfully' : 'Question updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('faqs').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        addToast('Question deleted successfully');
        deleting = null;
        await invalidateAll();
    }

    async function togglePublished(f: any) {
        if (moving) return;
        moving = f.id;
        const { error } = await supabase
            .from('faqs')
            .update({ is_published: !f.is_published })
            .eq('id', f.id);
        moving = null;
        if (error) { addToast(`Could not update: ${error.message}`); return; }
        addToast(f.is_published ? 'Question unpublished' : 'Question published');
        await invalidateAll();
    }

    async function move(f: any, dir: -1 | 1) {
        if (moving) return;
        const idx = ordered.findIndex((x: any) => x.id === f.id);
        const other = ordered[idx + dir];
        if (!other) return;

        moving = f.id;
        const a = Number(f.sort_order ?? 0);
        const b = Number(other.sort_order ?? 0);
        const [newA, newB] = a === b ? [idx + dir + 1, idx + 1] : [b, a];

        const [r1, r2] = await Promise.all([
            supabase.from('faqs').update({ sort_order: newA }).eq('id', f.id), 
            supabase.from('faqs').update({ sort_order: newB }).eq('id', other.id)
        ]);
        moving = null;
        if (r1.error || r2.error) {
            addToast(`Could not reorder: ${(r1.error ?? r2.error)?.message}`);
            return;
        }
        await invalidateAll();
    }

    function short(text: string, n = 90): string {
        const t = (text ?? '').toString();
        return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
    }
</script>

<div class="adm-bar">
    <input type="search" class="adm-search" placeholder="Search questions..." bind:value={search} />
    <button class="btn-primary" onclick={startNew}>Add Question</button>
</div>

<div class="card" style="padding:14px; overflow:hidden">
    {#if count === 0}
        <div class="adm-empty">No questions found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Order</th><th>Question</th><th>Answer</th><th>Published</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as f, i (f.id)}
                    <tr class:unpublished={!f.is_published}>
                        <td style="text-align: center; vertical-align: middle;">
                            <div class="ord">
                                <button class="ord-btn" title="Move up" aria-label="Move up" onclick={() => move(f, -1)} disabled={!!moving || (curPage === 1 && i === 0)}>
                                    <ChevronUp size={15} />
                                </button>
                                <span class="ord-n">{f.sort_order ?? 0}</span>
                                <button class="ord-btn" title="Move down" aria-label="Move down" onclick={() => move(f, 1)} disabled={!!moving || (curPage === pages && i === paged.length - 1)}>
                                    <ChevronDown size={15} />
                                </button>
                            </div>
                        </td>
                        <td style="vertical-align: middle;"><strong>{f.question}</strong></td>
                        <td style="vertical-align: middle;" class="ans">
                            <span class="ans-full">{f.answer}</span>
                            <span class="ans-short">{short(f.answer)}</span>
                        </td>
                        <td style="text-align: center; vertical-align: middle;">{f.is_published ? 'Yes' : 'No'}</td>
                        <td>
                            <div class="adm-actions">
                                <button class="adm-link" onclick={() => startEdit(f)}>Edit</button>
                                <button class="adm-link danger" onclick={() => (deleting = f)}>Delete</button>
                            </div>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

{#if count > 0}
    <Pagination total={count} page={curPage} {pageSize} onpage={(p) => (page = p)} />
{/if}

{#if editing !== null}
    <Modal title={editing === 'new' ? 'Add Question' : 'Edit Question'} onclose={cancel}>
        <div class="adm-form">
            <label>Question <span class="required">*</span>
                <input bind:value={form.question} placeholder="How do I request a quotation?" class:invalid={fieldErr.question} />
                {#if fieldErr.question}<span class="field-err">{fieldErr.question}</span>{/if}
            </label>
            <label>Answer <span class="required">*</span>
                <textarea rows="6" bind:value={form.answer} placeholder="Write the answer here..." class:invalid={fieldErr.answer}></textarea>
                {#if fieldErr.answer}<span class="field-err">{fieldErr.answer}</span>{/if}
            </label>
            <label><span>Order</span>
                <input type="number" min="0" bind:value={form.sort_order} />
            </label>
            <label class="chk">
                <input type="checkbox" bind:checked={form.is_published} />
                <span>Published (visible to users on the FAQ page)</span>
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
    <Modal title="Delete Question" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete "<strong>{deleting.question}</strong>"? This cannot be undone.</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

<style>
    .adm-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .adm-form label {
        display: block;
    }

    .adm-form label .required {
        display: inline;
        margin-left: 4px;
    }

    .adm-form label input,
    .adm-form label textarea {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 4px;
    }

    .ord {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .ord-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--bme-border);
        border-radius: 6px;
        background: #ffffff;
        color: var(--bme-dark-blue);
        cursor: pointer;
    }

    .ord-btn:hover:not(:disabled) { 
        border-color: var(--bme-dark-blue); 
    }

    .ord-btn:disabled { 
        opacity: 0.35; 
        cursor: default; 
    }

    .ord-n {
        min-width: 18px;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--bme-muted);
    }

    .ans {
        color: var(--bme-muted);
        font-size: 13px;
    }

    .ans-full {
        display: inline-block;
        max-width: 480px;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    .ans-short {
        display: none;
    }

    @media (max-width: 640px) {
        .ans-full { 
            display: none; 
        }
        .ans-short { 
            display: inline; 
        }
    }

    tr.unpublished td { 
        opacity: 0.6; 
    }

    .adm-form .chk {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
    }

    .adm-form .chk input {
        display: inline-block;
        width: auto;
        margin: 0;
    }
</style>