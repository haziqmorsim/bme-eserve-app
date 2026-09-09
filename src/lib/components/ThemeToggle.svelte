<script lang="ts">
    import { Sun, Moon } from "@lucide/svelte";
    import { theme } from "$lib/theme.svelte";

    let { size = 20, variant = 'icon' } = $props<{ size?: number; variant?: 'icon' | 'segmented' }>();
</script>

{#if variant === 'segmented'}
    <div class="theme-seg" role="group" aria-label="Theme">
        <button
            type="button"
            class="seg"
            class:active={theme.current === 'light'}
            aria-pressed={theme.current === 'light'}
            onclick={() => theme.set('light')}>
            <Sun size={15} />
            <span>Light</span>
        </button>
        <button
            type="button"
            class="seg"
            class:active={theme.current === 'dark'}
            aria-pressed={theme.current === 'dark'}
            onclick={() => theme.set('dark')}>
            <Moon size={15} />
            <span>Dark</span>
        </button>
    </div>
{:else}
    <button type="button" class="theme-toggle" onclick={() => theme.toggle()} aria-label={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {#if theme.current === 'dark'}
            <Moon {size} />
        {:else}
            <Sun {size} />
        {/if}
    </button>
{/if}

<style>
    .theme-toggle {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        background-color: var(--bme-surface);
        color: var(--bme-dark-blue);
    }

    .theme-toggle:hover {
        border-color: var(--bme-dark-blue);
    }

    :root[data-theme='dark'] .theme-toggle {
        color: #ffffff;
    }

    .theme-seg {
        display: inline-flex;
        border: 1.5px solid var(--bme-dark-blue);
        border-radius: 8px;
        overflow: hidden;
        flex: 0 0 auto;
    }

    .seg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 16px;
        border: none;
        background: var(--bme-surface);
        color: var(--bme-dark-blue);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
    }

    .seg.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
        border-radius: 0;
    }

    .seg:not(.active):hover {
        background: var(--bme-hover);
    }
</style>