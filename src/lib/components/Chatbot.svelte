<script lang="ts">
    import { PUBLIC_WHATSAPP_BUSINESS_NUMBER } from "$env/static/public";
    import { Headset } from "@lucide/svelte";

    type Msg = { role: 'user' | 'assistant'; content: string };

    let open = $state(false);
    let input = $state('');
    let loading = $state(false);
    let messages = $state<Msg[]>([ 
        { role: 'assistant', content: 'Hi! I can help you find your way around BME e-Serve. What are you looking for?' }
    ]);

    let scrollEl = $state<HTMLDivElement>();

    $effect(() => {
        messages.length;
        messages.at(-1)?.content;
        scrollEl?.scrollTo({ top: scrollEl.scrollHeight });
    });

    async function send() {
        const text = input.trim();
        if (!text || loading) return;
        input = '';

        messages.push({ role: 'user', content: text});
        const payload = messages.map(({ role, content }) => ({ role, content }));
        messages.push({ role: 'assistant', content: '' });
        const idx = messages.length - 1;
        loading = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ messages: payload })
            });
            if (!res.ok || !res.body) throw new Error('Bad response');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                messages[idx].content += decoder.decode(value, { stream: true });
            }
        } catch {
            messages[idx].content = 'Sorry, something went wrong. Please try again or chat with us in WhatsApp.';
        } finally {
            loading = false;
        }
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function openWhatsapp() {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        const intro = lastUser 
            ? `Hi BME, I was using the e-Serve portal and need help with ${lastUser.content}.` 
            : 'Hi BME, I need help with the e-Serve portal.';
        const url = `https://wa.me/${PUBLIC_WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(intro)}`;
        window.open(url, '_blank', 'noopener');
    }

    function segments(text: string) {
        const re = /\[([^\]]+)\]\((\/[^\s)]*)\)|\*\*([^*]+)\*\*/g;
        const out: { type: 'text' | 'link' | 'bold'; text: string; href?: string }[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
            if (m[1] !== undefined) {
                out.push({ type: 'link', text: m[1], href: m[2] });
            } else {
                out.push({ type: 'bold', text: m[3] });
            }
            last = re.lastIndex;
        }
        if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
        return out;
    }
</script>

<div class="chat-root">
    {#if open}
        <div class="chat-panel" role="dialog" aria-label="BME e-Serve assistant">
            <div class="chat-header">
                <span>BME e-Serve Assistant</span>
                <button class="chat-icon-btn" onclick={() => (open = false)} aria-label="Close">×</button>
            </div>

            <div class="chat-messages" bind:this={scrollEl}>
                {#each messages as m}
                    <div class="chat-bubble {m.role}">
                        {#each segments(m.content) as seg}
                            {#if seg.type === 'link'}<a href={seg.href} onclick={() => (open = false)}>{seg.text}</a>
                            {:else if seg.type === 'bold'}<strong>{seg.text}</strong>
                            {:else}{seg.text}
                            {/if}
                        {/each}
                        {#if loading && m === messages.at(-1) && m.role === 'assistant' && !m.content}
                            <span class="chat-dots">...</span>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="chat-input-row">
                <input type="text" placeholder="Ask me how to find something..." bind:value={input} disabled={loading} />
                <button class="chat-send" onclick={send} disabled={loading || !input.trim()}>Send</button>
            </div>

            <button class="chat-whatsapp" onclick={openWhatsapp}>
                Chat on WhatsApp
                <i class="fa-brands fa-whatsapp whatsapp-icon"></i>
            </button>
        </div>
    {/if}

    <button class="chat-launcher" onclick={() => (open = !open)} aria-label={open ? 'Close assistant' : 'Open assistant'}>
        {#if open}×{:else}<Headset size={24} />{/if}
    </button>
</div>

<style>
    .chat-root {
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        z-index: 1000;
        font-family: inherit;
    }

    .chat-launcher {
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        border: none;
        background: var(--bme-dark-blue);
        color: #ffffff;
        font-size: 0.95rem;
        cursor: pointer;
        box-shadow: 3px 3px 20px #000000;
    }

    .chat-launcher:hover {
        background: var(--bme-darker-blue);
    }

    .chat-panel {
        position: absolute;
        bottom: 4.5rem;
        right: 0;
        width: min(22rem, 90vw);
        height: 30rem;
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
        border-radius: 0.9rem;
        overflow: hidden;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
    }

    .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--bme-dark-blue);
        color: #ffffff;
        font-weight: 600;
    }

    .chat-icon-btn {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 1.3rem;
        line-height: 1;
        cursor: pointer;
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background-color: #f6f8fb;
    }

    .chat-bubble {
        max-width: 85%;
        padding: 0.55rem 0.75rem;
        border-radius: 0.8rem;
        font-size: 0.9rem;
        line-height: 1.35;
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    .chat-bubble.user {
        align-self: flex-end;
        background: var(--bme-dark-blue);
        color: #ffffff;
    }

    .chat-bubble.assistant {
        align-self: flex-start;
        background-color: #ffffff;
        color: #1c2733;
        border: 1px solid #e2e8f0;
    }

    .chat-bubble a {
        color: var(--bme-dark-blue);
        text-decoration: underline;
    }

    .chat-bubble.user a {
        color: #ffffff;
    }

    .chat-dots {
        opacity: 0.5;
    }

    .chat-input-row {
        display: flex;
        gap: 0.5rem;
        padding: 0.6rem;
        border-top: 1px solid #e2e8f0;
    }

    .chat-input-row input {
        flex: 1;
        padding: 0.55rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.6rem;
        font-size: 0.9rem;
    }

    .chat-send {
        border: none;
        background: var(--bme-dark-blue);
        color: #ffffff;
        padding: 0 0.9rem;
        border-radius: 0.6rem;
        cursor: pointer;
        font-size: 0.9rem;
    }

    .chat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .chat-whatsapp {
        border: none;
        border-top: 1px solid #e2e8f0;
        background-color: #25d366;
        color: #ffffff;
        padding: 0.65rem;
        margin: 0.65rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
    }

    .chat-whatsapp:hover {
        filter: brightness(0.95);
    }

    .whatsapp-icon {
        margin-left: 0.4rem;
    }

    @media (max-width: 480px) {
        .chat-root { right: 0.75rem; bottom: 0.75rem; }
        .chat-panel { width: 92vw; height: min(30rem, 70vh); }
    }
</style>