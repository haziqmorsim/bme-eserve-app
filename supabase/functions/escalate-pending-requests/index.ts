import { corsHeaders, json } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import {
    serviceClient, hoursBetween, guard, 
    recipientsByRole, notifyRecipients, reminderEmail, type Recipient
} from "../_shared/reminders.ts";

const ESCALATION_HOURS = 96;

const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO'};

const ESCALATE_TO: Record<number, string[]> = {
    1: ['manager'], 
    2: ['coo'], 
    3: ['admin', 'manager', 'coo']
};

function esc(v: unknown):string {
    return String(v ?? '')
        .replace('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!guard(req)) return json(401, { error: 'Unauthorized' });

    try {
        const admin = serviceClient();

        const { data: quotes } = await admin
            .from('quotes')
            .select('id, reference, current_level, created_at, escalated_at, user_id')
            .eq('status', 'open');

        const open = quotes ?? [];
        if (open.length === 0) return json(200, { ok: true, escalated: 0 });

        const { data: approvals } = await admin
            .from('quote_approvals')
            .select('quote_id, created_at')
            .in('quote_id', open.map((q: any) => q.id));

        const enteredAt: Record<string, string> = {};
        for (const a of approvals ?? []) {
            const prev = enteredAt[a.quote_id];
            if (!prev || new Date(a.created_at) > new Date(prev)) enteredAt[a.quote_id] = a.created_at;
        }

        const now = Date.now();
        const overdue = open.filter((q: any) => {
            const since = enteredAt[q.id] ?? q.created_at;
            const hrs = (now - new Date(since).getTime()) / 3600000;
            if (hrs < ESCALATION_HOURS) return false;
            return !q.escalated_at || new Date(q.escalated_at) < new Date(since);
        });

        if (overdue.length === 0) return json(200, { ok: true, escalated: 0 });

        const ownerIds = [...new Set(overdue.map((q: any) => q.user_id).filter(Boolean))];
        const ownerById: Record<string, any> = {};
        if (ownerIds.length) {
            const { data: owners } = await admin
                .from('profiles')
                .select('id, full_name, company')
                .in('id', ownerIds);
            for (const o of owners ?? []) ownerById[o.id] = o;
        }

        const [admins, managers, coos] = await Promise.all([
            recipientsByRole(admin, ['admin']),
            recipientsByRole(admin, ['manager']),
            recipientsByRole(admin, ['coo'])
        ]);
        const byRole: Record<string, Recipient[]> = { admin: admins, manager: managers, coo: coos };

        const inbox = new Map<string, { recipient: Recipient; rows: any[] }>();

        for (const q of overdue) {
            const since = enteredAt[q.id] ?? q.created_at;
            const hrs = hoursBetween(since, now);
            const label = LEVEL_LABEL[q.current_level] ?? `Level ${q.current_level}`;
            const owner = ownerById[q.user_id];
            const customer = owner?.company || owner?.full_name || 'Unknown customer';
            const isFinalLevel = q.current_level >= 3;

            const targets: Recipient[] = [];
            for (const role of ESCALATE_TO[q.current_level] ?? []) {
                for (const r of byRole[role] ?? []) targets.push(r);
            }
            if (targets.length === 0) continue;

            const body = isFinalLevel
                ? `${q.reference} has been awaiting ${label} action for about ${hrs} hours. This is the final approval level, so there is no higher level to escalate to.`
                : `${q.reference} has been awaiting ${label} action for about ${hrs} hours and has been ascalated to you.`;

            await notifyRecipients(admin, targets, {
                type: 'request_escalation', 
                quote_id: q.id, 
                title: `Escalation: ${q.reference} still with ${label}`, 
                body: `${body} Customer: ${customer}.`
            });

            for (const r of targets) {
                if (!r.email) continue;
                const entry = inbox.get(r.id) ?? { recipient: r, rows: [] };
                entry.rows.push({ reference: q.reference, customer, label, hrs, isFinalLevel });
                inbox.set(r.id, entry);
            }
        }

        let emailed = 0;
        for (const { recipient, rows } of inbox.values()) {
            const rowsHtml = [
                `<tr style="background:#e7f0f8"><th align="left">Reference</th><th align="left">Customer</th><th align="left">Pending level</th><th align="right">Hours pending</th></tr>`, 
                ...rows.map((r) => 
                    `<tr><td>${esc(r.reference)}</td><td>${esc(r.customer)}</td><td>${esc(r.label)}</td><td align="right">${r.hrs}</td></tr>`
                )
            ].join('');

            const anyFinal = rows.some((r) => r.isFinalLevel);
            const intro = anyFinal 
                ? `The following ${rows.length} request(s) have been pending at the same approval level for more than ${ESCALATION_HOURS} hours. Requests shown at the COO level are already at the final approval level.` 
                : `The following ${rows.length} request(s) have been pending at the level below you for more than ${ESCALATION_HOURS} hours and have been escalated to you.`;
            const html = reminderEmail({
                heading: 'Requests escalated to you', 
                intro, 
                rowsHtml, 
                ctaLabel: 'Review Requests', 
                ctaPath: '/app/requests'
            });

            try {
                await sendEmail(
                    recipient.email!,
                    `BME e-Serve App — ${rows.length} request(s) escalated`, 
                    html
                );
                emailed++;
            } catch (e) {
                console.error('Escalation email failed for', recipient.email, e);
            }
        }

        await admin
            .from('quotes')
            .update({ escalated_at: new Date().toISOstring() })
            .in('id', overdue.map((q: any) => q.id));

        return json(200, { ok: true, escalated: overdue.length, recipients: inbox.size, emailed });
    } catch (e) {
        console.error('escalate-pending-request failed:', e);
        return json(400, { error: String(e) });
    }
});