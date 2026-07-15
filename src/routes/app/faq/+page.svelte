<script lang="ts">
    import { ChevronDown } from "@lucide/svelte";

    let { data } = $props();

    let open = $state<number | null>(null);

    function toggle(i: number) {
        open = open === i ? null : i;
    }
</script>

<h1>Frequently Asked Questions</h1>
<p class="intro">Answers to the questions we are asked most about BME e-Serve App.</p>

{#if data.faqs.length === 0}
    <div class="card empty">No questions have been published yet.</div>
{:else}
    <div class="faq-list">
        {#each data.faqs as f, i (f.id)}
            <div class="card faq" class:open={open === i}>
                <button class="faq-q" onclick={() => toggle(i)} aria-expanded={open === i}>
                    <span>{f.question}</span>
                    <span class="chev" class:rot={open === i}><ChevronDown size={18} /></span>
                </button>
                {#if open === i}
                    <p class="faq-a">{f.answer}</p>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    h1 {
        margin: 5px 0 6px;
    }

    .intro {
        margin: 0 0 18px;
        color: var(--bme-muted);
        font-size: 14px;
    }

    .empty {
        padding: 36px;
        text-align: center;
        color: var(--bme-muted);
    }

    .faq-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .faq {
        padding: 0;
        overflow: hidden;
        transition: border-color var(--t-fast) var(--ease);
    }

    .faq.open {
        border-color: var(--bme-dark-blue);
    }

    .faq-q {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        background: none;
        border: none;
        font-family: inherit;
        font-size: 15px;
        font-weight: 600;
        color: var(--bme-ink);
        text-align: left;
        cursor: pointer;
    }

    .faq-q:hover {
        color: var(--bme-dark-blue);
    }

    .chev {
        flex: 0 0 auto;
        display: inline-flex;
        color: var(--bme-muted);
        transition: transform var(--t-fast) var(--ease);
    }

    .chev.rot {
        transform: rotate(180deg);
        color: var(--bme-dark-blue);
    }

    .faq-a {
        margin: 0;
        padding: 0 18px 18px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--bme-ink);
    }

    @media (max-width: 640px) {
        .faq-q {
            padding: 14px 16px;
            font-size: 14.5px;
        }

        .faq-a {
            padding: 0 16px 16px;
            font-size:  13.5px;
        }
    }
</style>