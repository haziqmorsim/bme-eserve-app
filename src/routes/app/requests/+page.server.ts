import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (profile?.role !== 'admin') throw error(403, 'Only admins have access.');

    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, user_id, quote_items(*)')
        .order('created_at', { ascending: false });

    const list = quotes ?? [];

    const userIds = [...new Set(list.map((q) => q.user_id).filter(Boolean))];
    const profileMap: Record<string, { full_name: string | null; company: string | null; }> = {};

    if (userIds.length) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, company')
            .in('id', userIds);
        for (const p of profiles ?? []) {
            profileMap[p.id] = {
                full_name: p.full_name, 
                company: p.company
            };
        }
    }

    const withCustomer = list.map((q) => ({
        ...q, 
        customer: profileMap[q.user_id] ?? { full_name: null, company: null }
    }));

    return { quotes: withCustomer };
};