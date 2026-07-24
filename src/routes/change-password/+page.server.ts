import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase }}) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) throw redirect(303, '/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile?.must_change_password) throw redirect(303, '/app');

    return {
        fullName: profile.full_name ?? null, 
        title: "Change Password"
    };
};