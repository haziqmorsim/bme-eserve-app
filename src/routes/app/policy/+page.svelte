<script lang="ts">
    let { data } = $props();

    type Block = { type: 'h' | 'p'; text: string };

    function blocks(text: string): Block[] {
        const out: Block[] = [];
        for (const raw of (text ?? '').split(/\n\s*\n/)) {
            const b = raw.trim();
            if (!b) continue;
            const nl = b.indexOf('\n');
            const first = nl === -1 ? b : b.slice(0, nl).trim();
            const rest = nl === -1 ? '' : b.slice(nl + 1).trim();
            if (first.length < 80 && !first.endsWith('.')) {
                out.push({ type: 'h', text: first });
                if (rest) out.push({ type: 'p', text: rest });
            } else {
                out.push({ type: 'p', text: b });
            }
        }
        return out;
    }

    let policyBlocks = $derived(blocks(data.privacyPolicy));
    let termsBlocks = $derived(blocks(data.termsConditions));
</script>

<h1>Privacy Policy &amp; Terms and Conditions</h1>

<div class="card policy">
    <h2>Privacy Policy</h2>
    {#if policyBlocks.length === 0}
        <p class="policy-empty">No privacy policy has been published yet.</p>
    {:else}
        {#each policyBlocks as b, i (i)}
            {#if b.type === 'h'}
                <h3>{b.text}</h3>
            {:else}
                <p>{b.text}</p>
            {/if}
        {/each}
    {/if}

    <h2>Terms and Conditions of Use</h2>
    {#if termsBlocks.length === 0}
        <p class="policy-empty">No terms and conditions have been published yet.</p>
    {:else}
        {#each termsBlocks as b, i (i)}
            {#if b.type === 'h'}
                <h3>{b.text}</h3>
            {:else}
                <p>{b.text}</p>
            {/if}
        {/each}
    {/if}
</div>

<style>
    .policy {
        padding: 0 20px;
    }

    .policy p {
        white-space: pre-line;
    }

    .policy-empty {
        color: var(--bme-muted);
        font-size: 13px;
    }
</style>