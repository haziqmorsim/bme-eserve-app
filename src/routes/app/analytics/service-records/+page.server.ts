import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

type Ref = { id: string; label: string; sub?: string };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [recordRes, projectRes, boilerRes, partRes] = await Promise.all([
        supabase
            .from('service_records')
            .select('id, project_id, boiler_id, part_id, serviced_on, action, quantity, failure_reason, premature, notes, created_at')
            .order('serviced_on', { ascending: false })
            .limit(300),
        supabase
            .from('projects')
            .select('id, project_no, name')
            .order('project_no'),
        supabase
            .from('boilers')
            .select('id, code, name')
            .order('code'),
        supabase
            .from('parts')
            .select('id, part_number, name')
            .order('part_number')
    ]);

    const projects: Ref[] = (projectRes.data ?? []).map((p: any) => ({
        id: p.id,
        label: p.project_no,
        sub: p.name
    }));
    const boilers: Ref[] = (boilerRes.data ?? []).map((b: any) => ({
        id: b.id,
        label: b.code,
        sub: b.name
    }));
    const parts: Ref[] = (partRes.data ?? []).map((p: any) => ({
        id: p.id,
        label: p.part_number,
        sub: p.name
    }));

    const byId = (list: Ref[]) => new Map(list.map((r) => [r.id, r]));
    const projectById = byId(projects);
    const boilerById = byId(boilers);
    const partById = byId(parts);

    const records = (recordRes.data ?? []).map((r: any) => ({
        ...r,
        project_label: projectById.get(r.project_id)?.label ?? '\u2014',
        boiler_label: boilerById.get(r.boiler_id)?.label ?? '\u2014',
        part_label: partById.get(r.part_id)?.label ?? '\u2014',
        part_name: partById.get(r.part_id)?.sub ?? ''
    }));

    return {
        records,
        projects,
        boilers,
        parts,
        title: 'Service Records'
    };
};