import { corsHeaders, json } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

function esc(value: string): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
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

        const html = `
        <div style="font-family:Arial,sans-serif;color:#1C2A14">
            <h2 style="color:#2F5E18">New general enquiry — BME e-Serve</h2>
            <table cellpadding="6" style="font-size:14px">
                <tr><td><strong>Name</strong></td><td>${esc(name)}</td></tr>
                <tr><td><strong>E-mail</strong></td><td>${esc(email)}</td></tr>
                ${company?.trim() ? `<tr><td><strong>Company</strong></td><td>${esc(company)}</td></tr>` : ''}
            </table>
            <p style="margin-top:16px"><strong>Message</strong></p>
            <p style="white-space:pre-wrap">${esc(message)}</p>
            <p style="color:#6B7A63;font-size:13px;margin-top:24px">
                Reply directly to <a href="mailto:${esc(email)}">${esc(email)}</a> to respond to this enquiry.
            </p>
        </div>`;

        await sendEmail(
            Deno.env.get('ADMIN_EMAIL')!,
            `General enquiry from ${name.trim()}`,
            html
        );

        return json(200, { ok: true });
    } catch (e) {
        console.error('General enquiry failed:', e);
        return json(400, { error: String(e) });
    }
});