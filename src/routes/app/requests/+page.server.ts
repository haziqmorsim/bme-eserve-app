import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO' };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    const role = profile?.role;
    const isDeveloper = role === 'developer';
    const myLevel = role ? ROLE_LEVEL[role] : undefined;

    if (!myLevel && !isDeveloper) throw error(403, 'Only reviewers (Admin, Manager, COO) have access.');

    let query = supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, current_level, user_id, quote_items(*)')
        .eq('status', 'open');

    if (!isDeveloper) query = query.eq('current_level', myLevel as number);

    const { data: quotes } = await query.order('created_at', { ascending: false });

    const list = quotes ?? [];
    const quoteIds = list.map((q) => q.id);
    const userIds = [...new Set(list.map((q) => q.user_id).filter(Boolean))];

    const profileMap: Record<string, { full_name: string | null; company: string | null; region: string | null }> = {};
    if (userIds.length) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, company, region_id, regions(name)')
            .in('id', userIds);
        for (const p of profiles ?? []) {
            profileMap[p.id] = {
                full_name: p.full_name,
                company: p.company,
                region: (p as any).regions?.name ?? null
            };
        }
    }

    const approvalsMap: Record<string, any[]> = {};
    if (quoteIds.length) {
        const { data: approvals } = await supabase
            .from('quote_approvals')
            .select('quote_id, level, role, action, action_taken, created_at')
            .in('quote_id', quoteIds)
            .order('created_at', { ascending: true });
        for (const a of approvals ?? []) {
            (approvalsMap[a.quote_id] ??= []).push(a);
        }
    }

    const { data: regions } = await supabase.from('regions').select('id, name').order('sort_order');

    const withMeta = list.map((q) => ({
        ...q,
        customer: profileMap[q.user_id] ?? { full_name: null, company: null, region: null },
        approvals: approvalsMap[q.id] ?? []
    }));

    return {
        quotes: withMeta,
        regions: regions ?? [],
        level: myLevel ?? null,
        levelLabel: isDeveloper ? 'Developer' : LEVEL_LABEL[myLevel as number],
        isDeveloper,
        title: "Requests"
    };
};