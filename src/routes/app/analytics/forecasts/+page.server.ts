import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const { data: rows } = await supabase
        .from('part_demand_forecasts')
        .select('region_id, region_name, part_number, part_name, period_month, predicted_qty, lower_qty, upper_qty, method, history_months, generated_at')
        .order('region_name', { ascending: true })
        .order('predicted_qty', { ascending: false });

    const forecasts = rows ?? [];
    const period = forecasts[0]?.period_month ?? null;
    const generatedAt = forecasts[0]?.generated_at ?? null;

    const byRegion: Record<string, typeof forecasts> = {};
    for (const f of forecasts) {
        const key = f.region_name ?? 'Unassigned';
        (byRegion[key] ??= []).push(f);
    }

    return { period, generatedAt, byRegion }
};