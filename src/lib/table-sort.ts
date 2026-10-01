export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir };
export type SortValue = string | number | null | undefined;

export function nextSort(current: SortState, key: string): SortState {
    if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    return { key, dir: 'asc' };
}

function isEmpty(v: SortValue): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return Number.isNaN(v);
    const s = v.trim();
    return s === '' || s === '-' || s === '—';
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortRows<T>(
    rows: T[],
    sort: SortState,
    accessors: Record<string, (row: T) => SortValue>
): T[] {
    const get = accessors[sort.key];
    if (!get) return [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows
        .map((row, i) => ({ row, i, v: get(row) }))
        .sort((a, b) => {
            const ae = isEmpty(a.v);
            const be = isEmpty(b.v);
            if (ae || be) return ae && be ? a.i - b.i : ae ? 1 : -1;
            const c = typeof a.v === 'number' && typeof b.v === 'number'
                ? a.v - b.v
                : collator.compare(String(a.v), String(b.v));
            return c !== 0 ? c * dir : a.i - b.i;
        })
        .map((x) => x.row);
}