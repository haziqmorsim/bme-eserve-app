<script lang="ts">
    import { onMount } from "svelte";
    import { ArrowUp } from "@lucide/svelte";

    let {
        threshold = 300,
        aboveChat = false
    }: {
        threshold?: number;
        aboveChat?: boolean;
    } = $props();

    let visible = $state(false);

    function update() {
        visible = window.scrollY > threshold;
    }

    function toTop() {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }

    onMount(update);
</script>

<svelte:window onscroll={update} onresize={update} />

<button
    type="button"
    class="back-to-top"
    class:visible
    class:above-chat={aboveChat}
    onclick={toTop}
    aria-label="Back to top"
    title="Back to top"
    tabindex={visible ? 0 : -1}
    aria-hidden={!visible}
>
    <ArrowUp size={20} aria-hidden="true" />
</button>

<style>
    .back-to-top {
        position: fixed;
        right: 1.25rem;
        bottom: 1.25rem;
        z-index: 40;
        width: 2.75rem;
        height: 2.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 50%;
        border: 1px solid var(--bme-border);
        background: var(--bme-surface);
        color: var(--bme-dark-blue);
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
        opacity: 0;
        visibility: hidden;
        transform: translateY(8px);
        transition:
            opacity 0.2s ease,
            transform 0.2s ease,
            visibility 0s linear 0.2s,
            background-color 0.15s ease,
            color 0.15s ease;
    }

    .back-to-top.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        transition-delay: 0s;
    }

    .back-to-top.above-chat {
        right: calc(1.25rem + 0.125rem);
        bottom: calc(1.25rem + 3rem + 0.75rem);
    }

    .back-to-top:hover {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .back-to-top:focus-visible {
        outline: 2px solid var(--bme-dark-blue);
        outline-offset: 3px;
    }

    @media (max-width: 480px) {
        .back-to-top {
            right: 0.75rem;
            bottom: 0.75rem;
        }

        .back-to-top.above-chat {
            right: calc(0.75rem + 0.125rem);
            bottom: calc(0.75rem + 3rem + 0.75rem);
        }
    }

    @media print {
        .back-to-top {
            display: none;
        }
    }
</style>