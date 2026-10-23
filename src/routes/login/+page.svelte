<script lang="ts">
    import { enhance } from "$app/forms";
    import { untrack } from "svelte";
    import { Eye, EyeOff } from "@lucide/svelte";
    import Announcement from "$lib/components/Announcement.svelte";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";
    import AuthBrandPanel from "$lib/components/AuthBrandPanel.svelte";

    let { data, form } = $props();
    let loading = $state(false);

    let email = $state(untrack(() => form?.email ?? ''));
    let password = $state('');
    let showPassword = $state(false);
    let fieldErr = $state<Record<string, string>>({});

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!email.trim()) e.email = 'E-mail is required.';
        if (!password) e.password = 'Password is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }
</script>

<div class="shell">
    <Announcement message={data.announcement} />

    <AuthBrandPanel />

    <main class="pane">
        <div class="card panel">
            <div class="head">
                <h2>Sign in</h2>
                <ThemeToggle variant="segmented" fontSize={16} compact />
            </div>
            <p class="sub">Use the e-mail and password registered to your account.</p>

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
                    <div class="pw">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            bind:value={password}
                            autocomplete="current-password"
                            class:invalid={fieldErr.password}
                        />
                        <button
                            type="button"
                            class="eye"
                            onclick={() => (showPassword = !showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                        >
                            {#if showPassword}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
                        </button>
                    </div>
                    {#if fieldErr.password}<span class="field-err">{fieldErr.password}</span>{/if}
                </label>

                <div class="forgot"><a href="/forgot-password">Forgot password?</a></div>

                {#if form?.error}
                    <p class="err" role="alert">{form.error}</p>
                {/if}

                <button type="submit" class="btn-primary submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <div class="foot">
                <p class="note">Accounts are created by BME administrators.<br>Contact us if you need access.</p>
                <p class="enquiry">Not a customer? <a href="/enquiry">Make a general enquiry</a></p>
            </div>
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

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
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

    .pw {
        position: relative;
    }

    .pw input {
        padding-right: 44px;
    }

    .eye {
        position: absolute;
        top: 0;
        right: 0;
        height: 44px;
        width: 44px;
        display: grid;
        place-items: center;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--bme-muted);
        cursor: pointer;
        border-radius: 0 8px 8px 0;
    }

    .eye:hover {
        color: var(--bme-dark-blue);
    }

    .eye:focus-visible {
        outline: 2px solid var(--bme-dark-blue);
        outline-offset: -2px;
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
        margin: -8px 0 18px;
    }

    .forgot a {
        font-size: 13px;
        font-weight: 700;
        color: var(--bme-dark-blue);
    }

    .forgot a:hover {
        text-decoration: underline;
    }

    .submit {
        width: 100%;
        height: 46px;
        font-size: 15px;
        font-weight: 700;
        border-radius: 8px;
    }

    .foot {
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .note {
        margin: 0;
        font-size: 13px;
        color: var(--bme-muted);
        text-align: center;
    }

    .enquiry {
        margin: 8px 0 0;
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