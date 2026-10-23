<script lang="ts">
    import Toaster from "$lib/components/Toaster.svelte";
    import { addToast } from "$lib/stores/toast";
    import AuthBrandPanel from "$lib/components/AuthBrandPanel.svelte";

    let { data } = $props();
    let { supabase } = $derived(data);

    let email = $state('');
    let busy = $state(false);
    let sent = $state(false);
    let err = $state('');

    async function submit() {
        if (!email.trim()) {
            err = 'Please enter your e-mail address.';
            return;
        }
        busy = true;
        err = '';

        const { error } = await supabase.functions.invoke('reset-password', { body: {
            email: email.trim()
        }});

        busy = false;

        if (error) {
            let message = 'Something went wrong. Please try again.';
            try {
                const body = await (error as any).context?.json();
                if (body?.error === 'not_found') {
                    message = 'An account with this e-mail address does not exist.';
                } else if (body?.message) {
                    message = body.message;
                }
            } catch {
                // Keep the default message if the error body can't be parsed.
            }
            err = message;
            return;
        }

        sent = true;
        addToast('A password reset link has been sent.');
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter') submit();
    }
</script>

<div class="shell">
    <AuthBrandPanel />

    <main class="pane">
        <div class="card panel">
            <h2>Forgot password</h2>

            {#if sent}
                <div class="sent">
                    <p>A password reset link has been sent to <strong>{email.trim()}</strong>.</p>
                    <p class="hint">The link expires in 30 minutes.</p>
                </div>
            {:else}
                <p class="sub">Enter your e-mail address and a link will be sent to reset your password.</p>
                <label>
                    <span>E-mail</span>
                    <input type="email" bind:value={email} onkeydown={onKey} required autocomplete="username" />
                </label>

                {#if err}<p class="err" role="alert">{err}</p>{/if}

                <button type="button" class="btn-primary submit" onclick={submit} disabled={busy}>
                    {busy ? 'Sending...' : 'Send Reset Link'}
                </button>
            {/if}

            <p class="back"><a href="/login">&larr; Back to sign in</a></p>
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

    .back {
        margin: 22px 0 0;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
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