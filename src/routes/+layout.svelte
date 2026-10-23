<script lang="ts">
    import '../app.css';
    import { invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import Chatbot from '$lib/components/Chatbot.svelte';
    import PageSkeleton from '$lib/components/PageSkeleton.svelte';
    import { toMap, bool } from '$lib/settings';
    import { startTracking } from '$lib/tracking';

    let { data, children } = $props();
    let { session, supabase, user } = $derived(data);

    let chatbotEnabled = $derived(bool(toMap(($page.data as any)?.settings), 'chatbot_enabled', true));

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
<PageSkeleton />