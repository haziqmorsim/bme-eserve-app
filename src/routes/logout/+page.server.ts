import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
    default: async ({ locals: { supabase, safeGetSession } }) => {
        const { user } = await safeGetSession();
        if (user) {
            await supabase
                .from('chat_sessions')
                .update({ ended_at: new Date().toISOString(), end_reason: 'signout' })
                .eq('user_id', user.id)
                .is('ended_at', null);

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();
                if (profile?.role !== 'developer') {
                    await supabase.from('activity_events').insert({
                        user_id: user.id,
                        role: profile?.role ?? null,
                        event_type: 'sign_out',
                        path: null,
                        meta: null
                    });
                }
            } catch {
                // Logging must never block sign-out.
            }
        }
        await supabase.auth.signOut();
        throw redirect(303, '/login');
    }
};