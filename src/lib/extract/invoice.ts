import { readLines } from './ocr';
import { openPdf, renderPage, textLayerLines } from './render';
import type { ExtractResult, InvoiceFields, InvoiceRow, ProgressFn } from './types';

const MONEY_SOURCE = '-?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})|-?\\d+\\.\\d{1,2}';
const MONEY = new RegExp(MONEY_SOURCE, 'g');

const PROJECT =
    /\b((?:ST|MP|PB|PO|WO|PI)\s?\d{3,6}[A-Z]?(?:\s*[/-]\s*(?:ST|MP|PB|PO|WO)?\d{2,6}[A-Z]?)?)/i;

const VENDORS: Array<[RegExp, string]> = [
    [/CNC\s+FREIGHT/i, 'CNC'],
    [/FM\s+GLOBAL/i, 'FM Global'],
    [/UNIMAJU\s+GLOBAL/i, 'Unimaju Global'],
    [/UNIMAJU/i, 'Unimaju'],
    [/\bCLS\b/i, 'CLS'],
    [/COMPLETE/i, 'Complete']
];

const BUCKETS: Array<[keyof Buckets, string[]]> = [
    ['port_storage', ['storage', 'demurrage', 'detention', 'warehous', 'port rent', 'ground rent']],
    [
        'transport_charges',
        ['transport', 'haulage', 'trucking', 'truck', 'lorry', 'cartage', 'delivery', 'inland', 'drayage', 'door']
    ],
    ['reimbursement', ['reimburs', 'disburs', 'out of pocket', 'out-of-pocket', 'duty', 'on behalf']],
    [
        'freight',
        ['freight', 'ocean', 'sea fr', 'seafreight', 'air fr', 'barge', 'baf', 'caf', 'carriage', 'shipping line']
    ],
    [
        'local_charges',
        [
            'thc', 'terminal handling', 'terminal', 'document', 'doc fee', 'd/o', 'do fee',
            'delivery order', 'handling', 'customs', 'clearance', 'forwarding', 'agency',
            'b/l', 'bl fee', 'bill of lading', 'seal', 'edi', 'dangerous', 'dg ',
            'port due', 'wharf', 'lift', 'survey', 'permit', 'declaration', 'local charge'
        ]
    ]
];

type Buckets = {
    freight: number;
    local_charges: number;
    port_storage: number;
    transport_charges: number;
    reimbursement: number;
};

const TOTAL = new RegExp(
    `(?:GRAND\\s+TOTAL|TOTAL\\s*\\(?\\s*INCLUSIVE|TOTAL\\s+INCL|TOTAL\\s+AMOUNT|NETT?\\s+TOTAL|TOTAL\\s+PAYABLE)\\b[^0-9-]*(${MONEY_SOURCE})`,
    'i'
);
const ANY_TOTAL = new RegExp(`\\bTOTAL\\b[^0-9-]*(${MONEY_SOURCE})`, 'gi');
const INVOICE_NO = /INVOICE\s*N(?:O|UMBER)\b[^A-Za-z0-9\n]{0,5}([A-Z0-9][A-Z0-9/-]{3,})/i;
const TYPE_CONTAINER = /\b(\d\s*[xX]\s*\d{2}\s?'?\s?(?:HC|HQ|FR|GP|RF|OT|DG)\w*)/i;

const toFloat = (token: string) => {
    const value = Number(String(token).replace(/,/g, ''));
    return Number.isFinite(value) ? value : 0;
};

function detectVendor(text: string): string {
    for (const [rx, name] of VENDORS) if (rx.test(text)) return name;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (line.length > 4 && /(SDN\s+BHD|LOGISTICS|FREIGHT|SHIPPING|FORWARD)/i.test(line)) {
            return line
                .split(/\bSDN\b/i)[0]
                .trim()
                .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
        }
    }
    return '';
}

