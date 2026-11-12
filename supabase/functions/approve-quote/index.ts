import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { appUrl, ctaButton } from '../_shared/email-ui.ts';

const CLOSER_ROLES = new Set(['staff']);
const MAX_CUSTOMER_MESSAGE = 1000;

type Notified = 'sent' | 'failed' | 'skipped';

interface QuoteRow {
    id: string;
    reference: string | null;
    status: string;
    user_id: string | null;
    created_at: string;
    acknowledged_at: string | null;
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stamp(ts: string | null): string {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function progressRow(label: string, ts: string | null, state: 'done' | 'todo' | 'skipped'): string {
    const mark = state === 'done' ? '&#10003;' : state === 'skipped' ? '&ndash;' : '&#9675;';
    const colour = state === 'done' ? '#1a7f4b' : '#8a94a0';
    const when = ts ? ` &mdash; ${esc(stamp(ts))}` : '';
    return `<tr>
        <td style="width:22px;color:${colour};font-weight:bold">${mark}</td>
        <td style="color:${state === 'todo' ? '#8a94a0' : '#1C2A14'}">${label}${when}</td>
    </tr>`;
}

async function notifyCustomer(
    admin: SupabaseClient,
    quote: QuoteRow,
    kind: 'in_review' | 'closed',
    detail: { at: string; message?: string | null; acknowledgedAt?: string | null }
): Promise<Notified> {
    if (!quote.user_id) return 'skipped';

    try {
        const { data: userInfo } = await admin.auth.admin.getUserById(quote.user_id);
        const to = userInfo.user?.email ?? null;
        if (!to) return 'skipped';

        const { data: profile } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', quote.user_id)
            .maybeSingle();
        const name = (profile?.full_name ?? '').trim();
        const ref = quote.reference ?? 'your request';

        const heading = kind === 'closed' ? 'Your request has been closed' : 'Your request is being reviewed';
        const lead =
            kind === 'closed'
                ? `Our team has completed their review of request <strong>${esc(ref)}</strong>.`
                : `Our team has started reviewing request <strong>${esc(ref)}</strong>. We will let you know as soon as it is closed.`;

        const message = (detail.message ?? '').trim();
        const messageBlock =
            kind === 'closed' && message
                ? `<div style="margin:18px 0;padding:12px 14px;background:#f3f7fb;border-left:4px solid #004b8d;border-radius:4px">
                        <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#004b8d;text-transform:uppercase;letter-spacing:.03em">Message from BME</p>
                        <p style="margin:0;white-space:pre-wrap">${esc(message)}</p>
                   </div>`
                : '';

        const ackAt = kind === 'in_review' ? detail.at : detail.acknowledgedAt ?? null;
        const progress = `<table role="presentation" cellpadding="4" cellspacing="0" style="margin:14px 0;font-size:14px">
            ${progressRow('Submitted', quote.created_at, 'done')}
            ${progressRow('In review', ackAt, ackAt ? 'done' : kind === 'closed' ? 'skipped' : 'todo')}
            ${progressRow('Closed', kind === 'closed' ? detail.at : null, kind === 'closed' ? 'done' : 'todo')}
        </table>`;

        const html = `
        <div style="font-family:Arial,sans-serif;color:#1C2A14;font-size:14px;line-height:1.5">
            <h2 style="color:#004b8d">${heading}</h2>
            <p>${name ? `Hi ${esc(name)},` : 'Hello,'}</p>
            <p>${lead}</p>
            ${progress}
            ${messageBlock}
            ${ctaButton('View Request', appUrl('/app/history'), '#004b8d')}
            <p style="color:#6b7280;font-size:12px">You are receiving this because you submitted a request in the BME e-Serve App.</p>
        </div>`;

        const subject =
            kind === 'closed'
                ? `Your request ${ref} has been closed`
                : `Your request ${ref} is being reviewed`;

        await sendEmail(to, subject, html, undefined, {
            kind: kind === 'closed' ? 'quote_closed' : 'quote_in_review',
            relatedRef: quote.reference ?? undefined
        });
        return 'sent';
    } catch (e) {
        console.error('Customer status e-mail failed:', e);
        return 'failed';
    }
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
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return json(401, { error: 'Unauthorized' });

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: me } = await admin
            .from('profiles')
            .select('role, full_name, position')
            .eq('id', user.id)
            .single();
        if (!me || !CLOSER_ROLES.has(me.role)) {
            return json(403, { error: 'Only staff can act on requests.' });
        }

        const body = await req.json();
        const action = body.action as 'close' | 'add_action' | 'reopen' | 'acknowledge';
        const quoteId = body.quote_id;
        const actionTaken = (body.action_taken ?? '').toString().trim();
        const customerMessage = (body.customer_message ?? '').toString().trim();
        if (!quoteId) return json(400, { error: 'Missing quote_id.' });
        if (customerMessage.length > MAX_CUSTOMER_MESSAGE) {
            return json(400, { error: `The message to the customer is limited to ${MAX_CUSTOMER_MESSAGE} characters.` });
        }

        const { data: quote } = await admin
            .from('quotes')
            .select('id, reference, status, user_id, created_at, acknowledged_at')
            .eq('id', quoteId)
            .single();
        if (!quote) return json(404, { error: 'Request not found.' });

        if (action === 'acknowledge') {
            if (quote.status !== 'open') {
                return json(409, { error: 'Only an open request can be marked as in review.' });
            }
            if (quote.acknowledged_at) {
                return json(200, {
                    ok: true,
                    already: true,
                    acknowledged_at: quote.acknowledged_at,
                    notified: 'skipped' as Notified,
                    staff_name: me.full_name ?? me.position ?? 'Staff'
                });
            }

            const acknowledgedAt = new Date().toISOString();
            const { data: updated, error: ackError } = await admin
                .from('quotes')
                .update({ acknowledged_at: acknowledgedAt, acknowledged_by: user.id })
                .eq('id', quoteId)
                .is('acknowledged_at', null)
                .select('id');
            if (ackError) return json(400, { error: ackError.message });

            if (!updated || updated.length === 0) {
                return json(200, { ok: true, already: true, notified: 'skipped' as Notified });
            }

            const notified = await notifyCustomer(admin, quote as QuoteRow, 'in_review', { at: acknowledgedAt });
            return json(200, {
                ok: true,
                acknowledged_at: acknowledgedAt,
                notified,
                staff_name: me.full_name ?? me.position ?? 'Staff'
            });
        }

        if (action === 'close') {
            if (!actionTaken) return json(400, { error: 'Action Taken is required.' });
            if (quote.status !== 'open') {
                return json(409, { error: 'This request has already been closed.' });
            }

            const reviewedAt = new Date().toISOString();

            await admin.from('quote_approvals').insert({
                quote_id: quoteId,
                level: 1,
                role: me.role,
                reviewer_id: user.id,
                action: 'closed',
                action_taken: actionTaken
            });

            const { error: closeError } = await admin
                .from('quotes')
                .update({
                    status: 'closed',
                    reviewed_at: reviewedAt,
                    customer_message: customerMessage || null
                })
                .eq('id', quoteId);
            if (closeError) return json(400, { error: closeError.message });

            const notified = await notifyCustomer(admin, quote as QuoteRow, 'closed', {
                at: reviewedAt,
                message: customerMessage,
                acknowledgedAt: quote.acknowledged_at
            });

            return json(200, {
                ok: true,
                status: 'closed',
                reviewed_at: reviewedAt,
                notified,
                staff_name: me.full_name ?? me.position ?? 'Staff'
            });
        }

        const { data: lastEntry } = await admin
            .from('quote_approvals')
            .select('action')
            .eq('quote_id', quoteId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const isReopened = lastEntry?.action === 'reopened';

        if (action === 'reopen') {
            if (quote.status !== 'closed') {
                return json(409, { error: 'Only a closed request can be reopened.' });
            }
            if (isReopened) {
                return json(409, { error: 'This request has already been reopened.' });
            }

            const { data: inserted, error: insertError } = await admin
                .from('quote_approvals')
                .insert({
                    quote_id: quoteId,
                    level: 1,
                    role: me.role,
                    reviewer_id: user.id,
                    action: 'reopened',
                    action_taken: null
                })
                .select('id, created_at')
                .single();

            if (insertError) return json(400, { error: insertError.message });

            return json(200, {
                ok: true,
                status: quote.status,
                approval_id: inserted?.id ?? null,
                created_at: inserted?.created_at ?? null,
                staff_name: me.full_name ?? me.position ?? 'Staff'
            });
        }

        if (action === 'add_action') {
            if (!actionTaken) return json(400, { error: 'Action Taken is required.' });
            if (quote.status === 'closed' && !isReopened) {
                return json(409, { error: 'Reopen this request before adding an action.' });
            }

            const createdAt = new Date().toISOString();

            const { data: inserted, error: insertError } = await admin
                .from('quote_approvals')
                .insert({
                    quote_id: quoteId,
                    level: 1,
                    role: me.role,
                    reviewer_id: user.id,
                    action: 'closed',
                    action_taken: actionTaken,
                    created_at: createdAt
                })
                .select('id, created_at')
                .single();

            if (insertError) return json(400, { error: insertError.message });

            return json(200, {
                ok: true,
                status: quote.status,
                approval_id: inserted?.id ?? null,
                created_at: inserted?.created_at ?? createdAt,
                staff_name: me.full_name ?? me.position ?? 'Staff'
            });
        }

        return json(400, { error: 'Unknown action.' });
    } catch (e) {
        return json(400, { error: String(e) });
    }
});