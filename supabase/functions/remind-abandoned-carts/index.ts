import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import {
	THRESHOLD_HOURS,
	serviceClient,
	hoursAgoIso,
	hoursBetween,
	guard,
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

type CartItem = {
	partNumber?: string;
	partName?: string;
	boilerCode?: string;
	quantity?: number;
};

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (!guard(req)) return json(401, { error: 'Unauthorized' });

	try {
		const admin = serviceClient();

		const { data: carts } = await admin
			.from('cart_state')
			.select('user_id, items, updated_at, reminder_sent_at')
			.lte('updated_at', hoursAgoIso(THRESHOLD_HOURS));

		const overdue = (carts ?? []).filter((c: any) => {
			const items: CartItem[] = Array.isArray(c.items) ? c.items : [];
			if (items.length === 0) return false;
			return !c.reminder_sent_at || new Date(c.reminder_sent_at) < new Date(c.updated_at);
		});

		if (overdue.length === 0) return json(200, { ok: true, reminded: 0 });

		const userIds = overdue.map((c: any) => c.user_id);
		const { data: profiles } = await admin
			.from('profiles')
			.select('id, email, full_name')
			.in('id', userIds);
		const profileById: Record<string, any> = {};
		for (const p of profiles ?? []) profileById[p.id] = p;

		const now = Date.now();
		let emailed = 0;

		for (const c of overdue) {
			const recipient = profileById[c.user_id];
			const items: CartItem[] = Array.isArray(c.items) ? c.items : [];
			const hrs = hoursBetween(c.updated_at, now);

			await notifyRecipients(
				admin,
				[
					{
						id: c.user_id,
						email: recipient?.email ?? null,
						full_name: recipient?.full_name ?? null
					}
				],
				{
					type: 'cart_reminder',
					quote_id: null,
					title: 'Items waiting in your quote list',
					body: `You have ${items.length} item(s) in your quote list. Submit to get a quotation.`
				}
			);

			if (!recipient?.email) continue;

			const rowsHtml = [
				`<tr style="background:#e7f0f8"><th align="left">Part No.</th><th align="left">Name</th><th align="left">Boiler</th><th align="right">Qty</th></tr>`,
				...items.map((it) => {
					return `<tr><td>${esc(it.partNumber ?? '-')}</td><td>${esc(it.partName ?? '-')}</td><td>${esc(it.boilerCode ?? '-')}</td><td align="right">${it.quantity ?? 1}</td></tr>`;
				})
			].join('');

			const html = reminderEmail({
				heading: 'You left items in the quote list',
				intro: `You have ${items.length} item(s) waiting in your quote list. Submit your request to get a quotation.`,
				rowsHtml,
				ctaLabel: 'View Quote List',
				ctaPath: '/app/quotes'
			});

			try {
				await sendEmail(
					recipient.email,
					'BME e-Serve App — items waiting in your quote list',
					html,
					undefined,
					{ kind: 'reminder_cart' }
				);
				emailed++;
			} catch (e) {
				console.error('Cart reminder e-mail failed for', recipient.email, e);
			}
		}

		await admin
			.from('cart_state')
			.update({ reminder_sent_at: new Date().toISOString() })
			.in(
				'user_id',
				overdue.map((c: any) => c.user_id)
			);

		return json(200, { ok: true, reminded: overdue.length, emailed });
	} catch (e) {
		console.error('remind-abandoned-carts failed:', e);
		return json(400, { error: String(e) });
	}
});