function detectProject(text: string): string {
    const head = text.split('\n').slice(0, 12).join('\n');
    const m = PROJECT.exec(head) ?? PROJECT.exec(text);
    return m ? m[1].replace(/\s+/g, '').toUpperCase().replace(/\//g, '/ ') : '';
}

function detectType(text: string): string {
    const m = TYPE_CONTAINER.exec(text);
    if (m) return m[1].replace(/\s+/g, ' ').replace(" '", "'").toUpperCase().replace('X', 'x');
    const upper = text.toUpperCase();
    if (upper.includes('BARGE')) return 'Barge';
    if (/\bFCL\b/.test(upper)) return 'FCL';
    if (/\bLCL\b/.test(upper)) return 'LCL';
    if (/\bAIR\s*FREIGHT|\bAWB\b/.test(upper)) return 'Air';
    return '';
}

function detectPod(text: string): string {
    const labels = [
        'FINAL\\s+DESTINATION',
        'P\\.?\\s*O\\.?\\s*D',
        'PORT\\s+OF\\s+DISCHARGE',
        'DESTINATION',
        'DISCHARGE\\s+PORT'
    ];
    for (const label of labels) {
        const m = new RegExp(`${label}\\s*[:-]?\\s*([A-Za-z][A-Za-z ,./'-]{2,40})`, 'i').exec(text);
        if (!m) continue;
        const value = m[1].replace(/^[\s.:-]+|[\s.:-]+$/g, '').split(/\s{2,}|JOB|OBL|HBL|VESSEL/)[0].trim();
        if (value.length > 2) return value;
    }
    return '';
}

function categorise(text: string): { buckets: Buckets; matched: boolean } {
    const buckets: Buckets = {
        freight: 0,
        local_charges: 0,
        port_storage: 0,
        transport_charges: 0,
        reimbursement: 0
    };
    let matched = false;

    for (const line of text.split('\n')) {
        const low = line.toLowerCase();
        if (/\btotal\b|\bsub\s*total\b|\btax\s+summary\b|\bsst\b/.test(low)) continue;

        const amounts = line.match(MONEY);
        if (!amounts) continue;
        const amount = toFloat(amounts[amounts.length - 1]);
        if (amount === 0) continue;

        for (const [bucket, keywords] of BUCKETS) {
            if (keywords.some((k) => low.includes(k))) {
                buckets[bucket] += amount;
                matched = true;
                break;
            }
        }
    }
    return { buckets, matched };
}

function detectTotal(text: string): number {
    const m = TOTAL.exec(text);
    if (m) return toFloat(m[1]);
    const candidates: number[] = [];
    for (const match of text.matchAll(ANY_TOTAL)) candidates.push(toFloat(match[1]));
    return candidates.length ? Math.max(...candidates) : 0;
}

const looksLikeInvoice = (text: string) => /INVOICE/i.test(text) && new RegExp(MONEY_SOURCE).test(text);

function buildRow(text: string, sourceFile: string, sourcePage: number): InvoiceRow | null {
    if (!looksLikeInvoice(text)) return null;

    const { buckets } = categorise(text);
    const printed = detectTotal(text);
    const summed = Math.round(Object.values(buckets).reduce((s, v) => s + v, 0) * 100) / 100;

    return {
        project_no: detectProject(text),
        vendor: detectVendor(text),
        invoice_no: (INVOICE_NO.exec(text)?.[1] ?? '').trim(),
        pod: detectPod(text),
        type: detectType(text),
        ...buckets,
        total: printed || summed,
        source_file: sourceFile,
        source_page: sourcePage,
        confidence: printed && summed && Math.abs(printed - summed) < 0.05 ? 'medium' : 'low'
    };
}

const AI_DPI = 200;
const AI_MAX_WIDTH = 1600;
const AI_CONCURRENCY = 2;
const AI_MAX_FAILURES = 2;

type Outcome =
    | { kind: 'read'; invoice: InvoiceFields | null }
    | { kind: 'unavailable'; reason: string }
    | { kind: 'failed'; reason: string };

async function pageImage(canvas: HTMLCanvasElement): Promise<string> {
    let source = canvas;
    if (canvas.width > AI_MAX_WIDTH) {
        source = document.createElement('canvas');
        source.width = AI_MAX_WIDTH;
        source.height = Math.round(canvas.height * (AI_MAX_WIDTH / canvas.width));
        const ctx = source.getContext('2d');
        if (!ctx) throw new Error('This browser would not provide a 2D canvas.');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, source.width, source.height);
    }
    const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, 'image/jpeg', 0.85));
    if (source !== canvas) source.width = source.height = 0;
    if (!blob) throw new Error('Could not encode the page image.');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

