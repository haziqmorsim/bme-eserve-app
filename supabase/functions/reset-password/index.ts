import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';

const BRAND = {
	blue: '#004b8d',
	darkBlue: '#003a6d',
	green: '#6CB33F',
	ink: '#1f2933',
	muted: '#6b7280',
	border: '#e5e7eb',
	bg: '#f4f6f9'
};

function buildResetEmail(actionLink: string, logoUrl: string | null): string {
	const logo = logoUrl
		? `<img src="${logoUrl}" alt="BME e-Serve" width="120" style="display:block;height:auto;border:0;margin:0 auto 6px;" />`
		: '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
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
                            <h1 style="margin:8px 0 0;font-size:20px;color:${BRAND.blue};">Reset your password</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 36px 0;color:${BRAND.ink};font-size:15px;line-height:1.6;">
                            <p style="margin:0 0 18px;">We received a request to reset your password. Click the button below to create a new password.</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
                                <tr>
                                    <td align="center" bgcolor="${BRAND.blue}" style="border-radius:10px;">
                                        <a href="${actionLink}" target="_blank" rel="noopener"
                                           style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 14px;color:${BRAND.muted};font-size:14px;">This link will expire in 30 minutes.</p>
                            <p style="margin:0 0 14px;color:${BRAND.muted};font-size:14px;">If you did not request for a password reset, you can ignore this e-mail.</p>
                            <p style="margin:18px 0 0;color:${BRAND.ink};font-size:15px;">Regards,<br />BME e-Serve App</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 36px 28px;">
                            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
                            <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.5;word-break:break-all;">
                                If the button does not work, copy and paste this link into your browser:<br />
                                <a href="${actionLink}" target="_blank" rel="noopener" style="color:${BRAND.blue};">${actionLink}</a>
                            </p>
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
		const { email } = await req.json().catch(() => ({ email: '' }));
		if (!email || typeof email !== 'string') {
			return json(400, { error: 'A valid e-mail address is required.' });
		}

		const base = (Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? '').replace(/\/+$/, '');
		if (!base) return json(500, { error: 'SITE_URL is not configured.' });
		const redirectTo = `${base}/reset-password`;

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
		);

		const escapedEmail = email.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`);
		const { data: match } = await admin
			.from('profiles')
			.select('id')
			.ilike('email', escapedEmail)
			.maybeSingle();

		if (!match) {
			return json(404, {
				error: 'not_found',
				message: 'An account with this e-mail address does not exist.'
			});
		}

		const { data, error } = await admin.auth.admin.generateLink({
			type: 'recovery',
			email: email.trim(),
			options: { redirectTo }
		});

		if (error || !data?.properties?.action_link) {
			return json(200, { ok: true });
		}

		const actionLink = data.properties.action_link;
		const logoUrl = Deno.env.get('LOGO_URL') ?? null;

		await sendEmail(
			email.trim(),
			'Reset your BME e-Serve password',
			buildResetEmail(actionLink, logoUrl),
			undefined,
			{ kind: 'password_reset' }
		);

		return json(200, { ok: true });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
