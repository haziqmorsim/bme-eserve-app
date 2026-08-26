<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import { UserRound, Pencil } from "@lucide/svelte";

    let { data } = $props();

    let me: any = $derived(data.me);

    const ROLE_LABEL: Record<string, string> = {
        customer: 'Customer', 
        admin: 'Admin', 
        manager: 'Manager', 
        coo: 'COO', 
        developer: 'Developer'
    };

    let editing = $state(false);
    let busy = $state(false);
    let err = $state('');
    let fieldErr = $state<Record<string, string>>({});
    let form = $state<any>({});

    function startEdit() {
        const m: any = me ?? {};
        form = {
            full_name: m.full_name ?? '', 
            company: m.company ?? '', 
            email: m.email ?? '', 
            phone: m.phone ?? '', 
            address_line1: m.address_line1 ?? '', 
            address_line2: m.address_line2 ?? '', 
            city: m.city ?? '', 
            postcode: m.postcode ?? '', 
            state: m.state ?? '', 
            country: m.country ?? ''
        };
        err = ''; fieldErr = {}; editing = true;
    }

    function cancel() {
        editing = false; err = ''; fieldErr = {};
    }

    function validate(): boolean {
        const e: Record<string, string> = {};
        if (!form.full_name?.toString().trim()) e.full_name = 'Full name is required.';
        const email = form.email?.toString().trim() ?? '';
        if (!email) e.email = 'E-mail is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid e-mail address.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
        busy = true; err = '';

        const supabase = data.supabase;
        const newEmail = form.email.trim();
        const emailChanged = newEmail.toLowerCase() !== (data.authEmail ?? '').toLowerCase();

        const { error } = await supabase.rpc('update_my_profile', {
            p_full_name: form.full_name, 
            p_company: form.company, 
            p_email: newEmail, 
            p_phone: form.phone, 
            p_address_line1: form.address_line1, 
            p_address_line2: form.address_line2, 
            p_city: form.city, 
            p_postcode: form.postcode, 
            p_state: form.state, 
            p_country: form.country
        });

        if (error) {
            busy = false;
            err = error.message;
            return;
        }

        let emailNotice = false;
        if (emailChanged) {
            const { error: aErr } = await supabase.auth.updateUser({ email: newEmail });
            if (aErr) {
                busy = false;
                err = `Your details were saved, but the sign-in e-mail could not be changed: ${aErr.message}`;
                await invalidateAll();
                return;
            }
            emailNotice = true;
        }

        busy = false;
        editing = false;
        addToast(
            emailNotice
                ? 'Profile updated. Check your new e-mail address to confirm the change.'
                : 'Profile updated successfully'
        );
        await invalidateAll();
    }

    function show(v: any): string {
        const s = (v ?? '').toString().trim();
        return s || '--';
    }

    let addressLines = $derived(
        [
            me?.address_line1, 
            me?.address_line2, 
            [me?.postcode, me?.city].filter(Boolean).join(' '), 
            me?.state, 
            me?.country
        ].filter((x: any) => (x ?? '').toString().trim())
    );
</script>

