export type SettingRow = { key: string; value: string | null };
export type SettingsMap = Record<string, string>;

export function toMap(rows: SettingRow[] | null | undefined): SettingsMap {
    const m: SettingsMap = {};
    for (const r of rows ?? []) m[r.key] = r.value ?? '';
    return m;
}

export function str(m: SettingsMap, key: string, fallback: string = ''): string {
    const v = (m[key] ?? '').trim();
    return v || fallback;
}

export function num(m: SettingsMap, key: string, fallback: number): number {
    const n = Number((m[key] ?? '').trim());
    return Number.isFinite(n) ? n : fallback;
}

export function bool(m: SettingsMap, key: string, fallback: boolean = false): boolean {
    const v = (m[key] ?? '').trim().toLowerCase();
    if (!v) return fallback;
    return v === 'on' || v === 'true' || v === '1' || v === 'yes';
}