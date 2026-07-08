<script lang="ts">
    import { page } from "$app/stores";
    import { quoteItems } from "$lib/stores/quote";
    import { Menu } from "@lucide/svelte";
    import NotificationBell from "$lib/components/NotificationBell.svelte";

    let { profile, pendingCount = 0, enquiryCount = 0, notifications = [], supabase } = $props();
    let count = $derived($quoteItems.reduce((n, i) => n + i.quantity, 0));

    let open = $state(false);
    const close = () => (open = false);

    let isStaff = $derived(
        profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'coo' || profile?.role === 'developer'
    );
    let isAdmin = $derived(profile?.role === 'admin' || profile?.role === 'developer');
</script>

<header class="header">
    <div class="row">
        <div>
            <a href="/app" class="brand">
                <img src="/images/bme-logo.jpg" alt="BME e-Serve" />
            </a>
        </div>
        <div class="pages">
            <a class="btn-ghost" class:active={$page.url.pathname === '/app'} href="/app">Home</a>

            <a class="btn-ghost quote-btn" class:active={$page.url.pathname === '/app/quotes'} href="/app/quotes">Quotes{#if count > 0}<span class="badge">{count}</span>{/if}</a>

            {#if isStaff}
                <a class="btn-ghost badge-btn" class:active={$page.url.pathname.startsWith('/app/requests')} href="/app/requests">Requests{#if pendingCount > 0}<span class="badge">{pendingCount}</span>{/if}</a>
            {/if}
            {#if isStaff}
                <a class="btn-ghost badge-btn" class:active={$page.url.pathname.startsWith('/app/enquiries')} href="/app/enquiries">Enquiries{#if enquiryCount > 0}<span class="badge">{enquiryCount}</span>{/if}</a>
            {/if}
            {#if isStaff}
                <a class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/analytics')} href="/app/analytics">Analytics</a>
            {/if}
            {#if isAdmin}
                <a class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/settings')} href="/app/settings">Settings</a>
            {/if}
        </div>
    </div>

    <nav>
        <div class="column">
            <div class="title-container">
                <span class="title">BME e-Serve App</span>
            </div>
            <div class="title-container">
                <p class="greeting">Hi, <span class="name">{profile?.full_name ?? 'there'}</span></p>
            </div>
            <div class="actions">
                <NotificationBell {notifications} {supabase} />
                <a class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/history')} href="/app/history">History</a>
                <form action="/logout" method="POST">
                    <button type="submit" class="btn-ghost signout">Sign Out</button>
                </form>
            </div>
        </div>
    </nav>
</header>

<aside class="sidebar" class:open>
    <a href="/app" class="side-logo" onclick={close}>
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" />
    </a>

    <button class="menu-btn" onclick={() => (open = !open)} aria-label="Toggle menu" aria-expanded={open}>
        <Menu size={24} />
    </button>

    <div class="side-body">
        <nav class="side-group top">
            <a href="/app" class="side-link" class:active={$page.url.pathname === '/app'} onclick={close}>Home</a>

            <a href="/app/quotes" class="side-link" class:active={$page.url.pathname === '/app/quotes'} onclick={close}>
                <span>Quotes</span>{#if count > 0}<span class="badge">{count}</span>{/if}
            </a>

            {#if isStaff}
                <a href="/app/requests" class="side-link" class:active={$page.url.pathname.startsWith('/app/requests')} onclick={close}>
                    <span>Requests</span>{#if pendingCount > 0}<span class="badge">{pendingCount}</span>{/if}
                </a>
            {/if}
            {#if isStaff}
                <a href="/app/enquiries" class="side-link" class:active={$page.url.pathname.startsWith('/app/enquiries')} onclick={close}><span>Enquiries</span>{#if enquiryCount > 0}<span class="badge">{enquiryCount}</span>{/if}</a>
            {/if}
            {#if isStaff}
                <a href="/app/analytics" class="side-link" class:active={$page.url.pathname.startsWith('/app/analytics')} onclick={close}>Analytics</a>
            {/if}
            {#if isAdmin}
                <a href="/app/settings" class="side-link" class:active={$page.url.pathname.startsWith('/app/settings')} onclick={close}>Settings</a>
            {/if}
        </nav>

        <nav class="side-group bottom">
            <div class="side-bell"><NotificationBell {notifications} {supabase} /></div>
            <a href="/app/history" class="side-link" class:active={$page.url.pathname.startsWith('/app/history')} onclick={close}>History</a>
            <form action="/logout" method="POST">
                <button type="submit" class="side-link signout">Sign Out</button>
            </form>
        </nav>
    </div>
</aside>

{#if open}
    <button class="backdrop" aria-label="Close menu" onclick={close}></button>
{/if}

<style>
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 150px;
        margin: 0 10px;
        padding: 0 24px;
        background: var(--bme-surface);
        border-bottom: 1px solid var(--bme-border);
        top: 0;
        z-index: 50;
    }

    .brand img {
        height: 120px;
        display: block;
    }

    nav {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    form {
        margin: 0;
    }

    .greeting {
        font-weight: 600;
        color: var(--bme-muted);
        margin-right: 6px;
        margin-bottom: 0;
    }

    .greeting :global(strong) {
        color: var(--bme-ink);
    }

    .name {
        font-weight: bold;
    }

    .column {
        display: flex;
        flex-direction: column;
    }

    .row {
        display: flex;
        flex-direction: row;
        gap: 20px;
    }

    .actions {
        display: flex;
        justify-content: end;
        margin-top: 15px;
        gap: 20px;
    }

    .pages {
        margin-top: auto;
        display: flex;
        gap: 20px;
    }

    .title-container {
        align-self: flex-end;
    }

    .title {
        font-size: 20px;
        font-weight: 600;
        color: var(--bme-dark-blue);
    }

    .quote-btn {
        position: relative;
        overflow: visible;
    }

    .quote-btn .badge {
        position: absolute;
        top: 0;
        right: 0;
        transform: translate(50%, -50%);
        pointer-events: none;
    }

    .badge-btn {
        position: relative;
        overflow: visible;
    }

    .badge-btn .badge {
        position: absolute;
        top: 0;
        right: 0;
        transform: translate(50%, -50%);
        pointer-events: none;
    }

    .pages .btn-ghost.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .btn-ghost {
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
    }

    .signout {
        height: 100%;
        font-size: 14px;
    }

    .side-bell { 
        padding: 4px 0 8px;
        margin-right: auto;
    }

    .sidebar { 
        display: none; 
    }

    .backdrop { 
        display: none; 
    }

    @media (max-width: 1024px) {
        .header {
            height: auto;
            margin: 0;
            padding: 14px 16px;
        }

        .brand img {
            height: 72px;
        }

        .title {
            font-size: 16px;
        }

        nav {
            gap: 10px;
        }
    }

    @media (max-width: 768px) {
        .header { display: none; }

        .sidebar {
            display: flex;
            flex-direction: column;
            position: fixed;
            margin: 10px 0;
            top: 0;
            left: 0;
            height: 100dvh;
            width: 56px;
            background: var(--bme-surface);
            border-right: 1px solid var(--bme-border);
            z-index: 60;
            overflow: hidden;
            transition: width 0.3s ease;
        }

        .sidebar.open {
            width: 150px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.18);
        }

        .menu-btn {
            flex: 0 0 auto;
            width: 56px;
            height: 56px;
            display: grid;
            place-items: center;
            background: none;
            border: none;
            color: var(--bme-dark-blue);
            cursor: pointer;
        }

        .side-logo {
            display: block;
            padding: 8px;
        }

        .side-logo img {
            display: block;
            width: 100%;
            height: auto;
        }

        .sidebar.open .side-logo {
            padding: 12px 12px 6px;
        }

        .sidebar.open .side-logo img {
            width: auto;
            height: 60px;
        }

        .side-body {
            display: none;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            padding: 4px 12px 16px;
            overflow-y: auto;
        }

        .sidebar.open .side-body {
            display: flex;
        }

        .side-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .side-group.bottom {
            margin-top: auto;
            padding-top: 16px;
        }

        .side-link {
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

        .side-link:hover {
            background: var(--bme-bg);
        }

        .side-link.active {
            background: var(--bme-dark-blue);
            color: #ffffff;
        }

        .side-link .badge {
            margin-left: auto;
        }

        .side-body form {
            margin: 0;
            width: 100%;
            display: flex;
        }

        .side-link.signout {
            flex: 1;
            width: 100%;
            justify-content: flex-start;
            text-align: left;
        }

        .backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            border: none;
            border-radius: 0;
            z-index: 55;
            cursor: pointer;
        }
    }
</style>