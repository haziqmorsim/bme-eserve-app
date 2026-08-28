import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [enquiryRes, partsRes] = await Promise.all([
        supabase
            .from('enquiries')
            .select('id, name, email, company, message, created_at, replied_at, resolution, resolved_part_id, resolved_at')
            .order('created_at', { ascending: false }),
        supabase
            .from('parts')
            .select('id, part_number, name')
            .order('part_number', { ascending: true })
    ]);

    type PartRef = { id: string; part_number: string; name: string };
    const parts: PartRef[] = partsRes.data ?? [];
    const partById = new Map<string, PartRef>(parts.map((p) => [p.id, p]));

    const enquiries = (enquiryRes.data ?? []).map((e: any) => {
        const part = e.resolved_part_id ? partById.get(e.resolved_part_id) : null;
        return {
            ...e,
            resolved_part_number: part?.part_number ?? null,
            resolved_part_name: part?.name ?? null
        };
    });

    return { enquiries, parts, title: "Enquiries" };
};