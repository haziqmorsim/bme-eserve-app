import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { getAdminEmail } from '../_shared/settings.ts';
import {
	REMINDER_SETTING,
	reminderHours,
	serviceClient,
	hoursBetween,
	guard,
	recipientsByRole,
	notifyRecipients,
	reminderEmail
} from '../_shared/reminders.ts';

function esc(v: unknown): string {
	return String(v ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function fmtDate(iso: string): string {
	return new Date(iso).toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Kuala_Lumpur'
	});
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (!guard(req)) return json(401, { error: 'Unauthorized' });

	try {
		const admin = serviceClient();
		const threshold = await reminderHours(admin, REMINDER_SETTING.pendingRequests);

		const { data: quotes } = await admin
			.from('quotes')
			.select('id, reference, created_at, reminder_sent_at')
			.eq('status', 'open');

		const open = quotes ?? [];
		if (open.length === 0) return json(200, { ok: true, reminded: 0, threshold });

		const ids = open.map((q: any) => q.id);
		const { data: approvals } = await admin
			.from('quote_approvals')
			.select('quote_id, created_at')
			.in('quote_id', ids);

		const lastActivity: Record<string, string> = {};
		for (const a of approvals ?? []) {
			const prev = lastActivity[a.quote_id];
			if (!prev || new Date(a.created_at) > new Date(prev)) lastActivity[a.quote_id] = a.created_at;
		}

		const now = Date.now();
		const overdue = open.filter((q: any) => {
			const since = lastActivity[q.id] ?? q.created_at;
			const hrs = (now - new Date(since).getTime()) / 3600000;
			if (hrs < threshold) return false;

			return !q.reminder_sent_at || new Date(q.reminder_sent_at) < new Date(since);
		});

		if (overdue.length === 0) return json(200, { ok: true, reminded: 0, threshold });

		const staff = await recipientsByRole(admin, ['admin', 'manager', 'coo']);

		for (const q of overdue) {
			const since = lastActivity[q.id] ?? q.created_at;
			const hrs = hoursBetween(since, now);
			await notifyRecipients(admin, staff, {
				type: 'request_reminder',
				quote_id: q.id,
				title: `Request ${q.reference} awaiting action`,
				body: `This request has been waiting for action for about ${hrs} hours.`
			});
		}

		const rowsHtml = [
			`<tr style="background:#e7f0f8"><th align="left">Reference</th><th align="left">Submitted</th><th align="right">Hours waiting</th></tr>`,
			...overdue.map((q: any) => {
				const since = lastActivity[q.id] ?? q.created_at;
				const hrs = hoursBetween(since, now);
				return `<tr><td>${esc(q.reference)}</td><td>${esc(fmtDate(q.created_at))}</td><td align="right">${hrs}</td></tr>`;
			})
		].join('');

		const html = reminderEmail({
			heading: 'Requests awaiting action',
			intro: `The following ${overdue.length} request(s) have been waiting for action for more than ${threshold} hours.`,
			rowsHtml,
			ctaLabel: 'Review Requests',
			ctaPath: '/app/requests'
		});

		let emailed = 0;
		const warnings: string[] = [];
		const adminEmail = await getAdminEmail(admin);
		if (!adminEmail) {
			warnings.push('No admin e-mail configured (Settings > General), e-mail not sent.');
			console.warn('remind-pending-requests: no admin e-mail configured, e-mail not sent.');
		} else {
			try {
				await sendEmail(
					adminEmail,
					`BME e-Serve App — ${overdue.length} request(s) awaiting action`,
					html,
					undefined,
					{ kind: 'reminder_requests' }
				);
				emailed = 1;
			} catch (e) {
				warnings.push(`admin_email_failed: ${String(e)}`);
				console.error('Request reminder e-mail failed for', adminEmail, e);
			}
		}

		await admin
			.from('quotes')
			.update({ reminder_sent_at: new Date().toISOString() })
			.in(
				'id',
				overdue.map((q: any) => q.id)
			);

		return json(200, { ok: true, reminded: overdue.length, threshold, staff: staff.length, emailed, warnings });
	} catch (e) {
		console.error('remind-pending-requests failed:', e);
		return json(400, { error: String(e) });
	}
});