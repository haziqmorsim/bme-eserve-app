<script lang="ts">
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import SessionTimeout from "$lib/components/SessionTimeout.svelte";
    import AppSkeleton from "$lib/components/AppSkeleton.svelte";
    import WhatsNewModal from "$lib/components/WhatsNewModal.svelte";
    import { navigating } from "$app/stores";
    import { afterNavigate } from "$app/navigation";
    import { untrack } from "svelte";
    import { logActivity } from "$lib/activity";
    import { quoteItems } from "$lib/stores/quote";
    import { toMap, bool } from "$lib/settings";

    let { data, children } = $props();
    let { supabase } = $derived(data);

    let whatsNewSnapshot = $state(untrack(() => data.whatsNew));

    const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
    let settingsMap = $derived(toMap(data.settings));
    let maintenanceOn = $derived(bool(settingsMap, 'maintenance_mode', false));
    let isStaff = $derived(STAFF.has(data.profile?.role));

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

    let cartSyncTimer: ReturnType<typeof setTimeout> | undefined;
    $effect(() => {
        const items = $quoteItems;
        const userId = data.profile?.id;
        clearTimeout(cartSyncTimer);
        if (!userId) return;
        cartSyncTimer = setTimeout(async () => {
            try {
                await supabase.from('cart_state').upsert({
                    user_id: userId, 
                    items, 
                    updated_at: new Date().toISOString()
                });
            } catch (e) {
                console.error('Could not sync cart state:', e);
            }
        }, 2000);
        return () => clearTimeout(cartSyncTimer);
    });

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
    {#if maintenanceOn && isStaff}
        <div class="maint-bar">Maintenance mode is ON — customers cannot access the portal.</div>
    {/if}
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

<WhatsNewModal
    show={whatsNewSnapshot.show}
    version={whatsNewSnapshot.version}
    content={whatsNewSnapshot.content}
    supabase={data.supabase}
    profileId={data.profile?.id} />

<style>
    .maint-bar {
        background: var(--bme-orange, #b26a00);
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
        padding: 7px 12px;
    }

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