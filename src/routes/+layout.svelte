<script lang="ts">
    import '../app.css';
    import { invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    import { page, navigating } from '$app/stores';
    import Chatbot from '$lib/components/Chatbot.svelte';
    import BackToTop from '$lib/components/BackToTop.svelte';
    import PageSkeleton from '$lib/components/PageSkeleton.svelte';
    import { toMap, bool } from '$lib/settings';
    import { startTracking } from '$lib/tracking';

    let { data, children } = $props();
    let { session, supabase, user } = $derived(data);

    let chatbotSetting = $derived(bool(toMap(($page.data as any)?.settings), 'chatbot_enabled', true));

    let path = $derived($navigating?.to?.url.pathname ?? $page.url.pathname);
    let inPortal = $derived(path === '/app' || path.startsWith('/app/'));
    let chatbotEnabled = $derived(chatbotSetting && !!user && inPortal);

    onMount(() => {
        startTracking(!!user);
        const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (newSession?.expires_at !== session?.expires_at) {
                invalidate('supabase:auth');
            }
        });
        return () => sub.subscription.unsubscribe();
    });
</script>

<svelte:head>
    <title>{$page.data.title ? `${$page.data.title} | BME e-Serve App` : "BME e-Serve App"}</title>
</svelte:head>

{@render children()}

{#if chatbotEnabled}
    <Chatbot {supabase} {user} />
{/if}
<BackToTop aboveChat={chatbotEnabled} />
<PageSkeleton />