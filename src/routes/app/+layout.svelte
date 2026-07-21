<script lang="ts">
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import SessionTimeout from "$lib/components/SessionTimeout.svelte";
    import AppSkeleton from "$lib/components/AppSkeleton.svelte";
    import { navigating } from "$app/stores";
    import { afterNavigate } from "$app/navigation";
    import { logActivity } from "$lib/activity";

    let { data, children } = $props();
    let { supabase } = $derived(data);

    async function handleTimeout() {
        if (data.profile?.id) {
            try {
                await supabase
                    .from('chat_sessions')
                    .update({ ended_at: new Date().toISOString(), end_reason: 'timeout' })
                    .eq('user_id', data.profile.id)
                    .is('ended_at', null);
            } catch (e) {
                console.error('Could not close chat session on timeout:', e);
            }
        }
        await supabase.auth.signOut();
    }

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

    afterNavigate((nav) => {
        const url = nav.to?.url;
        const path = url?.pathname;
        if (!path || !path.startsWith('/app')) return;
        if (path === '/app' && !url?.searchParams.has('boiler')) return;
        logActivity(
            data.supabase,
            data.profile ? { id: data.profile.id, role: data.profile.role } : null,
            { event_type: 'page_view', path }
        );
    });
</script>

<div class="shell">
    <Header profile={data.profile} pendingCount={data.pendingCount} enquiryCount={data.enquiryCount} notifications={data.notifications} supabase={data.supabase} />
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