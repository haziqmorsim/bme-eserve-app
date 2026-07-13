<script lang="ts">
    import RegionList from "$lib/components/RegionList.svelte";
    import Dashboard from "$lib/components/Dashboard.svelte";
    import PartsExplorer from "$lib/components/PartsExplorer.svelte";

    let { data } = $props();
</script>

<div class="layout">
    <RegionList regions={data.regions} activeBoilerId={data.boilerId} customerNoBoilers={data.customerNoBoilers} supabase={data.supabase} profile={data.profile} />

    <div class="content">
        {#if !data.boiler}
            <div class="card empty">
                <h2>Select a boiler</h2>
                <p>Choose a boiler from the list to view its dashboard and order parts.</p>
            </div>
        {:else}
            <div class="tabbar">
                <a href={`/app?boiler=${data.boilerId}&tab=dashboard`} class="tab" class:active={data.tab === 'dashboard'}>Dashboard</a>
                <a href={`/app?boiler=${data.boilerId}&tab=parts`} class="tab" class:active={data.tab === 'parts'}>Parts</a>
            </div>
            <div class="panel">
                {#if data.tab === 'parts'}
                    <PartsExplorer boiler={data.boiler} components={data.components} supabase={data.supabase} />
                {:else}
                    <Dashboard boiler={data.boiler} />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 10px;
        align-items: start;
    }

    .content {
        min-width: 0;
    }

    .empty {
        padding: 48px;
        text-align: center;
    }

    .empty p {
        color: var(--bme-muted);
    }

    .tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 18px;
    }

    .tab {
        padding: 9px 22px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        font-weight: 700;
        background-color: #ffffff;
        color: var(--bme-muted);
    }

    .tab:hover {
        border-color: var(--bme-darker-blue);
    }

    .tab.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .panel {
        min-width: 0;
    }

    @media (max-width: 860px) {
        .layout {
            grid-template-columns: 1fr;
        }
    }
</style>