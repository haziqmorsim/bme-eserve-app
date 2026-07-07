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

    const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
    const myLevel = profile ? ROLE_LEVEL[profile.role] : undefined;

    let pendingCount = 0;
    if (myLevel) {
        const { count } = await supabase
            .from('quotes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open')
            .eq('current_level', myLevel);
        pendingCount = count ?? 0;
    }

    const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
    let enquiryCount = 0;
    if (profile && STAFF.has(profile.role)) {
        const { count } = await supabase
            .from('enquiries')
            .select('id', { count: 'exact', head: true });
        enquiryCount = count ?? 0;
    }

    const { data: notifications } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at, quote_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

    return { profile, userEmail: user.email, pendingCount, enquiryCount, notifications: notifications ?? [] };
};