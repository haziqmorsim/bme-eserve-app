import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { toMap, bool } from "$lib/settings";

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) throw redirect(303, '/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company, role, region_id, must_change_password')
        .eq('id', user.id)
        .single();

    if (profile?.must_change_password) throw redirect(303, '/change-password');

    const { data: settingRows, error: settingsError } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('is_public', true);

    if (settingsError) {
        console.error('[app_settings] read failed:', settingsError.message);
    }

    const MAINTENANCE_EXEMPT = new Set(['admin', 'manager', 'coo', 'developer']);
    const settingsMap = toMap(settingRows);
    const maintenanceOn = bool(settingsMap, 'maintenance_mode', false);

    if (!settingRows || settingRows.length === 0) {
        console.warn('[app_settings] no public rows visible to this user - check migrations 0044/0045 were applied.');
    }

    if (maintenanceOn && !MAINTENANCE_EXEMPT.has(profile?.role)) {
        throw redirect(303, '/maintenance');
    }

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

    const STAFF = new Set(['admin', 'manager', 'coo']); // exclude developer
    let enquiryCount = 0;
    if (profile && STAFF.has(profile.role)) {
        const { count } = await supabase
            .from('enquiries')
            .select('id', { count: 'exact', head: true })
            .is('replied_at', null);
        enquiryCount = count ?? 0;
    }

    const { data: notifications } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at, quote_id, data, response, responded_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

    return {
        profile,
        userEmail: user.email,
        pendingCount,
        enquiryCount,
        notifications: notifications ?? [],
        settings: settingRows ?? []
    };
};