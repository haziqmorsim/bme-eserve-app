<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";

    let { settings = [], supabase, profile = null } = $props<{
        settings?: any[];
        supabase: SupabaseClient;
        profile?: any;
    }>();

    function initial() {
        const m: Record<string, string> = {};
        for (const s of settings) m[s.key] = s.value ?? '';
        return m;
    }

    let form = $state<Record<string, string>>(initial());
    let busy = $state(false);
    let err = $state('');
    let fieldErr = $state<Record<string, string>>({});

    $effect(() => {
        settings;
        form = initial();
    });

    let updatedAt = $derived.by(() => {
        const stamps = settings.map((s: any) => s.updated_at).filter(Boolean).sort();
        return stamps.length ? new Date(stamps[stamps.length - 1]).toLocaleString() : null;
    });

    function validate(): boolean {
        const e: Record<string, string> = {};
        const email = (form.admin_email ?? '').trim();
        if (!email) e.admin_email = 'Admin e-mail is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.admin_email = 'Enter a valid e-mail address.';

        const days = (form.quote_reply_days ?? '').trim();
        if (days && (!/^\d+$/.test(days) || Number(days) < 1)) {
            e.quote_reply_days = 'Enter a whole number of day(s).';
        }

        for (const [key, label] of [
            ['sla_warn_hours', 'Aging threshold'],
            ['sla_overdue_hours', 'Overdue threshold'],
            ['quote_validity_days', 'Quote validity'],
            ['low_stock_threshold', 'Low stock threshold'],
            ['chatbot_daily_limit', 'Chatbot daily limit']
        ] as [string, string][]) {
            const v = (form[key] ?? '').trim();
            if (v && (!/^\d+$/.test(v) || Number(v) <0)) e[key] = `${label} must be a whole number.`;
        }

        const warn = Number((form.sla_warn_hours ?? '').trim());
        const over = Number((form.sla_overdue_hours ?? '').trim());
        if (Number.isFinite(warn) && Number.isFinite(over) && over <= warn) {
            e.sla_overdue_hours = 'Overdue threshold must be greater than the aging threshold.';
        }

        const prefix = (form.quote_ref_prefix ?? '').trim();
        if (prefix && !/^[A-Za-z0-9]{1,10}$/.test(prefix)) {
            e.quote_ref_prefix = 'Use 1-10 letters or digits only.';
        }

        const semail = (form.support_email ?? '').trim();
        if (semail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(semail)) {
            e.support_email = 'Enter a valid e-mail address';
        }

        if (!(form.privacy_policy ?? '').trim()) e.privacy_policy = 'Privacy policy cannot be empty.';
        if (!(form.terms_conditions ?? '').trim()) e.terms_conditions = 'Terms and conditions cannot be empty.';

        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function save() {
        if (!validate()) return;
        busy = true;
        err = '';

        const changed = settings.filter((s:any) => (form[s.key] ?? '') !== (s.value ?? ''));
        if (changed.length === 0) {
            busy = false;
            addToast('No changes to save');
            return;
        }

        for (const s of changed) {
            // .select() matters: an UPDATE blocked by RLS is NOT an error, it
            // simply matches zero rows. Without asking for the updated rows
            // back we would report success while nothing was written.
            const { data, error } = await supabase
                .from('app_settings')
                .update({ value: (form[s.key] ?? '').trim(), updated_by: profile?.id ?? null })
                .eq('key', s.key)
                .select('key');
            if (error) {
                busy = false;
                err = error.message;
                return;
            }
            if (!data || data.length === 0) {
                busy = false;
                err = `"${s.key}" was not saved. Editing settings requires the admin or developer role.`;
                return;
            }
        }

        busy = false;
        addToast('Settings saved successfully.');
        await invalidateAll();
    }

    function reset() {
        form = initial();
        err = '';
        fieldErr = {};
    }
</script>

<div class="gen-wrap">
    <section class="card gen-card">
        <h2>Notifications</h2>
        <p class="gen-hint">Where staff notifications for new quotation requests and general enquiries are sent.</p>
        <div class="adm-form">
            <label>Admin E-mail <span class="required">*</span>
                <input type="email" bind:value={form.admin_email} placeholder="admin@boilermech.com" class:invalid={fieldErr.admin_email} />
                {#if fieldErr.admin_email}<span class="field-err">{fieldErr.admin_email}</span>{/if}
            </label>
            <label>Support Phone No.
                <input bind:value={form.support_phone} placeholder="+603-8023 9137" />
            </label>
            <label>Target Reply Time (days)
                <input bind:value={form.quote_reply_days} placeholder="3" class:invalid={fieldErr.quote_reply_days} />
                {#if fieldErr.quote_reply_days}<span class="field-err">{fieldErr.quote_reply_days}</span>{/if}
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Service Level Agreement (SLA)</h2>
        <p class="gen-hint">Weekday hours before an open request is flagged. Weekends are excluded.</p>
        <div class="adm-form">
            <label>Aging After (hours)
                <input bind:value={form.sla_warn_hours} placeholder="24" class:invalid={fieldErr.sla_warn_hours} />
                {#if fieldErr.sla_warn_hours}<span class="field-err">{fieldErr.sla_warn_hours}</span>{/if}
            </label>
            <label>Overdue After (hours)
                <input bind:value={form.sla_overdue_hours} placeholder="48" class:invalid={fieldErr.sla_overdue_hours} />
                {#if fieldErr.sla_overdue_hours}<span class="field-err">{fieldErr.sla_overdue_hours}</span>{/if}
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Quotations</h2>
        <p class="gen-hint">The prefix applies to newly created requests only, existing reference numbers are never rewritten.</p>
        <div class="adm-form">
            <label>Reference Prefix
                <input bind:value={form.quote_ref_prefix} placeholder="BME" class:invalid={fieldErr.quote_ref_prefix} />
                {#if fieldErr.quote_ref_prefix}<span class="field-err">{fieldErr.quote_ref_prefix}</span>{/if}
            </label>
            <label>Quote Validity (days)
                <input bind:value={form.quote_validity_days} placeholder="30" class:invalid={fieldErr.quote_validity_days} />
                {#if fieldErr.quote_validity_days}<span class="field-err">{fieldErr.quote_validity_days}</span>{/if}
            </label>
            <label class="full">Quotation Footer Note
                <textarea rows="3" bind:value={form.quote_footer_note}></textarea>
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Operational</h2>
        <p class="gen-hint">Maintenance mode blocks customer access while staff keep working, so it can always be switched back off.</p>
        <div class="adm-form">
            <label>Maintenance Mode
                <select bind:value={form.maintenance_mode}>
                    <option value="off">Off</option>
                    <option value="on">On</option>
                </select>
            </label>
            <label class="full">Maintenance Message
                <textarea rows="3" bind:value={form.maintenance_message}></textarea>
            </label>
            <label>Chatbot
                <select bind:value={form.chatbot_enabled}>
                    <option value="on">Enabled</option>
                    <option value="off">Disabled</option>
                </select>
            </label>
            <label>Chatbot Daily Limit (per user)
                <input bind:value={form.chatbot_daily_limit} placeholder="50" class:invalid={fieldErr.chatbot_daily_limit} />
                {#if fieldErr.chatbot_daily_limit}<span class="field-err">{fieldErr.chatbot_daily_limit}</span>{/if}
            </label>
            <label>Low Stock Threshold
                <input bind:value={form.low_stock_threshold} placeholder="5" class:invalid={fieldErr.low_stock_threshold} />
                {#if fieldErr.low_stock_threshold}<span class="field-err">{fieldErr.low_stock_threshold}</span>{/if}
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Content</h2>
        <p class="gen-hint">Shown to customers. Leave the login banner blank to hide it.</p>
        <div class="adm-form">
            <label>Support E-mail
                <input type="email" bind:value={form.support_email} placeholder="support@boilermech.com" class:invalid={fieldErr.support_email} />
            </label>
            <label class="full">Login Banner
                <textarea rows="2" bind:value={form.login_banner} placeholder="e.g. Scheduled maintenance this Saturday from 9pm to 11pm."></textarea>
            </label>
            <label class="full">Enquiry Auto-Reply
                <textarea rows="3" bind:value={form.enquiry_auto_reply}></textarea>
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Privacy Policy</h2>
        <p class="gen-hint">Shown to all users on the Privacy Policy page. Blank lines separate paragraphs; a short line on its own becomes a heading.</p>
        <div class="adm-form">
            <label class="full">
                <textarea rows="14" bind:value={form.privacy_policy} class:invalid={fieldErr.privacy_policy}></textarea>
                {#if fieldErr.privacy_policy}<span class="field-err">{fieldErr.privacy_policy}</span>{/if}
            </label>
        </div>
    </section>

    <section class="card gen-card">
        <h2>Terms and Conditions</h2>
        <p class="gen-hint">Shown below the privacy policy on the same page.</p>
        <div class="adm-form">
            <label class="full">
                <textarea rows="14" bind:value={form.terms_conditions} class:invalid={fieldErr.terms_conditions}></textarea>
                {#if fieldErr.terms_conditions}<span class="field-err">{fieldErr.terms_conditions}</span>{/if}
            </label>
        </div>
    </section>

    {#if err}<p class="adm-err">{err}</p>{/if}

    <div class="gen-actions">
        {#if updatedAt}<span class="gen-stamp">Last updated: {updatedAt}</span>{/if}
        <button class="btn-ghost" onclick={reset} disabled={busy}>Reset</button>
        <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Changes'}</button>
    </div>
</div>

<style>
    .gen-wrap {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .gen-card {
        padding: 16px 18px;
    }

    .gen-card h2 {
        margin: 0 0 4px;
        font-size: 16px;
        color: var(--bme-dark-blue);
    }

    .gen-hint {
        margin: 0 0 12px;
        font-size: 12.5px;
        color: var(--bme-muted);
    }

    .gen-card textarea {
        font-family: inherit;
        line-height: 1.55;
        resize: vertical;
    }

    .gen-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
    }

    .gen-stamp {
        margin-right: auto;
        font-size: 12.5px;
        color: var(--bme-muted);
    }

    input, select, textarea {
        margin-top: 10px;
    }
</style>