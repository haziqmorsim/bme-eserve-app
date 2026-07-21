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
        }
        await supabase.auth.signOut();
        throw redirect(303, '/login');
    }
};