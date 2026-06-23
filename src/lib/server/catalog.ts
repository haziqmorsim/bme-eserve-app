import { getSupabaseAdmin } from "./whatsapp";

let cache: { text: string; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getPartsCatalogContext(): Promise<string> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('parts').select('*').limit(300);
        if (error || !data?.length) return '';

        const lines = data
            .map((p: any) => {
                const name = p.name ?? p.part_name ?? p.title ?? '';
                const num = p.part_number ?? p.partNumber ?? p.code ?? p.sku ?? '';
                const desc = p.description ?? p.desc ?? '';
                const text = [name, num ? `(${num})` : '', desc].filter(Boolean).join(' ').trim();
                return text ? `- ${text}`.slice(0, 160) : '';
            })
            .filter((l: string) => l.length > 2);

        if (!lines.length) return '';

        const text = '\n\nAvailable spare parts catalogue (suggest ONLY from this list; match by name or part number):\n' + 
            lines.join('\n');
        cache = { text, at: Date.now() };
        return text;
    } catch (e) {
        console.error('Catalog content error:', e);
        return '';
    }
}