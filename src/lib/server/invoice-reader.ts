import { getClient, MODEL } from "./assistant";
import type { InvoiceFields } from "$lib/extract/types";

export const SYSTEM_PROMPT = `You are an expert accounts-payable clerk for a Malaysian \
manufacturer that imports/exports goods through freight forwarders. You read \
scanned freight-forwarder invoices (CNC Freight, FM Global Logistics, Unimaju, \
CLS, Complete, etc.) and turn them into structured accounting rows.
 
You are given, for ONE scanned page:
  1. The raw OCR text (may contain errors).
  2. The page image (authoritative — trust it over OCR, and use it to read
     handwriting such as the project / PO number written at the top).
 
TASK
Decide if this page is the FIRST page of an invoice. A page is NOT a new
invoice if it is a blank page, a terms-and-conditions page, a packing list, a
delivery order, or a continuation of the previous invoice. If it is not a new
invoice, return {"is_invoice": false}.
 
If it IS an invoice, extract these fields:
 
- project_no: The customer's project / PO number. Often HANDWRITTEN at the top
  of the page or inside the "INVOICE CERTIFICATION / PROJ NO / PO NO" stamp box.
  Examples: "PO25-1191", "ST6754", "MP0742", "PB0902". Keep slashes if several
  are written (e.g. "ST6752/ ST6821"). If none is visible, use "".
- vendor: The forwarder company that ISSUED the invoice (the logo / letterhead
  at the top), normalised short name. Map letterheads to:
  "CNC Freight Services"->"CNC", "FM Global Logistics"->"FM Global",
  "Unimaju"->"Unimaju" (or "Unimaju Global" if the letterhead says Global),
  "Complete"->"Complete", "CLS"->"CLS". Otherwise use the company's short name.
- invoice_no: The invoice number (field labelled INVOICE NO / INVOICE NUMBER).
- pod: Port of Discharge / Final Destination / P.O.D. For imports this is the
  origin->destination as written (e.g. "From Wakayama", "From Kobe"); for
  exports it is the destination port (e.g. "Colon", "Surabaya", "Sibu Sarawak").
  Copy what the invoice shows.
- type: Shipment type. Use "LCL", "FCL", "Barge", "Air", or the container
  configuration if shown (e.g. "1 x 40'HC", "2 x 40'FR", "1 x 40'HC DG").
 
Then read EVERY charge line item and assign its amount to exactly ONE bucket.
Sum amounts that fall in the same bucket. Use amounts INCLUSIVE of tax (the
right-most "AMOUNT INCL. TAX" column) so the buckets add up to the total.
 
Buckets:
- freight: ocean/sea freight, air freight, barge freight, freight surcharges,
  BAF/CAF, the main carriage cost.
- local_charges: terminal handling (THC), documentation/doc fee, customs/forwarding
  agency fees, handling, B/L fee, seal, DG surcharge, EDI, port dues, and any
  local destination/origin charges that are NOT storage or inland transport.
- port_storage: storage charges, demurrage, detention, port rent/warehousing
  while goods sit at the port.
- transport_charges: inland haulage, trucking, delivery, cartage, transport to/from
  the port or door.
- reimbursement: items the forwarder paid on your behalf and is recharging —
  duty/tax reimbursement, disbursement, out-of-pocket, "reimbursable".
 
- total: the invoice grand total INCLUSIVE of tax. Should equal the sum of the
  five buckets; if the printed total differs, trust the printed total and still
  fill the buckets as best you can.
- confidence: "high" if the image is clear and numbers are certain, "medium" if
  some inference was needed, "low" if the scan is poor.
 
OUTPUT
Return ONLY a JSON object, no prose, no markdown fences:
{"is_invoice": true,
 "project_no": "...", "vendor": "...", "invoice_no": "...",
 "pod": "...", "type": "...",
 "freight": 0, "local_charges": 0, "port_storage": 0,
 "transport_charges": 0, "reimbursement": 0, "total": 0,
 "confidence": "high"}
All amounts are plain numbers (no "RM", no commas). Negative values are allowed
(credit notes). Use 0 for empty buckets.`;

const USER_INSTRUCTION = 'Extract the invoice as specified. Return JSON only.';

export type AiInvoice = InvoiceFields;

function userText(ocrText: string): string {
    const text = ocrText.trim().slice(0, 6000);
    return (
        'OCR TEXT (may contain errors — trust the image):\n' +
        '```\n' +
        (text || '(no text detected)') +
        '\n```\n\n' +
        USER_INSTRUCTION
    );
}

function parseJson(raw: string): Record<string, unknown> | null {
    let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function num(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return cleaned && Number.isFinite(parsed) ? parsed : 0;
}

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

function toInvoice(data: Record<string, unknown>): AiInvoice | null {
    if (!data.is_invoice) return null;
    const row: AiInvoice = {
        project_no: str(data.project_no),
        vendor: str(data.vendor),
        invoice_no: str(data.invoice_no),
        pod: str(data.pod),
        type: str(data.type),
        freight: num(data.freight),
        local_charges: num(data.local_charges),
        port_storage: num(data.port_storage),
        transport_charges: num(data.transport_charges),
        reimbursement: num(data.reimbursement),
        total: num(data.total),
        confidence: (['low', 'medium', 'high'] as const).includes(data.confidence as never)
            ? (data.confidence as AiInvoice['confidence'])
            : 'medium'
    };
    if (!row.total) {
        row.total = Math.round((row.freight + row.local_charges + row.port_storage + row.transport_charges + row.reimbursement) * 100) / 100;
    }
    return row;
}

export class UnreadableReply extends Error {}

export async function readInvoicePage(imageBase64: string, ocrText: string): Promise<AiInvoice | null> {
    const res = await getClient().messages.create(
        {
            model: MODEL,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
                        { type: 'text', text: userText(ocrText) }
                    ]
                }
            ]
        },
        { timeout: 45_000, maxRetries: 1 }
    );

    const raw = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const data = parseJson(raw);
    if (!data) throw new UnreadableReply('The model reply was not valid JSON.');
    return toInvoice(data);
}