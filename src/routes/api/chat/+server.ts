import { getClient, MODEL, SYSTEM_PROMPT_WEB } from '$lib/server/assistant';
import { getPartsCatalogContext } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

type Block =
	| { type: 'text'; text: string }
	| { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
type InMsg = { role: 'user' | 'assistant'; content: string | Block[] };

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMG_BYTES = 5 * 1024 * 1024;

function sanitize(messages: InMsg[]): InMsg[] {
	const cleaned = messages.slice(-20).map((m) => {
		if (typeof m.content === 'string') return { role: m.role, content: m.content };
		const blocks = (m.content as Block[]).filter((b) => {
			if (b?.type === 'text') return typeof b.text === 'string';
			if (b?.type === 'image' && b.source?.type === 'base64') {
				if (!ALLOWED.has(b.source.media_type)) return false;
				if ((b.source.data.length * 3) / 4 > MAX_IMG_BYTES) return false;
				return true;
			}
			return false;
		});
		return { role: m.role, content: blocks.length ? blocks : '(empty)' };
	});
	while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
	return cleaned;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: { messages?: InMsg[] };
	try {
		body = await request.json();
	} catch {
		return new Response('Bad request', { status: 400 });
	}

	const messages = Array.isArray(body?.messages) ? sanitize(body.messages) : [];
	if (!messages.length) return new Response('No messages', { status: 400 });

	const system = SYSTEM_PROMPT_WEB + (await getPartsCatalogContext());

	const stream = getClient().messages.stream({
		model: MODEL,
		max_tokens: 1024,
		system,
		messages: messages as any
	});

	const encoder = new TextEncoder();
	const rs = new ReadableStream({
		async start(controller) {
			try {
				for await (const event of stream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						controller.enqueue(encoder.encode(event.delta.text));
					}
				}
			} catch {
				controller.enqueue(encoder.encode('[Connection interrupted]'));
			} finally {
				controller.close();
			}
		}
	});

	return new Response(rs, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};