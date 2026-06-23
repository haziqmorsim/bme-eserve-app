import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.facebook.com/v23.0';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
	if (!_admin) {
		_admin = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false }
		});
	}
	return _admin;
}

export async function sendWhatsAppText(to: string, body: string) {
	const res = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } })
	});
	if (!res.ok) console.error('WhatsApp send failed:', await res.text());
}

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export async function downloadWhatsAppMedia(
	mediaId: string
): Promise<{ data: string; mediaType: string } | null> {
	try {
		const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
			headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
		});
		if (!metaRes.ok) {
			console.error('WhatsApp media lookup failed:', await metaRes.text());
			return null;
		}
		const meta = await metaRes.json();

		const mediaType: string = meta.mime_type ?? 'image/jpeg';
		if (!ALLOWED_MEDIA.has(mediaType)) return null;

		const binRes = await fetch(meta.url, {
			headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` }
		});
		if (!binRes.ok) {
			console.error('WhatsApp media download failed:', binRes.status);
			return null;
		}

		const buf = Buffer.from(await binRes.arrayBuffer());
		if (buf.byteLength > MAX_MEDIA_BYTES) return null;
		return { data: buf.toString('base64'), mediaType };
	} catch (e) {
		console.error('WhatsApp media error:', e);
		return null;
	}
}