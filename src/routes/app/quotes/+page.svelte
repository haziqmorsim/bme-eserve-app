<script lang="ts">
    import { quoteItems, removeItem, setQuantity, clearCart } from "$lib/stores/quote";
    import { formatMoney } from "$lib/price";
    import { normaliseCode } from "$lib/coupon";
    import { invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/stores/toast";

    let { data } = $props();
    let notes = $state('');
    let submitting = $state(false);
    let done = $state(false);
    let errorMsg = $state('');

    let attachments = $state<File[]>([]);
    let attachErr = $state('');
    let fileInput = $state<HTMLInputElement | undefined>();

    const MAX_ATTACH = 10 * 1024 * 1024; // 10 MB total
    const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt'];

    function extOf(name: string): string {
        const i = name.lastIndexOf('.');
        return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
    }

    let attachTotal = $derived(attachments.reduce((n, f) => n + f.size, 0));

    function onFilePick(e: Event) {
        attachErr = '';
        const input = e.currentTarget as HTMLInputElement;
        const picked = Array.from(input.files ?? []);
        input.value = ''; // reset so the same file can be re-picked / more added
        if (picked.length === 0) return;

        const next = [...attachments];
        for (const f of picked) {
            if (!ALLOWED_EXT.includes(extOf(f.name))) {
                attachErr = `"${f.name}" is not an allowed file type.`;
                continue;
            }
            // Skip exact duplicates (same name + size).
            if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
            next.push(f);
        }

        const total = next.reduce((n, f) => n + f.size, 0);
        if (total > MAX_ATTACH) {
            attachErr = 'Total attachment size exceeds 10 MB.';
            return;
        }
        attachments = next;
    }

    function removeAttachment(idx: number) {
        attachments = attachments.filter((_, i) => i !== idx);
        attachErr = '';
    }

    function fileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function unitPrice(i: any): number {
        return i.price ?? i.priceMin ?? 0;
    }

    let subtotal = $derived($quoteItems.reduce((s, i) => s + unitPrice(i) * i.quantity, 0));

    let couponInput = $state('');
    let appliedCoupon = $state<{ code: string; percent: number } | null>(null);
    let couponErr = $state('');

    let earned = $derived(data.coupons ?? []);
    let available = $derived(earned.filter((c: any) => !c.used));
    let allCouponsUsed = $derived(earned.length > 0 && available.length === 0);
    let couponsLocked = $derived(allCouponsUsed || !!appliedCoupon);

    let discountPercent = $derived(appliedCoupon?.percent ?? 0);
    let discountAmount = $derived(Math.round(subtotal * (discountPercent / 100) * 100) / 100);
    let total = $derived(subtotal - discountAmount);

    function applyCoupon() {
        couponErr = '';
        if (allCouponsUsed) return;

        const code = normaliseCode(couponInput);
        if (!code) {
            couponErr = 'Enter a coupon code.';
            return;
        }
        const match = earned.find((c: any) => c.code === code);
        if (!match) {
            couponErr = 'This coupon code is invalid.';
            return;
        }
        if (match.used) {
            couponErr = 'The discount coupon has been used.';
            return;
        }
        appliedCoupon = { code: match.code, percent: match.percent };
    }

    function removeCoupon() {
        appliedCoupon = null;
        couponInput = '';
        couponErr = '';
    }

    function unitLabel(i: any) {
        const up = unitPrice(i);
        if (!up) return 'Price on request';
        return `RM${formatMoney(up)}`;
    }

    function lineAmount(i: any) {
        const up = unitPrice(i);
        if (!up) return 'Price on request';
        return `RM${formatMoney(up * i.quantity)}`;
    }

    async function submitQuote() {
        if ($quoteItems.length === 0) return;
        submitting = true;
        errorMsg = '';

        const supabase = data.supabase;
        const userId = data.user?.id;

        const uploaded: { url: string; name: string }[] = [];
        for (const file of attachments) {
            const safe = file.name.replace(/[^\w.\-]+/g, '_');
            const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
            const { error: upErr } = await supabase.storage
                .from('quote-attachments')
                .upload(path, file, { upsert: false });
            if (upErr) {
                errorMsg = 'Could not upload the attachment(s). Please try again.';
                submitting = false;
                return;
            }
            const { data: signed } = await supabase.storage
                .from('quote-attachments')
                .createSignedUrl(path, 60 * 60 * 24 * 365);
            uploaded.push({ url: signed?.signedUrl ?? path, name: file.name });
        }

        const { data: quote, error: qErr } = await supabase
            .from('quotes')
            .insert({
                user_id: userId, 
                notes, 
                coupon_code: appliedCoupon?.code ?? null, 
                discount_percent: discountPercent, 
                attachments: uploaded
            })
            .select()
            .single();

        if (qErr || !quote) {
            if ((qErr as any)?.code === '23505') {
                errorMsg = 'The discount coupon has been used.';
                appliedCoupon = null;
                await invalidateAll();
            } else {
                errorMsg = 'Could not create the quotation. Please try again.';
            }
            submitting = false;
            return;
        }

        const items = $quoteItems.map((i) => ({
            quote_id: quote.id,
            part_id: i.partId,
            boiler_code: i.boilerCode,
            part_number: i.partNumber,
            part_name: i.partName,
            quantity: i.quantity,
            unit_price: unitPrice(i)
        }));
        const { error: iErr } = await supabase
            .from('quote_items')
            .insert(items);
        if (iErr) {
            errorMsg = 'Could not save quote items. Please try again.';
            submitting = false;
            return;
        }

        await supabase.functions.invoke('notify-admin', { body: { quote_id: quote.id } });

        clearCart();
        done = true;
        submitting = false;

        addToast('Request submitted successfully.')
    }
</script>

<h1>Cart List</h1>

{#if done}
    <div class="card success">
        <h2>Request submitted</h2>
        <p>Your request has been sent. Our staff at Boilermech will get back to you.</p>
        <a href="/app" class="btn-primary">Back to Boilers</a>
    </div>
{:else if $quoteItems.length === 0}
    <div class="card empty">
        <p>Your cart list is empty. Browse a boiler's parts tab to add components.</p>
        <a href="/app" class="btn-ghost">Browse Boilers</a>
    </div>
{:else}
    <div class="card list">
        <div class="row head">
            <span>Part</span><span>Boiler</span><span>Quantity</span><!--<span>Unit Price</span><span>Amount</span>--><span></span>
        </div>    
        {#each $quoteItems as item (item.partId)}
            <div class="row">
                <span class="left">
                    <strong>{item.partNumber}</strong><br /><small>{item.partName}</small>
                </span>
                <span>{item.boilerCode}</span>
                <span>
                    <input type="number" min="1" value={item.quantity} oninput={(e) => setQuantity(item.partId, + e.currentTarget.value)} />
                </span>
                <!-- <span class="unit">{unitLabel(item)}</span>
                <span class="range">{lineAmount(item)}</span> -->
                <span><button class="remove" onclick={() => removeItem(item.partId)} aria-label="Remove">✕</button></span>
            </div>
        {/each}

        <!-- <div class="coupon">
            <label class="coupon-label" for="coupon-code">Discount coupon</label>
            <div class="coupon-row">
                <input
                    id="coupon-code"
                    type="text"
                    placeholder="Enter coupon code..."
                    bind:value={couponInput}
                    disabled={couponsLocked}
                    class:invalid={couponErr}
                    onkeydown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                />
                {#if appliedCoupon}
                    <button class="coupon-btn ghost" onclick={removeCoupon}>Remove</button>
                {:else}
                    <button class="coupon-btn" onclick={applyCoupon} disabled={allCouponsUsed}>Apply</button>
                {/if}
            </div>
            {#if allCouponsUsed}
                <span class="coupon-used">The discount coupon has been used.</span>
            {/if}
            {#if couponErr}<span class="coupon-err">{couponErr}</span>{/if}
            {#if appliedCoupon}
                <span class="coupon-ok">Coupon {appliedCoupon.code} applied — {appliedCoupon.percent}% off.</span>
            {/if}
        </div> -->

        <!-- <div class="subtotal">
            <span>Subtotal</span>
            <span>RM{formatMoney(subtotal)}</span>
        </div>
        {#if discountPercent > 0}
            <div class="subtotal discount">
                <span>Discount ({discountPercent}%)</span>
                <span>&minus;RM{formatMoney(discountAmount)}</span>
            </div>
        {/if} -->

        <!-- <div class="total">
            <span>Total</span>
            <strong>RM{formatMoney(total)}</strong>
        </div>
        <p class="indicative">Prices are indicative. The final quotation will be confirmed by Boilermech.</p> -->
    </div>

    <div class="card notes">
        <label>
            <span>Notes (optional)</span>
            <textarea rows="3" bind:value={notes} placeholder="Delivery site, urgency, reference PO..."></textarea>
        </label>

        <div class="attach">
            <span class="attach-label">Attachments (optional)</span>
            <input
                class="attach-input"
                type="file"
                multiple
                bind:this={fileInput}
                onchange={onFilePick}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.csv,.txt"
            />
            {#if attachments.length}
                <div class="attach-list">
                    {#each attachments as f, i (f.name + f.size)}
                        <div class="attach-file">
                            <span class="attach-name">{f.name}</span>
                            <span class="attach-size">{fileSize(f.size)}</span>
                            <button type="button" class="attach-remove" onclick={() => removeAttachment(i)} aria-label="Remove {f.name}">Remove</button>
                        </div>
                    {/each}
                    <div class="attach-total">Total: {fileSize(attachTotal)} of 10 MB</div>
                </div>
            {/if}
            {#if attachErr}<span class="attach-err">{attachErr}</span>{/if}
            <span class="attach-hint">Max total files size: 10 MB. Supported file types: .pdf, .doc, .docx, .csv, .xls, .xlsx, .png, .jpg, .jpeg, .webp, .txt</span>
        </div>
    </div>

    {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

    <button class="btn-primary submit" onclick={submitQuote} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit'}
    </button>
{/if}

<style>
    h1 {
        margin: 5px 0 15px;
    }

    .list {
        padding: 8px 18px 18px;
        margin-bottom: 18px;
    }

    .row {
        display: grid;
        grid-template-columns: 2fr 0.9fr 0.8fr /* 1fr 1.2fr */ 40px;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid var(--bme-border);
    }

    .row.head {
        font-size: 12px; 
        text-transform: uppercase; 
        color: var(--bme-muted); 
        font-weight: 700;
    }

    .row input {
        width: 70px;
        text-align: center;
    }

    /* .unit {
        color: var(--bme-ink);
    }

    .range {
        font-weight: 600;
        color: var(--bme-darker-blue);
    } */

    .remove {
        background: none; 
        color: var(--bme-muted); 
        font-size: 16px; 
        padding: 4px 8px;
    }

    .remove:hover {
        color: var(--bme-red);
    }

    span {
        text-align: center;
    }

    .left {
        text-align: left;
    }

    /* .coupon {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 16px 0 4px;
        border-top: 1px solid var(--bme-border);
    }

    .coupon-label {
        font-weight: 600;
        font-size: 14px;
        color: var(--bme-ink);
    }

    .coupon-row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .coupon-row input {
        flex: 1;
        min-width: 220px;
        padding: 9px 12px;
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        text-transform: uppercase;
    }

    .coupon-row input::placeholder {
        text-transform: none;
    }

    .coupon-row input.invalid {
        border-color: var(--bme-red);
    }

    .coupon-row input:disabled {
        background: var(--bme-mint);
        color: var(--bme-ink);
    }

    .coupon-btn {
        font-family: inherit;
        cursor: pointer;
        border: 1px solid var(--bme-dark-blue);
        background: var(--bme-dark-blue);
        color: #ffffff;
        border-radius: 8px;
        font-weight: 600;
        padding: 9px 18px;
    }

    .coupon-btn.ghost {
        background: var(--bme-surface);
        color: var(--bme-dark-blue);
    }

    .coupon-btn:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .coupon-used {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-muted);
    }

    .coupon-err {
        font-size: 12.5px;
        font-weight: 600;
        text-align: left;
        color: var(--bme-red);
    }

    .coupon-ok {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-green);
    } */

    /* .subtotal {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        color: var(--bme-ink);
        font-size: 14.5px;
    } */

    /* .subtotal.discount {
        color: var(--bme-green);
        font-weight: 600;
    } */

    /* .total {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding-top: 18px;
        font-size: 18px;
    }

    .total strong {
        color: var(--bme-darker-blue);
    }

    .indicative {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--bme-muted);
        text-align: right;
    } */

    .notes { 
        padding: 18px; 
        margin-bottom: 18px;
    }

    .notes label span { 
        display: block; 
        font-weight: 600; 
        margin-bottom: 8px; 
        text-align: left;
    }

    .attach {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .attach-label {
        font-weight: 600;
        text-align: left;
    }

    .attach-input {
        font: inherit;
        max-width: 100%;
    }

    .attach-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .attach-file {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        padding: 8px 12px;
        background: var(--bme-sky);
        border-radius: 8px;
    }

    .attach-total {
        font-size: 12px;
        font-weight: 600;
        color: var(--bme-muted);
        text-align: left;
    }

    .attach-name {
        font-weight: 600;
        color: var(--bme-ink);
        word-break: break-all;
        text-align: left;
    }

    .attach-size {
        font-size: 12px;
        color: var(--bme-muted);
    }

    .attach-remove {
        margin-left: auto;
        background: none;
        border: none;
        color: var(--bme-red);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .attach-hint {
        font-size: 12px;
        color: var(--bme-muted);
        text-align: left;
    }

    .attach-err {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-red);
        text-align: left;
    }

    .submit { 
        width: 100%; 
        padding: 14px; 
        font-size: 16px; 
    }

    .success, .empty { 
        padding: 36px; 
        text-align: center; 
    }

    .success p, .empty p { 
        color: var(--bme-muted);
        margin: 12px auto 20px; 
    }

    .err { 
        color: var(--bme-red); 
        margin-bottom: 12px; 
    }

    @media (max-width: 720px) {
        .row {
            grid-template-columns: 1fr auto;
            gap: 4px 12px;
            position: relative;
            padding-right: 28px;
        }
 
        .row.head { 
            display: none; 
        }

        .row .left {
            grid-column: 1 / -1;
        }

        .row > span:nth-child(2) {
            grid-column: 1 / -1;
            text-align: left;
        }

        .row > span:nth-child(3) {
            grid-column: 1;
            justify-self: start;
        }

        /* .row .unit {
            grid-column: 2;
            justify-self: end;
            text-align: right;
        }

        .row .range {
            grid-column: 1 / -1;
            text-align: right;
        } */
 
        .row > span:last-child {
            position: absolute;
            top: 10px;
            right: 0;
        }

        /* .total { 
            flex-direction: row; 
            justify-content: space-between; 
            align-items: baseline; 
            font-size: 16px; 
        }

        .indicative { 
            text-align: left; 
        } */
    }
</style>