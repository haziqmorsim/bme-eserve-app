<script lang="ts">
    import { FileText, X } from "@lucide/svelte";
    import { addToast } from "$lib/stores/toast";
    import { onDestroy, type Snippet } from "svelte";

    let {
        canRun = true,
        label = 'document',
        runningNote = 'This runs in your browser, so the PDFs stay on this device. Keep this tab open until it is finished.',
        extract,
        buildWorkbook,
        results
    } = $props<{
        canRun?: boolean;
        label?: string;
        runningNote?: string;
        extract: (
            file: File,
            onProgress: (done: number, total: number, note: string) => void
        ) => Promise<{ rows: any[]; warnings: string[] }>;
        buildWorkbook: (rows: any[]) => Promise<Blob>;
        results: Snippet<[{ rows: any[]; warnings: string[] }]>;
    }>();

    const MAX_BYTES = 50 * 1024 * 1024;

    type Stage = 'idle' | 'running' | 'done';

    let stage = $state<Stage>('idle');
    let files = $state<File[]>([]);
    let dragging = $state(false);
    let fileInput = $state<HTMLInputElement | null>(null);

    let pct = $state(0);
    let progressText = $state('Starting...');

    let rows = $state<any[]>([]);
    let warnings = $state<string[]>([]);
    let resultMsg = $state('');
    let workbook = $state<Blob | null>(null);
    let downloadName = $state('extract.xlsx');
    let downloading = $state(false);

    let cancelled = false;

    function addFiles(list: FileList | null | undefined) {
        if (!list || !canRun) return;
        const next = [...files];
        for (const f of Array.from(list)) {
            const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) continue;
            if (f.size > MAX_BYTES) {
                addToast(`'${f.name}' is larger than 50 MB.`);
                continue;
            }
            if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
            next.push(f);
        }
        files = next;
    }

    function removeFile(i: number) {
        files = files.filter((_, idx) => idx !== i);
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        dragging = false;
        addFiles(e.dataTransfer?.files);
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        if (canRun) dragging = true;
    }

    function onDragLeave(e: DragEvent) {
        e.preventDefault();
        dragging = false;
    }

    function openPicker() {
        if (canRun) fileInput?.click();
    }

    function onZoneKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
        }
    }

    function reset() {
        cancelled = true;
        stage = 'idle';
        files = [];
        pct = 0;
        progressText = 'Starting...';
        rows = [];
        warnings = [];
        resultMsg = '';
        workbook = null;
        if (fileInput) fileInput.value = '';
    }

    async function run() {
        if (files.length === 0 || !canRun) return;

        cancelled = false;
        stage = 'running';
        pct = 0;
        progressText = 'Loading the text recogniser...';
        rows = [];
        warnings = [];
        workbook = null;

        const collected: any[] = [];
        const problems: string[] = [];

        let pagesDone = 0;
        let pagesTotal = 0;

        try {
            for (const [index, file] of files.entries()) {
                if (cancelled) return;
                const before = pagesDone;
                const result = await extract(file, (done: number, total: number, note: string) => {
                    if (pagesTotal < before + total) pagesTotal = before + total;
                    pagesDone = before + done;
                    pct = pagesTotal ? Math.max(2, Math.round((pagesDone / pagesTotal) * 100)) : 2;
                    progressText = files.length > 1 ? `${file.name} — ${note}` : note;
                });
                pagesDone = before + Math.max(1, result.rows.length ? pagesTotal - before : 0);
                collected.push(...result.rows);
                problems.push(...result.warnings);
                if (files.length > 1) {
                    progressText = `Finished ${index + 1} of ${files.length} files.`;
                }
            }

            if (cancelled) return;
            progressText = 'Building the Excel file...';
            pct = 100;
            workbook = await buildWorkbook(collected);
            downloadName = `${files[0].name.replace(/\.pdf$/i, '')}${files.length > 1 ? `_and_${files.length - 1}_more` : ''}.xlsx`;

            rows = collected;
            warnings = problems;
            resultMsg = `Extracted ${collected.length} ${label} from ${files.length} file${files.length > 1 ? 's' : ''}.`;
            stage = 'done';
        } catch (err) {
            console.error('Extraction failed:', err);
            stage = 'idle';
            addToast(
                (err as Error)?.message
                    ? `Could not read the PDF: ${(err as Error).message}`
                    : 'Could not read the PDF.'
            );
        }
    }

    function download() {
        if (!workbook) return;
        downloading = true;
        try {
            const url = URL.createObjectURL(workbook);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } finally {
            downloading = false;
        }
    }

    onDestroy(() => {
        cancelled = true;
    });

    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
</script>

