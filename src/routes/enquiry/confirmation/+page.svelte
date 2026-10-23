<script lang="ts">
    import { CircleCheck } from "@lucide/svelte";
    import AuthBrandPanel from "$lib/components/AuthBrandPanel.svelte";
</script>

<div class="shell">
    <AuthBrandPanel />

    <main class="pane">
        <div class="card panel">
            <div class="check"><CircleCheck size={52} /></div>
            <h2>Enquiry sent</h2>
            <p class="msg">Your enquiry has been sent successfully. You will receive a confirmation e-mail from us.</p>
            <a href="/login" class="btn-primary submit back-btn">Back to sign in</a>
        </div>
    </main>
</div>

<style>
    .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(340px, 5fr) 7fr;
        background: var(--bme-page-bg);
    }

    .pane {
        display: grid;
        place-items: center;
        padding: 32px 24px;
    }

    .panel {
        width: 100%;
        max-width: 440px;
        padding: 34px 36px 28px;
        border-radius: 16px;
    }

    h2 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
        color: var(--bme-ink);
    }

    /* .sub {
        margin: 6px 0 24px;
        font-size: 14px;
        color: var(--bme-muted);
    }

    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    } */

    .submit {
        width: 100%;
        height: 46px;
        margin-top: 6px;
        font-size: 15px;
        font-weight: 700;
        border-radius: 8px;
    }

    .panel {
        text-align: center;
        padding-top: 40px;
        padding-bottom: 36px;
    }

    .check {
        display: inline-flex;
        color: var(--bme-green);
        margin-bottom: 10px;
    }

    .msg {
        margin: 10px 0 26px;
        font-size: 15px;
        line-height: 1.6;
        color: var(--bme-muted);
    }

    .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
    }

    @media (max-width: 860px) {
        .shell {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
        }

        .pane {
            align-items: start;
            padding: 20px 16px 28px;
        }
    }

    @media (max-width: 480px) {
        .panel {
            padding: 26px 20px 22px;
        }
    }
</style>