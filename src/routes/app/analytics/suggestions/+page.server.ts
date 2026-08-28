import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

type PartRef = { id: string; part_number: string; name: string };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [suggestionRes, partsRes] = await Promise.all([
        supabase
            .from('part_suggestions')
            .select('id, query_text, boiler_code, channel, retrieved, suggested_part_id, suggested_part_number, reasoning, model_confidence, outcome, outcome_source, actual_part_id, staff_note, created_at, outcome_at')
            .order('created_at', { ascending: false })
            .limit(300),
        supabase
            .from('parts')
            .select('id, part_number, name')
            .order('part_number', { ascending: true })
    ]);

    const suggestions: any[] = suggestionRes.data ?? [];
    const parts: PartRef[] = partsRes.data ?? [];
    const partById = new Map<string, PartRef>(parts.map((p) => [p.id, p]));

    const rows = suggestions.map((s: any) => {
        const actual = s.actual_part_id ? partById.get(s.actual_part_id) : null;
        const needsReview = s.outcome === 'pending' || s.outcome_source !== 'staff';
        return {
            ...s,
            actual_part_number: actual?.part_number ?? null,
            actual_part_name: actual?.name ?? null,
            needsReview
        };
    });

    const counts = {
        pending: rows.filter((r: any) => r.outcome === 'pending').length,
        reviewed: rows.filter((r: any) => r.outcome_source === 'staff').length,
        total: rows.length
    };

    return {
        rows, 
        parts, 
        counts, 
        title: "Suggestion Reviews"
    };
}