<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import Pagination from "./Pagination.svelte";
    import { Search, Plus, Menu } from "@lucide/svelte";
    import { logAction, activityLabel } from "$lib/activity";

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

    let orderOverride = $state<string[] | null>(null);
    let baseOrdered = $derived([...faqs].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    let ordered = $derived.by(() => {
        if (!orderOverride) return baseOrdered;
        const byId = new Map(baseOrdered.map((f: any) => [f.id, f]));
        const out = orderOverride.map((id) => byId.get(id)).filter(Boolean) as any[];
        for (const f of baseOrdered) if (!orderOverride.includes(f.id)) out.push(f);
        return out;
    });

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
        logAction(editing === 'new' ? 'faq_created' : 'faq_updated', { name: activityLabel(payload.question) });
        addToast(editing === 'new' ? 'Question added successfully' : 'Question updated successfully');
        editing = null;
        await invalidateAll();
    }

    async function confirmDelete() {
        busy = true;
        const { error } = await supabase.from('faqs').delete().eq('id', deleting.id);
        busy = false;
        if (error) { err = error.message; return; }
        logAction('faq_deleted', { name: activityLabel(deleting.question) });
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
        if (error) { addToast(`Could not update: ${error.message}`, 'error'); return; }
        logAction('faq_updated', { name: activityLabel(f.question) });
        addToast(f.is_published ? 'Question unpublished' : 'Question published');
        await invalidateAll();
    }

    let reordering = $state(false);
    let dndEnabled = $derived(!search.trim() && pages === 1 && !reordering);
    let dndDisabledReason = $derived.by(() => {
        if (search.trim()) return 'Clear the search box to drag and reorder questions.';
        if (pages > 1) return 'Reordering is only available when every question fits on one page.';
        return null;
    });

    let dragId = $state<string | null>(null);
    let dragOverId = $state<string | null>(null);
    let activePointerId: number | null = null;
    let dragSourceId: string | null = null;
    let dragArmed = false;
    let dragStartY = 0;

    function rowIdAt(x: number, y: number): string | null {
        const row = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('tr[data-faq-id]') as HTMLElement | null;
        return row?.dataset.faqId ?? null;
    }

    function onHandlePointerDown(e: PointerEvent, id: string) {
        if (!dndEnabled || (e.button ?? 0) !== 0) return;
        activePointerId = e.pointerId;
        dragSourceId = id;
        dragArmed = false;
        dragStartY = e.clientY;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    }

    function onPointerMove(e: PointerEvent) {
        if (e.pointerId !== activePointerId || !dragSourceId) return;
        if (!dragArmed) {
            if (Math.abs(e.clientY - dragStartY) < 4) return;
            dragArmed = true;
            dragId = dragSourceId;
        }
        e.preventDefault();
        dragOverId = rowIdAt(e.clientX, e.clientY);
    }

    async function onPointerUp(e: PointerEvent) {
        if (e.pointerId !== activePointerId) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        const sourceId = dragSourceId;
        const targetId = dragArmed ? (dragOverId ?? rowIdAt(e.clientX, e.clientY)) : null;
        activePointerId = null;
        dragSourceId = null;
        dragArmed = false;
        dragId = null;
        dragOverId = null;
        if (sourceId && targetId) await reorder(sourceId, targetId);
    }

    function onPointerCancel(e: PointerEvent) {
        if (e.pointerId !== activePointerId) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        activePointerId = null;
        dragSourceId = null;
        dragArmed = false;
        dragId = null;
        dragOverId = null;
    }

    function onHandleKeydown(e: KeyboardEvent, f: any) {
        if (!dndEnabled) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const ids = ordered.map((x: any) => x.id);
            const idx = ids.indexOf(f.id);
            const target = ids[idx + (e.key === 'ArrowUp' ? -1 : 1)];
            if (target) reorder(f.id, target);
        }
    }

    async function reorder(sourceId: string, targetId: string) {
        if (sourceId === targetId) return;
        const ids = ordered.map((f: any) => f.id);
        const from = ids.indexOf(sourceId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) return;

        const newIds = ids.slice();
        const [moved] = newIds.splice(from, 1);
        newIds.splice(to, 0, moved);

        orderOverride = newIds;
        reordering = true;

        const byId = new Map(ordered.map((f: any) => [f.id, f]));
        const updates = newIds
            .map((id, i) => ({ id, wanted: i + 1, row: byId.get(id) }))
            .filter(({ wanted, row }) => row && Number(row.sort_order ?? 0) !== wanted)
            .map(({ id, wanted }) => supabase.from('faqs').update({ sort_order: wanted }).eq('id', id));

        const results = await Promise.all(updates);
        reordering = false;

        const failed = results.find((r) => r.error);
        if (failed) {
            orderOverride = null;
            addToast(`Could not reorder: ${failed.error.message}`, 'error');
            return;
        }
        await invalidateAll();
        orderOverride = null;
    }

    function short(text: string, n = 90): string {
        const t = (text ?? '').toString();
        return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
    }
