export const SLA_WARN_HOURS = 24;
export const SLA_OVERDUE_HOURS = 48;

export type SlaThresholds = { warnHours: number; overdueHours: number };

export const DEFAULT_SLA: SlaThresholds = {
    warnHours: SLA_WARN_HOURS,
    overdueHours: SLA_OVERDUE_HOURS
};

export type SlaState = 'ontrack' | 'aging' | 'overdue';

export const SLA_LABEL: Record<SlaState, string> = {
    ontrack: 'On track',
    aging: 'Aging',
    overdue: 'Overdue'
};

export function hoursSince(iso: string, now: number = Date.now()): number {
    return (now - new Date(iso).getTime()) / 3_600_000;
}

export function slaState(iso: string, now: number = Date.now(), t: SlaThresholds = DEFAULT_SLA): SlaState {
    const h = hoursSince(iso, now);
    if (h >= t.overdueHours) return 'overdue';
    if (h >= t.warnHours) return 'aging';
    return 'ontrack';
}

export function ageLabel(iso: string, now: number = Date.now()): string {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    const rem = h % 24;
    return rem ? `${d}d ${rem}h` : `${d}d`;
}

export function levelSince(quote: { created_at: string; approvals?: { created_at: string }[] }): string {
    const approvals = quote.approvals ?? [];
    if (approvals.length === 0) return quote.created_at;
    return approvals.reduce((latest, a) => (a.created_at > latest ? a.created_at : latest), approvals[0].created_at);
}

export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function weekdayMsBetween(startMs: number, endMs: number): number {
    if (!(endMs > startMs)) return 0;
    const s = startMs + MYT_OFFSET_MS;
    const e = endMs + MYT_OFFSET_MS;
    const first = new Date(s);
    first.setUTCHours(0, 0, 0, 0);
    let dayMs = first.getTime();
    let total = 0;
    for (; dayMs < e; dayMs += DAY_MS) {
        const dow = new Date(dayMs).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const from = Math.max(s, dayMs);
        const to = Math.min(e, dayMs + DAY_MS);
        if (to > from) total += to - from;
    }
    return total;
}

export function weekdayHoursSince(iso: string, now: number = Date.now()): number {
    return weekdayMsBetween(new Date(iso).getTime(), now) / 3_600_000;
}

export function slaStateWeekday(iso: string, now: number = Date.now(), t: SlaThresholds = DEFAULT_SLA): SlaState {
    const h = weekdayHoursSince(iso, now);
    if (h >= t.overdueHours) return 'overdue';
    if (h >= t.warnHours) return 'aging';
    return 'ontrack';
}

export function weekdayAgeLabel(iso: string, now: number = Date.now()): string {
    const mins = Math.max(0, Math.floor(weekdayMsBetween(new Date(iso).getTime(), now) / 60_000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    const rem = h % 24;
    return rem ? `${d}d ${rem}h` : `${d}d`;
}