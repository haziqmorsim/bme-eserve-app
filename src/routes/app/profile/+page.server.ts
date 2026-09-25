import { fail, redirect } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { isStrongPassword } from "$lib/password";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company, email, phone, role, address_line1, address_line2, postcode, city, state, country')
        .eq('id', user.id)
        .maybeSingle();

    return {
        me: profile ?? null,
        authEmail: user.email ?? null,
        title: "Profile"
    };
};

export const actions: Actions = {
    changePassword: async ({ request, locals: { safeGetSession } }) => {
        const { user } = await safeGetSession();
        if (!user?.email) return fail(401, { error: 'Your session has expired. Please sign in again.' });

        const form = await request.formData();
        const current = String(form.get('current') ?? '');
        const next = String(form.get('next') ?? '');
        const confirm = String(form.get('confirm') ?? '');

        if (!current) return fail(400, { field: 'current', error: 'Enter your current password.' });
        if (!isStrongPassword(next)) {
            return fail(400, { field: 'next', error: 'Please meet all the password requirements below.' });
        }
        if (next !== confirm) return fail(400, { field: 'confirm', error: 'The passwords do not match.' });
        if (next === current) {
            return fail(400, { field: 'next', error: 'The new password must be different from your current password.' });
        }

        const verifier = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });

        const { data: signIn, error: signInErr } = await verifier.auth.signInWithPassword({
            email: user.email,
            password: current
        });
        if (signInErr || !signIn.user) {
            const limited = signInErr?.status === 429;
            return fail(400, {
                field: 'current',
                error: limited
                    ? 'Too many attempts. Please wait a moment and try again.'
                    : 'Your current password is incorrect.'
            });
        }

        try {
            if (signIn.user.id !== user.id) {
                return fail(400, { field: 'current', error: 'Your current password is incorrect.' });
            }

            const { error: updateErr } = await verifier.auth.updateUser({ password: next });
            if (updateErr) {
                return fail(400, {
                    field: 'next',
                    error: updateErr.message || 'Could not update your password. Please try again.'
                });
            }
        } finally {
            await verifier.auth.signOut({ scope: 'local' }).catch(() => {});
        }

        return { passwordUpdated: true };
    }
};