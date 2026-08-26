import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { toMap, str, bool } from "$lib/settings";

const MAINTENANCE_EXEMPT = new Set(['admin', 'manager', 'coo', 'developer']);

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();

    const { data: settingRows } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('is_public', true);

    const m = toMap(settingRows);

    if (!bool(m, 'maintenance_mode', false)) throw redirect(303, '/app');

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (MAINTENANCE_EXEMPT.has(profile?.role)) throw redirect(303, '/app');
    }

    return {
        message: str(
            m, 
            'maintenance_message', 
            'BME e-Serve App is temporarily unavailable for scheduled maintenance. Please try again later.'
        ),
        supportEmail: str(m, 'support_email', ''),
        title: 'Under Maintenance'
    };
};