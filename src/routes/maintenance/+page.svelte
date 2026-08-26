<script lang="ts">
    let { data } = $props();
</script>

<div class="maint-wrap">
    <div class="card maint-card">
        <h1>Under maintenance</h1>
        <p class="maint-msg">{data.message}</p>
        {#if data.supportEmail}
            <p class="maint-contact">
                Need help? Contact <a href={`mailto:${data.supportEmail}`}>{data.supportEmail}</a>
            </p>
        {/if}
        <a href="/app" class="btn-primary maint-retry">Try again</a>
    </div>
</div>

<style>
    .maint-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
    }

    .maint-card {
        max-width: 560px;
        width: 100%;
        padding: 32px;
        text-align: center;
    }

    .maint-card h1 {
        margin-top: 0;
        color: var(--bme-dark-blue);
    }

    .maint-msg {
        color: var(--bme-muted);
        white-space: pre-line;
    }

    .maint-contact {
        font-size: 13.5px;
        color: var(--bme-muted);
    }

    .maint-retry {
        display: inline-block;
        margin-top: 8px;
        text-decoration: none;
    }
</style>