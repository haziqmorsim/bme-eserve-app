export type Filters = {
    q: string;
    status: string;
    region: string;
    from: string;
    to: string;
};

export function emptyFilters(): Filters {
    return { q: '', status: 'all', region: 'all', from: '', to: ''};
}

export function isActive(f: Filters): boolean {
    return !!f.q.trim || f.status !== 'all' || f.region !== 'all' || !!f.from || !!f.to;
}

type Fields = {
    search?: (string | null | undefined)[];
    status?: string | null;
    region?: string | null;
    date?: string | null;
};

export function matches(f: Filters, fields: Fields): boolean {
    const q = f.q.trim().toLowerCase();
    if (q) {
        const hit = (fields.search ?? []).some((v) => (v ?? '').toString().toLowerCase().includes(q));
        if (!hit) return false;
    }
    if (f.status !== 'all' && fields.status !== f.status) return false;
    if (f.region !== 'all' && (fields.region ?? '') !== f.region) return false;
    if (fields.date) {
        const d = new Date(fields.date).getTime();
        if (f.from && d < new Date(f.from + 'T00:00:00').getTime()) return false;
        if (f.to && d > new Date(f.to + 'T23:59:59').getTime()) return false;
    }
    return true;
}