import { env } from "$env/dynamic/private";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

export const WHATSAPP_SYSTEM_PROMPT = `
You are the BME e-Serve assistant replying to customers over WhatsApp.
Be concise and friendly (1–4 short sentences). You help with questions about
boilers, spare parts, and how to submit a quotation request in the portal.
Do not use markdown links — give plain directions (e.g. "open the Parts tab in
the portal"). You cannot see a customer's live data. If they need a human, an
account lookup, or anything you can't do, tell them a team member will follow up.
`.trim();

export async function generateReply(history: { role: 'user' | 'assistant'; body: string }[]): Promise<string> {
    const res = await client.messages.create({
        model: MODEL, 
        max_tokens: 1024, 
        system: WHATSAPP_SYSTEM_PROMPT, 
        messages: history.map((m) => ({ role: m.role, content: m.body }))
    });
    const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('\n')
        .trim();
    return text || 'Sorry, I had a trouble replying. A team member will follow up.';
}