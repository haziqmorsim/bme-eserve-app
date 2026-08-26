import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['privacy_policy', 'terms_conditions']);

    const byKey: Record<string, string> = {};
    for (const row of data ?? []) byKey[row.key] = row.value ?? '';

    return {
        privacyPolicy: byKey.privacy_policy ?? '',
        termsConditions: byKey.terms_conditions ?? '',
        title: "Privacy Policy"
    };
};