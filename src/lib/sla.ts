export const SLA_WARN_HOURS = 24;
export const SLA_OVERDUE_HOURS = 48;

export type SlaState = 'ontrack' | 'aging' | 'overdue';

export const SLA_LABEL: Record<SlaState, string> = {
    ontrack: 'On track',
    aging: 'Aging',
    overdue: 'Overdue'
};

export function hoursSince(iso: string, now: number = Date.now()): number {
    return (now - new Date(iso).getTime()) / 3_600_000;
}

export function slaState(iso: string, now: number = Date.now()): SlaState {
    const h = hoursSince(iso, now);
    if (h >= SLA_OVERDUE_HOURS) return 'overdue';
    if (h >= SLA_WARN_HOURS) return 'aging';
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