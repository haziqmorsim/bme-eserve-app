import { getClient, MODEL, SYSTEM_PROMPT_WEB } from '$lib/server/assistant';
import { getPartsCatalogContext } from '$lib/server/catalog';
import { retrieveParts, formatCandidates } from '$lib/server/retrieval';
import { logSuggestion } from '$lib/server/suggestions';
import { describePartImage, extractImages } from '$lib/server/vision';
import { toMap, num } from '$lib/settings';
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

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: { messages?: InMsg[]; sessionId?: string };
	try {
		body = await request.json();
	} catch {
		return new Response('Bad request', { status: 400 });
	}

	const messages = Array.isArray(body?.messages) ? sanitize(body.messages) : [];
	if (!messages.length) return new Response('No messages', { status: 400 });

	const { session } = await locals.safeGetSession();
	const userId = session?.user?.id ?? null;

	if (userId) {
		const { data: settingRows } = await locals.supabase
			.from('app_settings')
			.select('key, value')
			.eq('key', 'chatbot_daily_limit');
		const dailyLimit = num(toMap(settingRows), 'chatbot_daily_limit', 0);

		if (dailyLimit > 0) {
			const since = new Date();
			since.setHours(0, 0, 0, 0);
			const { count } = await locals.supabase
				.from('chat_messages')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', userId)
				.eq('role', 'user')
				.gte('created_at', since.toISOString());

			if ((count ?? 0) >= dailyLimit) {
				return new Response(
					`You have reached today's limit of ${dailyLimit} messages. Please try again tomorrow, or contact us directly if it is urgent.`,
					{ status: 429, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
				);
			}
		}
	}

	const lastUser = [...messages].reverse().find((m) => m.role === 'user');
	const caption =
		typeof lastUser?.content === 'string'
			? lastUser.content
			: ((lastUser?.content as Block[] | undefined)
					?.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text')
					.map((b) => b.text)
					.join(' ') ?? '');

	const images = extractImages(lastUser?.content);
	const imageDescription = images.length ? await describePartImage(images, caption) : null;

	const queryText = [caption.trim(), imageDescription ?? ''].filter(Boolean).join(' ');

	const retrieved = queryText ? await retrieveParts(queryText, 8) : [];
	const catalogueContext = retrieved.length
		? formatCandidates(retrieved)
		: await getPartsCatalogContext();

	const system = SYSTEM_PROMPT_WEB + catalogueContext;

	const suggestionId = retrieved.length ? crypto.randomUUID() : null;

	const stream = getClient().messages.stream({
		model: MODEL,
		max_tokens: 1024,
		system,
		messages: messages as any
	});

	const encoder = new TextEncoder();
	const rs = new ReadableStream({
		async start(controller) {
			let full = '';
			try {
				for await (const event of stream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						full += event.delta.text;
						controller.enqueue(encoder.encode(event.delta.text));
					}
				}
			} catch {
				controller.enqueue(encoder.encode('[Connection interrupted]'));
			} finally {
				controller.close();

				if (suggestionId && retrieved.length) {
					const haystack = full.toLowerCase();
					const named = retrieved.find((p) => haystack.includes(p.part_number.toLowerCase()));

					void logSuggestion({
						id: suggestionId,
						userId,
						sessionId: body.sessionId ?? null,
						channel: 'web',
						queryText,
						retrieved,
						hasImage: images.length > 0,
						imageDescription,
						suggestedPartId: named?.id ?? null,
						suggestedPartNumber: named?.part_number ?? null,
						reasoning: full.slice(0, 2000),
						confidence: null
					}).catch(() => {});
				}
			}
		}
	});

	const headers: Record<string, string> = {
		'Content-Type': 'text/plain; charset=utf-8'
	};
	if (suggestionId) {
		headers['x-suggestion-id'] = suggestionId;
		headers['Access-Control-Expose-Headers'] = 'x-suggestion-id';
	}

	return new Response(rs, { headers });
};
