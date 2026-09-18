<script lang="ts">
    import Modal from "./admin/Modal.svelte";
    import { addToast } from "$lib/stores/toast";
    import { invalidateAll } from "$app/navigation";

    let {
        boilerId,
        metrics = [],
        supabase,
        onclose
    } = $props<{
        boilerId: string;
        metrics?: any[];
        supabase: any;
        onclose: () => void;
    }>();

    const today = new Date().toISOString().slice(0, 10);

    let form = $state({
        log_date: today,
        shift: 'day' as 'day' | 'night',
        operator: '',
        blowdown_done: false,
        blowdown_minutes: '',
        notes: ''
    });

    let readings = $state<Record<string, string>>({});

    const sortedMetrics = $derived(
        [...(metrics as any[])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    let err = '';
    let busy = $state(false);

    async function save() {
        if (busy) return;
        if (!form.operator.trim()) {
            addToast('Operator name is required.');
            return;
        }

        busy = true;

        const { data: log, err: logErr } = await supabase
            .from('boiler_daily_logs')
            .insert({
                boiler_id: boilerId,
                log_date: form.log_date,
                shift: form.shift,
                operator: form.operator.trim(),
                blowdown_done: form.blowdown_done,
                blowdown_minutes: form.blowdown_done && form.blowdown_minutes !== '' ? Number(form.blowdown_minutes) : null,
                notes: form.notes.trim() || null
            })
            .select()
            .single();

        if (logErr) {
            busy = false;
            addToast(
                logErr.code === '23505'
                    ? `A ${form.shift} shift log already exists for ${form.log_date}. Edit that one instead of creating another.`
                    : `Could not save the log sheet: ${logErr.message}`
            );
            return;
        }

        const readingRows = Object.entries(readings)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([metric_key, v]) => ({ log_id: log.id, metric_key, value: Number(v) }))

        if (readingRows.length) {
            const { error: readErr } = await supabase
                .from('boiler_daily_log_readings')
                .insert(readingRows);
            if (readErr) {
                addToast(`Log sheet saved, but some readings could not be saved: ${readErr.message}`);
                busy = false;
                await invalidateAll();
                onclose();
                return;
            }
        }

        busy = false;
        await invalidateAll();
        addToast('Log sheet saved.');
        onclose();
    }
</script>

<Modal title="New Log Sheet" {onclose} wide>
    <div class="adm-form">
        <label>Date <span class="required">*</span>
            <input type="date" bind:value={form.log_date} max={today} />
        </label>
        <label>Shift <span class="required">*</span>
            <select bind:value={form.shift}>
                <option value="day">Day</option>
                <option value="night">Night</option>
            </select>
        </label>
        <label class="full">Operator <span class="required">*</span>
            <input bind:value={form.operator} placeholder="Name of the operator on shift" />
        </label>
        <label>Blowdown Performed
            <select bind:value={form.blowdown_done}>
                <option value="false">No</option>
                <option value="true">Yes</option>
            </select>
        </label>
        {#if form.blowdown_done}
            <label>Blowdown Duration (min)
                <input type="number" min="0" step="any" bind:value={form.blowdown_minutes} />
            </label>
        {/if}

        <div class="full ls-readings">
            <span class="sf-label">Readings</span>
            <p class="sf-hint">Leave a field blank for anything not observed on this shift.</p>
            <div class="ls-grid">
                {#each sortedMetrics as m (m.metric_key)}
                    <label class="ls-cell">
                        <span class="ls-cell-label">{m.label}{m.unit ? ` (${m.unit})` : ''}</span>
                        <input type="number" step="any" bind:value={readings[m.metric_key]} />
                    </label>
                {/each}
            </div>
        </div>

        <label class="full">Notes
            <textarea bind:value={form.notes} rows="3" placeholder="Ash handling, fuel condition, anything worth recording..."></textarea>
        </label>

        <div class="adm-form-actions">
            <button class="btn-ghost" onclick={onclose} disabled={busy}>Cancel</button>
            <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save Log Sheet'}</button>
        </div>
    </div>
</Modal>

<style>
	.sf-label { font-weight: 600; font-size: 14px; color: var(--bme-ink); }
	.sf-hint { margin: 4px 0 10px; font-size: 12px; color: var(--bme-muted); }
 
	.ls-readings { display: flex; flex-direction: column; }
 
	.ls-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 10px;
		max-height: 280px;
		overflow-y: auto;
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		padding: 12px;
		background: var(--bme-surface);
	}
 
	.ls-cell { display: flex; flex-direction: column; gap: 4px; }
	.ls-cell-label { font-size: 11.5px; color: var(--bme-muted); }
	.ls-cell input { padding: 7px 9px; }
 
	textarea {
		width: 100%;
		padding: 9px 11px;
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		background: var(--bme-surface);
		color: var(--bme-ink);
		font: inherit;
		font-size: 13.5px;
		resize: vertical;
	}
</style>