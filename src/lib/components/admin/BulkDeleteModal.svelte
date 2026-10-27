<script lang="ts">
    import Modal from "./Modal.svelte";

    let {
        title,
        noun,
        labels,
        note = '',
        busy = false,
        err = '',
        onconfirm,
        onclose
    }: {
        title: string;
        noun: string;
        labels: string[];
        note?: string;
        busy?: boolean;
        err?: string;
        onconfirm: () => void;
        onclose: () => void;
    } = $props();

    const MAX_LISTED = 8;
    let shown = $derived(labels.slice(0, MAX_LISTED));
    let hidden = $derived(Math.max(0, labels.length - MAX_LISTED));
</script>

<Modal {title} onclose={() => { if (!busy) onclose(); }}>
    <div class="modal-confirm">
        <p>
            Are you sure you want to <strong>{labels.length}</strong>
            {labels.length === 1 ? noun : `${noun}s`}?
        </p>
        <ul class="bulk-list">
            {#each shown as l, i (i)}
                <li>{l}</li>
            {/each}
            {#if hidden > 0}<li class="more">…and {hidden} more</li>{/if}
        </ul>
        {#if note}<p class="bulk-note">{note}</p>{/if}
        {#if err}<p class="adm-err">{err}</p>{/if}
        <div class="modal-actions">
            <button class="btn-ghost" onclick={onclose} disabled={busy}>Cancel</button>
            <button class="btn-danger" onclick={onconfirm} disabled={busy || labels.length === 0}>
                {busy ? 'Deleting...' : 'Delete'}
            </button>
        </div>
    </div>
</Modal>

<style>
    .bulk-list {
        margin: 8px 0 12px;
        padding-left: 22px;
        max-height: 180px;
        overflow-y: auto;
        font-size: 14px;
        color: var(--bme-ink);
    }
 
    .bulk-list li {
        margin-bottom: 2px;
    }
 
    .bulk-list .more {
        list-style: none;
        margin-left: -22px;
        color: var(--bme-muted);
    }
 
    .bulk-note {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--bme-muted);
    }
</style>