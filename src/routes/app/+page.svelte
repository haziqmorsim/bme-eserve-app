<script lang="ts">
    import BoilerList from "$lib/components/BoilerList.svelte";
    import Dashboard from "$lib/components/Dashboard.svelte";
    import PartsExplorer from "$lib/components/PartsExplorer.svelte";
    import BoilerBlueprint from "$lib/components/BoilerBlueprint.svelte";
    import { afterNavigate } from "$app/navigation";
    import { tick } from "svelte";

    let { data } = $props();

    let contentEl = $state<HTMLElement | null>(null);

    afterNavigate(async (nav) => {
        if (nav.type !== 'link' || !data.boiler) return;
        if (!window.matchMedia('(max-width: 860px)').matches) return;
        await tick();
        setTimeout(() => {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            contentEl?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        }, 60);
    });
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

    <div class="content" bind:this={contentEl}>
        {#if !data.boiler}
            <div class="card empty">
                <div class="empty-bp" aria-hidden="true">
                    <BoilerBlueprint />
                </div>
                <div class="empty-text">
                    <h2>Select a boiler</h2>
                    <p>Choose a boiler from the list to view its dashboard and order parts.</p>
                </div>
            </div>
        {:else}
            <div class="tabbar">
                <!-- <a href={`/app?boiler=${data.boilerId}${data.activeProjectId ? `&project=${data.activeProjectId}` : ''}&tab=dashboard`} class="tab" class:active={data.tab === 'dashboard'}>Dashboard</a> -->
                <a href={`/app?boiler=${data.boilerId}${data.activeProjectId ? `&project=${data.activeProjectId}` : ''}&tab=parts`} class="tab" class:active={data.tab === 'parts'}>Spare Parts</a>
            </div>
            <div class="panel">
                {#if data.tab === 'parts'}
                    <PartsExplorer boiler={data.boiler} components={data.components} parts={data.parts} readings={data.sectionReadings} />
                {:else}
                    <Dashboard
                        boiler={data.boiler}
                        readings={data.sectionReadings}
                        metrics={data.metrics}
                        telemetry={data.telemetry}
                        rul={data.rul}
                        motors={data.motors}
                        maintenance={data.maintenance}
                        metricGroups={data.metricGroups}
                        motorCells={data.motorCells}
                        baselines={data.baselines}
                        indicators={data.indicators}
                        indicatorStatus={data.indicatorStatus}
                        inspection={data.inspection}
                        inspectionItems={data.inspectionItems}
                        findings={data.findings}
                        tubeReadings={data.tubeReadings}
                        dailyLogs={data.dailyLogs}
                        programme={data.programme}
                        actions={data.actions}
                        kpis={data.kpis}
                        projects={data.projects}
                        boilerProjects={data.boilerProjects}
                        activeProjectId={data.activeProjectId}
                        supabase={data.supabase}
                        profile={data.profile} />
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
        scroll-margin-top: 10px;
    }

    .empty {
        position: relative;
        overflow: hidden;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 36px 48px;
        text-align: center;
    }

    .empty-text {
        position: relative;
        z-index: 1;
        margin-top: 30px;
    }

    .empty-text h2 {
        margin: 0 0 6px;
    }

    .empty p {
        margin: 0;
        color: var(--bme-muted);
    }

    .empty-bp {
        position: absolute;
        top: 0;
        left: 50%;
        width: min(100%, 760px);
        transform: translateX(-50%);
        color: color-mix(in srgb, var(--bme-dark-blue) 34%, transparent);
        pointer-events: none;
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
        :global(main:has(> .layout)) {
            display: flex;
            flex-direction: column;
        }

        .layout {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            flex: 1;
            min-height: 0;
        }

        .empty {
            flex: 1;
            min-height: 380px;
            padding: 28px 20px;
        }

        .empty-bp {
            width: 100%;
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