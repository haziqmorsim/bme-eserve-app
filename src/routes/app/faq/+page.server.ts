import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { data: faqs } = await supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

    return { 
        faqs: faqs ?? [], 
        title: "FAQ"
    };
};