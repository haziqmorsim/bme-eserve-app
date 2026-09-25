import type { PageLoad } from "./$types";
import type { Boiler, Component, Part } from "$lib/types";
import { isCustomerRole } from "$lib/roles";

export const load: PageLoad = async ({ parent, url }) => {
    const { supabase, profile } = await parent();
    const isCustomer = !!profile && isCustomerRole(profile.role);

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
    const tab = (url.searchParams.get('tab') ?? 'parts') as 'dashboard' | 'parts'; // change to dashboard when iot is up
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
    let metricGroups: any[] = [];
    let motorCells: any[] = [];
    let baselines: any[] = [];
    let indicators: any[] = [];
    let indicatorStatus: any[] = [];
    let inspection: any = null;
    let inspectionItems: any[] = [];
    let findings: any[] = [];
    let tubeReadings: any[] = [];
    let dailyLogs: any[] = [];
    let programme: any = null;
    let actions: any[] = [];
    let kpis: any = null;

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

        const [{ data: r }, { data: m }, { data: t }, { data: ru }, { data: mo }, { data: mt }, { data: mg }, { data: mc }, { data: bl }, { data: ind }, { data: istat }, { data: items }, { data: insp }, { data: logs }, { data: prog }, { data: acts }, { data: kpi }] = await Promise.all([
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
                .order('due_on', { ascending: true }),
            supabase.from('boiler_metric_groups').select('*').order('sort_order', { ascending: true }),
            supabase.from('boiler_motor_cells').select('*').order('sort_order', { ascending: true }),
            supabase.from('boiler_metric_baselines').select('*').eq('boiler_id', boilerId),
            supabase.from('boiler_indicators').select('*').order('sort_order', { ascending: true }),
            supabase.from('boiler_indicator_status').select('*').eq('boiler_id', boilerId),
            supabase.from('inspection_items').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
            supabase
                .from('boiler_inspections')
                .select('*')
                .eq('boiler_id', boilerId)
                .order('inspected_on', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('boiler_daily_logs')
                .select('*, boiler_daily_log_readings(metric_key, value)')
                .eq('boiler_id', boilerId)
                .order('log_date', { ascending: false })
                .limit(14),
            supabase.from('boiler_programme').select('*').eq('boiler_id', boilerId).maybeSingle(),
            supabase
                .from('programme_actions')
                .select('*')
                .eq('boiler_id', boilerId)
                .order('due_date', { ascending: true, nullsFirst: false })
                .limit(50),
            supabase.from('programme_kpis').select('*').eq('boiler_id', boilerId).maybeSingle()
        ]);

        sectionReadings = r ?? [];
        metrics = m ?? [];
        rul = ru ?? [];
        motors = mo ?? [];
        maintenance = mt ?? [];
        metricGroups = mg ?? [];
        motorCells = mc ?? [];
        baselines = bl ?? [];
        indicators = ind ?? [];
        indicatorStatus = istat ?? [];
        inspectionItems = items ?? [];
        inspection = insp ?? null;
        dailyLogs = logs ?? [];
        programme = prog ?? null;
        actions = acts ?? [];
        kpis = kpi ?? null;

        if (inspection?.id) {
            const [{ data: f }, { data: tt }] = await Promise.all([
                supabase.from('boiler_inspection_findings').select('*').eq('inspection_id', inspection.id),
                supabase.from('boiler_tube_thickness').select('*').eq('inspection_id', inspection.id).order('location')
            ]);
            findings = f ?? [];
            tubeReadings = tt ?? [];
        }

        const raw = t ?? [];
        if (raw.length) {
            const newestByMetric = new Map<string, number>();
            for (const row of raw) {
                const ms = new Date(row.recorded_at).getTime();
                const cur = newestByMetric.get(row.metric_key) ?? 0;
                if (ms > cur) newestByMetric.set(row.metric_key, ms);
            }
            const now = Date.now();
            telemetry = raw
                .filter((row: any) => {
                    const newest = newestByMetric.get(row.metric_key)!;
                    const windowStart = newest - 24 * 60 * 60 * 1000;
                    return new Date(row.recorded_at).getTime() >= windowStart;
                })
                .map((row: any) => {
                    const shift = now - newestByMetric.get(row.metric_key)!;
                    return {
                        ...row,
                        recorded_at: new Date(new Date(row.recorded_at).getTime() + shift).toISOString()
                    };
                });
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
        metricGroups, 
        motorCells, 
        baselines, 
        indicators, 
        indicatorStatus, 
        inspection, 
        inspectionItems, 
        findings, 
        tubeReadings, 
        dailyLogs, 
        programme, 
        actions, 
        kpis, 
        boilerId: canViewBoiler ? boilerId : null, 
        activeProjectId, 
        tab, 
        customerNoBoilers, 
        title: "Home"
    };
};