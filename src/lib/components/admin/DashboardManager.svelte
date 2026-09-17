<script lang="ts">
    import Modal from "./Modal.svelte";
    import { addToast } from "$lib/stores/toast";
    import { invalidateAll } from "$app/navigation";
    import type { SupabaseClient } from "@supabase/supabase-js";

    let {
        metrics = [],
        groups = [],
        motors = [],
        motorCells = [],
        rul = [],
        boilers = [],
        baselines = [],
        indicators = [],
        supabase
    } = $props<{
        metrics?: any[];
        groups?: any[];
        motors?: any[];
        motorCells: any[];
        rul?: any[];
        boilers?: any[];
        baselines?: any[];
        indicators?: any[];
        supabase: SupabaseClient;
    }>();

    type Section = 'overview' | 'trends' | 'motors' | 'analytics' | 'baselines' | 'indicators';
    let section = $state<Section>('overview');

    type EditKind = 'metric' | 'rul' | 'motor' | 'cell' | 'group' | 'baseline' | 'indicator';

    let editing = $state<{ kind: EditKind; row: any } | null>(null);
    let deleting = $state<{ kind: EditKind; row: any; label: string } | null>(null);
    let form = $state<any>({});
    let fieldErr = $state<Record<string, string>>({});
    let err = $state('');
    let busy = $state(false);

    const SOURCE_FIELDS = [
        { value: 'vibration', label: 'Vibration', rating: 'vibration_limit' },
        { value: 'current_a', label: 'Current', rating: 'current_rating_a' },
        { value: 'power_kw', label: 'Power', rating: 'power_rating_kw' }
    ];

    const boilerLabel = (id: string) =>
        (boilers as any[]).find((b) => b.id === id)?.code ?? '—';

    const sortedMetrics = $derived([...metrics].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const sortedGroups = $derived([...groups].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const sortedCells = $derived([...motorCells].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const sortedMotors = $derived([...motors].sort((a, b) => boilerLabel(a.boiler_id).localeCompare(boilerLabel(b.boiler_id)) || (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    const sortedRul = $derived([...rul].sort((a, b) => boilerLabel(a.boiler_id).localeCompare(boilerLabel(b.boiler_id)) || a.section_key.localeCompare(b.section_key)));

    const metricLabel = (key: string) =>
        (metrics as any[]).find((m) => m.metric_key === key)?.label ?? key;

    const metricFor = (key: string) => (metrics as any[]).find((m) => m.metric_key === key);

    const sortedIndicators = $derived(
        [...indicators].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );

    const FORMULA_LABELS: Record<string, string> = {
        delta_vs_baseline: 'Difference from baseline',
        differential: 'Difference between two metrics',
        ratio: 'Ratio of two metrics',
        excursion_count: 'Days outside limit this month',
        unavailable: 'No data source yet'
    };

    const sortedBaselines = $derived(
        [...baselines].sort(
            (a, b) =>
                boilerLabel(a.boiler_id).localeCompare(boilerLabel(b.boiler_id)) ||
                metricLabel(a.metric_key).localeCompare(metricLabel(b.metric_key))
        )
    );

    /** Shows an overridden bound, or the inherited catalogue value in muted text. */
    function boundText(row: any, field: string) {
        const v = row[field];
        if (v !== null && v !== undefined) return { text: String(v), inherited: false };
        const m = metricFor(row.metric_key);
        return { text: m ? String(m[field]) : '—', inherited: true };
    }

    const seriesFor = (key: string) =>
    (metrics as any[]).filter((m) => m.group_key === key);

    function startNew(kind: EditKind) {
        err = '';
        fieldErr = {};
        form = 
            kind === 'metric'
                ? { metric_key: '', label: '', unit: '', group_key: '', sort_order: metrics.length + 1,
                    min_normal: 0, max_normal: 100, min_warning: 0, max_warning: 100,
                    base_value: 50, amplitude: 5, colour: '#38bdf8',
                    show_in_overview: true, show_in_trends: true, show_in_analytics: true
                  }
                : kind === 'rul'
                ? { boiler_id: boilers[0]?.id ?? '', section_key: '', label: '', rul_percent: 100, rul_days: 365, is_visible: true }
                : kind === 'motor'
                ? { boiler_id: boilers[0]?.id ??'', name: '', code: '', sort_order: metrics.length + 1,
                    vibration: 2, vibration_limit: 7.1, current_a: 30, current_rating_a: 45,
                    power_kw: 15, power_rating_kw: 22
                  }
                : kind === 'cell'
                ? { label: '', unit: '', source_field: 'vibration', rating_field: 'vibration_limit', is_visible: true, sort_order: motorCells.length + 1 }
                : kind === 'indicator'
                ? {
                    indicator_key: '', label: '', early_warning: '', suggested_action: '',
                    formula: 'delta_vs_baseline', metric_key: '', metric_key_b: null,
                    unit: '', trigger_op: 'above', trigger_value: null, trigger_days: 7,
                    is_visible: true, sort_order: indicators.length + 1
                  }
                : kind === 'baseline'
                ? {
                    boiler_id: boilers[0]?.id ?? '',
                    metric_key: (metrics as any[])[0]?.metric_key ?? '',
                    baseline_value: null, at_load: null,
                    min_normal: null, max_normal: null,
                    min_warning: null, max_warning: null,
                    note: ''
                  }
                : { group_key: '', label: '', sort_order: groups.length + 1, is_visible: true, series: [] };
            editing = { kind, row: null };
    }

    function startEdit(kind: EditKind, row: any) {
        err = '';
        fieldErr = {};
        form = { ...row };
        if (kind === 'group') {
            form.series = seriesFor(row.group_key).map((m: any) => m.metric_key);
        }
        editing = { kind, row };
    }

    function toggleSeries(metricKey: string) {
        const current: string[] = form.series ?? [];
        form.series = current.includes(metricKey)
            ? current.filter((k) => k !== metricKey)
            : [...current, metricKey];
    }

    async function removeSeries(m: any) {
        busy = true;
        const { error } = await supabase
            .from('boiler_metrics')
            .update({ group_key: null })
            .match({ metric_key: m.metric_key });
        busy = false;

        if (error) {
            addToast(`Could not remove: ${error.message}`);
            return;
        }
        removingSeries = null;
        await invalidateAll();
        addToast(`${m.label} removed from the group.`);
    }

    // Confirmation modal state for "Remove" - replaces the old hover title,
    // which explained the action but never asked before taking it.
    let removingSeries = $state<any | null>(null);

    // "+ Add Metric" quick-add modal, scoped to one group at a time.
    let addingTo = $state<string | null>(null);
    let toAdd = $state<string[]>([]);

    function openAddMetric(groupKey: string) {
        addingTo = groupKey;
        toAdd = [];
    }

    function toggleToAdd(key: string) {
        toAdd = toAdd.includes(key) ? toAdd.filter((k) => k !== key) : [...toAdd, key];
    }

    async function confirmAddMetrics() {
        if (!addingTo || toAdd.length === 0) return;
        busy = true;
        const { error } = await supabase
            .from('boiler_metrics')
            .update({ group_key: addingTo })
            .in('metric_key', toAdd);
        busy = false;

        if (error) {
            addToast(`Could not add: ${error.message}`);
            return;
        }
        addingTo = null;
        await invalidateAll();
        addToast(toAdd.length === 1 ? 'Metric added to the group.' : `${toAdd.length} metrics added to the group.`);
    }

    function cancel() {
        editing = null;
        err = '';
        fieldErr = {};
    }

    const TABLES: Record<EditKind, string> = {
        metric: 'boiler_metrics',
        rul: 'boiler_section_rul',
        motor: 'boiler_motors',
        cell: 'boiler_motor_cells',
        group: 'boiler_metric_groups',
        baseline: 'boiler_metric_baselines',
        indicator: 'boiler_indicators'
    };

    function validate(kind: EditKind) {
        const e: Record<string, string> = {};
        const req = (k: string, msg: string) => {
            if (!String(form[k] ?? '').trim()) e[k] = msg;
        };

        if (kind === 'metric') {
            req('label', 'Label is required.');
            if (!editing?.row) {
                req('metric_key', 'Key is required');
                if (form.metric_key && !/^[a-z0-9_]+$/.test(form.metric_key)) {
                    e.metric_key = 'Use lowercase letters, digits and underscores only.';
                }
                if ((metrics as any[]).some((m) => m.metric_key === form.metric_key)) {
                    e.metric_key = 'The key is already in use.';
                }
            }
        } else if (kind === 'rul') {
            req('boiler_id', 'Boiler is required.');
            req('section_key', 'Section key is required.');
            if (!editing?.row && (rul as any[]).some((r) => r.boiler_id === form.boiler_id && r.section_key === form.section_key)) {
                e.section_key = 'The section already exists for this boiler.';
            }
        } else if (kind === 'motor') {
            req('boiler_id', 'Boiler is required.');
            req('name', 'Name is required.');
            req('code', 'Code is required.');
        } else if (kind === 'cell') {
            req('label', 'Label is required.');
            req('source_field', 'Data source is required.');
        } else if (kind === 'indicator') {
            req('label', 'Label is required.');
            req('early_warning', 'Early warning description is required.');
            req('suggested_action', 'Suggested action is required.');
            if (!editing?.row) {
                req('indicator_key', 'Key is required.');
                if (form.indicator_key && !/^[a-z0-9_]+$/.test(form.indicator_key)) {
                    e.indicator_key = 'Use lowercase letters, digits and underscores only.';
                }
                if ((indicators as any[]).some((i) => i.indicator_key === form.indicator_key)) {
                    e.indicator_key = 'That key is already in use.';
                }
            }
            // The two-metric formulas are meaningless without the second metric.
            if ((form.formula === 'differential' || form.formula === 'ratio') && !form.metric_key_b) {
                e.metric_key_b = 'This formula compares two metrics, so a second metric is required.';
            }
        } else if (kind === 'baseline') {
            req('boiler_id', 'Boiler is required.');
            req('metric_key', 'Metric is required.');

            if (
                !editing?.row &&
                (baselines as any[]).some(
                    (b) => b.boiler_id === form.boiler_id && b.metric_key === form.metric_key
                )
            ) {
                e.metric_key = 'This boiler already has a baseline for that metric.';
            }

            // Caught here as well as by the database check constraint, so staff
            // get a field-level message instead of a raw Postgres error.
            const pair = (lo: string, hi: string, label: string) => {
                const a = form[lo];
                const b = form[hi];
                if (a !== null && a !== '' && b !== null && b !== '' && Number(a) > Number(b)) {
                    e[hi] = `${label} maximum must not be below its minimum.`;
                }
            };
            pair('min_normal', 'max_normal', 'Normal');
            pair('min_warning', 'max_warning', 'Warning');
        } else {
            req('label', 'Label is required.');
            if (!editing?.row) {
                req('group_key', 'Key is required.');
                if (form.group_key && !/^[a-z0-9_]+$/.test(form.group_key)) {
                    e.group_key = 'Use lowercase letters, digits and underscores only.';
                }
                if ((groups as any[]).some((g) => g.group_key === form.group_key)) {
                    e.group_key = 'The key is already in use';
                }
            }
        }

        fieldErr = e;
        return Object.keys(e).length === 0;
    }

    function matchFor(kind: EditKind, row: any) {
        if (kind === 'rul') return { boiler_id: row.boiler_id, section_key: row.section_key };
        if (kind === 'metric') return { metric_key: row.metric_key };
        if (kind === 'group') return { group_key: row.group_key };
        if (kind === 'baseline') return { boiler_id: row.boiler_id, metric_key: row.metric_key };
        if (kind === 'indicator') return { indicator_key: row.indicator_key };
        return { id: row.id };
    }

    async function save() {
        if (!editing) return;
        const { kind, row } = editing;
        if (!validate(kind)) return;

        busy = true;
        err = '';

        const payload = { ...form };
        const selectedSeries: string[] | null = kind === 'group' ? (form.series ?? []) : null;
        delete payload.series;

        // A blank threshold input means "inherit the fleet-wide value", which is
        // NULL - not 0 and not ''. Writing 0 would silently redefine the band
        // (an empty min_normal becoming 0 marks every negative draft reading as
        // an alert), and '' fails numeric insertion outright.
        if (kind === 'indicator') {
            // Blank trigger means "described but not enforced" - null, not 0.
            payload.trigger_value =
                payload.trigger_value === '' || payload.trigger_value === undefined || payload.trigger_value === null
                    ? null
                    : Number(payload.trigger_value);
            payload.trigger_days = Number(payload.trigger_days) || 1;
            // A single-metric formula must not keep a stale second metric.
            if (payload.formula !== 'differential' && payload.formula !== 'ratio') {
                payload.metric_key_b = null;
            }
            if (!payload.metric_key) payload.metric_key = null;
        }

        if (kind === 'baseline') {
            for (const k of ['baseline_value', 'at_load', 'min_normal', 'max_normal', 'min_warning', 'max_warning']) {
                const v = payload[k];
                payload[k] = v === '' || v === undefined || v === null ? null : Number(v);
            }
            if (!String(payload.note ?? '').trim()) payload.note = null;
        }

        if (row) {
            if (kind === 'metric') delete payload.metric_key;
            if (kind === 'group') delete payload.group_key;
            if (kind === 'rul') {
                delete payload.boiler_id;
                delete payload.section_key;
            }
            if (kind === 'baseline') {
                delete payload.boiler_id;
                delete payload.metric_key;
            }
            if (kind === 'indicator') delete payload.indicator_key;
            delete payload.id;
        }

        const table = TABLES[kind];
        const res = row
            ? await supabase.from(table).update(payload).match(matchFor(kind, row)).select()
            : await supabase.from(table).insert(payload).select();

        busy = false;

        if (res.error) {
            err = res.error.message;
            return;
        }
        if (!res.data || res.data.length === 0) {
            err = 'The change was not saved. You may not have permission to edit this.';
            return;
        }

        if (selectedSeries) {
            const key = row ? row.group_key : form.group_key;
            const before = seriesFor(key).map((m: any) => m.metric_key);
            const added = selectedSeries.filter((k) => !before.includes(k));
            const removed = before.filter((k: string) => !selectedSeries.includes(k));

            if (added.length) {
                await supabase.from('boiler_metrics').update({ group_key: key }).in('metric_key', added);
            }
            if (removed.length) {
                await supabase.from('boiler_metrics').update({ group_key: null }).in('metric_key', removed);
            }
        }

        editing = null;
        await invalidateAll();
        addToast('Dashboard settings saved.');
    }

    async function remove() {
        if (!deleting) return;
        busy = true;

        const { kind, row } = deleting;
        const { error } = await supabase.from(TABLES[kind]).delete().match(matchFor(kind, row));

        busy = false;

        if (error) {
            addToast(`Could not delete: ${error.message}`);
            return;
        }
        deleting = null;
        await invalidateAll();
        addToast('Deleted.');
    }

    async function setVisible(kind: EditKind, row: any, field: string, value: boolean) {
        if (row[field] === value) return;

        const { error } = await supabase
            .from(TABLES[kind])
            .update({ [field]: value })
            .match(matchFor(kind, row));

        if (error) {
            addToast(`Could not update: ${error.message}`);
            return;
        }
        await invalidateAll();
    }
</script>

<div class="dm">
    <label class="dm-tabs">
        <select bind:value={section}>
            <option value="overview">Overview</option>
            <option value="trends">Trends</option>
            <option value="motors">Motors</option>
            <option value="analytics">Analytics</option>
            <option value="baselines">Baselines</option>
            <option value="indicators">Indicators</option>
        </select>
    </label>

    {#if section === 'overview'}
        <div class="adm-bar">
            <p class="dm-hint">Cards shown on the dashboard 'Overview' sub-tab.</p>
            <button class="btn-primary" onclick={() => startNew('metric')}>+ Add Card</button>
        </div>
        {#if sortedMetrics.length === 0}
            <div class="adm-empty">No metrics defined yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Label</th><th>Unit</th><th>Key</th><th>Visible</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each sortedMetrics as m (m.metric_key)}
                        <tr>
                            <td><strong>{m.label}</strong></td>
                            <td class="dm-center">{m.unit || ''}</td>
                            <td class="mono dm-center">{m.metric_key}</td>
                            <td class="dm-center">
                                <span class="dm-seg" role="group"><button class="seg" class:active={m.show_in_overview} onclick={() => setVisible('metric', m, 'show_in_overview', true)} aria-pressed={m.show_in_overview}>Shown</button><button class="seg off" class:active={!m.show_in_overview} onclick={() => setVisible('metric', m, 'show_in_overview', false)} aria-pressed={!m.show_in_overview}>Hidden</button></span>
                            </td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('metric', m)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'metric', row: m, label: m.label })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    {:else if section === 'trends'}
        <div class="adm-bar">
            <p class="dm-hint">Charts shown on the dashboard 'Trends' sub-tab.</p>
            <button class="btn-primary" onclick={() => startNew('metric')}>+ Add Chart</button>
        </div>
        {#if sortedMetrics.length === 0}
            <div class="adm-empty">No metrics defined yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Label</th><th>Unit</th><th>Key</th><th>Visible</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each sortedMetrics as m (m.metric_key)}
                        <tr>
                            <td><strong>{m.label}</strong></td>
                            <td class="dm-center">{m.unit || '—'}</td>
                            <td class="mono dm-center">{m.metric_key}</td>
                            <td class="dm-center">
                                <span class="dm-seg" role="group"><button class="seg" class:active={m.show_in_trends} onclick={() => setVisible('metric', m, 'show_in_trends', true)} aria-pressed={m.show_in_trends}>Shown</button><button class="seg off" class:active={!m.show_in_trends} onclick={() => setVisible('metric', m, 'show_in_trends', false)} aria-pressed={!m.show_in_trends}>Hidden</button></span>
                            </td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('metric', m)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'metric', row: m, label: m.label })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}

        <div class="adm-bar mt">
            <p class="dm-hint">Remaining Useful Life cards, shown beneath the trend charts.</p>
            <button class="btn-primary" onclick={() => startNew('rul')}>+ Add RUL Card</button>
        </div>
        {#if sortedRul.length === 0}
            <div class="adm-empty">No RUL cards defined yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Boiler</th><th>Label</th><th>Section</th><th>Visible</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each sortedRul as r (r.boiler_id + r.section_key)}
                        <tr>
                            <td class="dm-center">{boilerLabel(r.boiler_id)}</td>
                            <td class="dm-center"><strong>{r.label || '—'}</strong></td>
                            <td class="mono dm-center">{r.section_key}</td>
                            <td class="dm-center">
                                <span class="dm-seg" role="group"><button class="seg" class:active={r.is_visible} onclick={() => setVisible('rul', r, 'is_visible', true)} aria-pressed={r.is_visible}>Shown</button><button class="seg off" class:active={!r.is_visible} onclick={() => setVisible('rul', r, 'is_visible', false)} aria-pressed={!r.is_visible}>Hidden</button></span>
                            </td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('rul', r)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'rul', row: r, label: `${boilerLabel(r.boiler_id)} / ${r.section_key}` })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}

    {:else if section === 'motors'}
        <div class="adm-bar">
            <p class="dm-hint">Motor cards shown on the dashboard 'Motors' sub-tab.</p>
            <button class="btn-primary" onclick={() => startNew('motor')}>+ Add Motor</button>
        </div>
        {#if sortedMotors.length === 0}
            <div class="adm-empty">No motors defined yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Boiler</th><th>Name</th><th>Code</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each sortedMotors as m (m.id)}
                        <tr>
                            <td class="dm-center">{boilerLabel(m.boiler_id)}</td>
                            <td class="dm-center"><strong>{m.name}</strong></td>
                            <td class="mono dm-center">{m.code}</td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('motor', m)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'motor', row: m, label: m.name })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}

        <div class="adm-bar mt">
            <p class="dm-hint">Cells shown inside every motor card.</p>
            <button class="btn-primary" onclick={() => startNew('cell')}>+ Add Cell</button>
        </div>
        {#if sortedCells.length === 0}
            <div class="adm-empty">No motor cells defined yet.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr><th>Label</th><th>Unit</th><th>Data</th><th>Visible</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {#each sortedCells as c (c.id)}
                        <tr>
                            <td class="dm-center"><strong>{c.label}</strong></td>
                            <td class="dm-center">{c.unit || '—'}</td>
                            <td class="dm-center">{SOURCE_FIELDS.find((s) => s.value === c.source_field)?.label ?? c.source_field}</td>
                            <td class="dm-center">
                                <span class="dm-seg" role="group"><button class="seg" class:active={c.is_visible} onclick={() => setVisible('cell', c, 'is_visible', true)} aria-pressed={c.is_visible}>Shown</button><button class="seg off" class:active={!c.is_visible} onclick={() => setVisible('cell', c, 'is_visible', false)} aria-pressed={!c.is_visible}>Hidden</button></span>
                            </td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('cell', c)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'cell', row: c, label: c.label })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}

    {:else if section === 'analytics'}
        <div class="adm-bar">
            <p class="dm-hint">Group cards shown on the dashboard 'Analytics' sub-tab. Each group plots its series together.</p>
            <button class="btn-primary" onclick={() => startNew('group')}>+ Add Group</button>
        </div>
        {#if sortedGroups.length === 0}
            <div class="adm-empty">No groups defined yet.</div>
        {:else}
            {#each sortedGroups as g (g.group_key)}
                <div class="grp">
                    <div class="grp-head">
                        <div>
                            <strong>{g.label}</strong>
                            <span class="mono grp-key">{g.group_key}</span>
                        </div>
                        <div class="adm-actions">
                            <span class="dm-seg" role="group"><button class="seg" class:active={g.is_visible} onclick={() => setVisible('group', g, 'is_visible', true)} aria-pressed={g.is_visible}>Shown</button><button class="seg off" class:active={!g.is_visible} onclick={() => setVisible('group', g, 'is_visible', false)} aria-pressed={!g.is_visible}>Hidden</button></span>
                            <button class="adm-link" onclick={() => startEdit('group', g)}>Edit</button>
                            <button class="adm-link danger" onclick={() => (deleting = { kind: 'group', row: g, label: g.label })}>Delete</button>
                        </div>
                    </div>

                    {#if seriesFor(g.group_key).length === 0}
                        <p class="grp-empty">No series in this group. Edit a metric and set its group to <span class="mono">{g.group_key}</span>.</p>
                    {:else}
                        <ul class="series">
                            {#each seriesFor(g.group_key) as m (m.metric_key)}
                                <li>
                                    <span class="dot" style={`background:${m.colour}`}></span>
                                    <span class="s-label">{m.label}</span>
                                    <span class="dm-seg sm" role="group"><button class="seg" class:active={m.show_in_analytics} onclick={() => setVisible('metric', m, 'show_in_analytics', true)} aria-pressed={m.show_in_analytics}>Shown</button><button class="seg off" class:active={!m.show_in_analytics} onclick={() => setVisible('metric', m, 'show_in_analytics', false)} aria-pressed={!m.show_in_analytics}>Hidden</button></span>
                                    <button class="adm-link" onclick={() => startEdit('metric', m)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (removingSeries = m)}>Remove</button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                    <div class="grp-foot">
                        <button class="adm-link" onclick={() => openAddMetric(g.group_key)}>+ Add Metric</button>
                    </div>
                </div>
            {/each}
        {/if}

    {:else if section === 'baselines'}
        <div class="adm-bar">
            <p class="dm-hint">Per-boiler thresholds from the Tier 2 baseline audit. Anything left blank inherits the fleet-wide value from the metric.</p>
            <button class="btn-primary" onclick={() => startNew('baseline')}>+ Add Baseline</button>
        </div>
        {#if sortedBaselines.length === 0}
            <div class="adm-empty">No baselines set. Every boiler currently uses the fleet-wide thresholds.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>Boiler</th><th>Metric</th><th class="dm-center">Baseline</th>
                        <th class="dm-center">Normal</th><th class="dm-center">Warning</th>
                        <th class="dm-center">At Load</th><th class="dm-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each sortedBaselines as b (b.boiler_id + b.metric_key)}
                        {@const nLo = boundText(b, 'min_normal')}
                        {@const nHi = boundText(b, 'max_normal')}
                        {@const wLo = boundText(b, 'min_warning')}
                        {@const wHi = boundText(b, 'max_warning')}
                        <tr>
                            <td>{boilerLabel(b.boiler_id)}</td>
                            <td><strong>{metricLabel(b.metric_key)}</strong></td>
                            <td class="dm-center">{b.baseline_value ?? '—'}</td>
                            <td class="dm-center">
                                <span class:inherited={nLo.inherited}>{nLo.text}</span>
                                <span class="rng">–</span>
                                <span class:inherited={nHi.inherited}>{nHi.text}</span>
                            </td>
                            <td class="dm-center">
                                <span class:inherited={wLo.inherited}>{wLo.text}</span>
                                <span class="rng">–</span>
                                <span class:inherited={wHi.inherited}>{wHi.text}</span>
                            </td>
                            <td class="dm-center">{b.at_load ?? '—'}</td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('baseline', b)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'baseline', row: b, label: `${boilerLabel(b.boiler_id)} / ${metricLabel(b.metric_key)}` })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <p class="dm-hint mt-sm">Values shown in grey are inherited from the metric's fleet-wide setting, not overridden for this boiler.</p>
        {/if}

    {:else}
        <div class="adm-bar">
            <p class="dm-hint">Tier 2 early-warning indicators. Thresholds are expected to be reset at the annual programme review, so they are editable here.</p>
            <button class="btn-primary" onclick={() => startNew('indicator')}>+ Add Indicator</button>
        </div>
        {#if sortedIndicators.length === 0}
            <div class="adm-empty">No indicators configured.</div>
        {:else}
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>Indicator</th><th>Formula</th><th class="dm-center">Trigger</th>
                        <th class="dm-center">Visible</th><th class="dm-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each sortedIndicators as i (i.indicator_key)}
                        <tr>
                            <td>
                                <strong>{i.label}</strong>
                                <span class="ind-sub">{i.early_warning}</span>
                            </td>
                            <td>
                                {FORMULA_LABELS[i.formula] ?? i.formula}
                                {#if i.formula === 'unavailable'}<span class="ind-sub">No data source yet</span>{/if}
                            </td>
                            <td class="dm-center">
                                {#if i.trigger_value === null || i.trigger_value === undefined}
                                    —
                                {:else}
                                    {i.trigger_op === 'above' ? '>' : '<'} {i.trigger_value}{i.unit ? ` ${i.unit}` : ''}
                                    {#if i.trigger_days > 1}<span class="ind-sub">for {i.trigger_days} days</span>{/if}
                                {/if}
                            </td>
                            <td class="dm-center">
                                <span class="dm-seg sm" role="group"><button class="seg" class:active={i.is_visible} onclick={() => setVisible('indicator', i, 'is_visible', true)} aria-pressed={i.is_visible}>Shown</button><button class="seg off" class:active={!i.is_visible} onclick={() => setVisible('indicator', i, 'is_visible', false)} aria-pressed={!i.is_visible}>Hidden</button></span>
                            </td>
                            <td>
                                <div class="adm-actions">
                                    <button class="adm-link" onclick={() => startEdit('indicator', i)}>Edit</button>
                                    <button class="adm-link danger" onclick={() => (deleting = { kind: 'indicator', row: i, label: i.label })}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    {/if}
</div>

{#if editing}
    <Modal title={`${editing.row ? 'Edit' : 'Add'} ${editing.kind === 'metric' ? 'Metric' : editing.kind === 'rul' ? 'RUL Card' : editing.kind === 'motor' ? 'Motor' : editing.kind === 'cell' ? 'Cell' : editing.kind === 'baseline' ? 'Baseline' : editing.kind === 'indicator' ? 'Indicator' : 'Group'}`} onclose={cancel}>
        <div class="adm-form">
            {#if editing.kind === 'metric'}
                {#if !editing.row}
                    <label>Key <span class="required">*</span>
                        <input bind:value={form.metric_key} placeholder="steam_flow" class:invalid={fieldErr.metric_key} />
                        {#if fieldErr.metric_key}<span class="field-err">{fieldErr.metric_key}</span>{/if}
                    </label>
                {/if}
                <label>Label <span class="required">*</span>
                    <input bind:value={form.label} placeholder="Steam Flow" class:invalid={fieldErr.label} />
                    {#if fieldErr.label}<span class="field-err">{fieldErr.label}</span>{/if}
                </label>
                <label>Unit
                    <input bind:value={form.unit} placeholder="TPH" />
                </label>
                <label>Analytics Group
                    <select bind:value={form.group_key}>
                        <option value="">None</option>
                        {#each sortedGroups as g (g.group_key)}<option value={g.group_key}>{g.label}</option>{/each}
                    </select>
                </label>
                <label>Colour
                    <input bind:value={form.colour} placeholder="#38bdf8" />
                </label>
                <label>Sort Order
                    <input type="number" bind:value={form.sort_order} />
                </label>
            
            {:else if editing.kind === 'rul'}
                {#if !editing.row}
                    <label>Boiler <span class="required">*</span>
                        <select bind:value={form.boiler_id} class:invalid={fieldErr.boiler_id}>
                            {#each boilers as b (b.id)}<option value={b.id}>{b.code}</option>{/each}
                        </select>
                        {#if fieldErr.boiler_id}<span class="field-err">{fieldErr.boiler_id}</span>{/if}
                    </label>
                    <label>Section Key <span class="required">*</span>
                        <input bind:value={form.section_key} placeholder="steam_drum" class:invalid={fieldErr.section_key} />
                        {#if fieldErr.section_key}<span class="field-err">{fieldErr.section_key}</span>{/if}
                    </label>
                {/if}
                <label class="full">Label
                    <input bind:value={form.label} placeholder="Steam Drum" />
                </label>

            {:else if editing.kind === 'motor'}
                {#if !editing.row}
                    <label>Boiler <span class="required">*</span>
                        <select bind:value={form.boiler_id} class:invalid={fieldErr.boiler_id}>
                            {#each boilers as b (b.id)}<option value={b.id}>{b.code}</option>{/each}
                        </select>
                        {#if fieldErr.boiler_id}<span class="field-err">{fieldErr.boiler_id}</span>{/if}
                    </label>
                {/if}
                <label>Name <span class="required">*</span>
                    <input bind:value={form.name} placeholder="Induced Draft Fan" class:invalid={fieldErr.name} />
                    {#if fieldErr.name}<span class="field-err">{fieldErr.name}</span>{/if}
                </label>
                <label>Code <span class="required">*</span>
                    <input bind:value={form.code} placeholder="IDF" class:invalid={fieldErr.code} />
                    {#if fieldErr.code}<span class="field-err">{fieldErr.code}</span>{/if}
                </label>
                <label>Sort Order
                    <input type="number" bind:value={form.sort_order} />
                </label>

            {:else if editing.kind === 'cell'}
                <label>Label <span class="required">*</span>
                    <input bind:value={form.label} placeholder="VIB" class:invalid={fieldErr.label} />
                    {#if fieldErr.label}<span class="field-err">{fieldErr.label}</span>{/if}
                </label>
                <label>Unit
                    <input bind:value={form.unit} placeholder="mm/s" />
                </label>
                <label class="full">Data to display <span class="required">*</span>
                    <select bind:value={form.source_field} onchange={() => (form.rating_field = SOURCE_FIELDS.find((s) => s.value === form.source_field)?.rating ?? null)}>
                        {#each SOURCE_FIELDS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
                    </select>
                </label>
                <label>Sort Order
                    <input type="number" bind:value={form.sort_order} />
                </label>

            {:else if editing.kind === 'indicator'}
                {#if !editing.row}
                    <label>Key <span class="required">*</span>
                        <input bind:value={form.indicator_key} placeholder="exhaust_rise" class:invalid={fieldErr.indicator_key} />
                        {#if fieldErr.indicator_key}<span class="field-err">{fieldErr.indicator_key}</span>{/if}
                    </label>
                {/if}
                <label>Label <span class="required">*</span>
                    <input bind:value={form.label} placeholder="Exhaust Gas Temperature Rise" class:invalid={fieldErr.label} />
                    {#if fieldErr.label}<span class="field-err">{fieldErr.label}</span>{/if}
                </label>
                <label class="full">Early Warning Of <span class="required">*</span>
                    <input bind:value={form.early_warning} placeholder="Internal scale or external tube fouling" class:invalid={fieldErr.early_warning} />
                    {#if fieldErr.early_warning}<span class="field-err">{fieldErr.early_warning}</span>{/if}
                </label>
                <label class="full">Suggested Action <span class="required">*</span>
                    <input bind:value={form.suggested_action} placeholder="Sustained rise for 7 days - inspect and clean" class:invalid={fieldErr.suggested_action} />
                    {#if fieldErr.suggested_action}<span class="field-err">{fieldErr.suggested_action}</span>{/if}
                </label>

                <label>Formula
                    <select bind:value={form.formula}>
                        {#each Object.entries(FORMULA_LABELS) as [k, v] (k)}<option value={k}>{v}</option>{/each}
                    </select>
                </label>
                <label>Unit
                    <input bind:value={form.unit} placeholder="°C" />
                </label>

                <label>Metric
                    <select bind:value={form.metric_key}>
                        <option value="">None</option>
                        {#each sortedMetrics as m (m.metric_key)}<option value={m.metric_key}>{m.label}</option>{/each}
                    </select>
                </label>
                {#if form.formula === 'differential' || form.formula === 'ratio'}
                    <label>Second Metric <span class="required">*</span>
                        <select bind:value={form.metric_key_b} class:invalid={fieldErr.metric_key_b}>
                            <option value={null}>None</option>
                            {#each sortedMetrics as m (m.metric_key)}<option value={m.metric_key}>{m.label}</option>{/each}
                        </select>
                        {#if fieldErr.metric_key_b}<span class="field-err">{fieldErr.metric_key_b}</span>{/if}
                    </label>
                {/if}

                <label>Trigger When
                    <select bind:value={form.trigger_op}>
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                    </select>
                </label>
                <label>Trigger Value
                    <input type="number" step="any" bind:value={form.trigger_value} placeholder="Blank = described but not enforced" />
                </label>
                <label>Sustained For (days)
                    <input type="number" bind:value={form.trigger_days} />
                </label>
                <label>Sort Order
                    <input type="number" bind:value={form.sort_order} />
                </label>

            {:else if editing.kind === 'baseline'}
                {#if !editing.row}
                    <label>Boiler <span class="required">*</span>
                        <select bind:value={form.boiler_id} class:invalid={fieldErr.boiler_id}>
                            {#each boilers as b (b.id)}<option value={b.id}>{b.code}</option>{/each}
                        </select>
                        {#if fieldErr.boiler_id}<span class="field-err">{fieldErr.boiler_id}</span>{/if}
                    </label>
                    <label>Metric <span class="required">*</span>
                        <select bind:value={form.metric_key} class:invalid={fieldErr.metric_key}>
                            {#each sortedMetrics as m (m.metric_key)}<option value={m.metric_key}>{m.label}</option>{/each}
                        </select>
                        {#if fieldErr.metric_key}<span class="field-err">{fieldErr.metric_key}</span>{/if}
                    </label>
                {/if}

                <p class="full dm-hint">
                    Leave a threshold blank to inherit the fleet-wide value.
                    {#if metricFor(form.metric_key)}
                        Currently inherits normal
                        {metricFor(form.metric_key).min_normal}–{metricFor(form.metric_key).max_normal},
                        warning {metricFor(form.metric_key).min_warning}–{metricFor(form.metric_key).max_warning}
                        {metricFor(form.metric_key).unit}.
                    {/if}
                </p>

                <label>Baseline Value
                    <input type="number" step="any" bind:value={form.baseline_value} placeholder="Reference reading when clean" />
                </label>
                <label>At Load
                    <input type="number" step="any" bind:value={form.at_load} placeholder="Steam output when measured" />
                </label>

                <label>Normal Minimum
                    <input type="number" step="any" bind:value={form.min_normal} />
                </label>
                <label>Normal Maximum
                    <input type="number" step="any" bind:value={form.max_normal} class:invalid={fieldErr.max_normal} />
                    {#if fieldErr.max_normal}<span class="field-err">{fieldErr.max_normal}</span>{/if}
                </label>

                <label>Warning Minimum
                    <input type="number" step="any" bind:value={form.min_warning} />
                </label>
                <label>Warning Maximum
                    <input type="number" step="any" bind:value={form.max_warning} class:invalid={fieldErr.max_warning} />
                    {#if fieldErr.max_warning}<span class="field-err">{fieldErr.max_warning}</span>{/if}
                </label>

                <label class="full">Note
                    <input bind:value={form.note} placeholder="e.g. established during Phase 1 audit, Mar 2026" />
                </label>

            {:else}
                {#if !editing.row}
                    <label>Key <span class="required">*</span>
                        <input bind:value={form.group_key} placeholder="flow" class:invalid={fieldErr.group_key} />
                        {#if fieldErr.group_key}<span class="field-err">{fieldErr.group_key}</span>{/if}
                    </label>
                {/if}
                <label>Label <span class="required">*</span>
                    <input bind:value={form.label} placeholder="Steam / Water / Fuel" class:invalid={fieldErr.label} />
                    {#if fieldErr.label}<span class="field-err">{fieldErr.label}</span>{/if}
                </label>
                <label>Sort Order
                    <input type="number" bind:value={form.sort_order} />
                </label>
                <div class="full series-field">
                    <span class="sf-label">Series</span>
                    <p class="sf-hint">Metrics plotted together on this group's chart. A metric can only belong to one group.</p>
                    <div class="sf-list">
                        {#each sortedMetrics as m (m.metric_key)}
                            {@const taken = m.group_key && m.group_key !== (editing?.row?.group_key ?? form.group_key)}
                            <label class="sf-item" class:disabled={taken}>
                                <input
                                    type="checkbox"
                                    checked={(form.series ?? []).includes(m.metric_key)}
                                    disabled={taken}
                                    onchange={() => toggleSeries(m.metric_key)} />
                                <span class="dot" style={`background:${m.colour}`}></span>
                                <span class="sf-name">{m.label}</span>
                                {#if taken}<span class="sf-taken">in {m.group_key}</span>{/if}
                            </label>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if err}<p class="adm-err">{err}</p>{/if}
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
                <button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if deleting}
    <Modal title="Delete" onclose={() => (deleting = null)}>
        <div class="modal-confirm">
            <p>Are you sure you want to delete <strong>{deleting.label}</strong>? This cannot be undone.</p>
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={remove} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if removingSeries}
    <Modal title="Remove Series" onclose={() => (removingSeries = null)}>
        <div class="modal-confirm">
            <p>Remove <strong>{removingSeries.label}</strong> from this group? The metric itself is kept and can be added to a group again later.</p>
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={() => (removingSeries = null)} disabled={busy}>Cancel</button>
                <button class="btn-danger" onclick={() => removeSeries(removingSeries)} disabled={busy}>{busy ? 'Removing...' : 'Remove'}</button>
            </div>
        </div>
    </Modal>
{/if}

{#if addingTo}
    <Modal title="Add Metric" onclose={() => (addingTo = null)}>
        <div class="adm-metric-form">
            <div class="metric-field series-field">
                <span class="sf-label">Available metrics</span>
                <p class="sf-hint">Only metrics not already in another group can be added here. To move a metric between groups, edit it directly or edit the other group.</p>
                <div class="sf-list">
                    {#each sortedMetrics.filter((m) => m.group_key !== addingTo) as m (m.metric_key)}
                        {@const taken = !!m.group_key}
                        <label class="sf-item" class:disabled={taken}>
                            <input
                                type="checkbox"
                                checked={toAdd.includes(m.metric_key)}
                                disabled={taken}
                                onchange={() => toggleToAdd(m.metric_key)} />
                            <span class="dot" style={`background:${m.colour}`}></span>
                            <span class="sf-name">{m.label}</span>
                            {#if taken}<span class="sf-taken">in {m.group_key}</span>{/if}
                        </label>
                    {/each}
                </div>
            </div>
            <div class="adm-form-actions">
                <button class="btn-ghost" onclick={() => (addingTo = null)} disabled={busy}>Cancel</button>
                <button class="btn-primary" onclick={confirmAddMetrics} disabled={busy || toAdd.length === 0}>
                    {busy ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    </Modal>
{/if}

<style>
    .dm-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
 
    .dm-tabs {
        display: block;
        margin-bottom: 18px;
    }

    .dm-tabs select {
        width: auto;
        padding: 8px 16px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        background-color: var(--bme-surface);
        color: var(--bme-ink);
        font: inherit;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
    }
 
    .dm-hint { margin: 0; font-size: 12.5px; color: var(--bme-muted); }
    .dm-hint.mt-sm { margin-top: 10px; }

    .inherited { color: var(--bme-muted); opacity: 0.75; }
    .rng { color: var(--bme-muted); margin: 0 3px; }

    .ind-sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--bme-muted); }

    .dm-center {
        text-align: center;
    }
 
    .dm-seg {
        display: inline-flex;
        border: 1px solid var(--bme-border);
        border-radius: 999px;
        overflow: hidden;
        flex: 0 0 auto;
        vertical-align: middle;
    }

    .dm-seg .seg {
        padding: 4px 12px;
        border: none;
        background: var(--bme-surface);
        color: var(--bme-muted);
        font: inherit;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
    }

    .dm-seg .seg.active { background: var(--bme-green); color: #ffffff; }
    .dm-seg .seg.off.active { background: var(--bme-muted); color: #ffffff; }
    .dm-seg .seg:not(.active):hover { background: var(--bme-hover); }

    .dm-seg.sm .seg { padding: 3px 10px; font-size: 11px; }
 
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--bme-muted); }
 
    .mt { margin-top: 28px; }
 
    .grp {
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 14px;
        background: var(--bme-surface);
    }

    .grp-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 14px 16px;
        background: var(--bme-surface-2);
        border-bottom: 1px solid var(--bme-border);
    }

    .grp-key { margin-left: 8px; }
    .grp-empty { margin: 0; padding: 14px 16px; font-size: 12.5px; color: var(--bme-muted); }

    .grp-foot {
        padding: 10px 34px;
        border-top: 1px solid var(--bme-border);
    }

    .adm-metric-form {
        gap: 12px;
        padding: 18px;
    }

    .metric-field {
        margin-bottom: 20px;
    }

    .series { list-style: none; margin: 0; padding: 4px 16px 10px 34px; display: flex; flex-direction: column; }
    .series li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--bme-border); }
    .series li:first-child { border-top: none; }
    .s-label { flex: 1; font-size: 13px; color: var(--bme-ink); }

    .series :global(.adm-link) { font-size: 12px; padding: 3px 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }

    .series-field { display: flex; flex-direction: column; gap: 4px; }
    .sf-label { font-weight: 600; font-size: 14px; color: var(--bme-ink); }
    .sf-hint { margin: 0 0 6px; font-size: 12px; color: var(--bme-muted); }

    .sf-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        padding: 8px 10px;
        background: var(--bme-surface);
    }

    .sf-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 5px 4px;
        font-size: 13.5px;
        cursor: pointer;
    }

    .sf-item.disabled { opacity: 0.5; cursor: not-allowed; }
    .sf-item input { width: auto; margin: 0; cursor: inherit; }
    .sf-name { flex: 1; }
    .sf-taken { font-size: 11.5px; color: var(--bme-muted); font-style: italic; }

    @media (max-width: 640px) {
        .adm-bar .btn-primary {
            margin-left: auto;
        }
    }
</style>