</script>

<div class="adm-bar">
    <div class="searchbar card">
        <span class="search-ic"><Search size={16} /></span>
        <input type="search" class="adm-search" placeholder="Search questions..." bind:value={search} />
    </div>
    <button class="btn-primary" onclick={startNew}>
        <Plus size={16} /> Add Question
    </button>
</div>

{#if dndDisabledReason}
    <p class="dnd-note">{dndDisabledReason}</p>
{/if}

<div class="card" style="padding:14px; overflow:hidden">
    {#if count === 0}
        <div class="adm-empty">No questions found.</div>
    {:else}
        <table class="adm-table">
            <thead>
                <tr><th>Order</th><th>Question</th><th>Answer</th><th>Published</th><th>Actions</th></tr>
            </thead>
            <tbody>
                {#each paged as f (f.id)}
                    <tr
                        data-faq-id={f.id}
                        class:unpublished={!f.is_published}
                        class:dragging={dragId === f.id}
                        class:drag-over={!!dragId && dragId !== f.id && dragOverId === f.id}
                    >
                        <td style="text-align: center; vertical-align: middle;">
                            <button
                                type="button"
                                class="drag-handle"
                                title={dndEnabled ? 'Drag to reorder (or focus and use the arrow keys)' : dndDisabledReason}
                                aria-label={`Reorder "${f.question}" - drag, or use the arrow keys`}
                                disabled={!dndEnabled}
                                onpointerdown={(e) => onHandlePointerDown(e, f.id)}
                                onkeydown={(e) => onHandleKeydown(e, f)}
                            >
                                <Menu size={16} />
                            </button>
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
    <Pagination total={count} page={curPage} {pageSize} onpage={(p) => (page = p)} compact />
{/if}

{#if editing !== null}
    <Modal title={editing === 'new' ? 'Add Question' : 'Edit Question'} onclose={cancel}>
        <div class="adm-form">
            <label>Question <span class="required">*</span>
                <input bind:value={form.question} placeholder="Type the question here..." class:invalid={fieldErr.question} />
                {#if fieldErr.question}<span class="field-err">{fieldErr.question}</span>{/if}
            </label>
            <label>Answer <span class="required">*</span>
                <textarea rows="6" bind:value={form.answer} placeholder="Type the answer here..." class:invalid={fieldErr.answer}></textarea>
                {#if fieldErr.answer}<span class="field-err">{fieldErr.answer}</span>{/if}
            </label>
            <label class="chk">
                <input type="checkbox" bind:checked={form.is_published} />
                <span>Published (visible to users on the FAQ page)</span>
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
    <Modal title="Delete Question" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete question "<strong>{deleting.question}</strong>"? This cannot be undone.</p>
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

    .adm-bar .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .dnd-note {
        margin: 0 0 10px;
        font-size: 12.5px;
        color: var(--bme-muted);
    }

    .drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid var(--bme-border);
        border-radius: 6px;
        background: var(--bme-surface);
        color: var(--bme-dark-blue);
        cursor: grab;
        touch-action: none;
    }

    .drag-handle:hover:not(:disabled) {
        border-color: var(--bme-dark-blue);
    }

    .drag-handle:disabled {
        opacity: 0.35;
        cursor: default;
    }

    tr.dragging {
        opacity: 0.5;
    }

    tr.dragging .drag-handle {
        cursor: grabbing;
    }

    tr.drag-over td {
        outline: 2px solid var(--bme-dark-blue);
        outline-offset: -2px;
    }

    .adm-table {
        -webkit-text-size-adjust: 100%;
        -moz-text-size-adjust: 100%;
        text-size-adjust: 100%;
    }

    .ans {
        color: var(--bme-muted);
        font-size: 13px;
    }

    .ans-full {
        display: inline-block;
        max-width: 500px;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    .ans-short {
        display: none;
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

        .ans-full { 
            display: none; 
        }
        
        .ans-short { 
            display: inline; 
        }
    }

    tr.unpublished td { 
        opacity: 0.8; 
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