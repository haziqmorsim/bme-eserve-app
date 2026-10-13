import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';

const BRAND = {
    blue: '#004b8d',
	green: '#6CB33F',
	ink: '#1f2933',
	muted: '#6b7280',
	border: '#e5e7eb',
	bg: '#f4f6f9',
	box: '#f3f7fb'
};

const SUBJECT = 'You have been invited to join BME e-Serve App';

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function buildInvitationEmail(
    email: string,
    password: string,
    signInUrl: string,
    logoUrl: string | null
): string {
    const logo = logoUrl
        ? `<img src="${esc(logoUrl)}" alt="BME e-Serve" width="120" style="display:block;height:auto;border:0;margin:0 auto 6px;" />`
        : '';

    const button = signInUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
                <tr>
                    <td align="center" bgcolor="${BRAND.blue}" style="border-radius:10px;">
                        <a href="${esc(signInUrl)}" target="_blank" rel="noopener"
                            style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                            Sign In
                        </a>
                    </td>
                </tr>
            </table>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
                    <tr>
                        <td style="background:${BRAND.blue};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td style="padding:28px 36px 8px;text-align:center;">
                            ${logo}
                            <h1 style="margin:8px 0 0;font-size:20px;color:${BRAND.blue};">You have been invited to join BME e-Serve App</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 36px 0;color:${BRAND.ink};font-size:15px;line-height:1.6;">
                            <p style="margin:0 0 14px;">Please sign in using this e-mail and the temporary password below.</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:${BRAND.box};border:1px solid ${BRAND.border};border-radius:10px;">
                                <tr>
                                    <td style="padding:14px 18px;font-size:14px;line-height:1.7;">
                                        <span style="color:${BRAND.muted};">E-mail</span><br />
                                        <strong style="color:${BRAND.ink};word-break:break-all;">${esc(email)}</strong>
                                        <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
                                        <span style="color:${BRAND.muted};">Temporary password</span><br />
                                        <strong style="color:${BRAND.ink};font-family:Consolas,'Courier New',monospace;font-size:16px;letter-spacing:0.5px;word-break:break-all;">${esc(password)}</strong>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 18px;color:${BRAND.muted};font-size:14px;">You will be prompted to change your password after your first sign-in</p>
                            ${button}
                            <p style="margin:18px 0 0;color:${BRAND.ink};font-size:15px;">Regards,<br />BME e-Serve App</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 36px 28px;">
                            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
                            ${
								signInUrl
									? `<p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.5;word-break:break-all;">
                                If the button does not work, copy and paste this link into your browser:<br />
                                <a href="${esc(signInUrl)}" target="_blank" rel="noopener" style="color:${BRAND.blue};">${esc(signInUrl)}</a>
                            </p>`
									: ''
							}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

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

        const { data: me } = await admin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (me?.role !== 'staff' && me?.role !== 'developer') return json(403, { error: 'Forbidden' });

        const body = await req.json().catch(() => ({}));
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!email || !password) {
            return json(400, { error: 'E-mail and temporary password are required.' });
        }

        const escapedEmail = email.replace(/[%_\\]/g, (ch) => `\\${ch}`);
        const { data: target } = await admin
            .from('profiles')
            .select('id, must_change_password')
            .ilike('email', escapedEmail)
            .maybeSingle();
        if (!target) return json(404, { error: 'No user with this e-mail address exists.' });
        if (!target.must_change_password) {
            return json(400, { error: 'This user has already signed in, so an invitation can no longer be sent.' });
        }

        const base = (
            Deno.env.get('SITE_URL') ??
            Deno.env.get('APP_BASE_URL') ??
            req.headers.get('origin') ??
            ''
        ).replace(/\/+$/, '');
        const signInUrl = base ? `${base}/login` : '';
        const logoUrl = Deno.env.get('LOGO_URL') ?? null;

        await sendEmail(email, SUBJECT, buildInvitationEmail(email, password, signInUrl, logoUrl), undefined, {
            kind: 'user_invitation'
        });

        return json(200, { ok: true });
    } catch(e) {
        return json(500, { error: String(e instanceof Error ? e.message : e) });
    }
});