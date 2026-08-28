import { env } from "$env/dynamic/private";
import { getSupabaseAdmin } from "./whatsapp";

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const EMBED_MODEL = 'voyage-3';

export type RetrievedPart = {
    id: string;
    part_number: string;
    name: string;
    description: string | null;
    in_stock: boolean | null;
    similarity: number;
};

export async function embedQuery(text: string): Promise<number[] | null> {
    const key = env.VOYAGE_API_KEY;
    if (!key || !text.trim()) return null;

    try {
        const res = await fetch(VOYAGE_URL, {
            method: 'POST',
            headers: {
                Authorization: `Beareer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: [text.slice(0, 2000)],
                model: EMBED_MODEL,
                input_type: 'query'
            })
        });
        if (!res.ok) {
            console.error('Voyage embed failed:', res.status);
            return null;
        }
        const json = await res.json();
        return json?.data?.[0]?.embedding ?? null;
    } catch (e) {
        console.error('Voyage embed error:', e);
        return null;
    }
}

export async function retrieveParts(query: string, limit = 8): Promise<RetrievedPart[]> {
    const embedding = await embedQuery(query);
    if (!embedding) return [];

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.rpc('match_parts', {
            query_embedding: embedding,
            match_count: limit,
            min_similarity: 0.25
        });
        if (error) {
            console.error('match_parts error:', error.message);
            return [];
        }
        return (data ?? []) as RetrievedPart[];
    } catch (e) {
        console.error('retrieveParts error:', e);
        return [];
    }
}

export function formatCandidates(parts: RetrievedPart[]): string {
    if (!parts.length) return '';
    const lines = parts.map((p) => {
        const desc = p.description ? ` - ${p.description}` : '';
        return `- ${p.part_number} | ${p.name}${desc}`.slice(0, 220);
    });
    return (
        '\n\nMost relevant catalogue parts for this question ' + 
        '(ranked by semantic similarity; suggest ONLY from the list):\n' + 
        lines.join('\n')
    );
}