<script lang="ts">
    let { status, level } = $props<{ status: string; level: number }>();

    const steps = [
        { n: 1, label: 'Admin' },
        { n: 2, label: 'Manager' },
        { n: 3, label: 'Chief Operating Officer' },
    ];

    function stepState(n: number): 'done' | 'active' | 'upcoming' {
        if (status === 'closed') return 'done';
        if (n < level) return 'done';
        if (n === level) return 'active';
        return 'upcoming';
    }

    function stepCaption(n: number): string {
        const s = stepState(n);
        if (s === 'done') return 'Closed';
        if (s === 'active') return 'In Progress';
        return 'Pending';
    }

    const finalState = $derived(status === 'closed' ? 'closed' : 'open');
    const finalLabel = $derived(finalState === 'closed' ? 'Closed' : 'Open');
</script>

<div class="stepper" role="group" aria-label="Request progress">
    {#each steps as s (s.n)}
        <div class="step">
            <div class="step {stepState(s.n)}">
                <div class="dot">{s.n}</div>
            </div>
            <div class="text">
                <div class="lbl">{s.label}</div>
                <div class="cap">{stepCaption(s.n)}</div>
            </div>
        </div>
        <div class="bar {stepState(s.n) === 'done' ? 'done' : ''}"></div>
    {/each}
    <div class="step final {finalState}">
        <div class="dot">4</div>
        <div class="lbl">Outcome</div>
        <div class="cap">{finalLabel}</div>
    </div>
</div>

<style>
    .stepper {
        display: flex;
        align-items: flex-start;
        width: 100%;
        overflow-x: auto;
        padding: 4px 0;
    }

    .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 0 0 auto;
        width: 84px;
        text-align: center;
    }

    .dot {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        background: var(--bme-muted);
        border: 2px solid var(--bme-muted);
    }

    .text { width: 168px; }

    .lbl {
        margin-top: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .cap {
        font-size: 11px;
        color: var(--bme-muted);
    }

    .bar {
        flex: 1 1 auto;
        min-width: 24px;
        height: 3px;
        margin-top: 16px;
        background: var(--bme-border);
        border-radius: 2px;
    }

    .bar.done { 
        background: var(--bme-dark-green); 
    }

    .step.done .dot {
        background: var(--bme-dark-green);
        border-color: var(--bme-dark-green);
    }

    .step.active .dot {
        background: var(--bme-dark-blue);
        border-color: var(--bme-dark-blue);
    }

    .step.active .cap {
        color: var(--bme-dark-blue);
        font-weight: 600;
    }

    .step.final.closed .dot {
        background: var(--bme-dark-green);
        border-color: var(--bme-dark-green);
    }

    .step.upcoming .dot,
    .step.final.open .dot {
        background: var(--bme-surface);
        color: var(--bme-muted);
        border-color: var(--bme-border);
    }
</style>