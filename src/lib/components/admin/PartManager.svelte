<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { addToast } from '$lib/stores/toast';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import Modal from './Modal.svelte';
	import Pagination from './Pagination.svelte';
	import { Plus } from '@lucide/svelte';
	import { page as pageStore } from '$app/stores';
	import { toMap, num } from '$lib/settings';

	let { parts, components, boilers, supabase } = $props<{
		parts: any[];
		components: any[];
		boilers: any[];
		supabase: SupabaseClient;
	}>();

	let lowStockThreshold = $derived(
		num(toMap(($pageStore.data as any)?.settings), 'low_stock_threshold', 5)
	);

	const pageSize = 20;
	let search = $state('');
	let page = $state(1);
	let editing = $state<string | 'new' | null>(null);
	let deleting = $state<any | null>(null);
	let busy = $state(false);
	let err = $state('');
	let form = $state<any>({});
	let fieldErr = $state<Record<string, string>>({});
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	let boilerCode = $derived(
		Object.fromEntries(boilers.map((b: any) => [b.id, b.code])) as Record<string, string>
	);
	let formComponents = $derived(
		components
			.filter((c: any) => c.boiler_id === form.boiler_id)
			.sort((a: any, b: any) => {
				const au = (a.name ?? '') === 'Panel/Instrument' ? 1 : 0;
				const bu = (b.name ?? '') === 'Panel/Instrument' ? 1 : 0;
				if (au !== bu) return au - bu;
				return (a.name ?? '').localeCompare(b.name ?? '');
			})
	);

	let filtered = $derived(
		parts.filter((p: any) => {
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return [p.part_number, p.name, p.components?.name, boilerCode[p.components?.boiler_id]].some(
				(v: any) => (v ?? '').toString().toLowerCase().includes(q)
			);
		})
	);
	let total = $derived(filtered.length);
	let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	let curPage = $derived(Math.min(page, pages));
	let paged = $derived(filtered.slice((curPage - 1) * pageSize, curPage * pageSize));

	$effect(() => {
		search;
		page = 1;
	});

	function blank() {
		return {
			boiler_id: '',
			component_id: '',
			part_number: '',
			name: '',
			description: '',
			price: '',
			image_url: '',
			stock_quantity: 0
		};
	}
	function startNew() {
		form = blank();
		form.component_id = '';
		err = '';
		fieldErr = {};
		editing = 'new';
	}
	function startEdit(p: any) {
		form = {
			boiler_id: p.components?.boiler_id ?? '',
			component_id: p.component_id,
			part_number: p.part_number,
			name: p.name,
			description: p.description ?? '',
			price: p.price ?? '',
			image_url: p.image_url ?? '',
			stock_quantity: p.stock_quantity ?? 0
		};
		err = '';
		fieldErr = {};
		editing = p.id;
	}
	function cancel() {
		editing = null;
		err = '';
		fieldErr = {};
	}
	function onBoilerChange() {
		form.component_id = '';
	}

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!form.boiler_id) e.boiler_id = 'Boiler is required.';
		if (!form.component_id) e.component_id = 'Component is required.';
		if (!form.part_number?.toString().trim()) e.part_number = 'Part number is required.';
		if (!form.name?.toString().trim()) e.name = 'Part name is required.';
		if (form.price === '' || form.price === null || form.price === undefined) {
			e.price = 'Price is required.';
		} else {
			const p = Number(form.price);
			if (isNaN(p) || p < 0) e.price = 'Price must be a valid non-negative number.';
		}
		if (!form.image_url) e.image_url = 'Part image is required.';
		fieldErr = e;
		return Object.keys(e).length === 0;
	}

	async function save() {
		if (!validate()) return;
		const price = Number(form.price);
		const qty = Math.max(0, Number(form.stock_quantity) || 0);

		busy = true;
		err = '';
		const payload = {
			component_id: form.component_id,
			part_number: form.part_number.trim(),
			name: form.name.trim(),
			description: form.description || null,
			price,
			price_min: price,
			price_max: price,
			image_url: form.image_url || null,
			stock_quantity: qty,
			in_stock: qty > 0
		};
		const resp =
			editing === 'new'
				? await supabase.from('parts').insert(payload)
				: await supabase.from('parts').update(payload).eq('id', editing);
		busy = false;
		if (resp.error) {
			err = resp.error.message;
			return;
		}
		addToast(editing === 'new' ? 'Part added successfully' : 'Part updated successfully');
		editing = null;
		await invalidateAll();
	}

	async function confirmDelete() {
		busy = true;
		const { error } = await supabase.from('parts').delete().eq('id', deleting.id);
		busy = false;
		if (error) {
			err = error.message;
			return;
		}
		addToast('Part deleted successfully');
		deleting = null;
		await invalidateAll();
	}

	async function onPickImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			err = 'Please select an image file.';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			err = 'Image must be 5 MB or smaller.';
			return;
		}

		uploading = true;
		err = '';
		const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
		const path = `parts/${crypto.randomUUID()}.${ext}`;
		const { error: upErr } = await supabase.storage.from('part-images').upload(path, file, {
			cacheControl: '3600',
			upsert: false,
			contentType: file.type
		});
		if (upErr) {
			uploading = false;
			err = upErr.message;
			return;
		}
		const { data: pub } = supabase.storage.from('part-images').getPublicUrl(path);
		form.image_url = pub.publicUrl;
		uploading = false;
		input.value = '';
	}

	function removeImage() {
		form.image_url = '';
	}

	function priceCell(p: any) {
		if (p.price != null) return `RM${p.price}`;
		if (p.price_min != null && p.price_max != null) return `RM${p.price_min} – RM${p.price_max}`;
		return '—';
	}
