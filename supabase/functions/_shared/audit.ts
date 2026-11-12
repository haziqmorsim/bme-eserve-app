import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface AuditEntry {
    actorId: string | null;
    action: 'create' | 'update' | 'delete' | 'invitation_resent' | 'password_reset';
    entityType: string;
    entityId?: string | null;
    entityLabel?: string | null;
    details?: Record<string, unknown> | null;
}

const MAX_VALUE_LENGTH = 200;

function clip(v: unknown): unknown {
    if (typeof v === 'string') return v.length > MAX_VALUE_LENGTH ? `${v.slice(0, MAX_VALUE_LENGTH)}…` : v;
    if (v !== null && typeof v === 'object') {
        const s = JSON.stringify(v);
        return s.length > MAX_VALUE_LENGTH ? `${s.slice(0, MAX_VALUE_LENGTH)}…` : v;
    }
    return v;
}

function same(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        return JSON.stringify([...a].map(String).sort()) === JSON.stringify([...b].map(String).sort());
    }
    return (a ?? null) === (b ?? null);
}

export function diffFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
    keys: string[]
): Record<string, [unknown, unknown]> {
    const out: Record<string, [unknown, unknown]> = {};
    for (const k of keys) {
        const b = before?.[k];
        const a = after[k];
        if (!same(b, a)) out[k] = [clip(b ?? null), clip(a ?? null)];
    }
    return out;
}

export function snapshotFields(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        const v = row[k];
        if (v !== null && v !== undefined && v !== '') out[k] = clip(v);
    }
    return out;
}

export async function writeAudit(admin: SupabaseClient, entry: AuditEntry): Promise<void> {
    try {
        let actorName: string | null = null;
        let actorRole: string | null = null;
        if (entry.actorId) {
            const { data } = await admin
                .from('profiles')
                .select('full_name, role')
                .eq('id', entry.actorId)
                .maybeSingle();
            actorName = data?.full_name ?? null;
            actorRole = data?.role ?? null;
        }

        const { error } = await admin.from('audit_log').insert({
            actor_id: entry.actorId,
            actor_name: actorName,
            actor_role: actorRole,
            action: entry.action,
            entity_type: entry.entityType,
            entity_id: entry.entityId ?? null,
            entity_label: entry.entityLabel ?? null,
            details: entry.details ?? null
        });
        if (error) console.error('audit_log write failed:', error.message);
    } catch (e) {
        console.error('audit_log write failed:', e);
    }
}