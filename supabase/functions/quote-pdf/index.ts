import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { corsHeaders, json } from '../_shared/cors.ts';
import { appUrl } from '../_shared/email-ui.ts';
import { getSettings } from '../_shared/settings.ts';

const BLUE = rgb(0, 0.29, 0.55);
const INK = rgb(0.11, 0.16, 0.08);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.89, 0.91, 0.87);
const WHITE = rgb(1, 1, 1);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { quote_id } = await req.json();
        if (!quote_id) return json(400, { error: 'quote_id is required.' });

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json(401, { error: 'Missing token' });

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!, 
            Deno.env.get('SUPABASE_ANON_KEY')!, 
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return json(401, { error: 'Unauthorized' });

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!, 
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: me } = await admin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        const STAFF = ['admin', 'manager', 'coo', 'developer'];
        if (!me || !STAFF.includes(me.role)) {
            return json(403, { error: 'Only staff can download quotation PDFs.' });
        }

        const { data: quote, error } = await admin
            .from('quotes')
            .select('id, reference, notes, created_at, user_id, quote_items(*)')
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
        const unit = (i: any): number => (i.unit_price ?? partPrice[i.part_id] ?? 0);
        const total = items.reduce((s: number, i: any) => s + unit(i) * i.quantity, 0);

        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        const W = 595.28, H = 841.89, M = 44;
        let page = doc.addPage([W, H]);
        let y = H - M;

        const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x, y: yy, size, font: f, color });
        const rightText = (s: string, xRight: number, yy: number, size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x: xRight - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color });
        const centerText = (s: string, cx: number, yy: number, size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x: cx - f.widthOfTextAtSize(s ?? '', size) / 2, y: yy, size, font: f, color });

        let logoDrawn = false;
        try {
            const logoUrl = appUrl('/images/bme-logo.jpg');
            if (logoUrl) {
                const res = await fetch(logoUrl);
                if (res.ok) {
                    const img = await doc.embedJpg(new Uint8Array(await res.arrayBuffer()));
                    const logoH = 68;
                    const logoW = img.width * (logoH / img.height);
                    page.drawImage(img, { x: M, y: y - logoH, width: logoW, height: logoH });
                    y -= logoH + 16;
                    logoDrawn = true;
                }
            }
        } catch (e) {
            console.error('Logo could not be embedded:', e);
        }
        if (!logoDrawn) {
            text('Boilermech Sdn Bhd', M, y - 12, 15, bold, BLUE);
            y -= 30;
        }

        text('BME e-Serve — Spare Parts Quotation', M, y, 12, bold, MUTED);
        rightText(quote.reference ?? '', W - M, y, 12, bold, INK);
        y -= 18;

        page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
        y -= 20;

        const fmtDate = (d: Date) => d.toLocaleDateString('en-MY', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        const issued = new Date(quote.created_at);
        const dateStr = fmtDate(issued);
        text('Date', M, y, 9, bold, MUTED);
        text(dateStr, M, y - 14, 10);

        // const validityRaw = await getSettings(admin, 'quote_validity_days');
        // const validityDays = Number((validityRaw ?? '').trim());
        // if (Number.isFinite(validityDays) && validityDays > 0) {
        //     const until = new Date(issued.getTime() + validityDays * 24 * 60 * 60 * 1000);
        //     text('Valid Until', M + 150, y, 9, bold, MUTED);
        //     text(fmtDate(until), M + 150, y - 14, 10);
        // }

        rightText('Customer Details', W - M, y, 9, bold, MUTED);
        rightText(prof?.company || prof?.full_name || customerEmail || '—', W - M, y - 14, 10);
        if (prof?.company && prof?.full_name) rightText(prof.full_name, W - M, y - 28, 9, font, MUTED);
        y -= 52;

        const cPart = M, cName = M + 92, cBoiler = 320;
        const qtyC = 392;
        const tableRight = qtyC + 40;

        const drawTableHeader = () => {
            page.drawRectangle({ x: M - 6, y: y - 7, width: tableRight - (M - 6) + 6, height: 22, color: BLUE });
            text('Part No.', cPart, y, 9, bold, WHITE);
            text('Part Name', cName, y, 9, bold, WHITE);
            text('Boiler', cBoiler, y, 9, bold, WHITE);
            centerText('Quantity', qtyC, y, 9, bold, WHITE);
            y -= 26;
        };

        drawTableHeader();

        const ensureSpace = (withHeader = false) => {
            if (y < M + 90) {
                page = doc.addPage([W, H]);
                y = H - M;
                if (withHeader) drawTableHeader();
            }
        };

        for (const i of items) {
            ensureSpace(true);
            text(i.part_number ?? '', cPart, y, 9, bold);
            let name = i.part_name ?? '';
            const maxW = cBoiler - cName - 8;
            while (name && font.widthOfTextAtSize(name, 9) > maxW) name = name.slice(0, -1);
            if (name !== (i.part_name ?? '')) name = name.slice(0, -1) + '...';
            text(name, cName, y, 9);
            text(i.boiler_code ?? '', cBoiler, y, 9);
            centerText(String(i.quantity), qtyC, y, 9);
            y -= 16;
            page.drawLine({ start: { x: M, y: y + 4 }, end: { x: tableRight, y: y + 4 }, thickness: 0.5, color: LINE });
            y -= 4;
        }

        y -= 20;

        if (quote.notes) {
            ensureSpace();
            text('Notes', M, y, 9, bold, MUTED); 
            y -= 14;
            let notes = String(quote.notes);
            const maxW = W - 2 * M;
            const words = notes.split(/\s+/);
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                if (line && font.widthOfTextAtSize(test, 9) > maxW) {
                    text(line, M, y, 9);
                    y -= 12;
                    ensureSpace();
                    line = w;
                } else {
                    line = test;
                }
            }
            if (line) {
                text(line, M, y, 9);
                y -= 12;
            }
            y -= 10;
        }

        const bytes = await doc.save();

        const path = `${quote.id}.pdf`;
        const { error: upErr } = await admin.storage.from('quotes')
            .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
        if (upErr) return json(400, { error: `Upload failed: ${upErr.message}` });

        let pdf_url: string | null = null;
        const { data: signed } = await admin.storage
            .from('quotes')
            .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) {
            pdf_url = signed.signedUrl;
        } else {
            const { data: pub } = admin.storage.from('quotes').getPublicUrl(path);
            pdf_url = pub?.publicUrl ?? null;
        }
        if (pdf_url) await admin.from('quotes').update({ pdf_url }).eq('id', quote.id);

        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const pdf_base64 = btoa(binary);

        return json(200, {
            ok: true, 
            pdf_url, 
            total, 
            reference: quote.reference ?? null, 
            pdf_base64
        });
    } catch (e) {
        console.error('quote-pdf failed.', e);
        return json(400, { error: String(e) });
    }
});