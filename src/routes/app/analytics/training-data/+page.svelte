<script lang="ts">
    import { Undo2 } from "@lucide/svelte";

    let { data } = $props();

    const totalTextLabels = $derived(
        data.stats.labelsFromChat + data.stats.labelsFromEnquiries
    );

    const enquiryProgress = $derived(
        data.stats.enquiriesTotal > 0 
            ? Math.round(
                ((data.stats.enquiriesTotal - data.stats.enquiriesUntagged) / data.stats.enquiriesTotal) * 100
             )
            : 0
    );

    const pct = (n: number, of: number) => (of > 0 ? Math.min(100, (n / of) * 100) : 0);
</script>

<div class="head">
    <h1>Training Data</h1>
    <a href="/app/analytics">
        <button class="btn-primary"><Undo2 size={16} /> Analytics</button>
    </a>
</div>

<p class="intro">
    How many labelled data exists, and how good the current assistant already is. A trained model is only worth building if it beats the baseline below.
</p>

<div class="card baseline">
    <div class="bl-main">
        <span class="bl-label">Current assistant accuracy:</span>
        {#if data.baseline.accuracy === null}
            <span class="bl-none">Not enough resolved suggestions yet.</span>
        {:else}
            <span class="bl-value">{data.baseline.accuracy}%</span>
            <span class="bl-sub">({data.baseline.correct} correct of {data.baseline.resolved} reviewed.)</span>
        {/if}
    </div>
    <p class="bl-note">
        This is the zero-shot baseline, with no training. Any model trained on the data below has to beat it to be worth of deploying.
    </p>
</div>

<h2>Label Sources</h2>
<div class="stats">
    <div class="card stat">
        <span class="s-val">{data.stats.labelsFromChat}</span>
        <span class="s-lbl">From chat</span>
        <span class="s-sub">{data.stats.suggestionsPending} awaiting review of {data.stats.suggestionsTotal}</span>
    </div>
    <div class="card stat">
        <span class="s-val">{data.stats.labelsFromEnquiries}</span>
        <span class="s-lbl">From enquiries</span>
        <span class="s-sub">{data.stats.enquiriesUntagged} untagged of {data.stats.enquiriesTotal}</span>
    </div>
    <div class="card stat">
        <span class="s-val">{data.stats.serviceIntervals}</span>
        <span class="s-lbl">Service intervals</span>
        <span class="s-sub">from {data.stats.serviceRecords} records</span>
    </div>
    <div class="card stat">
        <span class="s-val">{totalTextLabels}</span>
        <span class="s-lbl">Total text labels</span>
        <span class="s-sub">across {data.stats.partsTotal} catalogue parts</span>
    </div>
</div>

{#if data.stats.enquiriesUntagged > 0 || data.stats.suggestionsPending > 0}
    <div class="nudges">
        {#if data.stats.enquiriesUntagged > 0}
            <div class="card nudge">
                <div class="nudge-body">
                    <p>
                        <strong>{data.stats.enquiriesUntagged}</strong> enquiries are still untagged. These already exist - tagging them adds labels without waiting for new traffic.
                    </p>
                    <div class="bar"><div class="fill" style="width:{enquiryProgress}%"></div></div>
                </div>
                <a class="nudge-cta" href="/app/enquiries">Tag enquiries</a>
            </div>
        {/if}

        {#if data.stats.suggestionsPending > 0}
            <div class="card nudge">
                <div class="nudge-body">
                    <p>
                        <strong>{data.stats.suggestionsPending}</strong> chat suggestions await staff review. Staff verdict overrides inferred customer signals.
                    </p>
                </div>
                <a class="nudge-cta" href="/app/analytics/suggestions">Review suggestions</a>
            </div>
        {/if}
    </div>
{/if}

<h2>Confidence Signal</h2>
{#if data.calibration.length === 0}
    <div class="card empty">No resolved suggestions yet.</div>
{:else}
    <div class="card">
        <table>
            <thead>
                <tr><th>Stated confidence</th><th class="num">Reviewed</th><th class="num">Correct</th><th class="num">Accuracy</th></tr>
            </thead>
            <tbody>
                {#each data.calibration as c (c.confidence)}
                    <tr>
                        <td><span class="conf {c.confidence}">{c.confidence}</span></td>
                        <td class="num">{c.resolved}</td>
                        <td class="num">{c.correct}</td>
                        <td class="num strong">{c.accuracy_pct ?? '\u2014'}%</td>
                    </tr>
                {/each}
            </tbody>
        </table>
        <p class="hint">
            High-confidence answers should be clearly more accurate than low-confidence ones. If they are not, the signal is noise and should not gate anything.
        </p>
    </div>
{/if}

<h2>Class Balance</h2>
<div class="card">
    <p class="cov-summary">
        <strong>{data.coverage.labelledParts}</strong> of {data.stats.partsTotal} parts have at least one label.
        <strong>{data.coverage.readyParts}</strong> have reached {data.coverage.target}.
    </p>

    {#if data.coverage.topParts.length === 0}
        <p class="empty">No parts have labels yet.</p>
    {:else}
        <table>
            <thead>
                <tr><th>Part</th><th class="num">Chat</th><th class="num">Enquiries</th><th class="num">Total</th><th>Toward {data.coverage.target}</th></tr>
            </thead>
            <tbody>
                {#each data.coverage.topParts as p (p.part_number)}
                    <tr>
                        <td>
                            <span class="pn">{p.part_number}</span>
                            <span class="nm">{p.name}</span>
                        </td>
                        <td class="num">{p.chat_labels}</td>
                        <td class="num">{p.enquiry_labels}</td>
                        <td class="num strong">{p.text_labels}</td>
                        <td class="barcell">
                            <div class="bar sm">
                                <div class="fill" style="width:{pct(p.text_labels, data.coverage.target)}%"></div>
                            </div>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
    <p class="hint">
        Total volume matters less than spread: a classifier needs examples <em>per part</em>. A long tail of zero-label parts is the real constraint on what can be trained.
    </p>
</div>

<style>
    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 6px;
    }

    h1 {
        margin: 5px 0 10px;
    }

    h2 {
        font-size: 1rem;
        color: var(--bme-dark-blue);
        margin: 1.75rem 0 0.75rem;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .intro {
        color: var(--bme-muted);
        font-size: 0.85rem;
        line-height: 1.5;
        margin: 0 0 20px;
    }

    .baseline {
        border-left: 4px solid var(--bme-green);
        padding: 18px;
    }

    .bl-main {
        display: flex;
        align-items: baseline;
        gap: 5px;
        flex-wrap: wrap;
    }

    .bl-label {
        color: var(--bme-muted);
        font-size: 0.85rem;
    }

    .bl-value {
        font-weight: 700;
        color: var(--bme-dark-blue);
        font-size: 0.85rem;
        line-height: 1;
    }

    .bl-sub {
        color: var(--bme-muted);
        font-size: 0.82rem;
    }

    .bl-none {
        color: var(--bme-muted);
        font-style: italic;
    }

    .bl-note {
        color: var(--bme-muted);
        font-size: 0.8rem;
        line-height: 1.5;
        margin: 10px 0 0;
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
    }

    .stat {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 18px 20px;
    }

    .s-val {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--bme-dark-blue);
        line-height: 1.1;
    }

    .s-lbl {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .s-sub {
        font-size: 0.75rem;
        color: var(--bme-muted);
    }

    .nudges {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 14px;
    }

    .nudge {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        border-left: 4px solid var(--bme-amber);
        padding: 14px 20px;
    }

    .nudge-body {
        flex: 1;
        min-width: 220px;
    }

    .nudge p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--bme-ink);
    }

    .nudge-cta {
        flex: 0 0 auto;
        padding: 7px 16px;
        border-radius: 8px;
        background: var(--bme-dark-blue);
        color: #ffffff;
        font-size: 0.83rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .nudge-cta:hover {
        background: var(--bme-darker-blue);
    }

    .bar {
        height: 6px;
        background: var(--bme-border);
        border-radius: 999px;
        overflow: hidden;
        margin-top: 10px;
    }

    .bar.sm {
        margin: 0;
        width: 120px;
    }

    .fill {
        height: 100%;
        background: var(--bme-green);
        border-radius: 999px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.87rem;
    }

    th, td {
        text-align: left;
        padding: 0.65rem 0.7rem;
        border-bottom: 1px solid var(--bme-border);
        vertical-align: middle;
    }

    th {
        color: var(--bme-muted);
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    tbody tr:last-child td {
        border-bottom: none;
    }

    .num {
        text-align: center;
    }

    .strong {
        font-weight: 700;
        color: var(--bme-ink);
    }

    .pn {
        display: block;
        font-weight: 600;
        color: var(--bme-ink);
    }

    .nm {
        display: block;
        color: var(--bme-muted);
        font-size: 0.78rem;
    }

    .barcell {
        width: 140px;
    }

    .conf {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        font-weight: 700;
        background: var(--bme-surface-2);
        color: var(--bme-muted);
    }

    .conf.high {
        background: #e8f2e0;
        color: #3f6212;
    }

    :root[data-theme='dark'] .conf.high {
        background: #1e3212;
        color: #9adf6c;
    }

    .conf.medium {
        background: #fef3c7;
        color: #92400e;
    }

    :root[data-theme='dark'] .conf.medium {
        background: #3a2f0f;
        color: #ffcc66;
    }

    .conf.low {
        background: var(--bme-surface-2);
        color: var(--bme-muted);
    }

    .cov-summary {
        margin: 10px;
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--bme-ink);
    }

    .hint {
        color: var(--bme-muted);
        font-size: 0.8rem;
        line-height: 1.5;
        margin-left: 10px;
    }

    .empty {
        color: var(--bme-muted);
        text-align: center;
        padding: 2rem 1.5rem;
    }
</style>