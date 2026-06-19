<script lang="ts">
    import Toaster from "$lib/components/Toaster.svelte";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();
    let { supabase } = $derived(data);

    let email = $state('');
    let busy = $state(false);
    let sent = $state(false);
    let err = $state('');

    async function submit() {
        if (!email.trim()) {
            err: 'Please enter your e-mail address.';
            return;
        }
        busy = true;
        err = '';

        await supabase.functions.invoke('reset-password', { body: {
            email: email.trim()
        }});

        busy = false;
        sent = true;
        addToast('If the e-mail is registered, a reset link has been sent.')
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter') submit();
    }
</script>

<div class="auth">
    <div class="card panel">
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" class="logo" />
        <h1>BME e-Serve App</h1>
        <p class="sub">Forgot Password</p>

        {#if sent}
            <div class="sent">
                <p>If an account exists for <strong>{email.trim()}</strong>, a passowrd reset link has been sent to the e-mail address.</p>
                <p class="hint">The link expires in 30 minutes.</p>
            </div>
        {:else}
            <p class="lead">Enter your e-mail address and a link will be sent to reset your password.</p>
            <label>
                <span>E-mail</span>
                <input type="email" bind:value={email} onkeydown={onKey} required autocomplete="username" />
            </label>

            {#if err}<p class="err">{err}</p>{/if}

            <button type="button" class="btn-primary" onclick={submit} disabled={busy} style="width: 100%; margin-top: 6px;">
                {busy ? 'Sending...' : 'Send Reset Link'}
            </button>
        {/if}

        <p class="back"><a href="/login">&larr; Back to sign in</a></p>
    </div>
</div>

<Toaster />

<style>
    .auth {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: radial-gradient(1200px 500px at 80% -10%, rgba(63, 123, 179, 0.16), transparent), var(--bme-bg);
    }
 
    .panel {
        width: 100%;
        max-width: 400px;
        padding: 36px 32px;
    }
 
    .logo {
        display: block;
        height: 100px;
        margin: 0 auto 10px;
    }
 
    h1 {
        margin: 0 0 4px;
        font-size: 24px;
        text-align: center;
    }
 
    .sub {
        margin: 0 0 22px;
        color: var(--bme-muted);
        text-align: center;
    }
 
    .lead {
        font-size: 14px;
        color: var(--bme-muted);
        margin: 0 0 18px;
    }
 
    label {
        display: block;
        margin-bottom: 14px;
    }
 
    label span {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
        color: var(--bme-ink);
    }
 
    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    }
 
    .sent {
        background: rgba(108, 179, 63, 0.10);
        border: 1px solid rgba(108, 179, 63, 0.35);
        border-radius: 10px;
        padding: 16px;
        font-size: 14px;
        color: var(--bme-ink);
    }
 
    .sent p { 
        margin: 0 0 8px; 
    }

    .sent p:last-child { 
        margin-bottom: 0; 
    }

    .sent .hint { 
        color: var(--bme-muted); 
        font-size: 13px; 
    }
 
    .back {
        margin-top: 20px;
        font-size: 13px;
        text-align: center;
    }
 
    .back a {
        font-weight: 600;
        color: var(--bme-dark-blue);
    }
 
    .back a:hover { 
        text-decoration: underline; 
    }
 
    @media (max-width: 480px) {
        .panel { 
            padding: 26px 20px; 
        }

        .logo { 
            height: 72px; 
        }
    }
</style>