import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { toMap, str, bool } from "$lib/settings";

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (session) throw redirect(303, '/app');

    const { data: settingRows } = await supabase
        .from('app_settings')
        .select('key, value')
        .eq('is_public', true)
        .in('key', ['login_announcement_enabled', 'login_banner']);
    const m = toMap(settingRows);
    const announcement = bool(m, 'login_announcement_enabled', false) ? str(m, 'login_banner', '') : '';

    return {
        announcement, 
        title: "Sign In"
    }
};

export const actions: Actions = {
    default: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const email = String(formData.get('email') ?? '');
        const password = String(formData.get('password') ?? '');

        const { data, error } = await supabase.auth.signInWithPassword({ email, password});
        if (error) {
            return fail(400, { email, error: 'Invalid e-mail or password.' });
        }

        if (data.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('must_change_password')
                .eq('id', data.user.id)
                .maybeSingle();
            if (profile?.must_change_password) throw redirect(303, '/change-password');
        }

        throw redirect(303, '/app');
    }
};