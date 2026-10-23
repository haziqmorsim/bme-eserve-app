<script lang="ts">
    let {
        value,
        label,
        hint = '',
        color = 'var(--seq)'
    }: {
        value: number | null;
        label: string;
        hint?: string;
        color?: string;
    } = $props();

    const R = 42;
    const C = 2 * Math.PI * R;
    let pct = $derived(value === null ? 0 : Math.max(0, Math.min(100, value)));
</script>

<div class="gauge">
    <svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label="{label}: {value === null ? 'no data' : `${value}%`}">
        <circle cx="55" cy="55" r={R} class="track" />
        {#if value !== null && pct > 0}
            <circle
                cx="55"
                cy="55"
                r={R}
                fill="none"
                stroke={color}
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="{(pct / 100) * C} {C}"
                transform="rotate(-90 55 55)"
            />
        {/if}
        <text x="55" y="61" text-anchor="middle" class="val">{value === null ? '—' : `${value}%`}</text>
    </svg>
    <span class="lbl">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
    .gauge {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 4px;
        min-width: 0;
    }

    .track {
        fill: none;
        stroke: var(--bme-surface-2);
        stroke-width: 10;
    }

    .val {
        font-size: 20px;
        font-weight: 700;
        fill: var(--bme-ink);
    }

    .lbl {
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .hint {
        font-size: 11.5px;
        color: var(--bme-muted);
        max-width: 160px;
    }
</style>