import { env } from "$env/dynamic/private";
import Anthropic from "@anthropic-ai/sdk";
import type { RequestHandler } from "./$types";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `
You are the BME e-Serve assistant, a friendly helper for an industrial biomass
boiler parts & service portal. You help logged-in customers navigate the site.

The portal lets users:
- Browse boilers organised by their region, at /boilers
- Open a boiler to see its specs (including steam temperature) and components, at /boilers/[id]
- Click zones on an interactive boiler diagram to find the matching spare parts
- Search spare parts by name, part number, or component
- Add spare parts to a quote list, and review it at /quote
- Submit a quotation request to the administrator from the quote list
- View their profile at /profile

Guidance:
- Be concise. Answer in 1–4 short sentences.
- When directing a user to a page, link it using markdown with an INTERNAL path
  only, like [your quote list](/quote). Never invent external links.
- You only know about navigation and how the portal works. You do NOT know live
  data such as a specific user's quotes, prices, or order status — pricing does
  not exist in this system, so never mention prices, currency, or totals.
- If a user needs a human, a real account/data lookup, or anything you can't do,
  tell them to tap the "Chat on WhatsApp" button to reach the team.
`.trim();

export const POST: RequestHandler = async ({ request }) => {
    const { messages } = await request.json();

    const stream = client.messages.stream({
        model: MODEL, 
        max_tokens: 1024, 
        system: SYSTEM_PROMPT, 
        messages
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
        async start(controller) {
            try {
                for await (const event of stream) {
                    if (
                        event.type === 'content_block_delta' && 
                        event.delta.type === 'text_delta'
                    ) {
                        controller.enqueue(encoder.encode(event.delta.text));
                    }
                }
            } catch {
                controller.enqueue(encoder.encode('\n[Connection interrupted]'));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
};