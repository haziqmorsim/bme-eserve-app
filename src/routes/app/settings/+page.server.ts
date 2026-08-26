import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (profile?.role !== 'admin' && profile?.role !== 'developer') throw error(403, 'Forbidden');

    const [boilers, components, parts, users, assignments, lastSignIns, faqs, boilerSpecs, boilerReadings] = await Promise.all([
        supabase.from('boilers').select('*').order('code'),
        supabase.from('components').select('id, name, boiler_id').order('name'),
        supabase.from('parts').select('*, components(name, boiler_id)').order('part_number'),
        supabase
            .from('profiles')
            .select('id, full_name, company, email, phone, role')
            .order('full_name'), 
        supabase.from('customer_boilers').select('user_id, boiler_id'), 
        supabase.rpc('user_last_sign_ins'), 
        supabase.from('faqs').select('id, question, answer, sort_order, is_published').order('sort_order', { ascending: true }), 
        supabase.from('boiler_specs').select('id, boiler_id, label, value, sort_order').order('sort_order', { ascending: true }), 
        supabase.from('boiler_section_readings').select('id, boiler_id, section_key, state, metrics, sort_order').order('sort_order', { ascending: true })
    ]);

    const lastSignInById: Record<string, string | null> = {};
    for (const r of lastSignIns.data ?? []) lastSignInById[r.id] = r.last_sign_in_at;
    const usersWithSignIn = (users.data ?? []).map((u: any) => ({
        ...u, 
        last_sign_in_at: lastSignInById[u.id] ?? null
    }));

    return {
        boilers: boilers.data ?? [],
        components: components.data ?? [],
        parts: parts.data ?? [],
        users: usersWithSignIn, 
        faqs: faqs.data ?? [], 
        boilerSpecs: boilerSpecs.data ?? [], 
        boilerReadings: boilerReadings.data ?? [], 
        assignments: assignments.data ?? [],
        title: "Settings"
    };
};