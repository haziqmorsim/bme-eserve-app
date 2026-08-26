<script lang="ts">
    import { navigating } from "$app/stores";

    let show = $state(false);
    let timer: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        const nav = $navigating;
        clearTimeout(timer);
        if (nav && !nav.to?.route?.id?.startsWith('/app')) {
            timer = setTimeout(() => (show = true), 150);
        } else {
            show = false;
        }
        return () => clearTimeout(timer);
    });
</script>

{#if show}
    <div class="skl" role="status" aria-live="polite" aria-label="Loading">
        <div class="skl-topbar">
            <div class="sk sk-logo"></div>
            <div class="skl-navpills">
                {#each Array(4) as _, i (i)}<div class="sk sk-pill"></div>{/each}
            </div>
        </div>

        <div class="skl-content">
            <div class="sk sk-title"></div>
            <div class="skl-cards">
                {#each Array(4) as _, i (i)}<div class="sk sk-card"></div>{/each}
            </div>
            <div class="skl-list">
                {#each Array(5) as _, i (i)}<div class="sk sk-row"></div>{/each}
            </div>
        </div>

        <span class="sr-only">Loading...</span>
    </div>
{/if}

<style>
    .skl {
        position: fixed;
        inset: 0;
        z-index: 400;
        background: var(--bme-bg);
        overflow: hidden;
        animation: sklFade 160ms ease both;
    }

    .skl-topbar {
        height: 64px;
        background: #ffffff;
        border-bottom: 1px solid var(--bme-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
    }

    .sk-logo { 
        width: 120px; 
        height: 30px; 
    }

    .skl-navpills { 
        display: flex; 
        gap: 10px; 
    }

    .sk-pill { 
        width: 74px; 
        height: 30px; 
    }

    .skl-content {
        max-width: 1100px;
        margin: 0 auto;
        padding: 28px 20px;
    }

    .sk-title { 
        width: 220px; 
        height: 26px; 
        margin-bottom: 22px; 
    }

    .skl-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 24px;
    }
    .sk-card { 
        height: 92px; 
    }

    .skl-list { 
        display: flex; 
        flex-direction: column; 
        gap: 12px; 
    }

    .sk-row { 
        height: 64px; 
    }

    .sk {
        border-radius: 10px;
        background: linear-gradient(90deg, #e9edf1 25%, #f4f7f9 37%, #e9edf1 63%);
        background-size: 400% 100%;
        animation: sklShimmer 1.3s ease infinite;
    }

    @keyframes sklShimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
    }
    @keyframes sklFade {
        from { opacity: 0; }
        to { opacity: 1; }
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

    @media (max-width: 720px) {
        .skl-navpills { 
            display: none; 
        }

        .skl-cards { 
            grid-template-columns: repeat(2, 1fr); 
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sk { 
            animation-duration: 2.4s; 
        }
    }
</style>