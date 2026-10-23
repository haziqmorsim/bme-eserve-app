import { page } from '$app/state';
import { trackingIds } from '$lib/tracking';

export type ActivityUser = { id: string; role: string | null } | null | undefined;

export type ActivityInput = {
    event_type: string;
    path?: string | null;
    meta?: Record<string, unknown> | null;
}

export async function logActivity(
    supabase: any, 
    user: ActivityUser, 
    input: ActivityInput
): Promise<void> {
    if (!supabase || !user?.id) return;
    if (user.role === 'developer') return;

    const row = {
        user_id: user.id, 
        role: user.role ?? null, 
        event_type: input.event_type, 
        path: input.path ?? null, 
        meta: input.meta ?? null
    };

    try {
        const ids = trackingIds();
        const { error } = await supabase.from('activity_events').insert(ids ? { ...row, ...ids } : row);
        if (error && ids) await supabase.from('activity_events').insert(row);
    } catch {
        
    }
}

export function logAction(eventType: string, meta?: Record<string, unknown>): void {
    try {
        const d: any = page.data;
        const profile = d?.profile;
        void logActivity(
            d?.supabase,
            profile ? { id: profile.id, role: profile.role } : null,
            { event_type: eventType, path: page.url.pathname, meta: meta ?? null }
        );
    } catch {
        
    }
}

export function activityLabel(value: unknown, max = 80): string {
    const s = String(value ?? '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}