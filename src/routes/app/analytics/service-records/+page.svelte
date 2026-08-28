<script lang="ts">
    import { Search, Undo2, Plus } from "@lucide/svelte";
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();

    let search = $state('');
    let adding = $state(false);
    let saving = $state(false);
    let isDeveloper = $derived(data.profile?.role === 'developer');

    let projectId = $state('');
    let boilerId = $state('');
    let partId = $state('');
    let servicedOn = $state(new Date().toISOString().slice(0, 10));
    let action = $state<'replaced' | 'repaired' | 'inspected' | 'installed'>('replaced');
    let quantity = $state(1);
    let failureReason = $state('');
    let premature = $state(false);
    let notes = $state('');

    const filtered = $derived(
        data.records.filter((r: any) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return [r.project_label, r.boiler_label, r.part_label, r.part_name, r.notes]
                .some((v: any) => (v ?? '').toString().toLowerCase().includes(q));
        })
    );

    const canSave = $derived(!!projectId && !!boilerId && !!partId && !!servicedOn && !saving);

    const when  = (d: string) => new Date(d + 'T:00:00:00').toLocaleDateString('en-MY', {
        year: 'numeric', month: 'short', day: 'numeric'
    });

    function resetForm() {
        projectId = '';
        boilerId = '';
        partId = '';
        servicedOn = new Date().toISOString().slice(0, 10);
        action = 'replaced';
        quantity = 1;
        failureReason = '';
        premature = false;
        notes = '';
    }

    async function save() {
        if (!canSave || isDeveloper) return;
        saving = true;

        const { error } = await data.supabase.from('service_records').insert({
            project_id: projectId,
            boiler_id: boilerId,
            part_id: partId,
            serviced_on: servicedOn,
            action,
            quantity,
            failure_reason: failureReason || null,
            premature,
            notes: notes.trim() || null,
            recorded_by: data.profile?.id ?? null
        });

        saving = false;
        if (error) {
            addToast(`Could not save record: ${error.message}`);
            return;
        }
        adding = false;
        resetForm();
        await invalidateAll();
        addToast('Service record saved successfully.');
    }
</script>

