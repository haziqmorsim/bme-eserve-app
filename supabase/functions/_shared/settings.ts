import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export async function getSettings(
    admin: SupabaseClient,
    key: string,
    envFallback?: string
): Promise<string | null> {
    try {
        const { data } = await admin
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();
        const value = (data?.value ?? '').trim();
        if (value) return value;
    } catch (_err) {
        // Fall through the env fallback below.
    }
    const env = envFallback ? Deno.env.get(envFallback) : undefined;
    return (env ?? '').trim() || null;
}

export async function getAdminEmail(admin: SupabaseClient): Promise<string | null> {
    return await getSettings(admin, 'admin_email', 'ADMIN_EMAIL');
}