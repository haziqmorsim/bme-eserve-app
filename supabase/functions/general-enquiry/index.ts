import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { appUrl, ctaButton } from "../_shared/email-ui.ts";

const BRAND = {
    blue: '#004b8d',
    green: '#6CB33F',
    ink: '#1f2933',
    muted: '#6b7280',
    border: '#e5e7eb',
    bg: '#f4f6f9'
};

function esc(value: string): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function buildConfirmationEmail(name: string, message: string, logoUrl: string | null): string {
    const logo = logoUrl
        ? `<img src="${logoUrl}" alt="BME e-Serve" width="120" style="display:block;height:auto;border:0;margin:0 auto 6px;" />`
        : '';
    return `
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
    <body style="margin:0;padding:0;background:${BRAND.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 0;">
            <tr><td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
                    <tr><td style="background:${BRAND.blue};height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
                    <tr><td style="padding:28px 36px 8px;text-align:center;">
                        ${logo}
                        <h1 style="margin:8px 0 0;font-size:20px;color:${BRAND.blue};">We've received your enquiry</h1>
                    </td></tr>
                    <tr><td style="padding:14px 36px 0;color:${BRAND.ink};font-size:15px;line-height:1.6;">
                        <p style="margin:0 0 14px;">Hi ${esc(name)},</p>
                        <p style="margin:0 0 14px;">Thank you for contacting BoilerMech. Your enquiry has been received and our team will get back to you shortly.</p>
                        <p style="margin:0 0 6px;color:${BRAND.muted};font-size:13px;">Your message:</p>
                        <div style="min-height:48px;padding:12px 14px;background:${BRAND.bg};border-radius:6px;color:${BRAND.ink};font-size:14px;white-space:pre-wrap;text-align:center;">${esc(message)}</div>
                        <p style="margin:18px 0 0;color:${BRAND.ink};font-size:15px;">Regards,<br />BME e-Serve App</p>
                    </td></tr>
                    <tr><td style="padding:24px 36px 28px;">
                        <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
                        <p style="margin:0;color:${BRAND.muted};font-size:12px;">This is an automated confirmation — please do not reply to this email.</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body></html>`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { name, email, company, message } = await req.json();

        if (!name?.trim() || !email?.trim() || !message?.trim()) {
            return json(400, { error: 'Name, e-mail and message are required.' });
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
            return json(400, { error: 'Please provide a valid e-mail address.' });
        }

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { error: insErr } = await admin.from('enquiries').insert({
            name: name.trim(),
            email: email.trim(),
            company: company?.trim() || null,
            message: message.trim()
        });
        if (insErr) return json(400, { error: insErr.message });

        const adminHtml = `
        <div style="font-family:Arial,sans-serif;color:#1C2A14">
            <h2 style="color:#004b8d">New general enquiry — BME e-Serve</h2>
            <table cellpadding="6" style="font-size:14px">
                <tr><td valign="top"><strong>Name</strong></td><td>${esc(name)}</td></tr>
                <tr><td valign="top"><strong>E-mail</strong></td><td>${esc(email)}</td></tr>
                ${company?.trim() ? `<tr><td valign="top"><strong>Company</strong></td><td>${esc(company)}</td></tr>` : ''}
                <tr><td valign="top"><strong>Message</strong></td><td style="white-space:pre-wrap">${esc(message)}</td></tr>
            </table>
            <p style="color:#6B7A63;font-size:13px;margin-top:24px">
                Reply this enquiry here directly or in the BME e-Serve Enquiries page.
            </p>
            ${ctaButton('Reply Enquiry', appUrl('/app/enquiries'), '#004b8d')}
        </div>`;

        const logoUrl = Deno.env.get('LOGO_URL') ?? null;

        try {
            await sendEmail(Deno.env.get('ADMIN_EMAIL')!, `General enquiry from ${name.trim()}`, adminHtml);
        } catch (e) {
            console.error('Admin enquiry email failed:', e);
        }
        try {
            await sendEmail(email.trim(), 'We received your enquiry — BME e-Serve', buildConfirmationEmail(name.trim(), message.trim(), logoUrl));
        } catch (e) {
            console.error('Confirmation email failed:', e);
        }

        return json(200, { ok: true });
    } catch (e) {
        console.error('General enquiry failed:', e);
        return json(400, { error: String(e) });
    }
});