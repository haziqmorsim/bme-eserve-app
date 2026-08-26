import type { PageLoad } from "./$types";
import type { Boiler, Component, Part } from "$lib/types";

export const load: PageLoad = async ({ parent, url }) => {
    const { supabase, profile } = await parent();
    const isCustomer = profile?.role === 'customer';

    let assignedIds: Set<string> | null = null;
    if (isCustomer) {
        const { data: cb } = await supabase
            .from('customer_boilers')
            .select('boiler_id')
            .eq('user_id', profile.id);
        assignedIds = new Set((cb ?? []).map((r: any) => r.boiler_id));
    }

    const { data: boilersRaw } = await supabase
        .from('boilers')
        .select('id, code, name')
        .order('code', { ascending: true });

    let boilers = (boilersRaw ?? []) as Boiler[];
    if (assignedIds) {
        const ids = assignedIds;
        boilers = boilers.filter((b: any) => ids.has(b.id));
    }

    const customerNoBoilers = isCustomer && (assignedIds?.size ?? 0) === 0;

    const boilerId = url.searchParams.get('boiler');
    const tab = (url.searchParams.get('tab') ?? 'dashboard') as 'dashboard' | 'parts';

    let boiler: Boiler | null = null;
    let components: Component[] = [];
    let parts: Part[] = [];
    let boilerSpecs: any[] = [];
    let sectionReadings: any[] = [];

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

        const [specsRes, readingsRes] = await Promise.all([
            supabase
                .from('boiler_specs')
                .select('id, label, value, sort_order')
                .eq('boiler_id', boilerId)
                .order('sort_order', { ascending: true }), 
            supabase
                .from('boiler_section_readings')
                .select('id, section_key, state, metrics, sort_order')
                .eq('boiler_id', boilerId)
                .order('sort_order', { ascending: true })
        ]);
        boilerSpecs = specsRes.data ?? [];
        sectionReadings = readingsRes.data ?? [];
    }

    return {
        boilers, 
        boiler, 
        components, 
        parts,
        boilerSpecs, 
        sectionReadings, 
        boilerId: canViewBoiler ? boilerId : null, 
        tab, 
        customerNoBoilers, 
        title: "Home"
    };
};