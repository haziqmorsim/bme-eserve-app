import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const { profile } = await parent();
	if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

	const { data: rows } = await supabase
		.from('email_log')
		.select('id, to_email, subject, kind, related_ref, status, error, attachments, created_at')
		.order('created_at', { ascending: false })
		.limit(300);

	const list = rows ?? [];
	const since24h = Date.now() - DAY_MS;
	const since7d = Date.now() - 7 * DAY_MS;

	const failed = list.filter((r: any) => r.status === 'failed');
	const failed24h = failed.filter((r: any) => new Date(r.created_at).getTime() >= since24h).length;
	const last7d = list.filter((r: any) => new Date(r.created_at).getTime() >= since7d);
	const sent7d = last7d.filter((r: any) => r.status === 'sent').length;
	const failed7d = last7d.filter((r: any) => r.status === 'failed').length;
	const attempted7d = sent7d + failed7d;

	return {
		rows: list,
		stats: {
			total: list.length,
			failedTotal: failed.length,
			failed24h,
			sent7d,
			failed7d,
			successRate7d: attempted7d > 0 ? Math.round((sent7d / attempted7d) * 100) : null
		},
		title: 'E-mail Deliveries'
	};
};
