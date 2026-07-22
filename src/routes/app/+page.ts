import type { PageLoad } from "./$types";
import type { Region, Boiler, Component, Part } from "$lib/types";

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

    const { data: regionsRaw } = await supabase
        .from('regions')
        .select('id, name, sort_order, boilers(id, code, name, region_id)')
        .order('name', { ascending: true });

    let regions = (regionsRaw ?? []) as Region[];
    if (assignedIds) {
        const ids = assignedIds;
        regions = regions.map((r: any) => ({
            ...r, 
            boilers: (r.boilers ?? []).filter((b: any) => ids.has(b.id))
        })) as Region[];
    }

    const customerNoBoilers = isCustomer && (assignedIds?.size ?? 0) === 0;

    const boilerId = url.searchParams.get('boiler');
    const tab = (url.searchParams.get('tab') ?? 'dashboard') as 'dashboard' | 'parts';

    let boiler: Boiler | null = null;
    let components: Component[] = [];
    let parts: Part[] = [];

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
    }

    return {
        regions, 
        boiler, 
        components, 
        parts,
        boilerId: canViewBoiler ? boilerId : null, 
        tab, 
        customerNoBoilers, 
        title: "Home"
    };
};