import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { appUrl, ctaButton } from './email-ui.ts';

export const THRESHOLD_HOURS = 48;

const BRAND = {
    blue: '#004b8d', 
    darker: '#003a6d', 
    ink: '#1f2933', 
    muted: '#6b7280', 
    border: '#e5e7eb', 
    bg: '#f4f6f9'
};

export function serviceClient(): SupabaseClient {
    return CreateClient(
        Deno.env.get('SUPABASE_URL')!, 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
}

export function hoursAgoIso(hours: number): string {
    return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export function hoursBetween(fromIso: string, toMs = Date.now()): number {
    return Math.floor((toMs - new Date(fromIso).getTime()) / 3600000);
}

export function guard(req: Request): boolean {
    const secret = Deno.env.get('REMINDER_SECRET');
    if (!secret) return true;
    return req.headers.get('x-eserve-key') === secret;
}

export type Recipient = { id: string; email: string | null; full_name: string | null };

export async function recipientsByRole(admin: SupabaseClient, roles: string[]):
Promise<Recipient[]> {
    const { data } = await admin
        .from('profiles')
        .select('id, email, full_name, role')
        .in('role', roles);
    return (data ?? []).map((p: any) => ({ id: p.id, email: p.email, full_name: p.full_name }));
}

export async function notifyRecipients(
    admin: SupabaseClient, 
    recipients: Recipient[], 
    n: { type: string; title: string, body: string; quote_id?: string | null }
): Promise<void> {
    if (recipients.length === 0) return;
    const rows = recipients.map((r) => ({
        user_id: r.id, 
        quote_id: n.quote_id ?? null, 
        type: n.type, 
        title: n.title, 
        body: n.body
    }));
    await admin.from('notifications').insert(rows);
}

export function reminderEmail(opts: {
    heading: string;
    intro: string;
    rowsHtml: string;
    ctaLabel: string;
    ctaPath: string;
}): string {
    const url = appUrl(opts.ctaPath);
    return `
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
    <body style="margin:0;padding:0;background:${BRAND.bg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 0;">
            <tr><td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
                    <tr><td style="background:${BRAND.blue};height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
                    <tr><td style="padding:24px 32px 4px;">
                        <h1 style="margin:0;font-size:19px;color:${BRAND.blue};">${opts.heading}</h1>
                    </td></tr>
                    <tr><td style="padding:8px 32px 0;color:${BRAND.ink};font-size:14px;line-height:1.6;">
                        <p style="margin:0 0 12px;">${opts.intro}</p>
                        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13.5px;">
                            ${opts.rowsHtml}
                        </table>
                    </td></tr>
                    <tr><td style="padding:8px 32px 28px;">
                        ${ctaButton(opts.ctaLabel, url, BRAND.blue)}
                        <hr style="border:none;border-top:1px solid ${BRAND.border};margin:12px 0 14px;" />
                        <p style="margin:0;color:${BRAND.muted};font-size:12px;">This is an automated reminder from BME e-Serve. Please do not reply to this email.</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body></html>`;
}