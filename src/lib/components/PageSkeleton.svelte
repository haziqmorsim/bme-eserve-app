<script lang="ts">
    import { navigating } from "$app/stores";
    import AuthSkeleton from "$lib/components/AuthSkeleton.svelte";

    const VARIANTS = {
        '/login': 'login',
        '/forgot-password': 'forgot',
        '/enquiry': 'enquiry',
        '/enquiry/confirmation': 'confirmation',
        '/change-password': 'change',
        '/reset-password': 'reset',
        '/maintenance': 'maintenance'
    } as const;

    type Variant = (typeof VARIANTS)[keyof typeof VARIANTS];

    let variant = $state<Variant | null>(null);
    let timer: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        const nav = $navigating;
        const id = nav?.to?.route?.id ?? '';
        const next = (VARIANTS as Record<string, Variant>)[id] ?? null;

        clearTimeout(timer);
        if (nav && next) {
            timer = setTimeout(() => (variant = next), 150);
        } else {
            variant = null;
        }
        return () => clearTimeout(timer);
    });
</script>

{#if variant}
    <div class="skl">
        <AuthSkeleton {variant} />
    </div>
{/if}

<style>
    .skl {
        position: fixed;
        inset: 0;
        z-index: 400;
        overflow-y: auto;
        background: var(--bme-page-bg);
    }
</style>