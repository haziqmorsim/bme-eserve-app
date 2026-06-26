<script lang="ts">
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import SessionTimeout from "$lib/components/SessionTimeout.svelte";

    let { data, children } = $props();
    let { supabase } = $derived(data);

    async function handleTimeout() {
        await supabase.auth.signOut();
    }
</script>

<div class="shell">
    <Header profile={data.profile} pendingCount={data.pendingCount} notifications={data.notifications} supabase={data.supabase} />
    <main>
        {@render children()}
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