import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
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

    const body = await req.json();
    const { quote_id, action } = body;
    const priceMap: Record<string, number> = body.prices ?? {};

    const { data: quote } = await admin
      .from('quotes')
      .select('id, reference, notes, user_id, quote_items(*)')
      .eq('id', quote_id)
      .single();
    if (!quote) return json(404, { error: 'Quote not found' });

    const { data: userInfo } = await admin.auth.admin.getUserById(quote.user_id);
    const customerEmail = userInfo.user?.email;

    const warnings: string[] = [];

    if (action === 'reject') {
      await admin
        .from('quotes')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', quote_id);

      if (customerEmail) {
        try {
          await sendEmail(
            customerEmail,
            `BME e-Serve — quotation ${quote.reference} update`,
            `<p>Your quotation request <strong>${quote.reference}</strong> could not be approved at this time. Our team will be in touch.</p>`
          );
        } catch (e) {
          console.error('Rejection email failed:', e);
          warnings.push(`customer_email_failed: ${String(e)}`);
        }
      } else {
        warnings.push('customer_email_missing');
      }
      return json(200, { ok: true, status: 'rejected', warnings });
    }

    for (const it of quote.quote_items) {
      const p = Number(priceMap[it.id]);
      it.unit_price = Number.isFinite(p) ? p : Number(it.unit_price) || 0;
    }
    await Promise.all(
      quote.quote_items.map((it: any) =>
        admin.from('quote_items').update({ unit_price: it.unit_price }).eq('id', it.id)
      )
    );

    const pdfBytes = await buildQuotePdf(quote);
    const path = `${quote.user_id}/${quote.reference}.pdf`;

    await admin.storage
      .from('quotes')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    const { data: signed } = await admin.storage
      .from('quotes')
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    await admin
      .from('quotes')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        pdf_url: signed?.signedUrl ?? null
      })
      .eq('id', quote_id);

    if (customerEmail) {
      try {
        await sendEmail(
          customerEmail,
          `Your BME e-Serve quotation ${quote.reference} is approved`,
          `<div style="font-family:Arial,sans-serif;color:#1C2A14">
             <h2 style="color:#004b8d">Quotation Approved</h2>
             <p>Your quotation <strong>${quote.reference}</strong> has been approved and is attached as a PDF.</p>
             ${signed?.signedUrl ? `<p>You can also download it <a href="${signed.signedUrl}">here</a> (link valid 30 days).</p>` : ''}
             <p>Thank you for using BME e-Serve.</p>
           </div>`,
          [{ filename: `${quote.reference}.pdf`, content: encodeBase64(pdfBytes) }]
        );
      } catch (e) {
        console.error('Approval email failed:', e);
        warnings.push(`customer_email_failed: ${String(e)}`);
      }
    } else {
      warnings.push('customer_email_missing');
    }

    return json(200, { ok: true, status: 'approved', warnings });
  } catch (e) {
    return json(400, { error: String(e) });
  }
});

async function buildQuotePdf(quote: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const blue = rgb(0, 0.294, 0.553);
  const ink = rgb(0.11, 0.16, 0.08);
  const muted = rgb(0.42, 0.48, 0.39);
  const headerBg = rgb(0.91, 0.95, 0.99);
  const ruleColor = rgb(0.85, 0.88, 0.92);

  const center = (text: string, cx: number, y: number, size: number, f: any, color: any) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: cx - w / 2, y, size, font: f, color });
  };

  const right = (text: string, rx: number, y: number, size: number, f: any, color: any) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rx - w, y, size, font: f, color });
  };

  const logoH = 84;
  let topY = 815;
  const logoUrl = Deno.env.get('LOGO_URL');
  if (logoUrl) {
    try {
      const resp = await fetch(logoUrl);
      if (resp.ok) {
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const img = logoUrl.toLowerCase().endsWith('.png')
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const logoW = (img.width / img.height) * logoH;
        page.drawImage(img, { x: 40, y: 815 - logoH, width: logoW, height: logoH });
        topY = 815 - logoH - 48;
      }
    } catch (e) {
      console.error('Logo embed failed:', e);
    }
  }

  page.drawText('BME e-Serve', { x: 40, y: topY, size: 20, font: bold, color: blue });
  page.drawText('Boiler Parts Quotation', { x: 40, y: topY - 24, size: 12, font, color: muted });

  const d = new Date();
  const dateStr =
    `${String(d.getDate()).padStart(2, '0')}/` +
    `${String(d.getMonth() + 1).padStart(2, '0')}/` +
    `${d.getFullYear()}`;
  right(`Quotation: ${quote.reference}`, 555, topY, 13, bold, ink);
  right(`Date: ${dateStr}`, 555, topY - 22, 11, font, muted);

  const bounds = [40, 135, 300, 360, 410, 480, 555];
  const centerOf = (i: number) => (bounds[i] + bounds[i + 1]) / 2;
  const descLeft = bounds[1] + 6;

  let y = topY - 56;

  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 22, color: headerBg });
  const headers = ['Part No.', 'Description', 'Boiler', 'Qty', 'Unit (RM)', 'Amount (RM)'];
  headers.forEach((h, i) => center(h, centerOf(i), y, 10, bold, ink));

  y -= 24;
  let total = 0;
  for (const it of quote.quote_items) {
    const unit = Number(it.unit_price) || 0;
    const amount = unit * it.quantity;
    total += amount;

    center(String(it.part_number), centerOf(0), y, 10, font, ink);
    page.drawText(trim(it.part_name, 30), { x: descLeft, y, size: 10, font, color: ink });
    center(String(it.boiler_code), centerOf(2), y, 10, font, ink);
    center(String(it.quantity), centerOf(3), y, 10, font, ink);
    center(unit.toFixed(2), centerOf(4), y, 10, font, ink);
    center(amount.toFixed(2), centerOf(5), y, 10, font, ink);

    y -= 18;
    if (y < 90) { page = doc.addPage([595, 842]); y = 800; }
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, color: ruleColor });
  y -= 22;
  page.drawText('Total:', { x: bounds[4], y, size: 12, font: bold, color: ink });
  center(`RM${total.toFixed(2)}`, centerOf(5), y, 12, bold, blue);

  if (quote.notes) {
    y -= 40;
    page.drawText('Notes:', { x: 40, y, size: 10, font: bold, color: muted });
    page.drawText(trim(quote.notes, 90), { x: 40, y: y - 16, size: 10, font, color: ink });
  }

  // page.drawText('Prices are in Ringgit Malaysia (RM) and reflect the approved quotation.', {
  //   x: 40, y: 50, size: 9, font, color: muted
  // });

  return await doc.save();
}

function trim(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s ?? '';
}