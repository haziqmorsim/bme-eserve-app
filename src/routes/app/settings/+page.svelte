<script lang="ts">
    import GeneralManager from "$lib/components/admin/GeneralManager.svelte";
    import ProjectManager from "$lib/components/admin/ProjectManager.svelte";
    import BoilerManager from "$lib/components/admin/BoilerManager.svelte";
    import PartManager from "$lib/components/admin/PartManager.svelte";
    import UserManager from "$lib/components/admin/UserManager.svelte";
    import FaqManager from "$lib/components/admin/FaqManager.svelte";
    import BoilerDataManager from "$lib/components/admin/BoilerDataManager.svelte";

    let { data } = $props();
    let tab = $state<'general' | 'projects' | 'boilers' | 'parts' | 'users' | 'faq'>('projects');
</script>

<h1>Settings</h1>

<div class="tabbar">
    <button class="tab" class:active={tab === 'projects'} onclick={() => (tab = 'projects')}>Projects</button>
    <button class="tab" class:active={tab === 'boilers'} onclick={() => (tab = 'boilers')}>Boilers</button>
    <button class="tab" class:active={tab === 'parts'} onclick={() => (tab = 'parts')}>Parts</button>
    <button class="tab" class:active={tab === 'users'} onclick={() => (tab = 'users')}>Users</button>
    <button class="tab" class:active={tab === 'general'} onclick={() => (tab = 'general')}>General</button>
    <button class="tab" class:active={tab === 'faq'} onclick={() => (tab = 'faq')}>FAQ</button>
</div>

{#if tab === 'general'}
    <section>
        <GeneralManager settings={data.appSettings} supabase={data.supabase} profile={data.profile} />
    </section>
{:else if tab === 'projects'}
    <section>
        <ProjectManager projects={data.projects} supabase={data.supabase} />
    </section>
{:else if tab === 'boilers'}
    <section>
        <BoilerManager boilers={data.boilers} projects={data.projects} boilerProjects={data.boilerProjects} supabase={data.supabase} />
    </section>

    <section class="bd-section">
        <BoilerDataManager
            boilers={data.boilers}
            specs={data.boilerSpecs}
            readings={data.boilerReadings}
            supabase={data.supabase} />
    </section>
{:else if tab === 'parts'}
    <section>
        <PartManager parts={data.parts} components={data.components} boilers={data.boilers} supabase={data.supabase} />
    </section>
{:else if tab === 'users'}
    <section>
        <UserManager users={data.users} boilers={data.boilers} assignments={data.assignments} supabase={data.supabase} />
    </section>
{:else}
    <section>
        <FaqManager faqs={data.faqs} supabase={data.supabase} />
    </section>
{/if}

<style>
    .bd-section {
        margin-top: 34px;
        border-top: 1px solid var(--bme-border);
    }

    h1 {
        margin: 5px 0 15px;
    }

    .tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 20px;
        flex-wrap: wrap;
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
        border-color: var(--bme-dark-blue);
    }

    @media (max-width: 640px) {
        .tabbar {
            width: 100%;
            justify-content: space-between;
        }

        .tab {
            width: 30%;
        }
    }
</style>