import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { appUrl, ctaButton } from '../_shared/email-ui.ts';
import { getAdminEmail } from '../_shared/settings.ts';

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

	try {
		const { quote_id } = await req.json();

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
		);

		const { data: quote, error } = await admin
			.from('quotes')
			.select('id, reference, notes, user_id, quote_items(*)')
			.eq('id', quote_id)
			.single();
		if (error || !quote) return json(404, { error: 'Quote not found' });

		const { data: profile } = await admin
			.from('profiles')
			.select('company')
			.eq('id', quote.user_id)
			.single();

		const { data: userInfo } = await admin.auth.admin.getUserById(quote.user_id);

		const customerEmail = userInfo.user?.email ?? null;
		const customerCompany = profile?.company ?? null;

		const rows = quote.quote_items
			.map(
				(i: any) =>
					`<tr><td>${i.part_number}</td><td>${i.part_name}</td><td>${i.boiler_code}</td>` +
					`<td align="center">${i.quantity}</td></tr>`
			)
			.join('');

		const itemsTable = `
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
            <thead><tr style="background:#e7f0f8">
                <th align="left">Part No.</th><th align="left">Part Name</th><th align="left">Boiler</th><th>Quantity</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            </table>`;

		const warnings: string[] = [];

		const adminHtml = `
        <div style="font-family:Arial,sans-serif;color:#1C2A14">
            <h2 style="color:#004b8d">New quotation request — ${quote.reference}</h2>
            <p>From: <strong>${customerEmail ?? 'Unknown e-mail'} (${customerCompany ?? 'Unknown company'})</strong></p>
            ${quote.notes ? `<p><em>Notes:</em> ${quote.notes}</p>` : ''}
            ${itemsTable}
            <p style="margin-top:20px">Review this request in the BME e-Serve Requests page.</p>
            ${ctaButton('Review Request', appUrl('/app/requests'), '#004b8d')}
        </div>`;

		try {
			const adminEmail = await getAdminEmail(admin);
			if (!adminEmail) throw new Error('No admin email configured (Settings > General).');
			await sendEmail(adminEmail, `New quotation ${quote.reference}`, adminHtml, undefined, {
				kind: 'quote_admin',
				relatedRef: quote.reference
			});
		} catch (e) {
			console.error('Admin notification email failed:', e);
			warnings.push(`admin_email_failed: ${String(e)}`);
		}

		if (customerEmail) {
			const customerHtml = `
            <div style="font-family:Arial,sans-serif;color:#1C2A14">
                <h2 style="color:#004b8d">We've received your quotation request</h2>
                <p>Thank you for your request. Your reference number is
                   <strong>${quote.reference}</strong>.</p>
                <p>Here is a summary of the parts you requested:</p>
                ${itemsTable}
                ${quote.notes ? `<p style="margin-top:16px"><em>Your notes:</em> ${quote.notes}</p>` : ''}
                <p style="margin-top:20px">
                    Our team will review your request shortly. Once it is approved, you will
                    receive a confirmation email with the official quotation attached as a PDF.
                </p>
                ${ctaButton('View History', appUrl('/app/history'), '#004b8d')}
                <p style="color:#6B7A63;font-size:13px;margin-top:24px">
                    This email was sent automatically by BME e-Serve. Please do not reply.
                </p>
            </div>`;

			try {
				await sendEmail(
					customerEmail,
					`BME e-Serve — quotation request received (${quote.reference})`,
					customerHtml,
					undefined,
					{ kind: 'quote_customer', relatedRef: quote.reference }
				);
			} catch (e) {
				console.error('Customer confirmation email failed:', e);
				warnings.push(`customer_email_failed: ${String(e)}`);
			}
		} else {
			warnings.push('customer_email_missing');
		}

		return json(200, { ok: true, warnings });
	} catch (e) {
		return json(400, { error: String(e) });
	}
});
