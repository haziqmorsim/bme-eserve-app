<script lang="ts">
    import { page } from "$app/stores";
    import { quoteItems } from "$lib/stores/quote";

    let { profile } = $props();
    let count = $derived($quoteItems.reduce((n, i) => n + i.quantity, 0));
</script>

<header class="header">
    <div class="row">
        <div>
            <a href="/app" class="brand">
                <img src="/images/bme-logo.jpg" alt="BME e-Serve" />
            </a>
        </div>
        <div class="pages">
            <button class="btn-ghost" class:active={$page.url.pathname === '/app'}><a href="/app">Home</a></button>

            <button class="btn-ghost quote-btn" class:active={$page.url.pathname === '/app/quote'}><a href="/app/quote">Quotes</a>{#if count > 0}<span class="badge">{count}</span>{/if}</button>

            {#if profile?.role === 'admin'}
            <button class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/admin')}><a href="/app/admin">Requests</a></button>
            <button class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/settings')}><a href="/app/settings">Settings</a></button>
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
                <button class="btn-ghost" class:active={$page.url.pathname.startsWith('/app/history')}><a href="/app/history">History</a></button>
                <form action="/logout" method="POST">
                    <button type="submit" class="btn-ghost">Sign Out</button>
                </form>
            </div>
        </div>
    </nav>
</header>

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

    .pages .btn-ghost.active {
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .pages .btn-ghost.active a {
        color: #ffffff;
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

    @media (max-width: 640px) {
        .header { 
            flex-direction: column; 
            align-items: stretch; 
            gap: 12px; 
        }

        .row { 
            flex-direction: column; 
            align-items: flex-start; 
            gap: 10px; 
        }

        .brand img { 
            height: 52px; 
        }

        .pages { 
            margin-top: 0; 
            display: flex; 
            flex-wrap: wrap; 
            gap: 8px; 
        }

        nav { 
            width: 100%; 
        }

        .column { 
            width: 100%; 
        }

        .title-container { 
            align-self: flex-start; 
        }

        .actions { 
            margin-top: 8px; 
            flex-wrap: wrap; 
            justify-content: flex-start; 
            gap: 10px; 
        }
    }
</style>