{#if stage === 'idle'}
    <div class="card pane">
        <div
            class="dropzone"
            class:drag={dragging}
            class:disabled={!canRun}
            role="button"
            tabindex="0"
            aria-label="Drop PDFs here or browse files"
            onclick={openPicker}
            onkeydown={onZoneKey}
            ondrop={onDrop}
            ondragover={onDragOver}
            ondragenter={onDragOver}
            ondragleave={onDragLeave}
        >
            <input 
                type="file" 
                bind:this={fileInput}
                accept="application/pdf"
                multiple
                hidden
                onchange={(e) => addFiles((e.currentTarget as HTMLInputElement).files)}
            />
            <span class="dz-icon"><FileText size={34} /></span>
            <p class="dz-title">Drop PDFs here</p>
            <p class="dz-sub">
                or <button type="button" class="link" onclick={(e) => { e.stopPropagation(); openPicker(); }}>browse files</button>
            </p>
        </div>

        {#if files.length}
            <ul class="file-list">
                {#each files as f, i (f.name + f.size)}
                    <li>
                        <span class="f-name"><FileText size={14} />{f.name} <small>({mb(f.size)} MB)</small></span>
                        <button class="rm" aria-label={`Remove ${f.name}`} onclick={() => removeFile(i)}><X size={15} /></button>
                    </li>
                {/each}
            </ul>
        {/if}

        <button class="btn-primary run" disabled={files.length === 0 || !canRun} onclick={run}>Extract</button>

        {#if !canRun}
            <p class="hint">Read-only for the developer role.</p>
        {/if}
    </div>
{/if}

{#if stage === 'running'}
    <div class="card pane">
        <h2 class="pane-title">Processing...</h2>
        <div class="progress"><div class="progress-bar" style="width:{pct}%"></div></div>
        <p class="muted">{progressText}</p>
        <p class="muted small">{runningNote}</p>
    </div>
{/if}

{#if stage === 'done'}
    <div class="card pane">
        <div class="result-head">
            <h2 class="pane-title">Results</h2>
            <div class="result-actions">
                <button class="btn-primary" onclick={download} disabled={downloading || !workbook}>
                    {downloading ? 'Preparing...' : 'Download Excel'}
                </button>
                <button class="btn-ghost" onclick={reset}>Start again</button>
            </div>
        </div>

        {#if resultMsg}<p class="muted">{resultMsg}</p>{/if}

        {#if warnings.length}
            <div class="warnings">
                <strong>Worth a check:</strong>
                <ul>
                    {#each warnings as w}<li>{w}</li>{/each}
                </ul>
            </div>
        {/if}

        {@render results({ rows, warnings })}
    </div>
{/if}

<style>
    .pane {
        padding: 24px;
        margin: 0 auto 20px;
    }
 
    .pane-title {
        margin: 0 0 16px;
        font-size: 16px;
    }
 
    .dropzone {
        border: 2px dashed var(--bme-border);
        border-radius: 12px;
        padding: 38px 20px;
        text-align: center;
        cursor: pointer;
        background: var(--bme-surface-2);
        transition: border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
    }
 
    .dropzone:hover:not(.disabled),
    .dropzone:focus-visible:not(.disabled) {
        border-color: var(--bme-dark-blue);
        outline: none;
    }
 
    .dropzone.drag {
        border-color: var(--bme-dark-blue);
        background: var(--bme-sky);
    }
 
    .dropzone.disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
 
    .dz-icon {
        display: inline-flex;
        color: var(--bme-muted);
    }
 
    .dz-title {
        font-size: 17px;
        font-weight: 600;
        margin: 8px 0 2px;
        color: var(--bme-ink);
    }
 
    .dz-sub {
        margin: 0;
        color: var(--bme-muted);
        font-size: 14px;
    }
 
    .link {
        background: none;
        border: none;
        color: var(--bme-dark-blue);
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
        padding: 0;
    }
 
    .file-list {
        list-style: none;
        padding: 0;
        margin: 16px 0 0;
        display: grid;
        gap: 8px;
    }
 
    .file-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: var(--bme-surface-2);
        border: 1px solid var(--bme-border);
        border-radius: 9px;
        padding: 9px 12px;
        font-size: 14px;
        color: var(--bme-ink);
    }
 
    .f-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        overflow-wrap: anywhere;
    }
 
    .f-name small {
        color: var(--bme-muted);
    }
 
    .rm {
        display: inline-flex;
        align-items: center;
        border: none;
        background: none;
        color: var(--bme-red);
        cursor: pointer;
        padding: 2px;
        border-radius: 5px;
    }
 
    .rm:hover {
        background: var(--bme-hover);
    }
 
    .run {
        margin-top: 18px;
    }
 
    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
 
    .hint {
        margin: 10px 0 0;
        font-size: 13px;
        color: var(--bme-muted);
    }
 
    .muted {
        color: var(--bme-muted);
        font-size: 14px;
        margin: 12px 0 0;
    }
 
    .muted.small {
        font-size: 12.5px;
    }
 
    .progress {
        height: 12px;
        background: var(--bme-surface-2);
        border: 1px solid var(--bme-border);
        border-radius: 999px;
        overflow: hidden;
    }
 
    .progress-bar {
        height: 100%;
        width: 0;
        background: linear-gradient(90deg, var(--bme-dark-blue), var(--bme-light-blue));
        transition: width var(--t-med) var(--ease);
    }
 
    .result-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }
 
    .result-head .pane-title {
        margin: 0;
    }
 
    .result-actions {
        display: flex;
        gap: 10px;
    }
 
    .warnings {
        background: var(--bme-surface-2);
        color: var(--bme-ink);
        border: 1px solid var(--bme-amber);
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        margin: 12px 0;
    }
 
    .warnings ul {
        margin: 6px 0 0;
        padding-left: 18px;
        color: var(--bme-muted);
    }
 
    @media (max-width: 640px) {
        .pane {
            padding: 16px;
        }
 
        .result-head {
            align-items: flex-start;
        }
    }
</style>