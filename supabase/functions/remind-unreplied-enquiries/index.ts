import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import {
	THRESHOLD_HOURS,
	serviceClient,
	hoursAgoIso,
	hoursBetween,
	guard,
	recipientsByRole,
	notifyRecipients,
	reminderEmail
} from '../_shared/reminders.ts';

function esc(v: string): string {
	return String(v ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (!guard(req)) return json(401, { error: 'Unauthorized' });

	try {
		const admin = serviceClient();

		const { data: enquiries } = await admin
			.from('enquiries')
			.select('id, name, email, company, created_at, replied_at, reminder_sent_at')
			.is('replied_at', null)
			.is('reminder_sent_at', null)
			.lte('created_at', hoursAgoIso(THRESHOLD_HOURS))
			.order('created_at', { ascending: true });

		const overdue = enquiries ?? [];
		if (overdue.length === 0) return json(200, { ok: true, reminded: 0 });

		const admins = await recipientsByRole(admin, ['admin']);

		const now = Date.now();

		for (const e of overdue) {
			const hrs = hoursBetween(e.created_at, now);
			await notifyRecipients(admin, admins, {
				type: 'enquiry_reminder',
				quote_id: null,
				title: `Enquiry from ${e.name} awaiting your reply`,
				body: `This enquiry has been waiting for a reply for about ${hrs} hours.`
			});
		}

		const rowsHtml = [
			`<tr style="background:#e7f0f8"><th align="left">Name</th><th align="left">E-mail</th><th align="left">Company</th><th align="right">Hours waiting</th></tr>`,
			...overdue.map((e: any) => {
				const hrs = hoursBetween(e.created_at, now);
				return `<tr><td>${esc(e.name)}</td><td>${esc(e.email)}</td><td>${esc(e.company ?? '-')}</td><td align="right">${hrs}</td></tr>`;
			})
		].join('');

		const html = reminderEmail({
			heading: 'Enquiry waiting a reply',
			intro: `The following ${overdue.length} enquiry(ies) have been waiting for a reply for more than ${THRESHOLD_HOURS} hours.`,
			rowsHtml,
			ctaLabel: 'Reply Enquiries',
			ctaPath: '/app/enquiries'
		});

		let emailed = 0;
		for (const r of admins) {
			if (!r.email) continue;
			try {
				await sendEmail(
					r.email,
					`BME e-Serve App — ${overdue.length} enquiry(ies) awaiting reply`,
					html,
					undefined,
					{ kind: 'reminder_enquiries' }
				);
				emailed++;
			} catch (err) {
				console.error('Enquiry reminder e-mail failed for', r.email, err);
			}
		}

		await admin
			.from('enquiries')
			.update({ reminder_sent_at: new Date().toISOString() })
			.in(
				'id',
				overdue.map((e: any) => e.id)
			);

		return json(200, { ok: true, reminded: overdue.length, admins: admins.length, emailed });
	} catch (e) {
		console.error('remind-unreplied-enquiries failed:', e);
		return json(400, { error: String(e) });
	}
});
