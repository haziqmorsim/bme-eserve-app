import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { readInvoicePage, UnreadableReply } from "$lib/server/invoice-reader";
import type { RequestHandler } from "./$types";

export const config = { maxDuration: 60 };

const CAN_RUN = new Set(['admin', 'manager', 'coo', 'developer']);

const MAX_IMAGE_BASE64 = 4 * 1024 * 1024;
const MAX_OCR_CHARS = 20_000;

export const POST: RequestHandler = async ({ request, locals }) => {
    const { session, user } = await locals.safeGetSession();
    if (!session || !user) return json({ error: 'unauthenticated' }, { status: 401 });

    const { data: profile } = await locals.supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    if (!profile || !CAN_RUN.has(profile.role)) return json({ error: 'forbidden' }, { status: 403 });

    if (!env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, { status: 503 });

    let body: { image?: unknown; text?: unknown };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad_request' }, { status: 400 });
    }

    const image = typeof body.image === 'string' ? body.image : '';
    const text = typeof body.text === 'string' ? body.text.slice(0, MAX_OCR_CHARS) : '';
    if (!image || image.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
        return json({ error: 'bad_image' }, { status: 400 });
    }

    try {
        const invoice = await readInvoicePage(image, text);
        return json({ invoice });
    } catch (err) {
        const reason = err instanceof UnreadableReply ? 'unreadable_reply' : 'model_failed';
        console.error(`[extract/invoice] ${reason}:`, (err as Error)?.message ?? err);
        return json({ error: reason }, { status: 502 });
    }
};