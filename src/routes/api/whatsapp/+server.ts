import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { generateReply } from '$lib/server/assistant';
import { sendWhatsAppText, getSupabaseAdmin } from '$lib/server/whatsapp';
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

  if (!message || message.type !== 'text') {
    return new Response('ok', { status: 200 });
  }

  const from = message.from as string;
  const wamId = message.id as string;
  const text = message.text.body as string;

  const supabase = getSupabaseAdmin();

  const { error: claimError } = await supabase
    .from('whatsapp_messages')
    .insert({ wa_id: from, wam_id: wamId, role: 'user', body: text });
  if (claimError) return new Response('ok', { status: 200 });

  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('role, body')
    .eq('wa_id', from)
    .order('created_at', { ascending: true })
    .limit(20);

  const reply = await generateReply(history ?? []);
  await sendWhatsAppText(from, reply);
  await supabase
    .from('whatsapp_messages')
    .insert({ wa_id: from, role: 'assistant', body: reply });

  return new Response('ok', { status: 200 });
};