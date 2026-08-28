import { labelFromQuote } from "$lib/server/suggestions";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
    const { session } = await locals.safeGetSession();
    if(!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 400 });

    let body: { partIds?: unknown };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Bad request' }, { status: 400 });
    }

    const partIds = Array.isArray(body.partIds) 
        ? body.partIds.filter((p): p is string => typeof p === 'string' && p.length > 0) 
        : [];

    if (!partIds.length) return json({ ok: true, labelled: 0 });

    const labelled = await labelFromQuote(session.user.id, partIds);
    return json({ ok: true, labelled });
};