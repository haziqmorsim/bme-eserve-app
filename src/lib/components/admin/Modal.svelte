<script lang="ts">
    let { title, onclose, children } = $props<{ title: string; onclose: () => void; children: any }>();

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') onclose();
    }

    function onOverlayClick(e: MouseEvent) {
        if (e.target === e.currentTarget) onclose();
    }
</script>

<svelte:window onkeydown={handleKey} />

<div class="modal-overlay" role="presentation" onclick={onOverlayClick}>
    <div class="modal-panel" role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-head">
            <h3>{title}</h3>
            <button class="modal-x" onclick={onclose} aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
            {@render children()}
        </div>
    </div>
</div>