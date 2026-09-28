<script lang="ts">
    import GeneralManager from "$lib/components/admin/GeneralManager.svelte";
    import ProjectManager from "$lib/components/admin/ProjectManager.svelte";
    import BoilerManager from "$lib/components/admin/BoilerManager.svelte";
    import PartManager from "$lib/components/admin/PartManager.svelte";
    import UserManager from "$lib/components/admin/UserManager.svelte";
    import FaqManager from "$lib/components/admin/FaqManager.svelte";
    import BoilerDataManager from "$lib/components/admin/BoilerDataManager.svelte";
    import DashboardManager from "$lib/components/admin/DashboardManager.svelte";
    import Modal from "$lib/components/admin/Modal.svelte";
    import { beforeNavigate, goto } from "$app/navigation";

    type Tab = 'dashboard' | 'general' | 'projects' | 'boilers' | 'parts' | 'users' | 'faq';

    let { data } = $props();
    let tab = $state<Tab>('projects');

    let generalDirty = $state(false);
    let pendingLeave = $state<null | (() => void | Promise<void>)>(null);
    let leaving = false;

    const hasUnsavedGeneral = () => tab === 'general' && generalDirty;

    function selectTab(next: Tab) {
        if (next === tab) return;
        if (hasUnsavedGeneral()) {
            pendingLeave = () => {
                generalDirty = false;
                tab = next;
            };
            return;
        }
        tab = next;
    }

    beforeNavigate((nav) => {
        if (leaving || !hasUnsavedGeneral()) return;

        if (nav.to?.url.pathname.startsWith('/login')) return;

        if (nav.type === 'leave') {
            nav.cancel();
            return;
        }

        const target = nav.to?.url;
        if (!target || nav.type === 'form') return;

        nav.cancel();
        pendingLeave = async () => {
            leaving = true;
            if (target.origin === location.origin) {
                try {
                    await goto(target);
                } finally {
                    leaving = false;
                }
            } else {
                location.href = target.href;
            }
        };
    });

    async function confirmLeave() {
        const go = pendingLeave;
        pendingLeave = null;
        await go?.();
    }

    function cancelLeave() {
        pendingLeave = null;
    }
</script>

<h1>Settings</h1>

<div class="tabbar">
    <!-- <button class="tab" class:active={tab === 'dashboard'} onclick={() => selectTab('dashboard')}>Dashboard</button> -->
    <button class="tab" class:active={tab === 'projects'} onclick={() => selectTab('projects')}>Projects</button>
    <button class="tab" class:active={tab === 'boilers'} onclick={() => selectTab('boilers')}>Boilers</button>
    <button class="tab" class:active={tab === 'parts'} onclick={() => selectTab('parts')}>Parts</button>
    <button class="tab" class:active={tab === 'users'} onclick={() => selectTab('users')}>Users</button>
    <button class="tab" class:active={tab === 'general'} onclick={() => selectTab('general')}>General</button>
    <button class="tab" class:active={tab === 'faq'} onclick={() => selectTab('faq')}>FAQ</button>
</div>

{#if tab === 'dashboard'}
    <section>
        <DashboardManager
            metrics={data.dashMetrics}
            groups={data.dashGroups}
            motors={data.dashMotors}
            motorCells={data.dashMotorCells}
            rul={data.dashRul}
            baselines={data.dashBaselines}
            indicators={data.dashIndicators}
            boilers={data.boilers}
            supabase={data.supabase} />
    </section>
{:else if tab === 'general'}
    <section>
        <GeneralManager settings={data.appSettings} supabase={data.supabase} profile={data.profile} bind:dirty={generalDirty} />
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
        <UserManager users={data.users} projects={data.projects} customerProjects={data.customerProjects} supabase={data.supabase} />
    </section>
{:else}
    <section>
        <FaqManager faqs={data.faqs} supabase={data.supabase} />
    </section>
{/if}

{#if pendingLeave}
    <Modal title="Unsaved Changes" onclose={cancelLeave}>
        <div class="modal-confirm">
            <p>Are you sure you want to leave this page? Your changes will not be saved.</p>
            <div class="modal-actions">
                <button class="btn-ghost" onclick={cancelLeave}>Cancel</button>
                <button class="btn-primary" onclick={confirmLeave}>Confirm</button>
            </div>
        </div>
    </Modal>
{/if}

<style>
    .bd-section {
        margin-top: 34px;
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