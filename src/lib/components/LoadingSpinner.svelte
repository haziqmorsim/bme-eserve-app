<script lang="ts">
    import { navigating } from "$app/stores";
    
    let show = $state(false);
    let timer: ReturnType<typeof setTimeout> | undefined

    $effect(() => {
        const nav = $navigating;
        clearTimeout(timer);
        if (nav) {
            timer = setTimeout(() => (show = true), 150);
        } else {
            show = false;
        }
        return () => clearTimeout(timer);
    });
</script>

{#if show}
    <div class="loading-overlay" role="status" aria-live="polite" aria-label="Loading">
        <div class="spinner"></div>
        <span class="sr-only">Loading...</span>
    </div>
{/if}

<style>
    .loading-overlay {
        position: fixed;
        inset: 0;
        z-index: 400;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.55);
        backdrop-filter: blur(1px);
    }

    .spinner {
        width: 46px;
        height: 46px;
        border: 4px solid var(--bme-border);
        border-top-color: var(--bme-dark-blue);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    @media (prefers-reduced-motion: reduce) {
        .spinner {
            animation-duration: 1.6s;
        }
    }
</style>