async function askModel(image: string, text: string): Promise<Outcome> {
    let res: Response;
    try {
        res = await fetch('/api/extract/invoice', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ image, text })
        });
    } catch {
        return { kind: 'failed', reason: 'network error' };
    }

    let body: { invoice?: InvoiceFields | null; error?: string } = {};
    try {
        body = await res.json();
    } catch {
        /* a platform error page */
    }

    if (res.ok) return { kind: 'read', invoice: body.invoice ?? null };
    if (res.status === 503 || res.status === 401 || res.status === 403) {
        return { kind: 'unavailable', reason: body.error ?? `HTTP ${res.status}` };
    }
    return { kind: 'failed', reason: body.error ?? `HTTP ${res.status}` };
}

const money = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function extractInvoices(
    file: File,
    onProgress?: ProgressFn
): Promise<ExtractResult<InvoiceRow>> {
    const { doc, close } = await openPdf(await file.arrayBuffer());
    const total = doc.numPages;
    const found: Array<{ row: InvoiceRow; byModel: boolean } | null> = new Array(total).fill(null);
    const warnings: string[] = [];

    let useModel = true;
    let offReason = '';
    let failuresInARow = 0;
    let done = 0;

    const readOne = async (index: number, text: string, image: string) => {
        if (useModel && image) {
            const outcome = await askModel(image, text);
            if (outcome.kind === 'read') {
                failuresInARow = 0;
                return outcome.invoice
                    ? { row: { ...outcome.invoice, source_file: file.name, source_page: index }, byModel: true }
                    : null;
            }
            if (outcome.kind === 'unavailable') {
                if (useModel) offReason = outcome.reason;
                useModel = false;
            } else {
                failuresInARow += 1;
                warnings.push(`${file.name} p${index}: the AI reader failed (${outcome.reason}); read offline instead.`);
                if (failuresInARow >= AI_MAX_FAILURES && useModel) {
                    useModel = false;
                    offReason = 'repeated failures';
                }
            }
        }
        const row = buildRow(text, file.name, index);
        return row ? { row, byModel: false } : null;
    };

    const inFlight = new Set<Promise<void>>();
    try {
        for (let i = 1; i <= total; i += 1) {
            onProgress?.(done, total, `Reading page ${i} of ${total}`);
            const page = await renderPage(doc, i, AI_DPI);
            let text = '';
            let image = '';
            try {
                const lines = page.hasTextLayer
                    ? await textLayerLines(doc, i, AI_DPI)
                    : await readLines(page.canvas);
                text = lines.map((l) => l.text).join('\n');
                if (useModel) image = await pageImage(page.canvas);
            } catch (err) {
                warnings.push(`${file.name} p${i}: ${(err as Error).message}`);
                done += 1;
                continue;
            } finally {
                page.canvas.width = 0;
                page.canvas.height = 0;
            }

            const task = readOne(i, text, image)
                .then((result) => {
                    found[i - 1] = result;
                })
                .catch((err) => {
                    warnings.push(`${file.name} p${i}: ${(err as Error).message}`);
                })
                .finally(() => {
                    inFlight.delete(task);
                    done += 1;
                    onProgress?.(done, total, `Read page ${done} of ${total}`);
                });
            inFlight.add(task);
            if (inFlight.size >= AI_CONCURRENCY) await Promise.race(inFlight);
        }
        await Promise.all(inFlight);
    } finally {
        await close();
    }

    const results = found.filter((r): r is { row: InvoiceRow; byModel: boolean } => r !== null);

    if (offReason) {
        warnings.unshift(
            offReason === 'not_configured'
                ? `${file.name}: the AI reader is not set up on the server (ANTHROPIC_API_KEY), so pages were read offline — project numbers and the charge breakdown need checking.`
                : `${file.name}: the AI reader was unavailable (${offReason}), so some pages were read offline — rows marked low confidence need checking.`
        );
    }

    for (const { row, byModel } of results) {
        if (!byModel) continue;
        const label = `${file.name} p${row.source_page}${row.invoice_no ? ` (${row.invoice_no})` : ''}`;
        const summed =
            row.freight + row.local_charges + row.port_storage + row.transport_charges + row.reimbursement;
        if (Math.abs(summed - row.total) > 0.05) {
            warnings.push(`${label}: charges add up to RM ${money(summed)} but the total reads RM ${money(row.total)}.`);
        }
        if (row.confidence === 'low') warnings.push(`${label}: the page was hard to read — worth a check.`);
    }

    const rows = results.map((r) => r.row);
    if (!rows.length) warnings.push(`${file.name}: no invoices were recognised in this file.`);
    return { rows, warnings };
}