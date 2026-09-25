<script lang="ts">
    import Modal from "./admin/Modal.svelte";
    import { addToast } from "$lib/stores/toast";
    import { invalidateAll } from "$app/navigation";
    import { untrack } from "svelte";

    let {
        boilerId,
        action = null,
        supabase,
        onclose
    } = $props<{
        boilerId: string;
        action?: any;
        supabase: any;
        onclose: () => void;
    }>();

    let form = $state(
        untrack(() => ({
            title: action?.title ?? '',
            detail: action?.detail ?? '',
            owner: action?.owder ?? '',
            due_date: action?.due_date ?? '',
            status: action?.status ?? 'open'
        }))
    );

    let fieldErr = $state<{ title?: string }>({});
    let busy = $state(false);

    async function save() {
        if (busy) return;
        fieldErr = {};
        if (!form.title.trim()) {
            fieldErr = { title: 'Title is required.' };
            return;
        }

        busy = true;

        const payload = {
            title: form.title.trim(),
            detail: form.detail.trim() || null,
            owner: form.owner.trim() || null,
            due_date: form.due_date || null,
            status: form.status
        };

        const res = action
            ? await supabase
                .from('programme_actions')
                .update(payload)
                .eq('id', action.id)
                .select()
            : await supabase
                .from('programme_actions')
                .insert({ ...payload, boiler_id: boilerId, source: 'manual' })
                .select();

        busy = false;

        if (res.error) {
            addToast(`Could not save the action: ${res.error.message}`, 'error');
            return;
        }
        if (!res.data || res.data.length === 0) {
            addToast('The change was not saved. You may not have permission to edit this.', 'error');
            return;
        }

        await invalidateAll();
        addToast(action ? 'Action updated.' : 'Action raised.');
        onclose();
    }
</script>

<Modal title={action ? 'Edit Action' : 'Raise Action'} {onclose}>
    <div class="adm-form">
        <label class="full">Title <span class="required">*</span>
            <input bind:value={form.title} placeholder="Clean generating tubes" class:invalid={fieldErr.title} />
            {#if fieldErr.title}<span class="field-err">{fieldErr.title}</span>{/if}
        </label>
        <label class="full">Detail
            <input bind:value={form.detail} placeholder="Additional context or instructions" />
        </label>
        <label>Owner
            <input bind:value={form.owner} placeholder="Who this is assigned to" />
        </label>
        <label>Due Date
            <input type="date" bind:value={form.due_date} />
        </label>
        <label>Status
            <select bind:value={form.status}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
            </select>
        </label>
        {#if action && action.source !== 'manual'}
            <p class="full ae-src-note">
                Raised automatically from {action.source === 'indicator' ? 'a Tier 2 indicator escalation' : action.source === 'inspection' ? 'an annual inspection' : 'an assessment'}.
                Editing here only changes the status, owner and due date - not where it came from.
            </p>
        {/if}

        <div class="adm-form-actions">
            <button class="btn-ghost" onclick={onclose} disabled={busy}>Cancel</button>
            <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        </div>
    </div>
</Modal>

<style>
	.ae-src-note {
		margin: 0;
		padding: 10px 12px;
		background: var(--bme-surface-2);
		border-radius: 8px;
		font-size: 12px;
		color: var(--bme-muted);
		line-height: 1.5;
	}
</style>