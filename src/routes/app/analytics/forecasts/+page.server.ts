import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

type HistoryPoint = { month: string; qty: number };

function trendDirection(history: HistoryPoint[]): 'up' | 'down' | 'flat' {
    const n = history.length;
    if (n < 2) return 'flat';

    const ys = history.map((h) => h.qty);
    const meanX = (n - 1) / 2;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - meanX) * (ys[i] - meanY);
        den += (i - meanX) ** 2;
    }
    if (den === 0) return 'flat';

    const norm = num / den / (meanY || 1);
    if (norm > 0.05) return 'up';
    if (norm < -0.05) return 'down';
    return 'flat';
}

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [forecastRes, replacementRes] = await Promise.all([
        supabase
            .from('part_demand_forecasts')
            .select('id, project_id, project_no, project_name, boiler_code, part_number, part_name, period_month, predicted_qty, lower_qty, upper_qty, method, history_months, generated_at, history')
            .order('period_month', { ascending: false })
            .order('project_no', { ascending: true })
            .order('predicted_qty', { ascending: false }),
        supabase
            .from('part_replacement_schedule')
            .select('user_id, customer_name, company, region_name, boiler_code, part_number, part_name, last_ordered_on, interval_days, next_due_on, interval_samples, asset_orders, confidence, generated_at')
            .order('next_due_on', { ascending: true })
    ]);

    const allForecasts = forecastRes.data ?? [];
    const latestPeriod = allForecasts[0]?.period_month ?? null;
    const currentRows = latestPeriod
        ? allForecasts.filter((f) => f.period_month === latestPeriod)
        : [];

    const forecasts = currentRows.map((f) => {
        const history: HistoryPoint[] = Array.isArray(f.history)
            ? (f.history as HistoryPoint[]).map((h) => ({
                month: String(h.month), 
                qty: Number(h.qty) || 0
            }))
            : [];

        const last = history.length ? history[history.length - 1].qty : null;
        const predicted = Number(f.predicted_qty) || 0;
        const direction = trendDirection(history);

        return { ...f, history, predicted_qty: predicted, direction, lastObserved: last };
    });

    const period = latestPeriod;
    const forecastGeneratedAt = forecasts[0]?.generated_at ?? null;

    const byProject: Record<string, typeof forecasts> = {};
    for (const f of forecasts) {
        const key = f.project_no ? `${f.project_no} — ${f.project_name ?? ''}`.trim() : 'Unassigned';
        (byProject[key] ??= []).push(f);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const replacements = (replacementRes.data ?? []).map((r) => {
        const due = new Date(r.next_due_on + 'T00:00:00');
        const daysUntil = Math.round((due.getTime() - today.getTime()) / 86_400_000);

        let bucket: 'overdue' | 'due_soon' | 'upcoming' | 'later';
        if (daysUntil < 0) bucket = 'overdue';
        else if (daysUntil <= 30) bucket = 'due_soon';
        else if (daysUntil <= 90) bucket = 'upcoming';
        else bucket = 'later';

        return { ...r, daysUntil, bucket };
    });

    const replacementGeneratedAt = replacements[0]?.generated_at ?? null;

    const counts = {
        overdue: replacements.filter((i) => i.bucket === 'overdue').length, 
        due_soon: replacements.filter((i) => i.bucket === 'due_soon').length, 
        upcoming: replacements.filter((i) => i.bucket === 'upcoming').length, 
        later: replacements.filter((i) => i.bucket === 'later').length
    };

    return { 
        period, 
        forecastGeneratedAt, 
        byProject, 
        replacements, 
        counts, 
        replacementGeneratedAt, 
        title: "Forecasts"
    };
};