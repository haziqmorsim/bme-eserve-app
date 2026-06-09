import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, reviewed_at, pdf_url, quote_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return { quotes: quotes ?? []};
};