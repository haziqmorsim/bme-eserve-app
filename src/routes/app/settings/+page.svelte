<script lang="ts">
    import BoilerManager from "$lib/components/admin/BoilerManager.svelte";
    import PartManager from "$lib/components/admin/PartManager.svelte";
    import UserManager from "$lib/components/admin/UserManager.svelte";
    import FaqManager from "$lib/components/admin/FaqManager.svelte";

    let { data } = $props();
    let tab = $state<'boilers' | 'parts' | 'users' | 'faq'>('boilers');
</script>

<h1>Settings</h1>

<div class="tabbar">
    <button class="tab" class:active={tab === 'boilers'} onclick={() => (tab = 'boilers')}>Boilers</button>
    <button class="tab" class:active={tab === 'parts'} onclick={() => (tab = 'parts')}>Parts</button>
    <button class="tab" class:active={tab === 'users'} onclick={() => (tab = 'users')}>Users</button>
    <button class="tab" class:active={tab === 'faq'} onclick={() => (tab = 'faq')}>FAQ</button>
</div>

{#if tab === 'boilers'}
    <section>
        <BoilerManager boilers={data.boilers} regions={data.regions} supabase={data.supabase} />
    </section>
{:else if tab === 'parts'}
    <section>
        <PartManager parts={data.parts} components={data.components} boilers={data.boilers} supabase={data.supabase} />
    </section>
{:else if tab === 'users'}
    <section>
        <UserManager users={data.users} regions={data.regions} boilers={data.boilers} assignments={data.assignments} supabase={data.supabase} />
    </section>
{:else}
    <section>
        <FaqManager faqs={data.faqs} supabase={data.supabase} />
    </section>
{/if}

<style>
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
        background-color: #ffffff;
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
    }
</style>