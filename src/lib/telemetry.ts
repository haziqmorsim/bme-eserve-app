export type TrendPoint = { t: string; v: number };

export type TrendSeries = {
    key: string;
    label: string;
    unit: string;
    colour: string;
    points: TrendPoint[];
};

export type MetricRow = {
    metric_key: string;
    label: string;
    unit: string;
    min_normal: number;
    max_normal: number;
    min_warning: number;
    max_warning: number;
    colour: string;
    section_key: string | null;
    group_key: string | null;
    sort_order: number;
};

export type TelemetryRow = { metric_key: string; recorded_at: string; value: number };

export type RulRow = {
    section_key: string;
    rul_percent: number;
    rul_days: number;
    last_service: string | null;
};

export type AlertLevel = 'normal' | 'warning' | 'attention';

export type AlertItem = {
    metric_key: string;
    label: string;
    unit: string;
    value: number;
    level: AlertLevel;
    sectionKey: string | null;
    sectionLabel: string;
    minNormal: number;
    maxNormal: number;
    at: string;
};

export type MetricBaseline = {
    boiler_id: string;
    metric_key: string;
    baseline_value?: number | null;
    min_normal?: number | null;
    max_normal?: number | null;
    min_warning?: number | null;
    max_warning?: number | null;
    at_load?: number | null;
};

export function thresholdsFor(m: MetricRow, b?: MetricBaseline | null) {
    const pick = (o: number | null | undefined, fallback: number) =>
        o === null || o === undefined ? Number(fallback) : Number(o);
    return {
        minNormal: pick(b?.min_normal, m.min_normal),
        maxNormal: pick(b?.max_normal, m.max_normal),
        minWarning: pick(b?.min_warning, m.min_warning),
        maxWarning: pick(b?.max_warning, m.max_warning)
    };
}

export function baselineIndex(rows: MetricBaseline[] = []): Record<string, MetricBaseline> {
    const out: Record<string, MetricBaseline> = {};
    for (const r of rows) out[`${r.boiler_id}:${r.metric_key}`] = r;
    return out;
}

export function levelFor(value: number, m: MetricRow, b?: MetricBaseline | null): AlertLevel {
    const t = thresholdsFor(m, b);
    if (value < t.minWarning || value > t.maxWarning) return 'attention';
    if (value < t.minNormal || value > t.maxNormal) return 'warning';
    return 'normal';
}

export function pointsByMetric(rows: TelemetryRow[]): Record<string, TrendPoint[]> {
    const out: Record<string, TrendPoint[]> = {};
    for (const r of rows) {
        (out[r.metric_key] ??= []).push({ t: r.recorded_at, v: Number(r.value) });
    }
    for (const k of Object.keys(out)) {
        out[k].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
    }
    return out;
}

export function seriesFor(m: MetricRow, points: TrendPoint[]): TrendSeries {
    return { key: m.metric_key, label: m.label, unit: m.unit, colour: m.colour, points: points ?? [] };
}

export const GROUP_LABELS: Record<string, string> = {
    flow: 'Steam / Water / Fuel',
    temps: 'Temperatures',
    drives: 'Inverter & Dampers'
};