<div class="head">
    <h1>Service records</h1>
    <div class="head-actions">
        {#if !isDeveloper}
            <button class="btn-primary" onclick={() => (adding = !adding)}>
                <Plus size={16} /> {adding ? 'Cancel' : 'Add record'}
            </button>
        {/if}
        <a href="/app/analytics">
            <button class="btn-primary"><Undo2 size={16} /> Analytics</button>
        </a>
    </div>
</div>

<p class="intro">
    What was actually fitted, and when. Replacement prediction prefer these measured intervals over gaps inferred from ordering history.
</p>

{#if adding}
    <div class="card form">
        <div class="grid">
            <label>
                <span>Project</span>
                <select bind:value={projectId}>
                    <option value="">Select a project...</option>
                    {#each data.projects as p (p.id)}
                        <option value={p.id}>{p.label} - {p.sub}</option>
                    {/each}
                </select>
            </label>

            <label>
                <span>Boiler</span>
                <select bind:value={boilerId}>
                    <option value="">Select a boiler...</option>
                    {#each data.boilers as b (b.id)}
                        <option value={b.id}>{b.label} - {b.sub}</option>
                    {/each}
                </select>
            </label>

            <label class="wide">
                <span>Part</span>
                <select bind:value={partId}>
                    <option value="">Select a part...</option>
                    {#each data.parts as p (p.id)}
                        <option value={p.id}>{p.label} - {p.sub}</option>
                    {/each}
                </select>
            </label>

            <label>
                <span>Date serviced</span>
                <input type="date" bind:value={servicedOn} max={new Date().toISOString().slice(0, 10)} />
            </label>

            <label>
                <span>Actions</span>
                <select bind:value={action}>
                    <option value="replaced">Replaced</option>
                    <option value="installed">Installed</option>
                    <option value="repaired">Repaired</option>
                    <option value="inspected">Inspected</option>
                </select>
            </label>

            <label>
                <span>Quantity</span>
                <input type="number" min="1" step="1" bind:value={quantity} />
            </label>

            <label>
                <span>Failure reason</span>
                <select bind:value={failureReason}>
                    <option value="">Not recorded</option>
                    <option value="wear">Normal wear</option>
                    <option value="corrosion">Corrosion</option>
                    <option value="thermal_fatigue">Thermal fatigue</option>
                    <option value="blockage">Blockage</option>
                    <option value="mechanical_damage">Mechanical damage</option>
                    <option value="scheduled">Scheduled maintenance</option>
                    <option value="other">Other</option>
                </select>
            </label>

            <label class="wide">
                <span>Notes</span>
                <input type="text" bind:value={notes} placeholder="Optional" />
            </label>

            <label class="check wide">
                <input type="checkbox" bind:value={premature} />
                <span>
                    Premature failure
                    <small>Exclude from service-life averages - it describes an incident, not a lifespan.</small>
                </span>
            </label>
        </div>

        <div class="form-actions">
            <button class="btn-primary" disabled={!canSave} onclick={save}>
                {saving ? 'Saving...' : 'Save record'}
            </button>
        </div>
    </div>
{/if}

<div class="searchbar card">
    <span class="search-ic"><Search size={16} /></span>
    <input type="search" placeholder="Search by project, boiler, part, or notes..." bind:value={search} />
</div>

{#if data.records.length === 0}
    <div class="card empty">No service records yet. Add the first one to start measuring true part life.</div>
{:else if filtered.length === 0}
    <div class="card empty">No records matched your search.</div>
{:else}
    <div class="card table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Date</th><th>Project</th><th>Boiler</th><th>Part</th><th>Action</th><th class="num">Qty</th><th>Reason</th>
                </tr>
            </thead>
            <tbody>
                {#each filtered as r (r.id)}
                    <tr class:premature={r.premature}>
                        <td>{when(r.serviced_on)}</td>
                        <td class="mono">{r.project_label}</td>
                        <td class="mono">{r.boiler_label}</td>
                        <td>
                            <span class="pn">{r.part_label}</span>
                            <span class="nm">{r.part_name}</span>
                        </td>
                        <td><span class="act {r.action}">{r.action}</span></td>
                        <td class="num">{r.quantity}</td>
                        <td class="muted">
                            {(r.failure_reason ?? '\u2014').replace('_', ' ')}
                            {#if r.premature}<span class="prem">premature</span>{/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
    }

    h1 { margin: 5px 0 10px; }

    .head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn-primary, .btn-ghost { display: inline-flex; align-items: center; gap: 6px; }

    .intro {
        color: var(--bme-muted, #6b7280);
        font-size: 0.85rem;
        margin: 0 0 1rem;
    }

    .form { margin-bottom: 1rem; }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
    }

    .grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; }
    .grid label.wide { grid-column: 1 / -1; }
    .grid label > span { color: var(--bme-muted, #6b7280); }

    .grid select,
    .grid input[type="date"],
    .grid input[type="number"],
    .grid input[type="text"] {
        padding: 0.4rem 0.55rem;
        border: 1px solid var(--bme-border, #d1d5db);
        border-radius: 6px;
        font-size: 0.85rem;
        background: #fff;
    }

    .check { flex-direction: row !important; align-items: flex-start; gap: 0.5rem !important; }
    .check span { color: #374151; }
    .check small { display: block; color: var(--bme-muted, #6b7280); font-size: 0.75rem; }

    .form-actions { margin-top: 0.9rem; }

    .searchbar { position: relative; padding: 0; margin-bottom: 18px; }

    .search-ic {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--bme-muted, #6b7280);
        display: inline-flex;
        pointer-events: none;
    }

    .searchbar input {
        width: 100%;
        padding: 11px 14px 11px 36px;
        border: none;
        background: transparent;
    }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }

    th, td {
        text-align: left;
        padding: 0.5rem 0.6rem;
        border-bottom: 1px solid var(--bme-border, #e5e7eb);
        vertical-align: middle;
        white-space: nowrap;
    }

    th { color: #374151; font-weight: 600; }
    .num { text-align: right; }
    .muted { color: var(--bme-muted, #6b7280); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; }
    .pn { display: block; font-weight: 600; }
    .nm { display: block; color: var(--bme-muted, #6b7280); font-size: 0.78rem; white-space: normal; }

    .act {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        background: #f3f4f6;
        color: #4b5563;
        font-weight: 600;
    }

    .act.replaced, .act.installed { background: #e8f2e0; color: #3f6212; }
    .act.repaired { background: #fef3c7; color: #92400e; }

    tr.premature { background: #fef6f6; }

    .prem {
        margin-left: 0.35rem;
        font-size: 0.7rem;
        color: #9b1c1c;
        font-weight: 600;
    }

    .empty { text-align: center; color: var(--bme-muted, #6b7280); padding: 1.75rem; }
</style>