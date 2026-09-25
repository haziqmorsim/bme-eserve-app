<script lang="ts">
	import { addToast } from '$lib/stores/toast';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';

	let {
		boilerId,
		inspection = null,
		inspectionItems = [],
		findings = [],
		tubeReadings = [],
		supabase,
		onclose
	} = $props<{
		boilerId: string;
		inspection?: any;
		inspectionItems?: any[];
		findings?: any[];
		tubeReadings?: any[];
		supabase: any;
		onclose: () => void;
	}>();

	const today = new Date().toISOString().slice(0, 10);

	let insp = $state<any>(
		untrack(() => inspection ?? { id: null, inspected_on: today, inspector: '', status: 'draft', summary: '' })
	);

	let findingByItem = $state<Record<string, any>>(
		untrack(() => Object.fromEntries((findings as any[]).map((f) => [f.item_id, f])))
	);

	let tubes = $state<any[]>(untrack(() => [...(tubeReadings as any[])]));
	let newTube = $state({ location: '', reading_mm: '', minimum_mm: '', note: '' });

	const groups = $derived.by(() => {
		const out: { key: string; category: string; code: string; label: string; items: any[] }[] = [];
		for (const it of inspectionItems as any[]) {
			const key = `${it.category}:${it.group_code}`;
			let g = out.find((x) => x.key === key);
			if (!g) {
				g = { key, category: it.category, code: it.group_code, label: it.group_label, items: [] };
				out.push(g);
			}
			g.items.push(it);
		}
		return out;
	});

	const totals = $derived.by(() => {
		let ok = 0, attention = 0, na = 0, pending = 0;
		for (const it of inspectionItems as any[]) {
			const r = findingByItem[it.id]?.result ?? 'pending';
			if (r === 'ok') ok++;
			else if (r === 'attention') attention++;
			else if (r === 'na') na++;
			else pending++;
		}
		return { ok, attention, na, pending, total: (inspectionItems as any[]).length };
	});

	let busy = $state(false);
	let uploadingFor = $state<string | null>(null);

	async function ensureInspection() {
		if (insp.id) return insp.id;
		const { data, error } = await supabase
			.from('boiler_inspections')
			.insert({
				boiler_id: boilerId,
				inspected_on: insp.inspected_on,
				inspector: insp.inspector.trim() || null,
				status: 'draft'
			})
			.select()
			.single();
		if (error) {
			addToast(`Could not start the inspection: ${error.message}`, 'error');
			return null;
		}
		insp = data;
		await invalidateAll();
		return data.id;
	}

	async function setResult(item: any, result: string) {
		const inspectionId = await ensureInspection();
		if (!inspectionId) return;

		const prior = findingByItem[item.id];
		findingByItem = { ...findingByItem, [item.id]: { ...prior, item_id: item.id, result } };

		const { data, error } = await supabase
			.from('boiler_inspection_findings')
			.upsert(
				{ inspection_id: inspectionId, item_id: item.id, result, note: prior?.note ?? null, photo_url: prior?.photo_url ?? null },
				{ onConflict: 'inspection_id,item_id' }
			)
			.select()
			.single();

		if (error) {
			findingByItem = { ...findingByItem, [item.id]: prior ?? null };
			addToast(`Could not save that item: ${error.message}`, 'error');
			return;
		}
		findingByItem = { ...findingByItem, [item.id]: data };
	}

	async function saveNote(item: any, note: string) {
		const inspectionId = await ensureInspection();
		if (!inspectionId) return;
		const prior = findingByItem[item.id];

		const { data, error } = await supabase
			.from('boiler_inspection_findings')
			.upsert(
				{ inspection_id: inspectionId, item_id: item.id, result: prior?.result ?? 'pending', note: note.trim() || null, photo_url: prior?.photo_url ?? null },
				{ onConflict: 'inspection_id,item_id' }
			)
			.select()
			.single();

		if (error) {
			addToast(`Could not save the note: ${error.message}`, 'error');
			return;
		}
		findingByItem = { ...findingByItem, [item.id]: data };
	}

	async function onPickPhoto(item: any, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			addToast('Please select an image file.', 'error');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			addToast('Image must be 5 MB or smaller.', 'error');
			return;
		}

		const inspectionId = await ensureInspection();
		if (!inspectionId) return;

		uploadingFor = item.id;
		const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
		const path = `${inspectionId}/${crypto.randomUUID()}.${ext}`;
		const { error: upErr } = await supabase.storage.from('inspection-photos').upload(path, file, {
			cacheControl: '3600',
			upsert: false,
			contentType: file.type
		});
		if (upErr) {
			uploadingFor = null;
			addToast(`Could not upload the photo: ${upErr.message}`, 'error');
			return;
		}
		const { data: pub } = supabase.storage.from('inspection-photos').getPublicUrl(path);

		const prior = findingByItem[item.id];
		const { data, error } = await supabase
			.from('boiler_inspection_findings')
			.upsert(
				{ inspection_id: inspectionId, item_id: item.id, result: prior?.result ?? 'pending', note: prior?.note ?? null, photo_url: pub.publicUrl },
				{ onConflict: 'inspection_id,item_id' }
			)
			.select()
			.single();

		uploadingFor = null;
		input.value = '';

		if (error) {
			addToast(`Photo uploaded, but could not attach it: ${error.message}`, 'error');
			return;
		}
		findingByItem = { ...findingByItem, [item.id]: data };
	}

	async function addTube() {
		if (!newTube.location.trim() || newTube.reading_mm === '') {
			addToast('Location and reading are required.', 'error');
			return;
		}
		const inspectionId = await ensureInspection();
		if (!inspectionId) return;

		const { data, error } = await supabase
			.from('boiler_tube_thickness')
			.insert({
				inspection_id: inspectionId,
				location: newTube.location.trim(),
				reading_mm: Number(newTube.reading_mm),
				minimum_mm: newTube.minimum_mm !== '' ? Number(newTube.minimum_mm) : null,
				note: newTube.note.trim() || null
			})
			.select()
			.single();

		if (error) {
			addToast(`Could not add that reading: ${error.message}`, 'error');
			return;
		}
		tubes = [...tubes, data];
		newTube = { location: '', reading_mm: '', minimum_mm: '', note: '' };
	}

	async function removeTube(id: string) {
		const { error } = await supabase.from('boiler_tube_thickness').delete().eq('id', id);
		if (error) {
			addToast(`Could not remove that reading: ${error.message}`, 'error');
			return;
		}
		tubes = tubes.filter((t) => t.id !== id);
	}

	async function saveHeader() {
		const inspectionId = await ensureInspection();
		if (!inspectionId) return;
		const { error } = await supabase
			.from('boiler_inspections')
			.update({ inspector: insp.inspector.trim() || null, summary: insp.summary.trim() || null })
			.eq('id', inspectionId);
		if (error) addToast(`Could not save: ${error.message}`, 'error');
	}

	async function complete() {
		const inspectionId = await ensureInspection();
		if (!inspectionId) return;
		busy = true;
		const { error } = await supabase
			.from('boiler_inspections')
			.update({ status: 'complete', completed_at: new Date().toISOString() })
			.eq('id', inspectionId);
		busy = false;
		if (error) {
			addToast(`Could not complete the inspection: ${error.message}`, 'error');
			return;
		}
		await invalidateAll();
		addToast('Inspection marked complete.');
		onclose();
	}
