import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing token' });

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user }
    } = await userClient.auth.getUser();
    if (!user) return json(401, { error: 'Unauthorized' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json(403, { error: 'Admins only' });

    const { quote_id, action } = await req.json(); // action: 'approve' | 'reject'

    const { data: quote } = await admin
      .from('quotes')
      .select('id, reference, notes, user_id, quote_items(*)')
      .eq('id', quote_id)
      .single();
    if (!quote) return json(404, { error: 'Quote not found' });

    const { data: userInfo } = await admin.auth.admin.getUserById(quote.user_id);
    const customerEmail = userInfo.user?.email;

    if (action === 'reject') {
      await admin
        .from('quotes')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', quote_id);

      if (customerEmail) {
        await sendEmail(
          customerEmail,
          `BME e‑Serve — quotation ${quote.reference} update`,
          `<p>Your quotation request <strong>${quote.reference}</strong> could not be approved at this time. Our team will be in touch.</p>`
        );
      }
      return json(200, { ok: true, status: 'rejected' });
    }

    const pdfBytes = await buildQuotePdf(quote);
    const path = `${quote.user_id}/${quote.reference}.pdf`;

    await admin.storage
      .from('quotes')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    const { data: signed } = await admin.storage
      .from('quotes')
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days

    await admin
      .from('quotes')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        pdf_url: signed?.signedUrl ?? null
      })
      .eq('id', quote_id);

    if (customerEmail) {
      await sendEmail(
        customerEmail,
        `Your BME e‑Serve quotation ${quote.reference} is approved`,
        `<div style="font-family:Arial,sans-serif;color:#1C2A14">
           <h2 style="color:#2F5E18">Quotation approved ✅</h2>
           <p>Your quotation <strong>${quote.reference}</strong> has been approved and is attached as a PDF.</p>
           ${signed?.signedUrl ? `<p>You can also <a href="${signed.signedUrl}">download it here</a> (link valid 30 days).</p>` : ''}
           <p>Thank you for using BME e‑Serve.</p>
         </div>`,
        [{ filename: `${quote.reference}.pdf`, content: encodeBase64(pdfBytes) }]
      );
    }

    return json(200, { ok: true, status: 'approved' });
  } catch (e) {
    return json(400, { error: String(e) });
  }
});

async function buildQuotePdf(quote: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.18, 0.37, 0.09);
  const ink = rgb(0.11, 0.16, 0.08);
  const muted = rgb(0.42, 0.48, 0.39);

  let y = 800;
  page.drawText('BME e-Serve', { x: 40, y, size: 22, font: bold, color: green });
  page.drawText('Boiler Parts Quotation', { x: 40, y: y - 22, size: 12, font, color: muted });

  page.drawText(`Quotation: ${quote.reference}`, { x: 360, y, size: 12, font: bold, color: ink });
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: 360, y: y - 18, size: 11, font, color: muted
  });

  y -= 70;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 22, color: rgb(0.93, 0.95, 0.92) });
  const cols = [44, 150, 330, 420, 480];
  const headers = ['Part #', 'Description', 'Boiler', 'Qty', 'Unit (MYR)'];
  headers.forEach((h, i) => page.drawText(h, { x: cols[i], y, size: 10, font: bold, color: ink }));

  y -= 24;
  let total = 0;
  for (const it of quote.quote_items) {
    const line = Number(it.unit_price) * it.quantity;
    total += line;
    page.drawText(String(it.part_number), { x: cols[0], y, size: 10, font, color: ink });
    page.drawText(trim(it.part_name, 30), { x: cols[1], y, size: 10, font, color: ink });
    page.drawText(String(it.boiler_code), { x: cols[2], y, size: 10, font, color: ink });
    page.drawText(String(it.quantity), { x: cols[3], y, size: 10, font, color: ink });
    page.drawText(Number(it.unit_price).toFixed(2), { x: cols[4], y, size: 10, font, color: ink });
    y -= 18;
    if (y < 90) { y = 800; doc.addPage([595, 842]); }
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, color: rgb(0.89, 0.91, 0.87) });
  y -= 22;
  page.drawText('Estimated total:', { x: 360, y, size: 12, font: bold, color: ink });
  page.drawText(`MYR ${total.toFixed(2)}`, { x: 480, y, size: 12, font: bold, color: green });

  if (quote.notes) {
    y -= 40;
    page.drawText('Notes:', { x: 40, y, size: 10, font: bold, color: muted });
    page.drawText(trim(quote.notes, 90), { x: 40, y: y - 16, size: 10, font, color: ink });
  }

  page.drawText('This quotation is indicative and subject to BME confirmation.', {
    x: 40, y: 50, size: 9, font, color: muted
  });

  return await doc.save();
}

function trim(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s ?? '';
}