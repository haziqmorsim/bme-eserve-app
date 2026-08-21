<script lang="ts">
    import { fade, scale } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    let { message = '' } = $props<{ message?: string }>();

    let dismissed = $state(false);

    function close() {
        dismissed = true;
    }

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    function onOverlayClick(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }
</script>

<svelte:window onkeydown={handleKey} />

{#if (message ?? '').trim() && !dismissed}
    <div class="modal-overlay" role="presentation" onclick={onOverlayClick} transition:fade={{ duration: 150 }}>
        <div class="modal-panel announcement-panel" role="dialog" aria-modal="true" aria-label="Announcement" tabindex="-1" transition:scale={{ duration: 200, start: 0.94, easing: cubicOut }}>
            <div class="modal-head">
                <h3>Announcement</h3>
                <button class="modal-x" onclick={close} aria-label="Close">✕</button>
            </div>
            <div class="modal-body ann-body">
                <span class="ann-msg">{message}</span>
            </div>
        </div>
    </div>
{/if}

<style>
    .announcement-panel {
        max-width: 440px;
    }

    .ann-body {
        padding: 20px;
    }

    .ann-msg {
        display: block;
        font-size: 14px;
        line-height: 1.6;
        color: var(--bme-ink);
        white-space: pre-line;
    }
</style>