import type { PageLoad } from "./$types";
import type { Region, Boiler, Component } from "$lib/types";

export const load: PageLoad = async ({ parent, url }) => {
    const { supabase } = await parent();

    const { data: regions } = await supabase
        .from('regions')
        .select('id, name, sort_order, boilers(id, code, name, region_id)')
        .order('sort_order', { ascending: true });

    const boilerId = url.searchParams.get('boiler');
    const tab = (url.searchParams.get('tab') ?? 'dashboard') as 'dashboard' | 'parts';

    let boiler: Boiler | null = null;
    let components: Component[] = [];

    if (boilerId) {
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
            .order('sort_order', { ascending: true});
        components = c ?? [];
    }

    return {
        regions: (regions ?? []) as Region[], 
        boiler, 
        components, 
        boilerId, 
        tab, 
        title: "Home"
    };
};