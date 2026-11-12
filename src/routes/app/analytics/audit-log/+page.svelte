<script lang="ts">
    import SearchFilter from "$lib/components/SearchFilter.svelte";
    import Pagination from "$lib/components/admin/Pagination.svelte";
    import { emptyFilters, isActive, matches } from "$lib/filters";
    import { roleLabel } from "$lib/roles";

    let { data } = $props();

    const PAGE_SIZE = 25;

    type Group = 'all' | 'user' | 'setting' | 'catalogue' | 'faq';
    const GROUPS: { key: Group; label: string; types: string[] | null }[] = [
        { key: 'all', label: 'All', types: null },
        { key: 'user', label: 'Users', types: ['user'] },
        { key: 'setting', label: 'Settings', types: ['setting'] },
        { key: 'catalogue', label: 'Catalogue', types: ['project', 'boiler', 'component', 'part', 'region'] },
        { key: 'faq', label: 'FAQ', types: ['faq'] }
    ];

    let filters = $state(emptyFilters());
    let group = $state<Group>('all');
    let page = $state(1);
    let open = $state<Record<string, boolean>>({});

    const ACTION_LABEL: Record<string, string> = {
        create: 'Created',
        update: 'Updated',
        delete: 'Deleted',
        invitation_resent: 'Invitation resent',
        password_reset: 'Password reset'
    };

    const ENTITY_LABEL: Record<string, string> = {
        user: 'User',
        setting: 'Setting',
        project: 'Project',
        boiler: 'Boiler',
        component: 'Component',
        part: 'Part',
        faq: 'FAQ',
        region: 'Region'
    };

    const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;
    const entityLabel = (e: string) => ENTITY_LABEL[e] ?? e;
    const when = (ts: string) => new Date(ts).toLocaleString();

    function show(v: unknown): string {
        if (v === null || v === undefined || v === '') return '—';
        if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    }

    function changeRows(d: any): { field: string; from: string; to: string }[] {
        const ch = d?.changes;
        if (!ch || typeof ch !== 'object') return [];
        return Object.entries(ch).map(([field, pair]) => {
            const [from, to] = Array.isArray(pair) ? pair : [null, pair];
            return { field, from: show(from), to: show(to) };
        });
    }

    function snapshotRows(d: any): { field: string; value: string }[] {
        const sn = d?.snapshot;
        if (!sn || typeof sn !== 'object') return [];
        return Object.entries(sn).map(([field, value]) => ({ field, value: show(value) }));
    }

    function hasDetails(r: any): boolean {
        return changeRows(r.details).length > 0 || snapshotRows(r.details).length > 0 || !!r.details?.note;
    }

    function inGroup(r: any): boolean {
        const types = GROUPS.find((g) => g.key === group)?.types;
        return !types || types.includes(r.entity_type);
    }

    const counts = $derived(
        Object.fromEntries(
            GROUPS.map((g) => [g.key, g.types ? data.rows.filter((r: any) => g.types!.includes(r.entity_type)).length : data.rows.length])
        ) as Record<Group, number>
    );

    const filtered = $derived(
        data.rows.filter(
            (r: any) => inGroup(r) && matches(filters, {
                search: [r.action_name, r.entity_label, r.entity_type, r.action, r.actor_role],
                date: r.created_at
            })
        )
    );

    const paged = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

    $effect(() => {
        filters.q;
        filters.from;
        filters.to;
        group;
        page = 1;
    });
</script>

<p class="intro">
    A record of users who changed user accounts, app settings and the boiler, part and FAQ catalogue. Entries cannot be edited or deleted. Secret values are never stored.
</p>

<div class="stats">
    <div class="card stat">
        <span class="s-val">{data.stats.changes24h}</span>
        <span class="s-lbl">Changes (24h)</span>
        <span class="s-sub">{data.stats.total} in the log overall</span>
    </div>
    <div class="card stat">
        <span class="s-val">{data.stats.userChanges7d}</span>
        <span class="s-lbl">User Changes (7d)</span>
        <span class="s-sub">accounts, roles and access</span>
    </div>
    <div class="card stat" class:alert={data.stats.deletion7d > 0}>
        <span class="s-val" class:warn={data.stats.deletion7d}>{data.stats.deletion7d}</span>
        <span class="s-lbl">Deletions (7d)</span>
        <span class="s-sub">most recent 500 entries shown</span>
    </div>
</div>