<div class="head">
    <h1>Profile</h1>
    {#if !editing}
        <button class="btn-primary" onclick={startEdit}>
            <Pencil size={16} /> Edit Profile
        </button>
    {/if}
</div>

{#if !me}
    <div class="card empty">We could not load your profile. Please try again.</div>
{:else}
    <div class="card who">
        <div class="avatar"><UserRound size={30} /></div>
        <div class="who-text">
            <p class="who-name">{show(me.full_name)}</p>
            <p class="who-sub">{show(me.company)}</p>
        </div>
        <div class="who-tags">
            <span class="role">{ROLE_LABEL[me.role] ?? me.role ?? '--'}</span>
        </div>
    </div>

    {#if editing}
        <div class="card sect">
            <h2>Personal Information</h2>
            <div class="grid">
                <label>Full Name <span class="required">*</span>
                    <input bind:value={form.full_name} class:invalid={fieldErr.full_name} />
                    {#if fieldErr.full_name}<span class="field-err">{fieldErr.full_name}</span>{/if}
                </label>
                <label><span>Company</span>
                    <input bind:value={form.company} />
                </label>
                <label>E-mail <span class="required">*</span>
                    <input type="email" bind:value={form.email} class:invalid={fieldErr.email} />
                    {#if fieldErr.email}<span class="field-err">{fieldErr.email}</span>{/if}
                </label>
                <label><span>Phone</span>
                    <input bind:value={form.phone} placeholder="+60..." />
                </label>
                <label><span>Role</span>
                    <input bind:value={ROLE_LABEL[me.role]} disabled />
                </label>
            </div>
        </div>

        <div class="card sect">
            <h2>Address</h2>
            <div class="grid">
                <label class="wide"><span>Address Line 1</span>
                    <input bind:value={form.address_line1} placeholder="Unit/Street" />
                </label>
                <label class="wide"><span>Address Line 2</span>
                    <input bind:value={form.address_line2} placeholder="Area/Building" />
                </label>
                <label><span>Postcode</span>
                    <input bind:value={form.postcode} placeholder="47620" />
                </label>
                <label><span>City</span>
                    <input bind:value={form.city} placeholder="Subang Jaya" />
                </label>
                <label><span>State</span>
                    <input bind:value={form.state} placeholder="Selangor" />
                </label>
                <label><span>Country</span>
                    <input bind:value={form.country} placeholder="Malaysia" />
                </label>
            </div>

            {#if err}<p class="adm-err">{err}</p>{/if}

            <div class="actions">
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</button>
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
            </div>
        </div>
    {:else}
        <div class="card sect">
            <h2>Personal Information</h2>
            <dl class="rows">
                <div class="row"><dt>Full Name</dt><dd>{show(me.full_name)}</dd></div>
                <div class="row"><dt>Company</dt><dd>{show(me.company)}</dd></div>
                <div class="row"><dt>E-mail</dt><dd>{show(me.email)}</dd></div>
                <div class="row"><dt>Phone</dt><dd>{show(me.phone)}</dd></div>
                <div class="row"><dt>Role</dt><dd>{ROLE_LABEL[me.role] ?? show(me.role)}</dd></div>
            </dl>
            <p class="note">Your role is managed by your administrator.</p>
        </div>

        <div class="card sect">
            <h2>Address</h2>
            {#if addressLines.length === 0}
                <p class="note">No address saved yet. Use Edit Profile to add one.</p>
            {:else}
                <address class="addr">
                    {#each addressLines as line (line)}<span>{line}</span>{/each}
                </address>
            {/if}
        </div>
    {/if}
{/if}

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
    }

    .head h1 {
        margin: 0;
    }

    .head .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .empty {
        padding: 36px;
        text-align: center;
        color: var(--bme-muted);
    }

    .who {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        padding: 20px;
        margin-bottom: 16px;
    }

    .avatar {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: var(--bme-sky);
        color: var(--bme-dark-blue);
    }

    .who-text {
        flex: 1 1 auto;
        min-width: 0;
    }

    .who-name {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
        color: var(--bme-ink);
    }

    .who-sub {
        margin: 2px 0 0;
        color: var(--bme-muted);
        font-size: 14px;
    }

    .who-tags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .role {
        font-size: 12px;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid var(--bme-border);
        color: var(--bme-dark-blue);
        background: #ffffff;
    }

    .sect {
        padding: 20px;
        margin-bottom: 16px;
    }

    .sect h2 {
        margin: 0 0 14px;
        font-size: 16px;
        color: var(--bme-darker-blue);
    }

    .rows {
        margin: 0;
    }

    .row {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--bme-border);
    }

    .row:last-child {
        border-bottom: none;
    }

    .row dt {
        color: var(--bme-muted);
        font-size: 13.5px;
        font-weight: 600;
    }

    .row dd {
        margin: 0;
        color: var(--bme-ink);
        word-break: break-word;
    }

    .addr {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-style: normal;
        color: var(--bme-ink);
        line-height: 1.6;
    }

    .note {
        margin: 12px 0 0;
        font-size: 12.5px;
        color: var(--bme-muted);
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }

    .grid label {
        display: block;
    }

    .grid label .required {
        display: inline;
        margin-left: 4px;
    }

    .grid label input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 4px;
    }

    .grid label input:disabled {
        background: var(--bme-light-grey);
    }

    .grid .wide {
        grid-column: 1 / -1;
    }

    .actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
        flex-wrap: wrap;
    }

    @media (max-width: 640px) {
        .grid {
            grid-template-columns: 1fr;
        }

        .row {
            grid-template-columns: 1fr;
            gap: 2px;
        }

        .who-tags {
            width: 100%;
        }
    }
</style>