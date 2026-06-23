import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { generateReply,	SYSTEM_PROMPT_WHATSAPP,	type ChatMessage } from '$lib/server/assistant';
import { sendWhatsAppText, getSupabaseAdmin, downloadWhatsAppMedia } from '$lib/server/whatsapp';
import { getPartsCatalogContext } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');
	if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
		return new Response(challenge, { status: 200 });
	}
	return new Response('Forbidden', { status: 403 });
};

function verifySignature(raw: string, signature: string | null): boolean {
	if (!signature) return false;
	const expected =
		'sha256=' +
		crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(raw).digest('hex');
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.text();
	if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
		return new Response('Invalid signature', { status: 401 });
	}

	const value = JSON.parse(raw)?.entry?.[0]?.changes?.[0]?.value;
	const message = value?.messages?.[0];

	if (!message) return new Response('ok', { status: 200 });

	const from = message.from as string;
	const wamId = message.id as string;
	const type = message.type as string;

	let storedBody: string;
	if (type === 'text') storedBody = message.text.body;
	else if (type === 'image')
		storedBody = message.image?.caption ? `[image] ${message.image.caption}` : '[image]';
	else storedBody = `[${type}]`;

	const supabase = getSupabaseAdmin();

	const { error: claimError } = await supabase
		.from('whatsapp_messages')
		.insert({ wa_id: from, wam_id: wamId, role: 'user', body: storedBody });
	if (claimError) return new Response('ok', { status: 200 });

	let currentContent: ChatMessage['content'];

	if (type === 'text') {
		currentContent = message.text.body;
	} else if (type === 'image') {
		const media = await downloadWhatsAppMedia(message.image.id);
		if (!media) {
			const err =
				"I couldn't read that image. Please resend a clear, well-lit photo of the boiler part (JPG or PNG, under 5MB).";
			await sendWhatsAppText(from, err);
			await supabase
				.from('whatsapp_messages')
				.insert({ wa_id: from, role: 'assistant', body: err });
			return new Response('ok', { status: 200 });
		}
		const caption = (message.image.caption ?? '').trim();
		currentContent = [
			{ type: 'image', source: { type: 'base64', media_type: media.mediaType, data: media.data } },
			{
				type: 'text',
				text:
					caption ||
					'Please identify this boiler part from the photo and suggest the correct spare part.'
			}
		];
	} else {
		const msg =
			'I can help with text questions and photos of boiler parts. Please send a clear photo or describe what you need.';
		await sendWhatsAppText(from, msg);
		await supabase.from('whatsapp_messages').insert({ wa_id: from, role: 'assistant', body: msg });
		return new Response('ok', { status: 200 });
	}

	const { data: rows } = await supabase
		.from('whatsapp_messages')
		.select('role, body')
		.eq('wa_id', from)
		.order('created_at', { ascending: false })
		.limit(20);

	const history: ChatMessage[] = (rows ?? [])
		.reverse()
		.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.body as string }));
	if (history.length) history[history.length - 1].content = currentContent;
	else history.push({ role: 'user', content: currentContent });
	while (history.length && history[0].role !== 'user') history.shift();

	const system = SYSTEM_PROMPT_WHATSAPP + (await getPartsCatalogContext());
	const reply = await generateReply(history, system);

	await sendWhatsAppText(from, reply);
	await supabase.from('whatsapp_messages').insert({ wa_id: from, role: 'assistant', body: reply });

	return new Response('ok', { status: 200 });
};