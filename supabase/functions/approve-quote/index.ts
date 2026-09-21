import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const CLOSER_ROLES = new Set(['admin', 'manager', 'coo']);
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', coo: 'COO' };

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
            .select('role, full_name')
            .eq('id', user.id)
            .single();
        if (!me || !CLOSER_ROLES.has(me.role)) {
            return json(403, { error: 'Only Admin, Manager, or COO can act on requests.' });
        }

        const body = await req.json();
        const action = body.action as 'close' | 'add_action';
        const quoteId = body.quote_id;
        const actionTaken = (body.action_taken ?? '').toString().trim();
        if (!quoteId) return json(400, { error: 'Missing quote_id.' });

        const { data: quote } = await admin
            .from('quotes')
            .select('id, reference, status')
            .eq('id', quoteId)
            .single();
        if (!quote) return json(404, { error: 'Request not found.' });

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

            await admin
                .from('quotes')
                .update({ status: 'closed', reviewed_at: reviewedAt })
                .eq('id', quoteId);

            return json(200, {
                ok: true,
                status: 'closed',
                reviewed_at: reviewedAt,
                staff_name: me.full_name ?? ROLE_LABEL[me.role] ?? me.role
            });
        }

        if (action === 'add_action') {
            if (!actionTaken) return json(400, { error: 'Action Taken is required.' });

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
                staff_name: me.full_name ?? ROLE_LABEL[me.role] ?? me.role
            });
        }

        return json(400, { error: 'Unknown action.' });
    } catch (e) {
        return json(400, { error: String(e) });
    }
});