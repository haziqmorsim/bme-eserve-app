import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (session) throw redirect(303, '/app');
};

export const actions: Actions = {
    default: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData();
        const email = String(formData.get('email') ?? '');
        const password = String(formData.get('password') ?? '');

        const { error } = await supabase.auth.signInWithPassword({ email, password});
        if (error) {
            return fail(400, { email, error: 'Invalid e-mail or password.' });
        }
        throw redirect(303, '/app');
    }
};