<script lang="ts">
    import InvoiceExtractor from "$lib/components/InvoiceExtractor.svelte";
    import PackingListExtractor from "$lib/components/PackingListExtractor.svelte";
    import { untrack } from "svelte";

    type Tab = 'invoice' | 'packing';

    let { data } = $props();

    let tab = $state<Tab>(untrack(() => (data.tab as Tab)) ?? 'invoice');
</script>

<h1>Others</h1>

<div class="tabbar">
    <button class="tab" class:active={tab === 'invoice'} onclick={() => (tab = 'invoice')}>Shipping Invoice</button>
    <button class="tab" class:active={tab === 'packing'} onclick={() => (tab = 'packing')}>Packing List</button>
</div>

{#if tab === 'invoice'}
    <p class="intro">
        Convert shipping invoice PDFs into an organised Excel file.
    </p>
    <InvoiceExtractor canRun={data.canRun} />
{:else if tab === 'packing'}
    <p class="intro">
        Convert packing list PDFs into an organised Excel file.
    </p>
    <PackingListExtractor canRun={data.canRun} />
{/if}

<style>
    h1 {
        margin: 5px 0 15px;
    }

    .intro {
        margin: 10px 0 20px;
        color: var(--bme-muted);
        font-size: 0.85rem;
    }

    .tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }

    .tab {
        padding: 9px 22px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        font-weight: 700;
        background-color: var(--bme-surface);
        color: var(--bme-muted);
        cursor: pointer;
        transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
    }

    .tab.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
        border-color: var(--bme-dark-blue);
    }

    @media (max-width: 640px) {
        .tabbar {
            width: 100%;
        }

        .tab {
            flex: 1;
            padding: 9px 10px;
        }
    }
</style>