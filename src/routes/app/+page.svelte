<script lang="ts">
    import BoilerList from "$lib/components/BoilerList.svelte";
    import Dashboard from "$lib/components/Dashboard.svelte";
    import PartsExplorer from "$lib/components/PartsExplorer.svelte";

    let { data } = $props();
</script>

<div class="layout">
    <BoilerList
        boilers={data.boilers}
        projects={data.projects}
        boilerProjects={data.boilerProjects}
        activeBoilerId={data.boilerId}
        activeProjectId={data.activeProjectId}
        customerNoBoilers={data.customerNoBoilers}
        supabase={data.supabase}
        profile={data.profile} />

    <div class="content">
        {#if !data.boiler}
            <div class="card empty">
                <h2>Select a boiler</h2>
                <p>Choose a boiler from the list to view its dashboard and order parts.</p>
            </div>
        {:else}
            <div class="tabbar">
                <a href={`/app?boiler=${data.boilerId}${data.activeProjectId ? `&project=${data.activeProjectId}` : ''}&tab=dashboard`} class="tab" class:active={data.tab === 'dashboard'}>Dashboard</a>
                <a href={`/app?boiler=${data.boilerId}${data.activeProjectId ? `&project=${data.activeProjectId}` : ''}&tab=parts`} class="tab" class:active={data.tab === 'parts'}>Spare Parts</a>
            </div>
            <div class="panel">
                {#if data.tab === 'parts'}
                    <PartsExplorer boiler={data.boiler} components={data.components} parts={data.parts} readings={data.sectionReadings} />
                {:else}
                    <Dashboard boiler={data.boiler} readings={data.sectionReadings} />
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
        align-items: stretch;
        min-height: 63vh;
    }

    .content {
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
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
        background-color: var(--bme-surface);
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
            min-height: 0;
        }

        .empty {
            flex: none;
        }
    }

    @media (max-width: 640px) {
        .tabbar {
            width: 100%;
            justify-content: space-between;
        }

        .tab {
            width: 48%;
            text-align: center;
        }
    }
</style>