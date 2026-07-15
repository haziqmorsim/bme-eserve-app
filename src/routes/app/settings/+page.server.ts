import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (profile?.role !== 'admin' && profile?.role !== 'developer') throw error(403, 'Admins only');

    const [regions, boilers, components, parts, users, assignments, lastSignIns, faqs] = await Promise.all([
        supabase.from('regions').select('id, name').order('sort_order'),
        supabase.from('boilers').select('*, regions(name)').order('code'),
        supabase.from('components').select('id, name, boiler_id').order('name'),
        supabase.from('parts').select('*, components(name, boiler_id)').order('part_number'),
        supabase
            .from('profiles')
            .select('id, full_name, company, email, phone, role, region_id, regions(name)')
            .order('full_name'), 
        supabase.from('customer_boilers').select('user_id, boiler_id'), 
        supabase.rpc('user_last_sign_ins'), 
        supabase.from('faqs').select('id, question, answer, sort_order, is_published').order('sort_order', { ascending: true })
    ]);

    const lastSignInById: Record<string, string | null> = {};
    for (const r of lastSignIns.data ?? []) lastSignInById[r.id] = r.last_sign_in_at;
    const usersWithSignIn = (users.data ?? []).map((u: any) => ({
        ...u, 
        last_sign_in_at: lastSignInById[u.id] ?? null
    }));

    return {
        regions: regions.data ?? [],
        boilers: boilers.data ?? [],
        components: components.data ?? [],
        parts: parts.data ?? [],
        users: usersWithSignIn, 
        faqs: faqs.data ?? [], 
        assignments: assignments.data ?? [],
        title: "Settings"
    };
};