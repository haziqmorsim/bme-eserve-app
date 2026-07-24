import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company, email, phone, role, region_id, address_line1, address_line2, postcode, city, state, country, regions(name)')
        .eq('id', user.id)
        .maybeSingle();

    return {
        me: profile ?? null,
        authEmail: user.email ?? null,
        title: "Profile"
    };
};