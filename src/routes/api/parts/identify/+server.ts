import { getClient, MODEL } from "$lib/server/assistant";
import { retrieveParts, formatCandidates } from "$lib/server/retrieval";
import { logSuggestion } from "$lib/server/suggestions";
import { getSupabaseAdmin } from "$lib/server/whatsapp";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const SYSTEM = `
    You identify industrial biomass boiler spare parts from a customer's description.

You are given a shortlist of candidate parts retrieved from the catalogue by
semantic similarity, and sometimes a replacement schedule for the customer's
boiler.

Rules:
- Choose ONLY from the candidate list. Never invent a part number.
- If no candidate plausibly matches, set part_number to null and say what
  additional detail would help (location on the boiler, symptom, size, markings).
- Prefer a part that is also due for replacement according to the schedule, but
  only when it genuinely matches the description -- timing is corroboration, not
  evidence on its own.
- confidence: "high" only when the description clearly names or describes one
  part; "medium" when it fits a few; "low" when you are largely guessing.

Reply with ONLY a JSON object, no markdown fences, no preamble:
{"part_number": string|null, "reasoning": string, "confidence": "high"|"medium"|"low", "follow_up": string|null}
`.trim();

async function getScheduleContext(userId: string | null, boilerCode: string | null) {
    if (!userId) return '';
    try {
        const supabase = getSupabaseAdmin();
        let q = supabase
            .from('part_replacement_schedule')
            .select('part_number, part_name, next_due_on, confidence, boiler_code')
            .eq('user_id', userId)
            .order('next_due_on', { ascending: true })
            .limit(10);
        if (boilerCode) q = q.eq('boiler_code', boilerCode);

        const { data } = await q;
        if (!data?.length) return '';

        const lines = data.map(
            (r: any) => 
                `- ${r.part_number} (${r.part_name}) on ${r.boiler_code}: next due on ${r.next_due_on} [${r.confidence} confidence]`
        );
        return '\n\nReplacement schedule for this customer:\n' + lines.join('\n');
    } catch {
        return '';
    }
}

function parseModelJson(text: string) {
    const cleaned = text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >=0 && end > start) {
            try {
                return JSON.parse(cleaned.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

export const POST: RequestHandler = async ({ request, locals }) => {
    let body: { message?: string; boilerCode?: string; sessionId?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Bad request' }, { status: 400 });
    }

    const message = (body.message ?? '').trim();
    if (!message) return json({ error: 'No mesage' }, { status: 400 });

    const session = await locals.safeGetSession();
    const userId = session?.user?.id ?? null;
    const boilerCode = body.boilerCode?.trim() || null;

    const candidates = await retrieveParts(message, 8);
    if (!candidates.length) {
        return json({
            part_number: null,
            reasoning: 'No close catalogue match was found. Could you describe where the part sits in the boiler, or share its part number or image?',
            confidence: 'low',
            candidates: [],
            suggestionId: null
        });
    }

    const scheduleContext = await getScheduleContext(userId, boilerCode);
    const userPrompt = 
        `Customer's description: ${message}` + 
        (boilerCode ? `\nBoiler: ${boilerCode}` : '') + 
        formatCandidates(candidates) + 
        scheduleContext;

    let parsed: any = null;
    try {
        const res = await getClient().messages.create({
            model: MODEL,
            max_tokens: 600,
            system: SYSTEM,
            messages: [{ role: 'user', content: userPrompt }]
        });

        const text = res.content
            .map((b: any) => (b.type === 'text' ? b.text : ''))
            .filter(Boolean)
            .join('\n');
        parsed = parseModelJson(text);
    } catch (e) {
        console.error('identify: model call failed', e);
    }

    if (!parsed) {
        return json({
            part_number: null,
            reasoning: 'Could not analyse that just now. Please try again.', 
            confidence: 'low',
            candidates: candidates.map((c) => ({ part_number: c.part_number, name: c.name })),
            suggestionId: null
        });
    }

    const chosen = parsed.part_number
        ? candidates.find((c) => c.part_number.toLowerCase() === String(parsed.part_number).toLowerCase()) ?? null 
        : null;

    const suggestionId = await logSuggestion({
        userId,
        sessionId: body.sessionId ?? null,
        channel: 'web', 
        queryText: message,
        boilerCode,
        retrieved: candidates,
        suggestedPartId: chosen?.id ?? null,
        suggestedPartNumber: chosen?.part_number ?? null,
        reasoning: parsed.reasoning ?? null,
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
            ? parsed.confidence 
            : 'low'
    });

    return json({
        part_number: chosen?.part_number ?? null,
        part_name: chosen?.name ?? null,
        part_id: chosen?.id ?? null,
        reasoning: parsed.reasoning ?? '',
        confidence: parsed.confidence ?? 'low',
        candidates: candidates.map((c) => ({
            part_id: c.id,
            part_number: c.part_number,
            name: c.name,
            similarity: Number(c.similarity?.toFixed(3) ?? 0)
        })),
        suggestionId
    });
};