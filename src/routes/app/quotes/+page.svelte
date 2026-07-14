<script lang="ts">
    import { quoteItems, removeItem, setQuantity, clearCart } from "$lib/stores/quote";
    import { formatMoney } from "$lib/price";
    import { normaliseCode } from "$lib/coupon";
    import { invalidateAll } from "$app/navigation";

    let { data } = $props();
    let notes = $state('');
    let submitting = $state(false);
    let done = $state(false);
    let errorMsg = $state('');

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
            couponErr = 'This coupon code is not valid for your account.';
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

        const { data: quote, error: qErr } = await supabase
            .from('quotes')
            .insert({
                user_id: userId, 
                notes, 
                coupon_code: appliedCoupon?.code ?? null, 
                discount_percent: discountPercent
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
    }
</script>

<h1>Quote List</h1>

{#if done}
    <div class="card success">
        <h2>Request submitted</h2>
        <p>
            Your quotation request has been sent. Once it is approved, 
            you will receive a confirmation e-mail with the quotation attached as a PDF.
        </p>
        <a href="/app" class="btn-primary">Back to Boilers</a>
    </div>
{:else if $quoteItems.length === 0}
    <div class="card empty">
        <p>Your quote list is empty. Browse a boiler's parts tab to add components.</p>
        <a href="/app" class="btn-ghost">Browse Boilers</a>
    </div>
{:else}
    <div class="card list">
        <div class="row head">
            <span>Part</span><span>Boiler</span><span>Quantity</span><span>Unit Price</span><span>Amount</span><span></span>
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
                <span class="unit">{unitLabel(item)}</span>
                <span class="range">{lineAmount(item)}</span>
                <span><button class="remove" onclick={() => removeItem(item.partId)} aria-label="Remove">✕</button></span>
            </div>
        {/each}

        <div class="coupon">
            <label class="coupon-label" for="coupon-code">Discount coupon</label>
            <div class="coupon-row">
                <input
                    id="coupon-code"
                    type="text"
                    placeholder="Enter coupon code (e.g. BME5-XXXXXX)"
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
        </div>

        <div class="subtotal">
            <span>Subtotal</span>
            <span>RM{formatMoney(subtotal)}</span>
        </div>
        {#if discountPercent > 0}
            <div class="subtotal discount">
                <span>Discount ({discountPercent}%)</span>
                <span>&minus;RM{formatMoney(discountAmount)}</span>
            </div>
        {/if}

        <div class="total">
            <span>Total</span>
            <strong>RM{formatMoney(total)}</strong>
        </div>
        <p class="indicative">Prices are indicative. The final quotation will be confirmed by BME.</p>
    </div>

    <div class="card notes">
        <label>
            <span>Notes (optional)</span>
            <textarea rows="3" bind:value={notes} placeholder="Delivery site, urgency, reference PO..."></textarea>
        </label>
    </div>

    {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

    <button class="btn-primary submit" onclick={submitQuote} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Get a Quotation'}
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
        grid-template-columns: 2.2fr 0.9fr 0.8fr 1fr 1.2fr 40px;
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

    .unit {
        color: var(--bme-ink);
    }

    .range {
        font-weight: 600;
        color: var(--bme-darker-blue);
    }

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

    .coupon {
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
        background: #ffffff;
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
    }

    .subtotal {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        color: var(--bme-ink);
        font-size: 14.5px;
    }

    .subtotal.discount {
        color: var(--bme-green);
        font-weight: 600;
    }

    .total {
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
    }

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
            grid-template-columns: 1fr;
            gap: 4px;
            position: relative;
            padding-right: 28px;
        }
 
        .row.head { 
            display: none; 
        }
 
        .row > span:last-child {
            position: absolute;
            top: 10px;
            right: 0;
        }
 
        .total { 
            flex-direction: column; 
            align-items: flex-start; 
            gap: 4px; 
            font-size: 16px; 
        }

        .indicative, span { 
            text-align: left; 
        }
    }
</style>