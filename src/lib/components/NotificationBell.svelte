<script lang="ts">
    import { Bell } from "@lucide/svelte";
    import { invalidateAll, goto } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import { fly, fade } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import { addItem } from "$lib/stores/quote";
    import { addToast } from "$lib/stores/toast";

    let { notifications = [], supabase, label = '' } = $props<{ notifications: any[]; supabase: SupabaseClient; label?: string }>();

    let open = $state(false);
    let busy = $state(false);

    let unread = $derived(notifications.filter((n: any) => !n.is_read).length);

    function timeAgo(iso: string): string {
        const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (secs < 60) return 'just now';
        const m = Math.floor(secs / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d}d ago`;
        const w = Math.floor(d / 7);
        if (w < 4) return `${w}w ago`;
        const mo = Math.floor(d / 30);
        if (m < 12) return `${mo}mo ago`;
        return `${Math.floor(d / 365)}y ago`;
    }

    function toggle() {
        open = !open;
    }

    function shut() {
        open = false;
    }

    async function markAllAsRead() {
        if (unread === 0) return;
        busy = true;
        const ids = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
        await supabase.from('notifications').update({ is_read: true }).in('id', ids);
        busy = false;
        await invalidateAll();
    }

    async function openItem(n: any) {
        shut();
        if (!n.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
            await invalidateAll();
        }
        const dest =
            n.type === 'request_reminder' || n.type === 'request_escalation' ? '/app/requests'
            : n.type === 'enquiry_reminder' ? '/app/enquiries'
            : n.type === 'cart_reminder' || n.type === 'quote_suggestion' ? '/app/quotes'
            : n.type === 'data_quality' ? '/app/settings'
            : '/app/history';
        goto(dest);
    }

    function suggestedParts(n: any): any[] {
        const list = n?.data?.parts;
        return Array.isArray(list) ? list : [];
    }

    async function respond(n: any, response: 'accepted' | 'declined') {
        busy = true;
        const { error } = await supabase
            .from('notifications')
            .update({ response, responded_at: new Date().toISOString(), is_read: true })
            .eq('id', n.id);
        busy = false;
        if (error) {
            addToast('Sorry, we could not record your response. Please try again.');
            return false;
        }
        await invalidateAll();
        return true;
    }

    async function acceptSuggestion(n: any) {
        const parts = suggestedParts(n);
        const d = n.data ?? {};
        if (!(await respond(n, 'accepted'))) return;

        for (const p of parts) {
            addItem({
                partId: p.partId, 
                partNumber: p.partNumber, 
                partName: p.partName, 
                boilerCode: d.boiler_code ?? '', 
                componentName: d.component_name ?? '', 
                price: p.price ?? undefined, 
                priceMin: p.priceMin ?? p.price ?? 0, 
                priceMax: p.priceMax ?? p.price ?? 0, 
                quantity: p.quantity ?? 1
            });
        }

        shut();
        addToast(
            parts.length === 1
                ? '1 suggested part added to your quote list.'
                : `${parts.length} suggested parts added to your quote list.`
        );
    }

    async function declineSuggestion(n: any) {
        if (!(await respond(n, 'declined'))) return;
        addToast('Suggestion declined. You can still add these parts yourself any time.');
    }
</script>

<div class="bell-wrap" class:as-link={label}>
    {#if label}
        <button class="text-trigger" onclick={toggle} aria-label="Notifications" aria-expanded={open}>
            <span>{label}</span>
            {#if unread > 0}<span class="dot-inline" aria-label="Unread Notifications"></span>{/if}
        </button>
    {:else}
        <button class="bell-btn" onclick={toggle} aria-label="Notifications" aria-expanded={open}>
            <Bell size={20} />
            {#if unread > 0}<span class="dot" aria-label="Unread Notifications"></span>{/if}
        </button>
    {/if}

    {#if open}
        <div class="panel" role="menu" transition:fly={{ y: -8, duration: 190, easing: cubicInOut }}>
            <div class="panel-head">
                <span class="panel-title">Notifications</span>
                <button class="mark-all" onclick={markAllAsRead} disabled={busy || unread === 0}>
                    Mark all as read
                </button>
            </div>

            <div class="panel-body">
                {#if notifications.length === 0}
                    <p class="empty">You have no notifications.</p>
                {:else}
                    {#each notifications as n (n.id)}
                        {#if n.type === 'quote_suggestion' && !n.response}
                            <div class="item suggestion" class:unread={!n.is_read}>
                                <span class="item-top">
                                    <span class="item-title">{n.title}</span>
                                    <span class="item-time">{timeAgo(n.created_at)}</span>
                                </span>
                                <span class="item-body">{n.body}</span>

                                {#if suggestedParts(n).length > 0}
                                    <ul class="sg-parts">
                                        {#each suggestedParts(n).slice(0, 4) as p (p.partId)}
                                            <li><span class="sg-no">{p.partNumber}</span> <span>{p.partName}</span></li>
                                        {/each}
                                        {#if suggestedParts(n).length > 4}
                                            <li class="sg-more">+{suggestedParts(n).length - 4} more</li>
                                        {/if}
                                    </ul>
                                {/if}

                                <span class="sg-actions">
                                    <button class="sg-accept" onclick={() => acceptSuggestion(n)} disabled={busy}>Accept</button>
                                    <button class="sg-decline" onclick={() => declineSuggestion(n)} disabled={busy}>Decline</button>
                                </span>
                            </div>
                        {:else}
                            <button class="item" class:unread={!n.is_read} onclick={() => openItem(n)}>
                                <span class="item-top">
                                    <span class="item-title">{n.title}</span>
                                    <span class="item-time">{timeAgo(n.created_at)}</span>
                                </span>
                                <span class="item-body">{n.body}</span>
                                {#if n.type === 'quote_suggestion' && n.response}
                                    <span class="sg-status {n.response}">
                                        {n.response === 'accepted' ? 'Added to your quote list' : 'Declined'}
                                    </span>
                                {/if}
                            </button>
                        {/if}
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>

{#if open}
    <button class="bell-backdrop" aria-label="Close notifications" onclick={shut} transition:fade={{ duration: 150 }}></button>
{/if}

<style>
    .bell-wrap {
        position: relative;
        display: inline-flex;
    }

    .bell-wrap.as-link {
        display: block;
        width: 100%;
    }

    .text-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 11px 12px;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--bme-dark-blue);
        font: inherit;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
    }

    .text-trigger:hover {
        background: var(--bme-bg);
    }

    .dot-inline {
        margin-left: auto;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--bme-red);
    }
 
    .bell-btn {
        position: relative;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        background: var(--bme-surface);
        color: var(--bme-dark-blue);
        cursor: pointer;
    }
 
    .bell-btn:hover { 
        background: var(--bme-bg);
    }

    .bell-btn:active {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }
 
    .dot {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--bme-red);
        border: 2px solid #ffffff;
    }
 
    .panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 340px;
        max-width: calc(100vw - 32px);
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        border-radius: 12px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        z-index: 80;
        overflow: hidden;
    }
 
    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--bme-border);
    }
 
    .panel-title {
        font-weight: 700;
        color: var(--bme-ink);
    }
 
    .mark-all {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-dark-blue);
        cursor: pointer;
    }
 
    .mark-all:disabled {
        color: var(--bme-muted);
        cursor: default;
    }
 
    .mark-all:not(:disabled):hover { 
        text-decoration: underline; 
    }
 
    .panel-body {
        max-height: 360px;
        overflow-y: auto;
    }
 
    .empty {
        padding: 28px 16px;
        text-align: center;
        color: var(--bme-muted);
        font-size: 14px;
        margin: 0;
    }
 
    .item {
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 100%;
        padding: 12px 14px;
        border: none;
        border-bottom: 1px solid var(--bme-border);
        background: var(--bme-surface);
        text-align: left;
        cursor: pointer;
        font: inherit;
    }
 
    .item:last-child { 
        border-bottom: none; 
    }
    
    .item:hover { 
        background: var(--bme-bg); 
    }
    
    .item.unread { 
        background: #eef5fb; 
    }

    :root[data-theme='dark'] .item.unread {
        background: #16283a;
    }
    
    .item.unread:hover { 
        background: #e3eef8; 
    }

    :root[data-theme='dark'] .item.unread:hover {
        background: #1c3348;
    }
 
    .item-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
    }
 
    .item-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--bme-ink);
    }
 
    .item-time {
        flex: 0 0 auto;
        font-size: 12px;
        color: var(--bme-muted);
    }
 
    .item-body {
        font-size: 13px;
        color: var(--bme-muted);
        line-height: 1.4;
    }

    .item.suggestion {
        cursor: default;
        gap: 8px;
    }

    .item.suggestion:hover {
        background: var(--bme-surface);
    }

    .item.suggestion.unread:hover {
        background: var(--bme-hover);
    }

    .sg-parts {
        list-style: none;
        margin: 0;
        padding: 8px 10px;
        background: var(--bme-bg);
        border-radius: 8px;
        font-size: 12.5px;
        color: var(--bme-ink);
    }

    .sg-parts li {
        display: flex;
        gap: 6px;
        padding: 2px 0;
    }

    .sg-no {
        flex: 0 0 auto;
        font-weight: 700;
        color: var(--bme-dark-blue);
    }

    .sg-more {
        color: var(--bme-muted);
    }

    .sg-actions {
        display: flex;
        gap: 8px;
    }

    .sg-accept,
    .sg-decline {
        flex: 1;
        padding: 7px 10px;
        border-radius: 8px;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }

    .sg-accept {
        background: var(--bme-dark-blue);
        border: 1px solid var(--bme-dark-blue);
        color: #ffffff;
    }

    .sg-accept:hover:not(:disabled) {
        background: var(--bme-darker-blue);
    }

    .sg-decline {
        background: var(--bme-surface);
        border: 1px solid var(--bme-border);
        color: var(--bme-ink);
    }

    .sg-decline:hover:not(:disabled) {
        border-color: var(--bme-dark-blue);
    }

    .sg-accept:disabled,
    .sg-decline:disabled {
        opacity: 0.6;
        cursor: default;
    }

    .sg-status {
        font-size: 12px;
        font-weight: 700;
    }

    .sg-status.accepted {
        color: var(--bme-green);
    }

    .sg-status.declined {
        color: var(--bme-muted);
    }
 
    .bell-backdrop {
        position: fixed;
        inset: 0;
        background: transparent;
        border: none;
        z-index: 70;
        cursor: default;
    }
 
    @media (max-width: 768px) {
        .panel {
            position: fixed;
            top: 100px;
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            width: min(340px, calc(100vw - 32px));
        }

        .bell-btn {
            border: none;
        }
    }
</style>