<script lang="ts">
    import { toasts, removeToast } from "$lib/stores/toast";
    import { CircleCheck, CircleX, X } from "@lucide/svelte";
    import { fly } from "svelte/transition";
</script>

<div class="toaster">
    {#each $toasts as toast (toast.id)}
        <div
            class="toast"
            class:success={toast.type !== 'error'}
            class:error={toast.type === 'error'}
            role={toast.type === 'error' ? 'alert' : 'status'}
            transition:fly={{ y: 16, duration: 200 }}
        >
            <span class="toast-icon">
                {#if toast.type === 'error'}<CircleX size={20} />{:else}<CircleCheck size={20} />{/if}
            </span>
            <span class="toast-msg">{toast.message}</span>
            <button class="toast-close" onclick={() => removeToast(toast.id)} aria-label="Close"><X size={16} /></button>
        </div>
    {/each}
</div>

<style>
    .toaster {
        position: fixed;
        top: 1.25rem;
        right: 1.25rem;
        z-index: 300;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    }

    .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-left: 4px solid var(--bme-dark-blue);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(28, 42, 20, 0.14);
        padding: 12px 14px;
        min-width: 240px;
        max-width: 90vw;
    }

    .toast-icon {
        display: inline-flex;
        flex-shrink: 0;
    }

    .toast.success {
        border-left-color: var(--bme-darker-green);
    }

    .toast.success .toast-icon {
        color: var(--bme-darker-green);
    }

    .toast.error {
        border-left-color: var(--bme-red);
    }

    .toast.error .toast-icon {
        color: var(--bme-red);
    }

    .toast-msg {
        font-size: 14px;
        font-weight: 600;
        color: var(--bme-ink);
        flex: 1;
    }

    .toast-close {
        background: none;
        border: none;
        color: var(--bme-muted);
        cursor: pointer;
        display: inline-flex;
        padding: 2px;
        flex-shrink: 0;
    }

    .toast-close:hover {
        color: var(--bme-ink);
    }

    @media (max-width: 480px) {
        .toaster {
            left: 1rem;
            right: 1rem;
            top: 1rem;
        }

        .toast {
            min-width: 0;
        }
    }
</style>