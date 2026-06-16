import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { profile } = await parent();
    const role = profile?.role;
    const isStaff = role === 'admin' || role === 'manager' || role === 'coo';

    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, reviewed_at, pdf_url, current_level, quote_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    let reviews: any[] = [];
    if (isStaff) {
        const { data } = await supabase
            .from('quote_approvals')
            .select('id, level, role, action, remarks, created_at, quotes(id, reference, status, current_level, created_at, quote_items(*))')
            .eq('reviewer_id', user.id)
            .order('created_at', { ascending: false });
        reviews = data ?? [];
    }

    return { quotes: quotes ?? [], reviews, isStaff };
};