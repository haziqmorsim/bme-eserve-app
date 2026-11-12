<script lang="ts">
    let {
        createdAt,
        acknowledgedAt = null,
        closedAt = null,
        message = null
    }: {
        createdAt: string;
        acknowledgedAt?: string | null;
        closedAt?: string | null;
        message?: string | null;
    } = $props();

    type State = 'done' | 'current' | 'todo' | 'skipped';
    type Step = { key: string; label: string; at: string | null; state: State };

    function fmt(ts: string | null): string {
        return ts ? new Date(ts).toLocaleString() : '';
    }

    let steps = $derived.by<Step[]>(() => {
        const closed = !!closedAt;
        return [
            { key: 'submitted', label: 'Submitted', at: createdAt, state: 'done' },
            { key: 'review', label: 'In review', at: createdAt, state: acknowledgedAt ? (closed ? 'done' : 'current') : closed ? 'skipped' : 'todo' },
            { key: 'closed', label: 'Closed', at: createdAt, state: closed ? 'done' : 'todo' }
        ];
    });

    let note = $derived((message ?? '').trim());
</script>

<div class="timeline">
    <ol aria-label="Request progress">
        {#each steps as s (s.key)}
            <li class={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
                <span class="dot" aria-hidden="true">
                    {#if s.state === 'done'}&#10003;{:else if s.state === 'skipped'}&ndash;{/if}
                </span>
                <span class="label">{s.label}</span>
                {#if s.at}
                    <time datetime={s.at} class="at">{fmt(s.at)}</time>
                {:else if s.state === 'skipped'}
                    <span class="at">Not needed</span>
                {/if}
            </li>
        {/each}
    </ol>

    {#if closedAt && note}
        <div class="message">
            <span class="message-title">Message from BME</span>
            <p>{note}</p>
        </div>
    {/if}
</div>

<style>
    .timeline {
        margin: 4px 0 14px;
    }

    ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: flex-start;
    }

    li {
        position: relative;
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 4px;
        min-width: 0;
    }

    li + li::before {
        content: '';
        position: absolute;
        top: 11px;
        right: 50%;
        width: 100%;
        height: 2px;
        background: var(--bme-border);
        z-index: 0;
    }

    li.done + li::before,
    li.current + li::before {
        background: var(--bme-dark-blue);
    }

    li.done + li.todo::before,
    li.done + li.skipped::before {
        background: var(--bme-border);
    }

    .dot {
        position: relative;
        z-index: 1;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        background: var(--bme-surface);
        border: 2px solid var(--bme-border);
        color: var(--bme-muted);
        box-sizing: border-box;
    }

    li.done .dot {
        background: var(--bme-dark-blue);
        border-color: var(--bme-dark-blue);
        color: #fff;
    }

    li.current .dot {
        border-color: var(--bme-dark-blue);
        box-shadow: 0 0 0 3px rgba(0, 75, 141, 0.18);
    }

    li.current .dot::after {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--bme-dark-blue);
    }

    .label {
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
    }

    li.todo .label,
    li.skipped .label {
        color: var(--bme-muted);
        font-weight: 500;
    }

    .at {
        font-size: 12px;
        color: var(--bme-muted);
        font-style: normal;
    }

    .message {
        margin-top: 14px;
        padding: 10px 14px;
        background: var(--bme-surface-2);
        border: 1px solid var(--bme-border);
        border-left: 4px solid var(--bme-dark-blue);
        border-radius: 6px;
    }

    .message-title {
        display: block;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--bme-dark-blue);
        margin-bottom: 4px;
    }

    .message p {
        margin: 0;
        font-size: 14px;
        color: var(--bme-ink);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    @media (max-width: 480px) {
        .label {
            font-size: 12px;
        }

        .at {
            font-size: 11px;
        }
    }
</style>