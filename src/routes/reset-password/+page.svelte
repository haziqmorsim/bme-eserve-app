<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { Check, X } from "@lucide/svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();
    let { supabase } = $derived(data);

    let pw = $state('');
    let confirm = $state('');
    let busy = $state(false);
    let err = $state('');
    let done = $state(false);

    let checking = $state(true);
    let linkError = $state('');

    let checks = $derived({
        length: pw.length >= 8, 
        upper: /[A-Z]/.test(pw), 
        number: /[0-9]/.test(pw), 
        symbol: /[^A-Za-z0-9]/.test(pw)
    });
    let allValid = $derived(checks.length && checks.upper && checks.number && checks.symbol);
    let match = $derived(confirm.length > 0 && pw === confirm);

    onMount(() => {
        const hash = window.location.hash ?? '';
        const params = new URLSearchParams(hash.replace(/^#/, ''));

        if (params.get('error') || hash.includes('error')) {
            linkError = (params.get('error_description') ?? 'This reset link is invalid or has expired.').replace(/\+/g, ' ');
            checking = false;
            return;
        }

        let settled = false;
        const safety = setTimeout(() => {
            if (!settled) { settled = true; checking = false; }
        }, 4000);

        (async () => {
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken, 
                    refresh_token: refreshToken
                });
                if (error) {
                    linkError = 'This reset link is invalid or has expired. Please request a new one.';
                } else {
                    history.replaceState(null, '', window.location.pathname);
                }
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    linkError = 'This reset link is invalid or has expired. Please request a new one.';
                }
            }

            if (!settled) { settled = true; checking = false; }
        })();

        return () => clearTimeout(safety);
    });

    async function submit() {
        err = '';
        if (!allValid) {
            err = 'Please meet all the password requirements below.';
            return;
        }
        if (!match) {
            err = 'The passwords do not match.';
            return;
        }

        busy = true;
        const { error } = await supabase.auth.updateUser({ password: pw });
        busy = false;

        if (error) {
            err = error.message?.includes('session') 
                ? 'Your reset link is invalid or has expired. Please request a new one.' 
                : (error.message ?? 'Could not reset your password. Please try again.');
            return;
        }

        done = true;
        addToast('Password reset successfully. Please sign in.');
        await supabase.auth.signOut();
        setTimeout(() => goto('/login'), 1500);
    }
</script>

<div class="auth">
    <div class="card panel">
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" class="logo" />
        <h1>BME e-Serve App</h1>
        <p class="sub">Reset Password</p>

        {#if checking}
            <p class="lead">Verifying your reset link...</p>
        {:else if linkError}
            <div class="bad">
                <p>{linkError}</p>
            </div>
            <p class="back"><a href="/forgot-password">Request a new reset link</a></p>
        {:else if done}
            <div class="sent">
                <p>Your password has been reset successfully.</p>
                <p class="hint">Redirecting to the sign-in page...</p>
            </div>
        {:else}
            <p class="lead">Enter a new password.</p>

            <label>
                <span>New Password</span>
                <input type="password" bind:value={pw} autocomplete="new-password" />
            </label>
            <label>
                <span>Confirm Password</span>
                <input type="password" bind:value={confirm} autocomplete="new-password" />
            </label>
            <ul class="rules">
                <li class:ok={checks.length}>
                    <span class="ic">{#if checks.length}<Check size={15} />{:else}<X size={15} />{/if}</span>
                    At least 8 characters
                </li>
                <li class:ok={checks.upper}>
                    <span class="ic">{#if checks.upper}<Check size={15} />{:else}<X size={15} />{/if}</span>
                    At least one capital letter
                </li>
                <li class:ok={checks.number}>
                    <span class="ic">{#if checks.number}<Check size={15} />{:else}<X size={15} />{/if}</span>
                    At least one number
                </li>
                <li class:ok={checks.symbol}>
                    <span class="ic">{#if checks.symbol}<Check size={15} />{:else}<X size={15} />{/if}</span>
                    At least one symbol
                </li>
                <li class:ok={match} class:muted={confirm.length === 0}>
                    <span class="ic">{#if match}<Check size={15} />{:else}<X size={15} />{/if}</span>
                    Passwords match
                </li>
            </ul>

            {#if err}<p class="err">{err}</p>{/if}

            <button type="button" class="btn-primary" onclick={submit} disabled={busy} style="width: 100%; margin-top: 6px;">
                {busy ? 'Resetting...' : 'Reset Password'}
            </button>
        {/if}
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
        text-align: center;
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
 
    .rules {
        list-style: none;
        margin: 4px 0 14px;
        padding: 14px 16px;
        background: var(--bme-light-grey);
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        font-size: 13px;
    }
 
    .rules li {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--bme-red);
        margin-bottom: 6px;
    }
 
    .rules li:last-child { 
        margin-bottom: 0; 
    }
 
    .rules li.ok { 
        color: var(--bme-green); 
    }

    .rules li.muted { 
        color: var(--bme-muted); 
    }
 
    .rules .ic {
        display: inline-flex;
        flex-shrink: 0;
    }
 
    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    }
 
    .bad {
        background: rgba(208, 48, 47, 0.08);
        border: 1px solid rgba(208, 48, 47, 0.30);
        border-radius: 10px;
        padding: 16px;
        font-size: 14px;
        color: var(--bme-ink);
    }
 
    .bad p { 
        margin: 0; 
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