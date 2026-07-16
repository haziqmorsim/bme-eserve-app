import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { TIERS, couponCode } from "$lib/coupon";

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) throw redirect(303, '/login');

    const { profile } = await parent();
    const role = profile?.role;
    const isStaff = role === 'admin' || role === 'manager' || role === 'coo' || role === 'developer';

    const { data: regionRows } = await supabase.from('regions').select('id, name').order('sort_order');
    const regions = regionRows ?? [];
    const regionMap: Record<string, string> = {};
    for (const r of regions) regionMap[r.id] = r.name;
    const myRegion = profile?.region_id ? (regionMap[profile.region_id] ?? null) : null;

    const { data: quoteRows } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, attachment_url, attachment_name, created_at, reviewed_at, pdf_url, current_level, quote_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const quotes = (quoteRows ?? []).map((q) => ({ ...q, region: myRegion }));

    let reviewGroups: any[] = [];
    if (isStaff) {
        const { data: mine } = await supabase
            .from('quote_approvals')
            .select('quote_id, quotes(id, reference, status, current_level, created_at, user_id, quote_items(*))')
            .eq('reviewer_id', user.id);

        const mineList = mine ?? [];
        const quoteById: Record<string, any> = {};
        for (const r of mineList) {
            const q = (r as any).quotes;
            if (q && !quoteById[q.id]) quoteById[q.id] = q;
        }
        const quoteIds = Object.keys(quoteById);

        if (quoteIds.length) {
            const { data: allActions } = await supabase
                .from('quote_approvals')
                .select('id, quote_id, level, role, action, action_taken, created_at, reviewer_id')
                .in('quote_id', quoteIds)
                .order('created_at', { ascending: true });

            const actionsByQuote: Record<string, any[]> = {};
            for (const a of allActions ?? []) (actionsByQuote[a.quote_id] ??= []).push(a);

            const ownerIds = [...new Set(Object.values(quoteById).map((q: any) => q.user_id).filter(Boolean))];
            const custMap: Record<string, { full_name: string | null; company: string | null; region: string | null }> = {};
            if (ownerIds.length) {
                const { data: profs } = await supabase
                    .from('profiles')
                    .select('id, full_name, company, region_id')
                    .in('id', ownerIds);
                for (const p of profs ?? []) {
                    custMap[p.id] = {
                        full_name: p.full_name,
                        company: p.company,
                        region: p.region_id ? (regionMap[p.region_id] ?? null) : null
                    };
                }
            }

            reviewGroups = quoteIds.map((qid) => {
                const q = quoteById[qid];
                const actions = (actionsByQuote[qid] ?? []).map((a) => ({ ...a, mine: a.reviewer_id === user.id }));
                const lastActivity = actions.length ? actions[actions.length - 1].created_at : q?.created_at;
                return {
                    quote: q,
                    customer: custMap[q?.user_id] ?? { full_name: null, company: null, region: null },
                    actions,
                    lastActivity
                };
            }).sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : a.lastActivity > b.lastActivity ? -1 : 0));
        }
    }

    const reqCount = quotes.length;

    const { data: redeemed } = await supabase
        .from('quotes')
        .select('coupon_code')
        .eq('user_id', user.id)
        .not('coupon_code', 'is', null);
    const usedCodes = new Set((redeemed ?? []).map((r: any) => r.coupon_code));

    const tiers = TIERS.map((t) => {
        const code = couponCode(user.id, t.percent);
        return { ...t, earned: reqCount >= t.threshold, code, used: usedCodes.has(code) };
    });
    const earnedTiers = tiers.filter((t) => t.earned);
    const currentPercent = earnedTiers.length ? earnedTiers[earnedTiers.length - 1].percent : 0;
    const nextTier = tiers.find((t) => !t.earned) ?? null;
    const segStart = earnedTiers.length ? earnedTiers[earnedTiers.length - 1].threshold : 0;
    const progressPct = nextTier
        ? Math.min(100, Math.round(((reqCount - segStart) / (nextTier.threshold - segStart)) * 100))
        : 100;
    const loyalty = {
        count: reqCount, tiers, currentPercent, nextTier,
        toNext: nextTier ? nextTier.threshold - reqCount : 0, progressPct
    };

    return {
        quotes,
        reviewGroups, isStaff,
        regions,
        loyalty,
        title: "History"
    };
};