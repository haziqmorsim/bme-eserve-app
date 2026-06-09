<script lang="ts">
    import { quoteItems, removeItem, setQuantity, clearCart } from "$lib/stores/quote";

    let { data } = $props();
    let notes = $state('');
    let submitting = $state(false);
    let done = $state(false);
    let errorMsg = $state('');

    async function submitQuote() {
        if ($quoteItems.length === 0) return;
        submitting = true;
        errorMsg = '';

        const supabase = data.supabase;
        const userId = data.user?.id;

        const { data: quote, error: qErr } = await supabase
            .from('quotes')
            .insert({ user_id: userId, notes })
            .select()
            .single();

        if (qErr || !quote) {
            errorMsg = 'Could not create the quotation. Please try again.';
            submitting = false;
            return;
        }

        const items = $quoteItems.map((i) => ({
            quote_id: quote.id,
            part_id: i.partId,
            boiler_code: i.boilerCode,
            part_number: i.partNumber,
            part_name: i.partName,
            quantity: i.quantity
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
            <span>Part</span><span>Boiler</span><span>Quantity</span><span></span>
        </div>    
        {#each $quoteItems as item (item.partId)}
            <div class="row">
                <span>
                    <strong>{item.partNumber}</strong><br /><small>{item.partName}</small>
                </span>
                <span>{item.boilerCode}</span>
                <span>
                    <input type="number" min="1" value={item.quantity} oninput={(e) => setQuantity(item.partId, + e.currentTarget.value)} />
                </span>
                <span><button class="remove" onclick={() => removeItem(item.partId)} aria-label="Remove">✕</button></span>
            </div>
        {/each}
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
        margin-bottom: 18px;
    }

    .list {
        padding: 8px 18px 18px;
        margin-bottom: 18px;
    }

    .row {
        display: grid;
        grid-template-columns: 2.6fr 1.2fr 1fr 40px;
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

    .remove {
        background: none; 
        color: var(--bme-muted); 
        font-size: 16px; 
        padding: 4px 8px;
    }

    .remove:hover {
        color: var(--bme-red);
    }

    .notes { 
        padding: 18px; 
        margin-bottom: 18px; 
    }

    .notes label span { 
        display: block; 
        font-weight: 600; 
        margin-bottom: 8px; 
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
            grid-template-columns: 1fr 1fr; 
        } 
        
        .row.head { 
            display: none; 
        } 
    }
</style>