</script>

<div class="adm-bar">
	<input class="adm-search" type="search" placeholder="Search parts..." bind:value={search} />
	<button class="btn-primary" onclick={startNew}>
		<Plus size={16} /> Add Part
	</button>
</div>

<div class="card" style="padding:14px; overflow:hidden;">
	{#if total === 0}
		<div class="adm-empty">No parts found.</div>
	{:else}
		<table class="adm-table">
			<thead>
				<tr
					><th>Part #</th><th>Name</th><th>Boiler</th><th>Component</th
					><!--<th>Price</th><th>Stock</th>--><th>Actions</th></tr
				>
			</thead>
			<tbody>
				{#each paged as p (p.id)}
					<tr>
						<td style="text-align: center; vertical-align: middle;"
							><strong>{p.part_number}</strong></td
						>
						<td style="vertical-align: middle;">{p.name}</td>
						<td style="text-align: center; vertical-align: middle;"
							>{boilerCode[p.components?.boiler_id] ?? '—'}</td
						>
						<td style="text-align: center; vertical-align: middle;">{p.components?.name ?? '—'}</td>
						<!-- <td style="text-align: center; vertical-align: middle;">{priceCell(p)}</td>
                        <td style="text-align: center; vertical-align: middle;">
                            <span class="stock" class:out={p.stock_quantity === 0} class:low={p.stock_quantity > 0 && p.stock_quantity <= lowStockThreshold}>{p.stock_quantity}</span>
                        </td> -->
						<td>
							<div class="adm-actions">
								<button class="adm-link" onclick={() => startEdit(p)}>Edit</button>
								<button class="adm-link danger" onclick={() => (deleting = p)}>Delete</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if total > 0}
	<Pagination {total} page={curPage} {pageSize} onpage={(p) => (page = p)} />
{/if}

{#if editing !== null}
	<Modal title={editing === 'new' ? 'Add Part' : 'Edit Part'} onclose={cancel}>
		<div class="adm-form">
			<label
				>Boiler <span class="required">*</span>
				<select
					bind:value={form.boiler_id}
					onchange={onBoilerChange}
					class:invalid={fieldErr.boiler_id}
				>
					{#each boilers as b (b.id)}<option value={b.id}>{b.code}</option>{/each}
				</select>
				{#if fieldErr.boiler_id}<span class="field-err">{fieldErr.boiler_id}</span>{/if}
			</label>
			<label
				>Component <span class="required">*</span>
				<select bind:value={form.component_id} class:invalid={fieldErr.component_id}>
					{#each formComponents as c (c.id)}
						<option value={c.id}>
							{c.name === 'Panel/Instrument' ? 'Panel/Instrument (no schematic section)' : c.name}
						</option>
					{/each}
				</select>
				{#if fieldErr.component_id}<span class="field-err">{fieldErr.component_id}</span>{/if}
			</label>
			<label
				>Part Number <span class="required">*</span><input
					bind:value={form.part_number}
					placeholder="PB130-TB-001"
					class:invalid={fieldErr.part_number}
				/>
				{#if fieldErr.part_number}<span class="field-err">{fieldErr.part_number}</span>{/if}
			</label>
			<label
				>Part Name <span class="required">*</span><input
					bind:value={form.name}
					class:invalid={fieldErr.name}
				/>
				{#if fieldErr.name}<span class="field-err">{fieldErr.name}</span>{/if}
			</label>
			<!-- <label>Price (RM) <span class="required">*</span><input type="number" min="0" step="0.01" bind:value={form.price} class:invalid={fieldErr.price} />
                {#if fieldErr.price}<span class="field-err">{fieldErr.price}</span>{/if}
            </label>
            <label><span>Quantity In Stock</span><input type="number" min="0" bind:value={form.stock_quantity} /></label> -->
			<label class="full"
				>Description<textarea rows="2" bind:value={form.description}></textarea></label
			>
			<div class="full img-field">
				<span class="img-label">Part Image <span class="required">*</span></span>
				<div class="img-row">
					<div class="img-preview" class:invalid={fieldErr.image_url}>
						{#if form.image_url}
							<img src={form.image_url} alt="Part preview" />
						{:else}
							<span class="img-empty">No image</span>
						{/if}
					</div>
					<div class="img-actions">
						<input
							type="file"
							accept="image/*"
							bind:this={fileInput}
							onchange={onPickImage}
							style="display:none"
						/>
						<button
							type="button"
							class="btn-ghost"
							onclick={() => fileInput?.click()}
							disabled={uploading}
						>
							{uploading ? 'Uploading...' : form.image_url ? 'Replace Image' : 'Upload Image'}
						</button>
						{#if form.image_url}
							<button
								type="button"
								class="btn-ghost danger"
								onclick={removeImage}
								disabled={uploading}>Remove Image</button
							>
						{/if}
					</div>
				</div>
				{#if fieldErr.image_url}<span class="field-err">{fieldErr.image_url}</span>{/if}
			</div>
			{#if err}<p class="adm-err">{err}</p>{/if}
			<div class="adm-form-actions">
				<button class="btn-ghost" onclick={cancel} disabled={busy}>Cancel</button>
				<button class="btn-primary" onclick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
			</div>
		</div>
	</Modal>
{/if}

{#if deleting}
	<Modal title="Delete Part" onclose={() => (deleting = null)}>
		<div class="modal-confirm">
			<p>Are you sure you want to delete part <strong>{deleting.part_number}</strong>?</p>
			{#if err}<p class="adm-err">{err}</p>{/if}
			<div class="modal-actions">
				<button class="btn-ghost" onclick={() => (deleting = null)} disabled={busy}>Cancel</button>
				<button class="btn-danger" onclick={confirmDelete} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button>
			</div>
		</div>
	</Modal>
{/if}

<style>
	/*.stock.low {
        color: #97700a;
        font-weight: 700;
    }

    .stock.out {
        color: #8e261b;
        font-weight: 700;
    }*/

	.adm-bar .btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.img-preview.invalid {
		border-color: var(--bme-red);
	}

	.img-field {
		margin-top: 4px;
	}

	.img-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--bme-ink);
		margin-bottom: 6px;
	}

	.img-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.img-preview {
		width: 72px;
		height: 72px;
		border: 1px solid var(--bme-border);
		border-radius: 10px;
		overflow: hidden;
		background: var(--bme-surface-2);
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}

	.img-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.img-empty {
		font-size: 11px;
		color: var(--bme-muted);
	}

	.img-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
</style>
