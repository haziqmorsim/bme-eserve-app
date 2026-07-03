<script lang="ts">
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import SessionTimeout from "$lib/components/SessionTimeout.svelte";
    import AppSkeleton from "$lib/components/AppSkeleton.svelte";
    import { navigating } from "$app/stores";

    let { data, children } = $props();
    let { supabase } = $derived(data);

    async function handleTimeout() {
        await supabase.auth.signOut();
    }

    // Show a page-tailored skeleton while navigating between app pages.
    let showSkeleton = $state(false);
    let skTimer: ReturnType<typeof setTimeout> | undefined;
    let dest = $derived($navigating?.to?.route?.id ?? '');
    $effect(() => {
        const nav = $navigating;
        clearTimeout(skTimer);
        if (nav && nav.to?.route?.id?.startsWith('/app')) {
            skTimer = setTimeout(() => (showSkeleton = true), 150);
        } else {
            showSkeleton = false;
        }
        return () => clearTimeout(skTimer);
    });
</script>

<div class="shell">
    <Header profile={data.profile} pendingCount={data.pendingCount} notifications={data.notifications} supabase={data.supabase} />
    <main>
        {#if showSkeleton}
            <AppSkeleton route={dest} />
        {:else}
            {@render children()}
        {/if}
    </main>
    <Footer />
</div>

<Toaster />

<SessionTimeout onTimeout={handleTimeout} />

<style>
    .shell {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        flex: 1;
        padding: 10px;
    }

    @media (max-width: 768px) {
        .shell {
            padding-left: 56px;
        }
    }
</style>