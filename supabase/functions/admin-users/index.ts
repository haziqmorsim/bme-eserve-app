import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const ALLOWED_ROLES = ['customer', 'admin', 'manager', 'coo', 'developer'];
function normaliseRole(r: unknown): string {
    return typeof r === 'string' && ALLOWED_ROLES.includes(r) ? r : 'customer';
}

async function syncBoilers(admin: any, userId: string, role: string, boilerIds: unknown): Promise<string | null> {
    const { error: dErr } = await admin.from('customer_boilers').delete().eq('user_id', userId);
    if (dErr) return dErr.message;
    if (role !== 'customer') return null;
    const ids = Array.isArray(boilerIds) 
        ? [...new Set(boilerIds.filter((x: unknown) => typeof x === 'string'))] 
        : [];
    if (!ids.length) return null;
    const rows = ids.map((boiler_id) => ({ user_id: userId, boiler_id }));
    const { error: iErr } = await admin.from('customer_boilers').insert(rows);
    return iErr ? iErr.message : null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json(401, { error: 'Missing token' });

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            {
                global: {
                    headers: {
                        Authorization: authHeader
                    }
                }
            }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return json(401, { error: 'Unauthorized' });

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data: me } = await admin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (me?.role !== 'admin' && me?.role !== 'developer') return json(403, { error: 'Admins only' });

        const body = await req.json();
        const action = body.action;

        if (action === 'create') {
            const { email, password, full_name, company, phone, region_id } = body;
            const role = normaliseRole(body.role);
            if (!email || !password) return json(400, { error: 'Email and password are required.' });

            const { data: created, error: cErr } = await admin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name, company }
            });
            if (cErr || !created.user) return json(400, { error: cErr?.message ?? 'Could not create user.' });

            const { error: pErr } = await admin.from('profiles').upsert({
                id: created.user.id,
                role,
                full_name: full_name ?? null,
                company: company ?? null,
                phone: phone ?? null,
                email,
                region_id: region_id ?? null,
                must_change_password: true
            });
            if (pErr) return json(400, { error: pErr.message });

            const bErr = await syncBoilers(admin, created.user.id, role, body.boiler_ids);
            if (bErr) return json(400, { error: bErr });

            return json(200, { ok: true, id: created.user.id });
        }

        if (action === 'update') {
            const { id, email, full_name, company, phone, region_id } = body;
            const role = normaliseRole(body.role);
            if (!id) return json(400, { error: 'Missing id' });

            if (email) {
                const { error: uErr } = await admin.auth.admin.updateUserById(id, { email });
                if (uErr) return json(400, { error: uErr.message });
            }
            const { error: pErr } = await admin.from('profiles').update({
                full_name: full_name ?? null,
                company: company ?? null,
                phone: phone ?? null,
                email: email ?? null,
                role,
                region_id: region_id ?? null
            }).eq('id', id);
            if (pErr) return json(400, { error: pErr.message });

            const bErr = await syncBoilers(admin, id, role, body.boiler_ids);
            if (bErr) return json(400, { error: bErr });

            return json(200, { ok: true });
        }

        if (action === 'delete') {
            const { id } = body;
            if (!id) return json(400, { error: 'Missing id' });
            await admin.from('customer_boilers').delete().eq('user_id', id);
            const { error: dErr } = await admin.auth.admin.deleteUser(id);
            if (dErr) return json(400, { error: dErr.message });
            return json(200, { ok: true });
        }

        return json(400, { error: 'Unknown action' });
    } catch (e) {
        return json(400, { error: String(e) });
    }
});