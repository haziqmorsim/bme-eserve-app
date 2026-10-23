<script lang="ts">
    import { goto } from "$app/navigation";
    import { Check, X } from "@lucide/svelte";
    import Toaster from "$lib/components/Toaster.svelte";
    import { addToast } from "$lib/stores/toast";
    import AuthBrandPanel from "$lib/components/AuthBrandPanel.svelte";

    let { data } = $props();
    let { supabase } = $derived(data);

    let pw = $state('');
    let confirm = $state('');
    let busy = $state(false);
    let err = $state('');
    let done = $state(false);

    let checks = $derived({
        length: pw.length >= 8, 
        upper: /[A-Z]/.test(pw), 
        number: /[0-9]/.test(pw), 
        symbol: /[^A-Za-z0-9]/.test(pw)
    });
    let allValid = $derived(checks.length && checks.upper && checks.number && checks.symbol);
    let match = $derived(confirm.length > 0 && pw === confirm);

    async function submit() {
        err = '';
        if (!allValid) {
            err = 'Please meet all password requirements below.';
            return;
        }
        if (!match) {
            err = 'The passwords do not match.';
            return;
        }

        busy = true;
        const { error } = await supabase.auth.updateUser({ password: pw });

        if (error) {
            busy = false;
            err = error.message ?? 'Could not change your password. Please try again.';
            return;
        }

        const { error: rpcErr } = await supabase.rpc('clear_must_change_password');
        busy = false;

        if (rpcErr) {
            err = 'Your password was changed, but we could not update your account. Please contact support.';
            return;
        }

        done = true;
        addToast('Password changed successfully. Please sign in.');
        await supabase.auth.signOut();
        setTimeout(() => goto('/login'), 1500);
    }
</script>

<div class="shell">
    <AuthBrandPanel />

    <main class="pane">
        <div class="card panel">
            <h2>Change password</h2>

            {#if done}
                <div class="sent">
                    <p>Your password has been changed successfully.</p>
                    <p class="hint">Redirecting to the sign-in page...</p>
                </div>
            {:else}
                <p class="sub">For security, please replace your temporary password before continuing.</p>

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

                {#if err}<p class="err" role="alert">{err}</p>{/if}

                <button type="button" class="btn-primary submit" onclick={submit} disabled={busy}>
                    {busy ? 'Changing...' : 'Change password'}
                </button>

                <form action="/logout" method="POST" class="back-form">
                    <button type="submit" class="link-btn">Back to sign in</button>
                </form>
            {/if}
        </div>
    </main>
</div>

<Toaster />

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

    .sub {
        margin: 6px 0 24px;
        font-size: 14px;
        color: var(--bme-muted);
    }

    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    }

    .submit {
        width: 100%;
        height: 46px;
        margin-top: 6px;
        font-size: 15px;
        font-weight: 700;
        border-radius: 8px;
    }

    label {
        display: block;
        margin-bottom: 16px;
    }

    label > span:first-child {
        display: block;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
        color: var(--bme-ink);
    }

    input {
        height: 44px;
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

    .sent {
        margin-top: 20px;
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

    .back-form {
        margin: 22px 0 0;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
        text-align: center;
    }

    .link-btn {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-dark-blue);
        cursor: pointer;
    }

    .link-btn:hover {
        text-decoration: underline;
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