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

export function levelFor(value: number, m: MetricRow): AlertLevel {
    if (value < m.min_warning || value > m.max_warning) return 'attention';
    if (value < m.min_normal || value > m.max_normal) return 'warning';
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