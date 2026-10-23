<script lang="ts">
    let {
        steps,
        unit = 'sessions',
        empty = 'No data yet.'
    }: {
        steps: { label: string; value: number }[];
        unit?: string;
        empty?: string;
    } = $props();

    let first = $derived(steps[0]?.value ?? 0);
    const pctOf = (v: number, base: number) => (base ? Math.round((v / base) * 100) : 0);
</script>

{#if first === 0}
    <p class="empty">{empty}</p>
{:else}
    <ol class="funnel">
        {#each steps as s, i (s.label)}
            {#if i > 0}
                <li class="drop" aria-hidden="true">
                    ↓ {steps[i - 1].value ? 100 - pctOf(s.value, steps[i - 1].value) : 0}% dropped off
                </li>
            {/if}
            <li class="step">
                <div class="head">
                    <span class="lbl">{s.label}</span>
                    <span class="num">{s.value} {unit} · {pctOf(s.value, first)}%</span>
                </div>
                <div class="track">
                    <div class="bar" style="width:{Math.max(1.5, pctOf(s.value, first))}%; background:var(--funnel-{Math.min(i + 1, 4)})"></div>
                </div>
            </li>
        {/each}
    </ol>
{/if}

<style>
    .empty {
        margin: 0;
        font-size: 13px;
        color: var(--bme-muted);
    }

    .funnel {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 4px;
        font-size: 13px;
    }

    .lbl {
        font-weight: 600;
        color: var(--bme-ink);
    }

    .num {
        color: var(--bme-muted);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }

    .track {
        height: 16px;
        background: var(--bme-surface-2);
        border-radius: 4px;
        overflow: hidden;
    }

    .bar {
        height: 100%;
        border-radius: 0 4px 4px 0;
    }

    .drop {
        padding: 2px 0 2px 4px;
        font-size: 11.5px;
        color: var(--bme-muted);
    }
</style>