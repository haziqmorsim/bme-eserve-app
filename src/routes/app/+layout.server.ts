import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) throw redirect(303, '/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company, role, region_id')
        .eq('id', user.id)
        .single();

    let pendingCount = 0;
    if (profile?.role === 'admin') {
        const { count } = await supabase
            .from('quotes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');
        pendingCount = count ?? 0;
    }

    return { profile, userEmail: user.email, pendingCount };
};