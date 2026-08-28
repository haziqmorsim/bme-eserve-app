import { resolveSuggestion } from "$lib/server/suggestions";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
    let body: { suggestionId?: string; outcome: string; actualPartId: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Bad request' }, { status: 400 });
    }

    const { session } = await locals.safeGetSession();
    if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

    const { suggestionId, outcome, actualPartId } = body;
    if (!suggestionId || !['accepted', 'rejected', 'corrected'].includes(outcome ?? '')) {
        return json({ error: 'Invalid outcome' }, { status: 400 });
    }

    const ok = await resolveSuggestion(
        suggestionId,
        outcome as 'accepted' | 'rejected' | 'corrected',
        { actualPartId: actualPartId ?? null, source: 'customer' }
    );

    return json({ ok });
};