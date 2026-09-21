import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const CLOSER_ROLES = new Set(['admin', 'manager', 'coo']);

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    const role = profile?.role;
    const isDeveloper = role === 'developer';
    const canClose = !!role && CLOSER_ROLES.has(role);

    if (!canClose && !isDeveloper) throw error(403, 'Only staff have access.');

    const COLUMNS =
        'id, reference, status, notes, attachment_url, attachment_name, attachments, created_at, reviewed_at, user_id, quote_items(*)';

    const { data: openRows } = await supabase
        .from('quotes')
        .select(COLUMNS)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

    const openList = openRows ?? [];

    const quoteIds = openList.map((q) => q.id);
    const userIds = [...new Set(openList.map((q) => q.user_id).filter(Boolean))];

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
            .select('quote_id, role, action, action_taken, created_at, reviewer_id')
            .in('quote_id', quoteIds)
            .order('created_at', { ascending: true });

        const rows = approvals ?? [];

        const reviewerIds = [...new Set(rows.map((a: any) => a.reviewer_id).filter(Boolean))];
        const staffNames: Record<string, string | null> = {};
        if (reviewerIds.length) {
            const { data: staff } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', reviewerIds);
            for (const s of staff ?? []) staffNames[s.id] = s.full_name;
        }

        for (const a of rows) {
            (approvalsMap[a.quote_id] ??= []).push({
                ...a,
                staff_name: (a.reviewer_id ? staffNames[a.reviewer_id] : null) ?? null
            });
        }
    }

    const { data: regions } = await supabase.from('regions').select('id, name').order('name');

    const openQuotes = openList.map((q) => ({
        ...q,
        customer: profileMap[q.user_id] ?? { full_name: null, company: null, region: null },
        approvals: approvalsMap[q.id] ?? []
    }));

    return {
        openQuotes,
        regions: regions ?? [],
        canClose,
        isDeveloper,
        title: "Requests"
    };
};