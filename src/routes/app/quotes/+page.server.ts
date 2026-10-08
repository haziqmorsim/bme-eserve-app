import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { earnedCoupons } from "$lib/coupon";
import { requirePage } from "$lib/page-access";

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');
    requirePage((await parent()).profile, 'cart');

    const [{ count }, { data: redeemed }] = await Promise.all([
        supabase
            .from('quotes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id), 
        supabase
            .from('quotes')
            .select('coupon_code')
            .eq('user_id', user.id)
            .not('coupon_code', 'is', null)
    ]);

    const used = new Set((redeemed ?? []).map((r: any) => r.coupon_code));
    const coupons = earnedCoupons(user.id, count ?? 0).map((c) => ({
        ...c, 
        used: used.has(c.code)
    }));

    return {
        coupons, 
        title: "Cart List"
    };
};