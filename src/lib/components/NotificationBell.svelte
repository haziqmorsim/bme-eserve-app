<script lang="ts">
    import { Bell } from "@lucide/svelte";
    import { invalidateAll, goto } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import { fly, fade } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";

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
            n.type === 'request_reminder' ? '/app/requests'
            : n.type === 'enquiry_reminder' ? '/app/enquiries'
            : n.type === 'cart_reminder' ? '/app/quotes'
            : '/app/history';
        goto(dest);
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
                        <button class="item" class:unread={!n.is_read} onclick={() => openItem(n)}>
                            <span class="item-top">
                                <span class="item-title">{n.title}</span>
                                <span class="item-time">{timeAgo(n.created_at)}</span>
                            </span>
                            <span class="item-body">{n.body}</span>
                        </button>
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
        background: #ffffff;
        color: var(--bme-dark-blue);
        cursor: pointer;
    }
 
    .bell-btn:hover { 
        background: var(--bme-bg);
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
        background: #ffffff;
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
        background: #ffffff;
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
    
    .item.unread:hover { 
        background: #e3eef8; 
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