<script lang="ts">
    import Header from "$lib/components/Header.svelte";
    import Footer from "$lib/components/Footer.svelte";
    let { data, children } = $props();
</script>

<div class="shell">
    <Header profile={data.profile} />
    <main>
        {@render children()}
    </main>
    <Footer />
</div>

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
</style>