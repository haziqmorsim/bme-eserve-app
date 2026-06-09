import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (profile?.role !== 'admin') throw error(403, 'Only admins have access.');

    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, user_id, quote_items(*)')
        .order('created_at', { ascending: false });

    return { quotes: quotes ?? [] };
};