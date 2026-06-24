import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (profile?.role !== 'admin' && profile?.role !== 'developer') throw error(403, 'Admins only');

    const [regions, boilers, components, parts, users] = await Promise.all([
        supabase.from('regions').select('id, name').order('sort_order'),
        supabase.from('boilers').select('*, regions(name)').order('code'),
        supabase.from('components').select('id, name, boiler_id').order('name'),
        supabase.from('parts').select('*, components(name, boiler_id)').order('part_number'),
        supabase
            .from('profiles')
            .select('id, full_name, company, email, phone, role, region_id, regions(name)')
            .order('full_name')
    ]);

    return {
        regions: regions.data ?? [],
        boilers: boilers.data ?? [],
        components: components.data ?? [],
        parts: parts.data ?? [],
        users: users.data ?? [], 
        title: "Settings"
    };
};