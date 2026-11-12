import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

import { STAFF_ROLES as STAFF } from "$lib/roles";

const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const { data: rows } = await supabase
        .from('audit_log')
        .select('id, created_at, actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, details')
        .order('created_at', { ascending: false })
        .limit(500);

    const list = rows ?? [];
    const since24h = Date.now() - DAY_MS;
    const since7d = Date.now() - 7 * DAY_MS;
    const at = (r: { created_at: string }) => new Date(r.created_at).getTime();

    return {
        rows: list,
        stats: {
            total: list.length,
            changes24h: list.filter((r) => at(r) >= since24h).length,
            userChanges7d: list.filter((r) => r.entity_type === 'user' && at(r) >= since7d).length,
            deletion7d: list.filter((r) => r.action === 'delete' && at(r) >= since7d).length
        },
        title: 'Audit Log'
    };
};