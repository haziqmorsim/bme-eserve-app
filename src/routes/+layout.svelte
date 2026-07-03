<script lang="ts">
    import '../app.css';
    import { invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import Chatbot from '$lib/components/Chatbot.svelte';
    import PageSkeleton from '$lib/components/PageSkeleton.svelte';

    let { data, children } = $props();
    let { session, supabase } = $derived(data);

    onMount(() => {
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

<Chatbot />
<PageSkeleton />