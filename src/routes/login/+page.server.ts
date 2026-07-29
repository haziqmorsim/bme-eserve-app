import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (session) throw redirect(303, '/app');

    return {
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