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

    try {
        await supabase.from('activity_events').insert({
            user_id: user.id, 
            role: user.role ?? null, 
            event_type: input.event_type, 
            path: input.path ?? null, 
            meta: input.meta ?? null
        });
    } catch {
        
    }
}