{#if data.rows.length === 0}
    <div class="card empty">
        Nothing has been recorded yet. Entries appear here once the audit migration has been applied and an administrator changes something.
    </div>
{:else}
    <SearchFilter 
        bind:filters
        showStatus={false}
        showRegion={false}
        placeholder="Search by user, item or action..."
    />

    <div class="tabbar">
        {#each GROUPS as g (g.key)}
            <button class="tab" class:active={group === g.key} onclick={() => (group = g.key)}>
                {g.label} ({counts[g.key]})
            </button>
        {/each}
    </div>

    {#if filtered.length === 0}
        <div class="card empty">
            {#if isActive(filters)}
                Nothing matches these filters.
            {:else}
                No entries in this category yet.
            {/if}
        </div>
    {:else}
        <div class="card table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>When</th><th>Who</th><th>Action</th><th>Item</th>
                    </tr>
                </thead>
                <tbody>
                    {#each paged as r (r.id)}
                        <tr>
                            <td class="when">{when(r.created_at)}</td>
                            <td>
                                <span class="who">{r.actor_name ?? 'System'}</span>
                                {#if r.actor_role}<span class="role">{roleLabel(r.actor_role) || r.actor_role}</span>{/if}
                            </td>
                            <td>
                                <span class="badge {r.action}">{actionLabel(r.action)}</span>
                            </td>
                            <td>
                                <span class="type">{entityLabel(r.entity_type)}</span>
                                <span class="label">{r.entity_label ?? r.entity_id ?? '—'}</span>
                                {#if hasDetails(r)}
                                    <button class="more" aria-expanded={!!open[r.id]} onclick={() => (open[r.id] = !open[r.id])}>
                                        {open[r.id] ? 'Hide details' : 'Show details'}
                                    </button>
                                {/if}
                                {#if open[r.id]}
                                    <div class="details">
                                        {#if r.details?.note}<p class="note">{r.details.note}</p>{/if}
                                        {#each changeRows(r.details) as c (c.field)}
                                            <p class="line">
                                                <span class="field">{c.field}</span>
                                                <span class="old">{c.from}</span>
                                                <span class="arrow" aria-hidden="true">→</span>
                                                <span class="new">{c.to}</span>
                                            </p>
                                        {/each}
                                        {#each snapshotRows(r.details) as s (s.field)}
                                            <p class="line">
                                                <span class="field">{s.field}</span>
                                                <span class="new">{s.value}</span>
                                            </p>
                                        {/each}
                                    </div>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <Pagination total={filtered.length} {page} pageSize={PAGE_SIZE} onpage={(p) => (page = p)} />
    {/if}
{/if}

<style>
	.intro {
		color: var(--bme-muted);
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0 0 20px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 20px;
	}

	.stat.alert {
		border-left: 4px solid var(--bme-red);
	}

	.s-val {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--bme-dark-blue);
		line-height: 1.1;
	}

	.s-val.warn {
		color: var(--bme-red);
	}

	.s-lbl {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--bme-ink);
	}

	.s-sub {
		font-size: 0.75rem;
		color: var(--bme-muted);
	}

	.tabbar {
		display: inline-flex;
		gap: 8px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}

	.tab {
		padding: 9px 22px;
		border: 1px solid var(--bme-border);
		border-radius: 8px;
		font-weight: 700;
		font-size: 14px;
		font-family: inherit;
		background-color: var(--bme-surface);
		color: var(--bme-muted);
		cursor: pointer;
		transition:
			background-color var(--t-fast) var(--ease),
			color var(--t-fast) var(--ease),
			border-color var(--t-fast) var(--ease);
	}

	.tab.active {
		background: var(--bme-dark-blue);
		color: #ffffff;
		border-color: var(--bme-dark-blue);
	}

	.table-wrap {
		padding: 6px 14px;
		overflow-x: auto;
		margin-bottom: 14px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.87rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.7rem;
		border-bottom: 1px solid var(--bme-border);
		vertical-align: top;
	}

	th {
		color: var(--bme-muted);
		font-weight: 600;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	.when {
		color: var(--bme-muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.who {
		display: block;
		color: var(--bme-ink);
		font-weight: 600;
	}

	.role {
		display: block;
		font-size: 0.75rem;
		color: var(--bme-muted);
	}

	.badge {
		display: inline-block;
		letter-spacing: 0.03em;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		white-space: nowrap;
		background: #e7f0f8;
		color: #004b8d;
	}

	.badge.create {
		background: #e4f3d8;
		color: #2f5e18;
	}

	.badge.delete {
		background: #fbe3e0;
		color: #8e261b;
	}

	.badge.password_reset,
	.badge.invitation_resent {
		background: #fdf1d6;
		color: #7a5300;
	}

	:root[data-theme='dark'] .badge {
		background: #1c2f44;
		color: #8cc4f5;
	}

	:root[data-theme='dark'] .badge.create {
		background: #1e3212;
		color: #9adf6c;
	}

	:root[data-theme='dark'] .badge.delete {
		background: #3a1c18;
		color: #ff9d8f;
	}

	:root[data-theme='dark'] .badge.password_reset,
	:root[data-theme='dark'] .badge.invitation_resent {
		background: #3b2f10;
		color: #f3cf7a;
	}

	.type {
		display: inline-block;
		margin-right: 6px;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
		background: var(--bme-surface-2);
		color: var(--bme-muted);
	}

	.label {
		color: var(--bme-ink);
		overflow-wrap: anywhere;
	}

	.more {
		display: block;
		margin-top: 6px;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--bme-dark-blue);
		cursor: pointer;
	}

	.more:hover {
		text-decoration: underline;
	}

	.details {
		margin-top: 8px;
		padding: 10px 12px;
		background: var(--bme-surface-2);
		border: 1px solid var(--bme-border);
		border-radius: 6px;
		font-size: 0.8rem;
	}

	.details p {
		margin: 0 0 6px;
	}

	.details p:last-child {
		margin-bottom: 0;
	}

	.note {
		color: var(--bme-muted);
	}

	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: baseline;
	}

	.field {
		font-weight: 700;
		color: var(--bme-ink);
		min-width: 90px;
	}

	.old {
		color: var(--bme-muted);
		text-decoration: line-through;
		overflow-wrap: anywhere;
	}

	.arrow {
		color: var(--bme-muted);
	}

	.new {
		color: var(--bme-ink);
		overflow-wrap: anywhere;
	}

	.empty {
		text-align: center;
		color: var(--bme-muted);
		padding: 36px;
	}

	@media (max-width: 640px) {
		.tab {
			padding: 8px 14px;
		}

		.field {
			min-width: 0;
			flex-basis: 100%;
		}
	}
</style>