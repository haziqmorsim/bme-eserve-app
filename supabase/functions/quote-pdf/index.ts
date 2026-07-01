import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { corsHeaders, json } from '../shared/cors.ts';

const BLUE = rgb(0, 0.29, 0.55);
const GREEN = rgb(0.184, 0.369, 0.094);
const INK = rgb(0.11, 0.16, 0.08);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.89, 0.91, 0.87);
const HEADBG = rgb(0.93, 0.95, 0.91);

function money(n:number): string {
    return 'RM' + Math.round(n).toLocaleString('en-MY', { maximumFractionDigits: 0 });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { quote_id } = await req.json();
        if (!quote_id) return json(400, { error: 'quote_id is required.' });

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!, 
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: quote, error } = await admin
            .from('quotes')
            .select('id, references, notes, created_at, user_id, quote_items(*)')
            .eq('id', quote_id)
            .single();
        if (error || !quote) return json(404, { error: 'Quote not found.' });

        const { data: prof } = await admin
            .from('profiles')
            .select('full_name, company')
            .eq('id', quote.user_id)
            .single();

        const { data: userInfo } = await admin.auth.admin.getUserById(quote.user_id);

        const customerEmail = userInfo.user?.email ?? '';

        const items = quote.quote_items ?? [];
        const partIds = [...new Set(items.map((i: any) => i.part_id).filter(Boolean))];
        const partPrice: Record<string, number> = {};
        if (partIds.length) {
            const { data: parts } = await admin
                .from('parts')
                .select('id, price')
                .in('id', partIds);
            for (const p of parts ?? []) partPrice[p.id] = p.price ?? 0;
        }
        const unit = (i: any): number => (p.unit_price ?? partPrice[i.part_id] ?? 0);
        const total = items.reduce((s: number, i: any) => s + unit(i) * i.quantity, 0);

        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const bold = await doc.embedFont(StandardFonts, HelveticaBold);
        const W = 595.28, H = 841.89, M = 44;
        let page = doc.addPage([W, H]);
        let y = H - M;

        const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x, y: yy, size, font: f, color });
        const rightText = (s: string, xRight: number, yy: number, size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x: xRight - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color });

        page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: BLUE });
        text('Boilermech Sdn Bhd', M, y - 8, 15, bold, BLUE);
        text('BME e-Serve — Spare Parts Quotation', M, y - 26, 10, font, MUTED);
        rightText('QUOTATION', W - M, y - 8, 18, bold, GREEN);
        rightText(quote.reference ?? '', W - M, y - 28, 11, bold, INK);
        y -= 58;

        page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
        y -= 20;
        const dateStr = new Date(quote.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
        text('Date', M, y, 9, bold, MUTED);
        text('Billed To', W / 2, y, 9, bold, MUTED);
        text(prof?.company || prof?.full_name || customerEmail || '—', W / 2, y - 14, 10);
        if (prof?.company && prof?.full_name) text(prof.full_name, W / 2, y - 28, 9, font, MUTED);
        y -= 48;

        const cPart = M, cName = M + 92, cBoiler = 330, cQty = 410, cUnit = 476, cAmt = W - M;
        page.drawRectangle({ x: M - 6, y: y - 6, width: W - 2 * M + 12, height: 22, color: HEADBG });
        text('Part No.', cPart, y, 9, bold, INK);
        text('Description', cName, y, 9, bold, INK);
        text('Boiler', cBoiler, y, 9, bold, INK);
        rightText('Qty', cQty, y, 9, bold, INK);
        rightText('Unit', cUnit, y, 9, bold, INK);
        rightText('Amount', cAmt, y, 9, bold, INK);
        y -= 26;

        const ensureSpace = () => {
            if (y < M + 90) {
                page = doc.addPage([W, H]);
                y = H - M;
            }
        };

        for (const i of items) {
            ensureSpace();
            const amt = unit(i) * i.quantity;
            text(i.part_number ?? '', cPart, y, 9, bold);
            let name = i.part_name ?? '';
            const maxW = cBoiler - cName - 8;
            while (name && font.widthOfTextAtSize(name, 9) > maxW) name = name.slice(0, -1);
            if (name !== (i.part_name ?? '')) name = name.slice(0, -1) + '...';
            text(name, cName, y, 9);
            text(i.boiler_code ?? '', cBoiler, y, 9);
            rightText(String(i.quantity), cQty, y, 9);
            rightText(unit(i) ? money(unit(i)) : '—', cUnit, y, 9);
            rightText(amt ? money(amt) : '—', cAmt, y, 9);
            y -= 16;
            page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: LINE });
            y -= 4;
        }

        y -= 8;
        page.drawRectangle({ x: cUnit - 60, y: y - 6, width: (W- M) - (cUnit - 60), height: 24, color: BLUE });
        rightText('Total', cUnit, y, 11, bold, rgb(1, 1, 1));
        rightText(money(total), cAmt, y, 11, bold, rgb(1, 1, 1));
        y -= 40;

        if (quote.notes) {
            ensureSpace();
            text('Notes', M, y, 9, bold, MUTED): y -= 14;
            let notes = String(quote.notes);
            const maxW = W - 2 * M;
            const words = notes.split(/\s+/);
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                if (font.widthOfTextAtSize(test, 9) > maxW) { 
                    text(line, M, y, 9);
                    y -= 12;
                    ensureSpace();
                }
                else line = test;
            }
            if (line) {
                text(line, M, n, y, 9);
                y -= 12;
            }
            y -= 10;
        }

        text('Prices are idicative and subject to confirmation by Boilermech Sdn Bhd.', M, M, 8, font, MUTED);

        const bytes = await doc.save();

        const path = `${quote.id}.pdf`;
        const { error: upErr } = await admin.storage.from('quotes')
            .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        if (upErr) return js(400, { error: `Upload failed: ${upErr.message}` });

        const { data: pub } = admin.storage.from('quotes').getPublicUrl(path);
        const pdf_url = pub.publicUrl;
        await admin.from('quotes').update({ pdf_url }).eq('id', quote.id);

        return json(200, { ok: true, pdf_url, total });
    } catch (e) {
        console.error('quote-pdf failed.', e);
        return json(400, { error: String(e) });
    }
})