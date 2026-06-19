import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const ROLE_LEVEL: Record<string, number> = { admin: 1, manager: 2, coo: 3 };
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO' };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    const myLevel = profile ? ROLE_LEVEL[profile.role] : undefined;
    if (!myLevel) throw error(403, 'Only reviewers (Admin, Manager, COO) have access.');

    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, reference, status, notes, created_at, current_level, user_id, quote_items(*)')
        .eq('status', 'pending')
        .eq('current_level', myLevel)
        .order('created_at', { ascending: true });

    const list = quotes ?? [];
    const quoteIds = list.map((q) => q.id);
    const userIds = [...new Set(list.map((q) => q.user_id).filter(Boolean))];

    const profileMap: Record<string, { full_name: string | null; company: string | null }> = {};
    if (userIds.length) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, company')
            .in('id', userIds);
        for (const p of profiles ?? []) {
            profileMap[p.id] = { full_name: p.full_name, company: p.company };
        }
    }

    const approvalsMap: Record<string, any[]> = {};
    if (quoteIds.length) {
        const { data: approvals } = await supabase
            .from('quote_approvals')
            .select('quote_id, level, role, action, remarks, created_at')
            .in('quote_id', quoteIds)
            .order('level', { ascending: true });
        for (const a of approvals ?? []) {
            (approvalsMap[a.quote_id] ??= []).push(a);
        }
    }

    const withMeta = list.map((q) => ({
        ...q,
        customer: profileMap[q.user_id] ?? { full_name: null, company: null },
        approvals: approvalsMap[q.id] ?? []
    }));

    return { 
        quotes: withMeta, 
        level: myLevel, 
        levelLabel: LEVEL_LABEL[myLevel], 
        title: "Requests"
    };
};