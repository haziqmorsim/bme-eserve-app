<script lang="ts">
    import { enhance } from "$app/forms";
    import { untrack } from "svelte";
    import Announcement from "$lib/components/Announcement.svelte";

    let { data, form } = $props();
    let loading = $state(false);

    let email = $state(untrack(() => form?.email ?? ''));
    let password = $state('');
    let fieldErr = $state<Record<string, string>>({});

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!email.trim()) e.email = 'E-mail is required.';
        if (!password) e.password = 'Password is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }
</script>

<div class="auth">
    <Announcement message={data.announcement} />
    <div class="card panel">
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" class="logo" />
        <h1>BME e-Serve App</h1>
        <p class="sub">Sign In</p>

        <form method="POST" use:enhance={({ cancel }) => {
            if (!validate()) {
                cancel();
                return;
            }
            loading = true;
            return async ({ update }) => {
                await update();
                loading = false;
            };
        }}
        >
            <label>
                <span>E-mail</span>
                <input type="email" name="email" bind:value={email} autocomplete="username" class:invalid={fieldErr.email} />
                {#if fieldErr.email}<span class="field-err">{fieldErr.email}</span>{/if}
            </label>
            <label>
                <span>Password</span>
                <input type="password" name="password" bind:value={password} autocomplete="current-password" class:invalid={fieldErr.password} />
                {#if fieldErr.password}<span class="field-err">{fieldErr.password}</span>{/if}
            </label>

            <div class="forgot"><a href="/forgot-password">Forgot password?</a></div>

            {#if form?.error}
                <p class="err">{form.error}</p>
            {/if}

            <button type="submit" class="btn-primary" disabled={loading} style="width: 100%; margin-top: 6px;">
                {loading ? 'Signing in...' : 'Sign In'}
            </button>
        </form>

        <p class="note">Accounts are created by BME administrators.<br>Contact us if you need access.</p>
        <p class="enquiry">Not a customer? <a href="/enquiry">Make a general enquiry</a></p>
    </div>
</div>

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
        margin-bottom: 10px;
        margin-left: auto;
        margin-right: auto;
    }

    h1 {
        margin: 0 0 4px;
        font-size: 24px;
        text-align: center;
    }

    .sub {
        margin: 0 0 22px;
        color: var(--bme-muted);
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

    .field-err {
        display: block;
        margin-top: 4px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-red);
    }

    input.invalid {
        border-color: var(--bme-red);
    }

    input.invalid:focus {
        outline-color: var(--bme-red);
    }

    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    }

    .forgot {
        text-align: right;
        margin: -8px 0 14px;
    }

    .forgot a {
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-dark-blue);
    }

    .forgot a:hover {
        text-decoration: underline;
    }

    .note {
        margin-top: 20px;
        font-size: 13px;
        color: var(--bme-muted);
        text-align: center;
    }

    .enquiry {
        margin-top: 6px;
        font-size: 13px;
        color: var(--bme-muted);
        text-align: center;
    }

    .enquiry a {
        font-weight: 600;
        color: var(--bme-dark-blue);
    }

    .enquiry a:hover {
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