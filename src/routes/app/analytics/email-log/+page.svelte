<script lang="ts">
	import { Search, Undo2 } from '@lucide/svelte';

	let { data } = $props();

	let search = $state('');
	let tab = $state<'failed' | 'all'>('failed');

	const KIND_LABEL: Record<string, string> = {
		quote_admin: 'Quote (staff)',
		quote_customer: 'Quote (customer)',
		quote_approved: 'Quote approved',
		enquiry_admin: 'Enquiry (staff)',
		enquiry_confirmation: 'Enquiry reply',
		password_reset: 'Password reset',
		escalation: 'Escalation',
		reminder_requests: 'Reminder: requests',
		reminder_enquiries: 'Reminder: enquiries',
		reminder_cart: 'Reminder: cart',
		data_quality: 'Data quality'
	};

	const kindLabel = (k: string | null) => (k ? (KIND_LABEL[k] ?? k) : 'Uncategorised');
	const when = (ts: string) => new Date(ts).toLocaleString();

	const filtered = $derived(
		data.rows.filter((r: any) => {
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return [r.to_email, r.subject, r.related_ref, r.kind, r.error].some((v: any) =>
				(v ?? '').toString().toLowerCase().includes(q)
			);
		})
	);

	const list = $derived(
		tab === 'failed' ? filtered.filter((r: any) => r.status === 'failed') : filtered
	);
</script>

<div class="head">
	<h1>E-mail Deliveries</h1>
	<a href="/app/analytics">
		<button class="btn-primary"><Undo2 size={16} /> Analytics</button>
	</a>
</div>

<p class="intro">
	Every outbound e-mail is recorded here. A failure means the message never reached the mail
	service, so the recipient did not get it — those need to be sent manually.
</p>

<div class="stats">
	<div class="card stat" class:alert={data.stats.failed24h > 0}>
		<span class="s-val">{data.stats.failed24h}</span>
		<span class="s-lbl">Failed (24h)</span>
		<span class="s-sub">{data.stats.failedTotal} in the log overall</span>
	</div>
	<div class="card stat">
		<span class="s-val"
			>{data.stats.successRate7d === null ? '—' : `${data.stats.successRate7d}%`}</span
		>
		<span class="s-lbl">Success rate (7d)</span>
		<span class="s-sub">{data.stats.sent7d} sent, {data.stats.failed7d} failed</span>
	</div>
	<div class="card stat">
		<span class="s-val">{data.stats.total}</span>
		<span class="s-lbl">Recent attempts</span>
		<span class="s-sub">most recent 300 shown</span>
	</div>
</div>

{#if data.rows.length === 0}
	<div class="card empty">
		No e-mails have been recorded yet. Entries appear here once the updated Edge Functions have been
		deployed and e-mail is attempted.
	</div>
{:else}
	<div class="searchbar">
		<span class="search-ic"><Search size={16} /></span>
		<input
			type="search"
			placeholder="Search by recipient, subject, reference, or error..."
			bind:value={search}
		/>
	</div>

	<div class="tabbar">
		<button class="tab" class:active={tab === 'failed'} onclick={() => (tab = 'failed')}>
			Failed ({data.stats.failedTotal})
		</button>
		<button class="tab" class:active={tab === 'all'} onclick={() => (tab = 'all')}>
			All ({data.stats.total})
		</button>
	</div>

	{#if list.length === 0}
		<div class="card empty">
			{tab === 'failed'
				? 'No failed deliveries. Every recorded e-mail was accepted by the mail service.'
				: 'Nothing matches this search.'}
		</div>
	{:else}
		<div class="card table-wrap">
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>When</th>
						<th>Type</th>
						<th>Recipient</th>
						<th>Subject</th>
					</tr>
				</thead>
				<tbody>
					{#each list as r (r.id)}
						<tr>
							<td><span class="badge {r.status}">{r.status}</span></td>
							<td class="when">{when(r.created_at)}</td>
							<td><span class="kind">{kindLabel(r.kind)}</span></td>
							<td class="to">{r.to_email}</td>
							<td>
								<span class="subj">{r.subject}</span>
								{#if r.related_ref}<span class="ref">{r.related_ref}</span>{/if}
								{#if r.attachments > 0}<span class="att"
										>{r.attachments} attachtment{r.attachments === 1 ? '' : 's'}</span
									>{/if}
								{#if r.error}<span class="err">{r.error}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
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
		margin-bottom: 6px;
	}

	h1 {
		margin: 5px 0 10px;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

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

	.stat.alert .s-val {
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

	.searchbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		margin-bottom: 16px;
		background: var(--bme-surface);
		border: 1px solid var(--bme-border);
		border-radius: 10px;
		color: var(--bme-muted);
	}

	.searchbar:focus-within {
		border-color: var(--bme-dark-blue);
	}

	.search-ic {
		display: flex;
		flex: 0 0 auto;
	}

	.searchbar input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font: inherit;
		color: var(--bme-ink);
	}

	.searchbar input::-webkit-search-cancel-button {
		display: none;
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

	.badge {
		display: inline-block;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	.badge.sent {
		background: #e4f3d8;
		color: #2f5e18;
	}

	:root[data-theme='dark'] .badge.sent {
		background: #1e3212;
		color: #9adf6c;
	}

	.badge.failed {
		background: #fbe3e0;
		color: #8e261b;
	}

	:root[data-theme='dark'] .badge.failed {
		background: #3a1c18;
		color: #ff9d8f;
	}

	.when {
		color: var(--bme-muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.kind {
		font-size: 0.78rem;
		color: var(--bme-ink);
		white-space: nowrap;
	}

	.to {
		color: var(--bme-ink);
		word-break: break-all;
	}

	.subj {
		display: block;
		color: var(--bme-ink);
	}

	.ref {
		display: inline-block;
		margin-top: 4px;
		margin-right: 6px;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
		background: var(--bme-surface-2);
		color: var(--bme-muted);
	}

	.att {
		display: inline-block;
		margin-top: 4px;
		font-size: 0.72rem;
		color: var(--bme-muted);
	}

	.err {
		display: block;
		margin-top: 6px;
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--bme-red);
		word-break: break-word;
	}

	.empty {
		text-align: center;
		color: var(--bme-muted);
		padding: 2rem 1.5rem;
		line-height: 1.5;
	}
</style>
