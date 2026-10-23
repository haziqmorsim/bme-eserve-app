<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { track, flush } from "$lib/tracking";
    import AuthBrandPanel from "$lib/components/AuthBrandPanel.svelte";

    let { data } = $props();

    let name = $state('');
    let email = $state('');
    let company = $state('');
    let message = $state('');

    let submitting = $state(false);
    let errorMsg = $state('');

    let started = false;
    onMount(() => track('enquiry_view'));
    $effect(() => {
        const touched = !!(name || email || company || message);
        if (touched && !started) {
            started = true;
            track('enquiry_start');
        }
    });

    async function submitEnquiry() {
        errorMsg = '';
        if (!name.trim() || !email.trim() || !company.trim() || !message.trim()) {
            errorMsg = 'Please fill in all fields.';
            return;
        }

        submitting = true;
        const { error } = await data.supabase.functions.invoke('general-enquiry', {
            body: {
                name: name.trim(), 
                email: email.trim(), 
                company: company.trim(), 
                message: message.trim()
            }
        });
        submitting = false;

        if (error) {
            errorMsg = 'Sorry, your enquiry cannot be sent. Please try again.';
            return;
        }
        track('enquiry_submit');
        flush(true);
        await goto('/enquiry/confirmation');
    }
</script>

<div class="shell">
    <AuthBrandPanel />

    <main class="pane">
        <div class="card panel">
            <h2>General enquiry</h2>
            <p class="sub">Not a customer? Send us a message and our team will get back to you.</p>

            <label>
                <span>Name <i class="required">*</i></span>
                <input type="text" bind:value={name} required autocomplete="name" />
            </label>
            <label>
                <span>E-mail Address <i class="required">*</i></span>
                <input type="email" bind:value={email} required autocomplete="email" />
            </label>
            <label>
                <span>Company <i class="required">*</i></span>
                <input type="text" bind:value={company} required autocomplete="organization" />
            </label>
            <label>
                <span>Message <i class="required">*</i></span>
                <textarea rows="5" bind:value={message} required placeholder="How can we help?"></textarea>
            </label>

            {#if errorMsg}<p class="err" role="alert">{errorMsg}</p>{/if}

            <button type="button" class="btn-primary submit" onclick={submitEnquiry} disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Enquiry'}
            </button>

            <p class="back"><a href="/login">&larr; Back to sign in</a></p>
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
        max-width: 480px;
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

    .required {
        font-style: normal;
        color: var(--bme-red);
    }

    textarea {
        resize: vertical;
        min-height: 110px;
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