import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO' };

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

        const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
        const myLevel = me ? ROLE_LEVEL[me.role] : undefined;
        if (!myLevel) return json(403, { error: 'Only Admin, Manager, or COO can act on requests.' });

        const body = await req.json();
        const action = body.action as 'close' | 'reopen';
        const quoteId = body.quote_id;
        const actionTaken = (body.action_taken ?? '').toString().trim();
        if (!quoteId) return json(400, { error: 'Missing quote_id.' });

        const { data: quote } = await admin
            .from('quotes')
            .select('id, reference, status, current_level')
            .eq('id', quoteId)
            .single();
        if (!quote) return json(404, { error: 'Request not found.' });

        if (action === 'close') {
            if (!actionTaken) return json(400, { error: 'Action Taken is required.' });
            if (quote.status !== 'open' || quote.current_level !== myLevel) {
                return json(409, { error: 'This request is not awaiting your action.' });
            }

            await admin.from('quote_approvals').insert({
                quote_id: quoteId,
                level: myLevel,
                role: me!.role,
                reviewer_id: user.id,
                action: 'closed',
                action_taken: actionTaken
            });

            if (myLevel < 3) {
                const next = myLevel + 1;
                await admin.from('quotes').update({ current_level: next }).eq('id', quoteId);
                return json(200, { ok: true, status: 'open', current_level: next, next_label: LEVEL_LABEL[next] });
            }

            await admin
                .from('quotes')
                .update({ status: 'closed', reviewed_at: new Date().toISOString() })
                .eq('id', quoteId);
            return json(200, { ok: true, status: 'closed' });
        }

        if (action === 'reopen') {
            if (myLevel < 2) return json(403, { error: 'Admin cannot reopen a request.' });

            const canReopen = myLevel === 2
                ? (quote.current_level > 2 || quote.status === 'closed')
                : (quote.status === 'closed');
            if (!canReopen) {
                return json(409, { error: 'This request cannot be reopened from its current state.' });
            }

            const target = myLevel - 1;
            await admin.from('quote_approvals').insert({
                quote_id: quoteId,
                level: myLevel,
                role: me!.role,
                reviewer_id: user.id,
                action: 'reopened',
                action_taken: actionTaken || null
            });
            await admin
                .from('quotes')
                .update({ status: 'open', current_level: target, reviewed_at: null })
                .eq('id', quoteId);
            return json(200, { ok: true, status: 'open', current_level: target, target_label: LEVEL_LABEL[target] });
        }

        return json(400, { error: 'Unknown action.' });
    } catch (e) {
        return json(400, { error: String(e) });
    }
});