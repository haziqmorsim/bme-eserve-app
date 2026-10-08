import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const ALLOWED_ROLES = ['customer', 'staff', 'developer'];
const CUSTOMER_ROLES = ['customer'];
function normaliseRole(r: unknown): string {
    return typeof r === 'string' && ALLOWED_ROLES.includes(r) ? r : 'customer';
}

const ALL_PAGES = ['home', 'cart', 'history', 'profile', 'requests', 'enquiries', 'analytics', 'others'];
const BASE_PAGES = ['home', 'cart', 'history', 'profile'];
const STAFF_ONLY_PAGES = ['requests', 'enquiries', 'analytics'];
function normalisePages(role: string, pages: unknown): string[] {
    const allowed = CUSTOMER_ROLES.includes(role)
        ? ALL_PAGES.filter((p) => !STAFF_ONLY_PAGES.includes(p))
        : ALL_PAGES;
    if (!Array.isArray(pages)) return CUSTOMER_ROLES.includes(role) ? [...BASE_PAGES] : [...ALL_PAGES];
    return allowed.filter((p) => pages.includes(p));
}

function jobField(role: string, value: unknown): string | null {
    if (CUSTOMER_ROLES.includes(role)) return null;
    const s = typeof value === 'string' ? value.trim() : '';
    return s || null;
}

async function syncProjectsAndBoilers(admin: any, userId: string, role: string, projectIds: unknown): Promise<string | null> {
    const { error: dpErr } = await admin.from('customer_projects').delete().eq('user_id', userId);
    if (dpErr) return dpErr.message;
    const { error: dbErr } = await admin.from('customer_boilers').delete().eq('user_id', userId);
    if (dbErr) return dbErr.message;

    if (!CUSTOMER_ROLES.includes(role)) return null;

    const ids = Array.isArray(projectIds)
        ? [...new Set(projectIds.filter((x: unknown) => typeof x === 'string'))]
        : [];
    if (!ids.length) return null;

    const projectRows = ids.map((project_id) => ({ user_id: userId, project_id }));
    const { error: ipErr } = await admin.from('customer_projects').insert(projectRows);
    if (ipErr) return ipErr.message;

    const { data: links, error: lErr } = await admin
        .from('boiler_projects')
        .select('boiler_id, project_id')
        .in('project_id', ids);
    if (lErr) return lErr.message;

    const boilerIds = [...new Set((links ?? []).map((r: any) => r.boiler_id))];
    if (!boilerIds.length) return null;

    const boilerRows = boilerIds.map((boiler_id) => ({ user_id: userId, boiler_id }));
    const { error: ibErr } = await admin.from('customer_boilers').insert(boilerRows);
    return ibErr ? ibErr.message : null;
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
        if (me?.role !== 'staff' && me?.role !== 'developer') return json(403, { error: 'Forbidden' });

        const body = await req.json();
        const action = body.action;

        if (action === 'create') {
            const { email, password, full_name, company } = body;
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
                department: jobField(role, body.department),
                position: jobField(role, body.position),
                pages: normalisePages(role, body.pages),
                email,
                must_change_password: true
            });
            if (pErr) return json(400, { error: pErr.message });

            const bErr = await syncProjectsAndBoilers(admin, created.user.id, role, body.project_ids);
            if (bErr) return json(400, { error: bErr });

            return json(200, { ok: true, id: created.user.id });
        }

        if (action === 'update') {
            const { id, email, full_name, company } = body;
            const role = normaliseRole(body.role);
            if (!id) return json(400, { error: 'Missing id' });

            if (email) {
                const { error: uErr } = await admin.auth.admin.updateUserById(id, { email });
                if (uErr) return json(400, { error: uErr.message });
            }
            const { error: pErr } = await admin.from('profiles').update({
                full_name: full_name ?? null,
                company: company ?? null,
                department: jobField(role, body.department),
                position: jobField(role, body.position),
                pages: normalisePages(role, body.pages),
                email: email ?? null,
                role,
            }).eq('id', id);
            if (pErr) return json(400, { error: pErr.message });

            const bErr = await syncProjectsAndBoilers(admin, id, role, body.project_ids);
            if (bErr) return json(400, { error: bErr });

            return json(200, { ok: true });
        }

        if (action === 'delete') {
            const { id } = body;
            if (!id) return json(400, { error: 'Missing id' });
            await admin.from('customer_projects').delete().eq('user_id', id);
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