<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";
    import type { SupabaseClient } from "@supabase/supabase-js";
    import Modal from "./Modal.svelte";
    import { grateFor } from "$lib/boiler-design";

    let { boilers, specs, readings, supabase } = $props<{
        boilers: any[];
        specs: any[];
        readings: any[];
        supabase: SupabaseClient;
    }>();

    let boilerId = $state<string>('');

    $effect(() => {
        if (!boilerId && boilers.length) boilerId = boilers[0].id;
    });

    let boiler = $derived(boilers.find((b: any) => b.id === boilerId) ?? null);

    let mySpecs = $derived(
        specs
            .filter((s: any) => s.boiler_id === boilerId)
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    let myReadings = $derived(
        readings
            .filter((r: any) => r.boiler_id === boilerId)
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    let sectionOptions = $derived(boiler ? grateFor(boiler.code, boiler.name).sections : []);

    let usedKeys = $derived(new Set(myReadings.map((r: any) => r.section_key)));
    let freeSections = $derived(sectionOptions.filter((s: any) => !usedKeys.has(s.key)));

    function sectionLabel(key: string): string {
        return sectionOptions.find((s: any) => s.key === key)?.label ?? key;
    }

    let busy = $state(false);
    let err = $state('');
    let fieldErr = $state<Record<string, string>>({});

    let editSpec = $state<string | 'new' | null>(null);
    let deleteSpec = $state<any | null>(null);
    let specForm = $state<any>({});

    function newSpec() {
        const maxOrder = mySpecs.reduce((m: number, s: any) => Math.max(m, s.sort_order ?? 0), 0);
        specForm = { label: '', value: '', sort_order: maxOrder + 1 };
        err = ''; fieldErr = {}; editSpec = 'new';
    }

    function startEditSpec(s: any) {
        specForm = { ...s };
        err = ''; fieldErr = {}; editSpec = s.id;
    }

    function validateSpec(): boolean {
        const e: Record<string, string> = {};
        if (!specForm.label?.toString().trim()) e.label = 'Label is required.';
        if (!specForm.value?.toString().trim()) e.value = 'Value is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function saveSpec() {
        if (!validateSpec()) return;
        busy = true; err = '';
        const payload = {
            boiler_id: boilerId, 
            label: specForm.label.trim(), 
            value: specForm.value.trim(), 
            sort_order: Number(specForm.sort_order) || 0
        };
        const resp = editSpec === 'new'
            ? await supabase.from('boiler_specs').insert(payload)
            : await supabase.from('boiler_specs').update(payload).eq('id', editSpec);
        busy = false;
        if (resp.error) { err = resp.error.message; return; }
        addToast(editSpec === 'new' ? 'Specification added successfully' : 'Specification updated successfully');
        editSpec = null;
        await invalidateAll();
    }

    async function confirmDeleteSpec() {
        busy = true;
        const { error } = await supabase.from('boiler_specs').delete().eq('id', deleteSpec.id);
        busy = false;
        if (error) { err = error.message; return; }
        addToast('Specification deleted successfully');
        deleteSpec = null;
        await invalidateAll();
    }

    const STATES = ['Normal', 'Warning', 'Attention'];

    let editReading = $state<string | 'new' | null>(null);
    let deleteReading = $state<any | null>(null);
    let readingForm = $state<any>({});

    function newReading() {
        const maxOrder = myReadings.reduce((m: number, r: any) => Math.max(m, r.sort_order ?? 0), 0);
        readingForm = {
            section_key: freeSections[0]?.key ?? sectionOptions[0]?.key ?? '', 
            state: 'Normal', 
            metrics: [{ label: '', value: '' }], 
            sort_order: maxOrder + 1
        };
        err = ''; fieldErr = {}; editReading = 'new';
    }

    function startEditReading(r: any) {
        readingForm = {
            ...r, 
            state: r.state ?? 'Normal', 
            metrics: Array.isArray(r.metrics) && r.metrics.length ? r.metrics.map((m: any) => ({ ...m })) : [{ label: '', value: '' }]
        };
        err = ''; fieldErr = {}; editReading = r.id;
    }

    function addMetric() {
        readingForm.metrics = [...readingForm.metrics, { label: '', value: '' }];
    }

    function removeMetric(i: number) {
        readingForm.metrics = readingForm.metrics.filter((_: any, idx: number) => idx !== i);
    }

    function validateReading(): boolean {
        const e: Record<string, string> = {};
        if (!readingForm.section_key) e.section_key = 'Section is required.';
        if (!readingForm.state) e.state = 'State is required.';
        const filled = (readingForm.metrics ?? []).filter(
            (m: any) => m.label?.toString().trim() && m.value?.toString().trim()
        );
        if (filled.length === 0) e.metrics = 'At least one reading (label and value) is required.';
        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    async function saveReading() {
        if (!validateReading()) return;
        busy = true; err = '';
        const metrics = (readingForm.metrics ?? [])
            .filter((m: any) => m.label?.toString().trim() && m.value?.toString().trim())
            .map((m: any) => ({ label: m.label.trim(), value: m.value.trim() }));

        const payload = {
            boiler_id: boilerId, 
            section_key: readingForm.section_key, 
            state: readingForm.state, 
            metrics, 
            sort_order: Number(readingForm.sort_order) || 0, 
            updated_at: new Date().toISOString()
        };

        const resp = editReading === 'new'
            ? await supabase.from('boiler_section_readings').insert(payload)
            : await supabase.from('boiler_section_readings').update(payload).eq('id', editReading);
        busy = false;

        if (resp.error) {
            err = resp.error.code === '23505'
                ? 'This section already has readings for this boiler. Edit the existing row instead.'
                : resp.error.message;
            return;
        }
        addToast(editReading === 'new' ? 'Readings added successfully' : 'Readings updated successfully');
        editReading = null;
        await invalidateAll();
    }

    async function confirmDeleteReading() {
        busy = true;
        const { error } = await supabase.from('boiler_section_readings').delete().eq('id', deleteReading.id);
        busy = false;
        if (error) { err = error.message; return; }
        addToast('Readings deleted successfully');
        deleteReading = null;
        await invalidateAll();
    }

    function metricSummary(r: any): string {
        const list = Array.isArray(r?.metrics) ? r.metrics : [];
        if (!list.length) return '--';
        return list.map((m: any) => `${m?.label ?? ''}: ${m?.value ?? ''}`).join(' | ');
    }
</script>

<div class="bd-head">
    <h2>Boiler Specifications &amp; Data</h2>
    <label class="bd-pick">
        <span>Boiler</span>
        <select bind:value={boilerId}>
            {#each boilers as b (b.id)}<option value={b.id}>{b.code}{b.name ? ` - ${b.name}` : ''}</option>{/each}
        </select>
    </label>
</div>

{#if !boiler}
    <div class="card adm-empty">Add a boiler first to manage its specs and data.</div>
{:else}
    <div class="adm-bar">
        <h3 class="sec-title">Specifications</h3>
        <button class="btn-primary" onclick={newSpec}>Add Specification</button>
    </div>

    <div class="card" style="padding:14px; overflow:hidden; margin-bottom:26px;">
        {#if mySpecs.length === 0}
            <div class="adm-empty">No specifications for this boiler yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Order</th><th>Label</th><th>Value</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each mySpecs as s (s.id)}
                        <tr>
                            <td style="text-align:center; vertical-align:middle;">{s.sort_order ?? 0}</td>
                            <td style="vertical-align:middle;"><strong>{s.label}</strong></td>
                            <td style="text-align:center; vertical-align:middle;">{s.value}</td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEditSpec(s)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleteSpec = s)}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>

    <div class="adm-bar">
        <h3 class="sec-title">Schematic Section Readings</h3>
        <div class="sec-right">
            <span class="sec-count">{myReadings.length} of {sectionOptions.length} sections configured</span>
            <button class="btn-primary" onclick={newReading} disabled={freeSections.length === 0}>Add Readings</button>
        </div>
    </div>

    <div class="card" style="padding:14px; overflow:hidden;">
        {#if myReadings.length === 0}
            <div class="adm-empty">No section readings for this boiler yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Order</th><th>Section</th><th>State</th><th>Readings</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each myReadings as r (r.id)}
                        <tr>
                            <td style="text-align:center; vertical-align:middle;">{r.sort_order ?? 0}</td>
                            <td style="vertical-align:middle;"><strong>{sectionLabel(r.section_key)}</strong></td>
                            <td style="text-align:center; vertical-align:middle;">
                                <span class="state {(r.state ?? 'Normal').toLowerCase()}">{r.state ?? 'Normal'}</span>
                            </td>
                            <td style="vertical-align:middle;" class="mets">{metricSummary(r)}</td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEditReading(r)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleteReading = r)}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
{/if}

{#if editSpec !== null}
    <Modal title={editSpec === 'new' ? 'Add Specification' : 'Edit Specification'} onclose={() => (editSpec = null)}>
        <div class="adm-form stack">
            <label>Label <span class="required">*</span>
                <input bind:value={specForm.label} placeholder="Thermal Efficiency" class:invalid={fieldErr.label} />
                {#if fieldErr.label}<span class="field-err">{fieldErr.label}</span>{/if}
            </label>
            <label>Value <span class="required">*</span>
                <input bind:value={specForm.value} placeholder="85.5 %" class:invalid={fieldErr.value} />
                {#if fieldErr.value}<span class="field-err">{fieldErr.value}</span>{/if}
            </label>
            <label><span>Order</span>
                <input type="number" min="0" bind:value={specForm.sort_order} />
            </label>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-primary" onclick={saveSpec} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                <button class="btn-ghost" onclick={() => (editSpec = null)} disabled={busy}>Cancel</button>
            </div>
        </div>
    </Modal>
{/if}

{#if editReading !== null}
    <Modal title={editReading === 'new' ? 'Add Section Readings' : 'Edit Section Readings'} onclose={() => (editReading = null)}>
        <div class="adm-form stack">
            <label>Section <span class="required">*</span>
                <select bind:value={readingForm.section_key} class:invalid={fieldErr.section_key}>
                    {#each sectionOptions as s (s.key)}
                        <option value={s.key} disabled={usedKeys.has(s.key) && s.key !== readingForm.section_key}>
                            {s.label}{usedKeys.has(s.key) && s.key !== readingForm.section_key ? ' (already added)' : ''}
                        </option>
                    {/each}
                </select>
                {#if fieldErr.section_key}<span class="field-err">{fieldErr.section_key}</span>{/if}
            </label>
            <label>State <span class="required">*</span>
                <select bind:value={readingForm.state} class:invalid={fieldErr.state}>
                    {#each STATES as st (st)}<option value={st}>{st}</option>{/each}
                </select>
                {#if fieldErr.state}<span class="field-err">{fieldErr.state}</span>{/if}
            </label>

            <div class="mx">
                <span class="mx-label">Readings <span class="required">*</span></span>
                {#each readingForm.metrics as m, i}
                    <div class="mx-row">
                        <input placeholder="Label (e.g. Flue Gas Temp)" bind:value={readingForm.metrics[i].label} />
                        <input placeholder="Value (e.g. 165 C)" bind:value={readingForm.metrics[i].value} />
                        <button
                            type="button"
                            class="mx-del"
                            onclick={() => removeMetric(i)}
                            disabled={readingForm.metrics.length === 1}
                            aria-label="Remove reading">Remove</button>
                    </div>
                {/each}
                <button type="button" class="btn-ghost mx-add" onclick={addMetric}>+ Add reading</button>
                {#if fieldErr.metrics}<span class="field-err">{fieldErr.metrics}</span>{/if}
            </div>

            <label><span>Order</span>
                <input type="number" min="0" bind:value={readingForm.sort_order} />
            </label>

            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-primary" onclick={saveReading} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                <button class="btn-ghost" onclick={() => (editReading = null)} disabled={busy}>Cancel</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleteSpec}
    <Modal title="Delete Specification" onclose={() => (deleteSpec = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete <strong>{deleteSpec.label}</strong>?</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleteSpec = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDeleteSpec} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleteReading}
    <Modal title="Delete Section Readings" onclose={() => (deleteReading = null)}>
        <div class="modal-confirm">
            <p>Are you confirm to delete the readings for <strong>{sectionLabel(deleteReading.section_key)}</strong>?</p>
            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="modal-actions">
                <button class="btn-ghost" onclick={() => (deleteReading = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={confirmDeleteReading} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

<style>
    .btn-primary:disabled {
        background-color: #9fabbc;
        cursor: not-allowed;
    }

    .bd-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
    }

    .bd-head h2 {
        margin: 0;
        font-size: 18px;
    }

    .bd-pick {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 240px;
    }

    .bd-pick span {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--bme-muted);
    }

    .sec-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .sec-count {
        font-size: 12.5px;
        color: var(--bme-muted);
    }

    .sec-title {
        margin: 0;
        font-size: 15px;
        color: var(--bme-darker-blue);
    }

    .mets {
        color: var(--bme-muted);
        font-size: 13px;
    }

    .state {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        padding: 3px 12px;
        border-radius: 999px;
        border: 1px solid var(--bme-border);
    }

    .state.normal {
        background: var(--bme-mint);
        border-color: var(--bme-green);
        color: #3f6b21;
    }

    :root[data-theme='dark'] .state.normal {
        color: #9adf6c;
    }

    .state.warning {
        background: #fdf3d8;
        border-color: var(--bme-gold);
        color: #7a5a00;
    }

    :root[data-theme='dark'] .state.warning {
        background: #3a2f0f;
        color: #ffcc66;
    }

    .state.attention {
        background: #fdeaea;
        border-color: var(--bme-red);
        color: #a11f1c;
    }

    :root[data-theme='dark'] .state.attention {
        background: #3a1c18;
        color: #ff9d8f;
    }

    .adm-form.stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .adm-form.stack label {
        display: block;
    }

    .adm-form.stack label .required {
        display: inline;
        margin-left: 4px;
    }

    .adm-form.stack label input,
    .adm-form.stack label select {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 4px;
    }

    .mx {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .mx-label {
        font-weight: 600;
    }

    .mx-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 8px;
        align-items: center;
    }

    .mx-row input {
        width: 100%;
        box-sizing: border-box;
    }

    .mx-del {
        background: none;
        border: none;
        color: var(--bme-red);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }

    .mx-del:disabled {
        color: var(--bme-muted);
        cursor: default;
        opacity: 0.6;
    }

    .mx-add {
        align-self: flex-start;
    }

    @media (max-width: 640px) {
        .mx-row {
            grid-template-columns: 1fr;
        }
    }
</style>