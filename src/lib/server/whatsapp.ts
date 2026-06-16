import { env } from "$env/dynamic/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
    PUBLIC_SUPABASE_URL, 
    env.SUPABASE_SERVICE_ROLE_KEY, 
    { auth: { persistSession: false} }
);

export async function sendWhatsAppText(to: string, body: string) {
    const url = `http://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
        method: 'POST', 
        headers: {
            Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp', 
            to, 
            type: 'text', 
            text: { body }
        })
    });
    if (!res.ok) console.error('Whatsapp send failed:', await res.text());
}