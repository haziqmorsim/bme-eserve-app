import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Staff only');

    const { data: enquiries } = await supabase
        .from('enquiries')
        .select('id, name, email, company, message, created_at')
        .order('created_at', { ascending: false });

    return { enquiries: enquiries ?? [], title: "Enquiries"};
};