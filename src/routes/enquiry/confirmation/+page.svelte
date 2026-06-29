<script lang="ts">
    import { CircleCheck } from "@lucide/svelte";
</script>

<div class="auth">
    <div class="card panel">
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" class="logo" />
        <div class="check"><CircleCheck size={48} /></div>
        <h1>Enquiry Sent</h1>
        <p class="msg">Your enquiry has been sent successfully. You will receive a confirmation e-mail from us.</p>
        <a href="/login" class="btn-primary back">Back to Sign In</a>
    </div>
</div>

<style>
    .auth {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: radial-gradient(1200px, 500px at 80% -10%, rgba(63, 123, 179, 0.16), transpaernt), var(--bme-bg);
    }

    .panel {
        width: 100%;
        max-width: 440px;
        padding: 40px 32px;
        text-align: center;
    }

    .logo {
        display: block;
        height: 88px;
        margin: 0 auto 14px;
    }

    .check {
        display: inline-flex;
        color: var(--bme-green);
        margin-bottom: 8px;
    }

    h1 {
        margin: 0 0 10px;
        font-size: 24px;
    }

    .msg {
        color: var(--bme-muted);
        font-size: 15px;
        line-height: 1.6;
        margin: 0 0 24px;
    }

    .back {
        display: inline-block;
        text-decoration: none;
    }

    @media (max-width: 480px) {
        .panel {
            padding: 30px 22px;
        }

        .logo {
            height: 68px;
        }
    }
</style>