<script lang="ts">
    import PdfExtractor from "$lib/components/PdfExtractor.svelte";
    import type { InvoiceRow } from "$lib/extract/types";

    let { canRun = true } = $props<{ canRun?: boolean }>();

    const extract = async (file: File, onProgress: any) =>
        (await import('$lib/extract/invoice')).extractInvoices(file, onProgress);
    const buildWorkbook = async (rows: InvoiceRow[]) =>
        (await import('$lib/extract/workbook')).buildInvoiceWorkbook(rows);

    const money = (n: number | null | undefined) =>
        (n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<PdfExtractor {canRun} label="invoice(s)" {extract} {buildWorkbook}>
    {#snippet results({ rows })}
        {#if rows.length === 0}
            <p class="muted">No invoice rows were extracted.</p>
        {:else}
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Project No</th><th>Vendor</th><th>Invoice No</th><th>POD</th><th>Type</th>
                            <th class="num">Freight</th><th class="num">Local</th><th class="num">Storage</th>
                            <th class="num">Transport</th><th class="num">Reimburse</th><th class="num">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each rows as r, i (r.invoice_no + '-' + i)}
                            <tr>
                                <td>{r.project_no}</td>
                                <td>{r.vendor}</td>
                                <td>{r.invoice_no}</td>
                                <td>{r.pod}</td>
                                <td>{r.type}</td>
                                <td class="num">{money(r.freight)}</td>
                                <td class="num">{money(r.local_charges)}</td>
                                <td class="num">{money(r.port_storage)}</td>
                                <td class="num">{money(r.transport_charges)}</td>
                                <td class="num">{money(r.reimbursement)}</td>
                                <td class="num"><strong>{money(r.total)}</strong></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <p class="muted">
                Figures read from a scan are worth a glance before use — the Excel file carries
                the same rows plus a summary by project and vendor.
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
    }

    .num {
        text-align: right;
    }
</style>