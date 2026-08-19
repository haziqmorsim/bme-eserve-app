import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MODEL = 'claude-sonnet-4-6';
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMG_BYTES = 5 * 1024 * 1024;

type Block = 
    | { type: 'text'; text: string; } 
    | { type: 'image'; source { type: 'base64'; media_type: string; data: string; } };
type InMsg = { role: 'user' | 'assistant'; content: string | Block[] };

const IMAGE_ANALYSIS_GUIDE = `
Image handling — when the customer sends a photo of a boiler part:
- Identify the part: what it is, its function, and any visible identifying clues
  (markings, part numbers, shape, threads/flanges, connection type, approximate size).
- Suggest the correct spare part(s) the customer likely needs and the next step
  (for example, adding it to a quotation request in the portal).
- If a parts catalogue is provided below, suggest ONLY items from that catalogue and
  match by name or part number. Never invent a part number that is not in the catalogue.
- If the photo is too blurry, dark, cropped, or low-resolution to identify the part with
  reasonable confidence, do NOT guess — say so plainly and ask for a clearer, well-lit
  photo of the whole part.
- If the photo is not a boiler or a boiler part at all, say you can only identify boiler
  spare parts and ask for a relevant photo.
`.trim();

const SYSTEM_PROMPT_WEB = `
You are the BME e-Serve assistant, a friendly helper for an industrial biomass boiler
parts and service portal. You help logged-in customers navigate the site.

Guidance:
- Be concise. Answer in 1-4 short sentences (a little more is fine when identifying a part).
- When directing a user to a page, use a markdown link with an INTERNAL path only, like
  [your quote list](/quote). Never invent external links.
- You do not have access to live data such as a specific user's quotes or order status.
- Do NOT use markdown tables or pipe (|) characters. When listing parts, put each part on
  its own line as: • **<PART NUMBER>** — <name> (<key details>). Keep it tidy and
  easy to read on a phone.
- If the user needs a human or something you cannot do, tell them to use the
  "Chat on WhatsApp" button.

${IMAGE_ANALYSIS_GUIDE}
`.trim();

let catalogCache: { text: string; at: number } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function getPartsCatalogContext(admin: ReturnType<typeof createClient>): Promise<string> {
    if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.text;

    try {
        const { data, error } = await admin.from('parts').select('*').limit(300);
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

        const text = 
            '\n\nAvailable spare parts catalogue (suggest ONLY from this list; match by name or part number):\n' + 
            lines.join('\n');
        catalogCache = { text, at: Date.now() };
        return text;
    } catch (e) {
        console.error('Catalog content error:', e);
        return '';
    }
}

function sanitize(messages: InMsg[]): InMsg[] {
    const cleaned = messages.slice(-20).map((m) => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content };
        const blocks = (m.content as Blocks[]).filter((b) => {
            if (b?.type === 'text') return typeof b.text === 'string';
            if (b?.type === 'image' && b.source?.type === 'base64') {
                if(!ALLOWED.has(b.source.media_type)) return false;
                if ((b.source.data.length * 3) / 4 > MAX_IMG_BYTES) return false;
            return true;
            } 
            return false;
        });
        return { role: m.role, content: block.length ? blocks : '(empty' };
    });
    while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
    return cleaned;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method === 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body: { message?. InMsg[] };
    try {
        body = await req.json();
    } catch {
        return new Response('Bad request', { status: 400, headers: corsHeaders });
    }

    const messages = Array.isArray(body?.messages) ? sanitize(body.messages) : [];
    if (!messages.length) {
        return new Response('No messages', { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const system = SYSTEM_PROMPT_WEB + (await getPartsCatalogContext(admin));

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', 
        headers: {
            'content-type': 'application/json', 
            'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: MODEL, 
            max_token: 1024, 
            system, 
            messages, 
            stream: true
        })
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
        const errText = await anthropicRes.text().catch(() => '');
        console.error('Anthropic API error:', anthropicRes.status, errText);
        return new Response('Upstream error', { status: 502, headers: corsheaders });
    }
})