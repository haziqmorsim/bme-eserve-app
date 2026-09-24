<script lang="ts">
    import PdfExtractor from './PdfExtractor.svelte';
    import type { PackingList } from '$lib/extract/types';

    let { canRun = true } = $props<{ canRun?: boolean }>();

    const extract = async (file: File, onProgress: any) => (await import('$lib/extract/packing')).extractPackingList(file, onProgress);
    const buildWorkbook = async (rows: PackingList[]) => (await import('$lib/extract/workbook')).buildPackingWorkbook(rows);

    const num = (n: number | null | undefined, dp = 2) => n === null || n === undefined
        ? '—'
        : n.toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp});
</script>

<PdfExtractor {canRun} label="package(s)" {extract} {buildWorkbook}>
    {#snippet results({ rows })}
        {@const lists = rows as PackingList[]}
        {@const packages = lists.flatMap((l) => l.packages)}
        {@const printed = lists
            .map((l) => l.totalWeight)
            .filter((v): v is number => v !== null)
            .reduce((s, v) => s + v, 0)}
        {@const totalWeight = packages.reduce((s, p) => s + (p.weight ?? 0), 0)}
        {@const totalVolume = packages.reduce((s, p) => s + (p.volume ?? 0), 0)}

        {#if lists.some((l) => l.project || l.client || l.date)}
            <dl class="meta">
                {#each lists as list (list.sourceFile)}
                    {#if list.project}<div><dt>Project</dt><dd>{list.project}</dd></div>{/if}
                    {#if list.client}<div><dt>Client</dt><dd>{list.client}</dd></div>{/if}
                    {#if list.date}<div><dt>Date</dt><dd>{list.date}</dd></div>{/if}
                {/each}
            </dl>
        {/if}

        {#if packages.length === 0}
            <p class="muted">No packages were extracted.</p>
        {:else}
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th><th>Quantity</th><th>Package Type</th><th>Dimensions</th>
                            <th class="num">Volume (m³)</th><th class="num">Weight (kg)</th>
                            <th class="num">Contents</th><th class="num">Pages</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each packages as p,i (p.itemNo + '-' + i)}
                            <tr>
                                <td class="num">{p.itemNo}</td>
                                <td>{p.quantity}</td>
                                <td>{p.packageType}</td>
                                <td class="dim">{p.dimension}</td>
                                <td class="num">{num(p.volume)}</td>
                                <td class="num">{num(p.weight)}</td>
                                <td class="num">{p.contents.length}</td>
                                <td class="num">{p.sourcePage}</td>
                            </tr>
                        {/each}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4"><strong> Total ({packages.length} packages)</strong></td>
                            <td class="num"><strong>{num(totalVolume)}</strong></td>
                            <td class="num"><strong>{num(totalWeight)}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                        {#if printed > 0}
                            <tr class="printed">
                                <td colspan="4">Printed total on the document</td>
                                <td></td>
                                <td class="num" class:mismatch={Math.abs(printed - totalWeight) > 1}>{num(printed, 0)}</td>
                                <td colspan="2"></td>
                            </tr>
                        {/if}
                    </tfoot>
                </table>
            </div>
            <p class="muted">
                Each package's full "Consisting of" list is on the Contents sheet of the Excel file.
            </p>
        {/if}
    {/snippet}
</PdfExtractor>

<style>
    .muted {
        color: var(--bme-muted);
        font-size: 14px;
        margin: 12px 0 0;
    }
 
    .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 28px;
        margin: 14px 0 0;
    }
 
    .meta div {
        display: flex;
        gap: 8px;
        align-items: baseline;
    }
 
    .meta dt {
        color: var(--bme-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }
 
    .meta dd {
        margin: 0;
        color: var(--bme-ink);
        font-size: 14px;
        font-weight: 600;
    }
 
    .table-wrap {
        overflow-x: auto;
        margin-top: 14px;
    }
 
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
    }
 
    th {
        text-align: left;
        color: var(--bme-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        padding: 6px 8px;
        white-space: nowrap;
    }
 
    td {
        padding: 8px;
        border-top: 1px solid var(--bme-border);
        color: var(--bme-ink);
        vertical-align: top;
    }
 
    .dim {
        min-width: 190px;
    }
 
    .num {
        text-align: center;
        white-space: nowrap;
    }
 
    tfoot td {
        border-top: 2px solid var(--bme-border);
        color: var(--bme-ink);
    }
 
    tfoot .printed td {
        border-top: 1px solid var(--bme-border);
        color: var(--bme-muted);
    }
 
    .mismatch {
        color: var(--bme-red);
        font-weight: 700;
    }
</style>