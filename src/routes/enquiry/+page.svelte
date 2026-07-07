<script lang="ts">
    import { goto } from "$app/navigation";

    let { data } = $props();

    let name = $state('');
    let email = $state('');
    let company = $state('');
    let message = $state('');

    let submitting = $state(false);
    let errorMsg = $state('');

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
        await goto('/enquiry/confirmation');
    }
</script>

<div class="auth">
    <div class="card panel">
        <img src="/images/bme-logo.jpg" alt="BME e-Serve" class="logo" />
        <h1>General Enquiry</h1>
        <p class="sub">Not a customer? Send us a message and our team will get back to you.</p>
            <label>
                Name <span class="required">*</span>
                <input type="text" bind:value={name} required autocomplete="name" />
            </label>
            <label>
                E-mail Address <span class="required">*</span>
                <input type="email" bind:value={email} required autocomplete="email" />
            </label>
            <label>
                Company <span class="required">*</span>
                <input type="text" bind:value={company} required autocomplete="organization" />
            </label>
            <label>
                Message <span class="required">*</span>
                <textarea rows="5" bind:value={message} required placeholder="How can we help?"></textarea>
            </label>

            {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

            <button type="button" class="btn-primary" onclick={submitEnquiry} disabled={submitting} style="width: 100%; margin-top: 6px;">{submitting ? 'Sending...' : 'Send Enquiry'}</button>

            <p class="note"><a href="/login">Back to Sign In</a></p>
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
        max-width: 460px;
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
        text-align: center;
    }
 
    label {
        display: block;
        font-weight: 600;
        margin-bottom: 14px;
    }
 
    label > span {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 4px;
    }

    input, textarea {
        margin-top: 8px;
    }
 
    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 4px 0 10px;
    }
 
    .note {
        margin-top: 20px;
        font-size: 13px;
        color: var(--bme-muted);
        text-align: center;
    }
 
    .note a {
        font-weight: 600;
        color: var(--bme-dark-blue);
    }

    @media (max-width: 480px) {
        .panel { padding: 26px 20px; }
        .logo { height: 72px; }
    }
</style>