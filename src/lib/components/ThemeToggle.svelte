<script lang="ts">
    import { Sun, Moon } from "@lucide/svelte";
    import { theme } from "$lib/theme.svelte";

    let { size = 20 } = $props<{ size?: number }>();
</script>

<button type="button" class="theme-toggle" onclick={() => theme.toggle()} aria-label={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
    {#if theme.current === 'dark'}
        <Moon {size} />
    {:else}
        <Sun {size} />
    {/if}
</button>

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
</style>