</script>

<div class="rec">
	<div class="card rec-head">
		<div class="rec-head-row">
			<label>Inspected On
				<input type="date" bind:value={insp.inspected_on} max={today} disabled={!!insp.id} />
			</label>
			<label>Inspector
				<input bind:value={insp.inspector} placeholder="Name" onblur={saveHeader} />
			</label>
			<div class="rec-progress">
				<span class="rec-progress-n">{totals.ok + totals.attention + totals.na} / {totals.total}</span>
				<span class="rec-progress-l">assessed</span>
			</div>
		</div>
		<label class="rec-summary">Summary
			<textarea bind:value={insp.summary} onblur={saveHeader} rows="2" placeholder="Overall condition and any notes for the written report"></textarea>
		</label>
	</div>

	{#each groups as g (g.key)}
		<div class="card insp-grp">
			<div class="insp-grp-head">
				<span class="insp-code">{g.code}</span>
				<span class="insp-grp-name">{g.label}</span>
				<span class="insp-cat">{g.category === 'mechanical' ? 'Mechanical' : 'Instrumentation'}</span>
			</div>
			<ul class="rec-items">
				{#each g.items as it (it.id)}
					{@const f = findingByItem[it.id]}
					{@const res = f?.result ?? 'pending'}
					<li>
						<div class="rec-item-row">
							<span class="rec-item-label">{it.label}</span>
							<div class="rec-btns" role="group">
								<button class="rec-btn ok" class:active={res === 'ok'} onclick={() => setResult(it, 'ok')}>OK</button>
								<button class="rec-btn attention" class:active={res === 'attention'} onclick={() => setResult(it, 'attention')}>Attention</button>
								<button class="rec-btn na" class:active={res === 'na'} onclick={() => setResult(it, 'na')}>N/A</button>
							</div>
						</div>
						<div class="rec-item-detail">
							<input
								class="rec-note"
								placeholder="Note (optional)"
								value={f?.note ?? ''}
								onblur={(e) => saveNote(it, (e.currentTarget as HTMLInputElement).value)}
							/>
							<label class="rec-photo-btn">
								{#if uploadingFor === it.id}
									Uploading...
								{:else if f?.photo_url}
									<a href={f.photo_url} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>Photo attached</a>
								{:else}
									+ Photo
								{/if}
								<input type="file" accept="image/*" hidden onchange={(e) => onPickPhoto(it, e)} disabled={uploadingFor === it.id} />
							</label>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/each}

	<div class="card insp-grp">
		<div class="insp-grp-head">
			<span class="insp-grp-name">Tube Thickness Readings</span>
		</div>
		<div class="rec-tt-body">
			{#each tubes as t (t.id)}
				<div class="tt-row">
					<span class="tt-loc">{t.location}</span>
					<span class="tt-val">{t.reading_mm} mm</span>
					<span class="tt-min">{t.minimum_mm ? `min ${t.minimum_mm} mm` : ''}</span>
					<button class="adm-link danger" onclick={() => removeTube(t.id)}>Remove</button>
				</div>
			{/each}
			<div class="tt-add">
				<input placeholder="Location, e.g. Gasifier 7, Tube F5 Left" bind:value={newTube.location} />
				<input type="number" step="any" placeholder="Reading (mm)" bind:value={newTube.reading_mm} />
				<input type="number" step="any" placeholder="Minimum (mm)" bind:value={newTube.minimum_mm} />
				<button class="adm-link" onclick={addTube}>+ Add</button>
			</div>
		</div>
	</div>

	<div class="rec-footer">
		<span class="rec-footer-status">
			{totals.attention} needing attention, {totals.pending} not yet assessed.
		</span>
		<div class="rec-footer-actions">
			<button class="btn-ghost" onclick={onclose}>Close</button>
			<button class="btn-primary" onclick={complete} disabled={busy || insp.status === 'complete'}>
				{insp.status === 'complete' ? 'Already complete' : busy ? 'Saving...' : 'Mark Complete'}
			</button>
		</div>
	</div>
</div>

<style>
	.rec { display: flex; flex-direction: column; gap: 12px; }

	.rec-head { padding: 16px 18px; }
	.rec-head-row { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
	.rec-head-row label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--bme-muted); }
	.rec-head-row input { padding: 7px 10px; }
	.rec-progress { margin-left: auto; text-align: right; }
	.rec-progress-n { display: block; font-size: 18px; font-weight: 700; color: var(--bme-dark-blue); }
	.rec-progress-l { font-size: 11px; color: var(--bme-muted); }

	.rec-summary { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; font-size: 12px; color: var(--bme-muted); }
	.rec-summary textarea {
		width: 100%; padding: 9px 11px; border: 1px solid var(--bme-border); border-radius: 8px;
		background: var(--bme-surface); color: var(--bme-ink); font: inherit; font-size: 13.5px; resize: vertical;
	}

	.insp-grp { padding: 0; overflow: hidden; }
	.insp-grp-head { display: flex; align-items: center; gap: 10px; padding: 11px 16px; background: var(--bme-surface-2); border-bottom: 1px solid var(--bme-border); }
	.insp-code { width: 22px; height: 22px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 5px; background: var(--bme-dark-blue); color: #fff; font-size: 11.5px; font-weight: 700; }
	.insp-grp-name { flex: 1; font-size: 13.5px; font-weight: 700; color: var(--bme-ink); }
	.insp-cat { font-size: 11px; color: var(--bme-muted); text-transform: uppercase; letter-spacing: 0.03em; }

	.rec-items { list-style: none; margin: 0; padding: 0; }
	.rec-items li { padding: 10px 16px; border-bottom: 1px solid var(--bme-border); }
	.rec-items li:last-child { border-bottom: none; }

	.rec-item-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.rec-item-label { flex: 1; min-width: 200px; font-size: 13px; color: var(--bme-ink); }

	.rec-btns { display: inline-flex; border: 1px solid var(--bme-border); border-radius: 999px; overflow: hidden; flex: 0 0 auto; }
	.rec-btn {
		padding: 5px 12px; border: none; background: var(--bme-surface); color: var(--bme-muted);
		font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer;
		border-right: 1px solid var(--bme-border);
	}
	.rec-btn:last-child { border-right: none; }
	.rec-btn.ok.active { background: var(--bme-green); color: #fff; }
	.rec-btn.attention.active { background: var(--bme-red); color: #fff; }
	.rec-btn.na.active { background: var(--bme-muted); color: #fff; }

	.rec-item-detail { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding-left: 0; }
	.rec-note {
		flex: 1; padding: 6px 10px; border: 1px solid var(--bme-border); border-radius: 6px;
		background: var(--bme-surface); color: var(--bme-ink); font: inherit; font-size: 12.5px;
	}
	.rec-photo-btn {
		flex: 0 0 auto; font-size: 12px; color: var(--bme-dark-blue); cursor: pointer; white-space: nowrap;
	}

	.rec-tt-body { padding: 12px 16px; }
	.tt-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--bme-border); }
	.tt-loc { flex: 1; font-size: 13px; color: var(--bme-ink); }
	.tt-val { font-size: 13px; font-weight: 700; color: var(--bme-ink); }
	.tt-min { font-size: 11.5px; color: var(--bme-muted); }
	.tt-add { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
	.tt-add input { flex: 1; min-width: 140px; padding: 7px 10px; }

	.rec-footer {
		position: sticky; bottom: 0;
		display: flex; align-items: center; justify-content: space-between; gap: 16px;
		padding: 12px 18px; margin-top: 4px;
		background: var(--bme-surface); border: 1px solid var(--bme-border); border-radius: 10px;
		flex-wrap: wrap;
	}
	.rec-footer-status { font-size: 12.5px; color: var(--bme-muted); }
	.rec-footer-actions { display: flex; gap: 10px; }
</style>