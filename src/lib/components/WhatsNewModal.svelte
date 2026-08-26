<script lang="ts">
    import { Sparkles } from "@lucide/svelte";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import { fade, scale } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    let { show = false, version = '', content = '', supabase, profileId = null } = $props<{
        show?: boolean;
        version?: string;
        content?: string;
        supabase: SupabaseClient;
        profileId?: string | null;
    }>();

    let dismissed = $state(false);
    let visible = $derived(show && !dismissed);

    async function close() {
        dismissed = true;
        if (!profileId || !version) return;
        try {
            const { error } = await supabase.rpc('mark_whats_new_seen', { seen_version: version });
            if (error) console.error('Could not record What\'s New as seen:', error.message);
        } catch (e) {
            console.error('Could not record What\'s New as seen:', e);
        }
    }

    function handleKey(e: KeyboardEvent) {
        if (visible && e.key === 'Escape') close();
    }

    function onOverlayClick(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }
</script>

<svelte:window onkeydown={handleKey} />

{#if visible}
    <div class="modal-overlay" role="presentation" onclick={onOverlayClick} transition:fade={{ duration: 150 }}>
        <div class="modal-panel whats-new-panel" role="dialog" aria-modal="true" aria-label="What's New" tabindex="-1" transition:scale={{ duration: 200, start: 0.94, easing: cubicOut }}>
            <div class="modal-head">
                <h3><Sparkles size={17} class="wn-icon" /> What's New</h3>
                <button class="modal-x" onclick={close} aria-label="Close">✕</button>
            </div>
            <div class="modal-body wn-body">
                <span class="wn-msg">{content}</span>
            </div>
            <div class="wn-actions">
                <button class="btn-primary" onclick={close}>Got it</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .whats-new-panel {
        max-width: 460px;
    }

    .modal-head h3 {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    :global(.wn-icon) {
        color: var(--bme-dark-blue);
    }

    .wn-body {
        padding: 20px;
    }

    .wn-msg {
        display: block;
        font-size: 14px;
        line-height: 1.6;
        color: var(--bme-ink);
        white-space: pre-line;
    }

    .wn-actions {
        display: flex;
        justify-content: flex-end;
        padding: 0 20px 20px;
    }
</style>