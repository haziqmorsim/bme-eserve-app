import type { PageLoad } from "./$types";
import type { Boiler, Component, Part } from "$lib/types";

export const load: PageLoad = async ({ parent, url }) => {
    const { supabase, profile } = await parent();
    const isCustomer = profile?.role === 'customer';

    let assignedIds: Set<string> | null = null;
    let assignedProjectIds: Set<string> | null = null;
    if (isCustomer) {
        const [{ data: cb }, { data: cp }] = await Promise.all([
            supabase
                .from('customer_boilers')
                .select('boiler_id')
                .eq('user_id', profile.id), 
            supabase
                .from('customer_projects')
                .select('project_id')
                .eq('user_id', profile.id)
        ]);
        assignedIds = new Set((cb ?? []).map((r: any) => r.boiler_id));
        assignedProjectIds = new Set((cp ?? []).map((r: any) => r.project_id));
    }

    const [{ data: boilersRaw }, { data: projectsRaw }, { data: boilerProjectsRaw }] = await Promise.all([
        supabase
            .from('boilers')
            .select('id, code, name')
            .order('code', { ascending: true }),
        supabase
            .from('projects')
            .select('id, project_no, name, location, sort_order')
            .order('sort_order', { ascending: true }),
        supabase
            .from('boiler_projects')
            .select('boiler_id, project_id')
    ]);

    let boilers = (boilersRaw ?? []) as Boiler[];
    if (assignedIds) {
        const ids = assignedIds;
        boilers = boilers.filter((b: any) => ids.has(b.id));
    }

    const projects = assignedProjectIds
        ? (projectsRaw ?? []).filter((p: any) => assignedProjectIds!.has(p.id))
        : (projectsRaw ?? []);
    const boilerProjects = boilerProjectsRaw ?? [];

    const customerNoBoilers = isCustomer && (assignedIds?.size ?? 0) === 0;

    const boilerId = url.searchParams.get('boiler');
    const tab = (url.searchParams.get('tab') ?? 'dashboard') as 'dashboard' | 'parts';
    const activeProjectId = url.searchParams.get('project');

    let boiler: Boiler | null = null;
    let components: Component[] = [];
    let parts: Part[] = [];
    let sectionReadings: any[] = [];
    let metrics: any[] = [];
    let telemetry: any[] = [];
    let rul: any[] = [];
    let motors: any[] = [];
    let maintenance: any[] = [];

    const canViewBoiler = !!boilerId && (!isCustomer || assignedIds!.has(boilerId));
    if (canViewBoiler) {
        const { data: b } = await supabase
            .from('boilers')
            .select('*')
            .eq('id', boilerId)
            .single();
        boiler = b;
        const { data: c } = await supabase
            .from('components')
            .select('*')
            .eq('boiler_id', boilerId)
            .order('name', { ascending: true });
        components = c ?? [];

        if (components.length) {
            const componentIds = components.map((c) => c.id);
            const { data: p } = await supabase
                .from('parts')
                .select('*')
                .in('component_id', componentIds)
                .order('part_number', { ascending: true });
            parts = p ?? [];
        }

        const [{ data: r }, { data: m }, { data: t }, { data: ru }, { data: mo }, { data: mt }] = await Promise.all([
            supabase
                .from('boiler_section_readings')
                .select('id, section_key, state, metrics, sort_order')
                .eq('boiler_id', boilerId)
                .order('sort_order', { ascending: true }),
            supabase
                .from('boiler_metrics')
                .select('metric_key, label, unit, min_normal, max_normal, min_warning, max_warning, colour, section_key, group_key, sort_order')
                .order('sort_order', { ascending: true }),
            supabase
                .from('boiler_telemetry')
                .select('metric_key, recorded_at, value')
                .eq('boiler_id', boilerId)
                .order('recorded_at', { ascending: false })
                .limit(4000),
            supabase
                .from('boiler_section_rul')
                .select('section_key, rul_percent, rul_days, last_service')
                .eq('boiler_id', boilerId),
            supabase
                .from('boiler_motors')
                .select('id, name, code, vibration, vibration_limit, current_a, current_rating_a, power_kw, power_rating_kw')
                .eq('boiler_id', boilerId)
                .order('sort_order', { ascending: true }),
            supabase
                .from('boiler_maintenance')
                .select('id, part_name, reason, due_on, est_hours, est_cost, part_id, parts(id, part_number, name, price, price_min, price_max, components(name))')
                .eq('boiler_id', boilerId)
                .is('completed_at', null)
                .lte('due_on', new Date().toISOString().slice(0, 10))
                .order('due_on', { ascending: true })
        ]);

        sectionReadings = r ?? [];
        metrics = m ?? [];
        rul = ru ?? [];
        motors = mo ?? [];
        maintenance = mt ?? [];

        const raw = t ?? [];
        if (raw.length) {
            let newest = 0;
            for (const row of raw) {
                const ms = new Date(row.recorded_at).getTime();
                if (ms > newest) newest = ms;
            }
            const windowStart = newest - 24 * 60 * 60 * 1000;
            const shift = Date.now() - newest;
            telemetry = raw
                .filter((row: any) => new Date(row.recorded_at).getTime() >= windowStart)
                .map((row: any) => ({
                    ...row,
                    recorded_at: new Date(new Date(row.recorded_at).getTime() + shift).toISOString()
                }));
        } else {
            telemetry = [];
        }
    }

    return {
        boilers, 
        projects,
        boilerProjects,
        boiler, 
        components, 
        parts,
        sectionReadings, 
        metrics, 
        telemetry, 
        rul, 
        motors, 
        maintenance, 
        boilerId: canViewBoiler ? boilerId : null, 
        activeProjectId, 
        tab, 
        customerNoBoilers, 
        title: "Home"
    };
};