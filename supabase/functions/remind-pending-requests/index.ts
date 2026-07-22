import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import {
    THRESHOLD_HOURS, serviceClient, hoursBetween, guard, 
    recipientByRole, notifyRecipients, reminderEmail
} from '../_shared/reminders.ts';

const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO' };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!guard(req)) return json(401, { error: 'Unauthorized' });

    try {
        const admin = serviceClient();

        const { data: quotes } = await admin
            .from('quotes')
            .select('id, reference, current_level, created_at, reminder_sent_at')
            .eq('status', 'open');

        const open = quotes ?? [];
        if (open.length === 0) return json(200, { ok: true, reminded: 0 });

        const ids = open.map((q: any) => q.id);
        const { data: approvals } = await admin
            .from('quote_approvals')
            .select('quote_id, created_at')
            .in('quote_id', ids);

        const enteredAt: Record<string, string> = {};
        for (const a of approvals ?? []) {
            const prev = enteredAt[a.quote_id];
            if (!prev || new Date(a.created_at) > new Date(prev)) enteredAt[a.quote_id] = a.created_at;
        }

        const now = Date.now();
        const overdue = open.filter((q: any) => {
            const since = enteredAt[q.id] ?? q.created_at;
            const hrs = (now - new Date(since).getTime()) / 3600000;
            if (hrs < THRESHOLD_HOURS) return false;

            return !q.reminder_sent_at || new Date(q.reminder_sent_at) < new Date(since);
        });

        if (overdue.length === 0) return json(200, { ok: true, reminded: 0 });

        const staff = await recipientsByRole(admin, ['admin', 'manager', 'coo']);

        for (const q of overdues) {
            const since = enteredAt[q.id] ?? q.created_at;
            const hrs = hoursBetween(since, now);
            const label = LEVEL_LABEL[q.current_level] ?? `Level ${q.current_level}`;
            await notifyRecipients(admin, staff, {
                type: 'request_reminder', 
                quote_id: q.id, 
                title: `Request ${q.reference} awaiting ${label}`, 
                body: `This request has been pending at the ${label} level for about ${hrs} hours.`
            });
        }

        const rowsHtml = [
            `<tr style="background:#e7f0f8"><th align="left">Reference</th><th align="left">Pending level</th><th align="right">Hours pending</th></tr>`, 
            ...overdue.map((q: any) => {
                const since = enteredAt[q.id] ?? q.created_at;
                const hrs = hoursBetween(since, now);
                const label = LEVEL_LABEL[q.current_level] ?? `Level ${q.current_level}`;
                return `<tr><td>${q.reference}</td><td>${label}</td><td align="right">${hrs}</td></tr>`;
            })
        ].join('');

        const html = reminderEmail({
            heading: 'Request awaiting action', 
            intro: `The following ${overdue.length} request(s) have been pending at their current level for more than ${THRESHOLD_HOURS} hours.`, 
            rowsHtml, 
            ctaLabel: 'Review Requests', 
            ctaPath: '/app/requests'
        });

        let emailed = 0;
        for (const r of staff) {
            if (!r.email) continue;
            try {
                await sendEmail(r.email, `BME e-Serve App — ${overdue.length} request(s) awaiting action`, html);
                emailed++;
            } catch(e) {
                console.error('Request reminder e-mail failed for', r.email, e);
            }
        }

        await admin
            .from('quotes')
            .update({ reminder_sent_at: new Date().toISOString() })
            .in('id', overdue.map((q: any) => q.id));

        return json(200, { ok: true, reminded: overdue.length, staff: staff.length, emailed });
    } catch (e) {
        console.error('reminder-pending-request failed:', e);
        return json(400, { error: String(e) });
    }
});