<script lang="ts">
    import { onMount } from "svelte";
    import { idleLimitReached, touchActivity } from "$lib/idle";

    const BEAT_MS = 30_000;

    function leaveIfIdle(): boolean {
        if (!idleLimitReached()) return false;
        window.location.replace('/app');
        return true;
    }

    function beat(): void {
        if (leaveIfIdle()) return;
        touchActivity();
    }

    function onVisibility(): void {
        if (document.visibilityState === 'visible') beat();
        else touchActivity();
    }

    function onPageShow(e: PageTransitionEvent): void {
        if (e.persisted) beat();
    }

    function onPageHide(): void {
        touchActivity();
    }

    onMount(() => {
        touchActivity();
        const timer = setInterval(beat, BEAT_MS);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow);
        window.addEventListener('pagehide', onPageHide);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow);
            window.removeEventListener('pagehide', onPageHide);
        };
    });
</script>