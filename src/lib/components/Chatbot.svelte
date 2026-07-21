<script lang="ts">
    import { PUBLIC_WHATSAPP_BUSINESS_NUMBER } from "$env/static/public";
    import { Headset, Image as ImageIcon } from "@lucide/svelte";
    import { fly } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";

    type Msg = { role: 'user' | 'assistant'; content: string; image?: string };

    let { supabase = null, user = null } = $props<{ supabase?: any; user?: any }>();

    let sessionId: string | null = null;

    async function ensureSession(): Promise<string | null> {
        if (!supabase || !user) return null;
        if (sessionId) return sessionId;
        const { data: existing } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('user_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existing?.id) { sessionId = existing.id; return sessionId; }
        const { data: created } = await supabase
            .from('chat_sessions')
            .insert({ user_id: user.id })
            .select('id')
            .single();
        sessionId = created?.id ?? null;
        return sessionId;
    }

    async function persistMessage(role: 'user' | 'assistant', content: string, imageUrl: string | null = null) {
        if (!supabase || !user || !sessionId) return;
        try {
            await supabase.from('chat_messages').insert({
                session_id: sessionId, 
                user_id: user.id, 
                role, 
                content, 
                image_url: imageUrl
            });
        } catch (e) {
            console.error('Could not save chat message:', e);
        }
    }

    async function uploadChatImage(dataUrl: string, name: string): Promise<string | null> {
        if (!supabase || !user || !sessionId) return null;
        try {
            const blob = await (await fetch(dataUrl)).blob();
            const path = `${user.id}/${sessionId}/${Date.now()}.jpg`;
            const { error } = await supabase.storage.from('chat-uploads').upload(path, blob, {
                contentType: 'image/jpeg', 
                upsert: false
            });
            if (error) return null;
            const { data } = await supabase.storage.from('chat-uploads').createSignedUrl(path, 60 * 60 * 24 * 365);
            return data?.signedUrl ?? null;
        } catch (e) {
            console.error('Could not upload chat image:', e);
            return null;
        }
    }

    let open = $state(false);
    let input = $state('');
    let loading = $state(false);
    let messages = $state<Msg[]>([ 
        { role: 'assistant', content: 'Hi! I can help you find your way around BME e-Serve. You can also upload a photo of a boiler part and I will try to identify the right spare part. What are you looking for?' }
    ]);

    let pendingImage = $state<{ dataUrl: string; name: string } | null>(null);
    let fileInput = $state<HTMLInputElement>();

    let scrollEl = $state<HTMLDivElement>();

    $effect(() => {
        messages.length;
        messages.at(-1)?.content;
        scrollEl?.scrollTo({ top: scrollEl.scrollHeight });
    });

    function downscaleImage(file: File, max = 1568, quality = 0.85): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > max || height > max) {
                        const scale = Math.min(max / width, max / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('no canvas context'));
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('could not load image'));
                img.src = reader.result as string;
            };
            reader.onerror = () => reject(new Error('could not read file'));
            reader.readAsDataURL(file);
        });
    }

    async function onFile(e: Event) {
        const target = e.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        try {
            const dataUrl = await downscaleImage(file);
            pendingImage = { dataUrl, name: file.name };
        } catch {
            pendingImage = null;
        }
    }

    function toApiMessage(m: Msg, isLast: boolean) {
        if (m.role === 'user' && m.image && isLast) {
            const comma = m.image.indexOf(',');
            const mediaType = m.image.slice(5, comma).split(';')[0];
            const data = m.image.slice(comma + 1);
            return {
                role: m.role,
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
                    {
                        type: 'text',
                        text:
                            m.content?.trim() ||
                            'Please identify this boiler part from the photo and suggest the correct spare part.'
                    }
                ]
            };
        }
        if (m.role === 'user' && m.image) {
            return { role: m.role, content: m.content ? `${m.content} [photo sent]` : '[photo sent]' };
        }
        return { role: m.role, content: m.content };
    }

    async function send() {
        const text = input.trim();
        if ((!text && !pendingImage) || loading) return;
        input = '';
        const image = pendingImage?.dataUrl ?? undefined;
        const imageName = pendingImage?.name ?? 'photo.jpg';
        pendingImage = null;

        messages.push({ role: 'user', content: text, image });
        const payload = messages.map((m, i) => toApiMessage(m, i === messages.length - 1));
        messages.push({ role: 'assistant', content: '' });
        const idx = messages.length - 1;
        loading = true;

        await ensureSession();
        let imageUrl: string | null = null;
        if (image) imageUrl = await uploadChatImage(image, imageName);
        await persistMessage('user', text, imageUrl);

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
            await persistMessage('assistant', messages[idx].content);
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

    function normalize(text: string): string {
        const lines = text.replace(/\r/g, '').split('\n');
        const isPipe = (l: string) => /^\s*\|.*\|\s*$/.test(l);
        const isSep = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l);
        const out: string[] = [];
        let i = 0;
        while (i < lines.length) {
            if (isPipe(lines[i])) {
                const block: string[] = [];
                while (i < lines.length && isPipe(lines[i])) { block.push(lines[i]); i++; }
                const sepIdx = block.findIndex(isSep);
                const rows = sepIdx >= 0
                    ? block.filter((_, idx) => idx !== sepIdx && idx !== sepIdx - 1)
                    : block;
                for (const r of rows) {
                    const cells = r.trim().replace(/^\|/, '').replace(/\|$/, '')
                        .split('|').map((c) => c.trim()).filter(Boolean);
                    if (cells.length) out.push('\u2022 ' + cells.join(' \u2014 '));
                }
            } else {
                out.push(lines[i]); i++;
            }
        }
        return out.join('\n').trim();
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
        <div class="chat-panel" role="dialog" aria-label="BME e-Serve assistant" transition:fly={{ y: 16, duration: 220, easing: cubicInOut }}>
            <div class="chat-header">
                <span>BME e-Serve Assistant</span>
            </div>

            <div class="chat-messages" bind:this={scrollEl}>
                {#each messages as m}
                    <div class="chat-bubble {m.role}">
                        {#if m.image}
                            <img class="chat-bubble-img" src={m.image} alt="Uploaded boiler part" />
                        {/if}
                        {#each segments(normalize(m.content)) as seg}
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

            {#if pendingImage}
                <div class="chat-preview">
                    <img src={pendingImage.dataUrl} alt="Selected part" />
                    <span class="chat-preview-label" title={pendingImage.name}>{pendingImage.name}</span>
                    <button class="chat-preview-remove" onclick={() => (pendingImage = null)} aria-label="Remove photo">×</button>
                </div>
            {/if}

            <div class="chat-input-row">
                <input type="text" placeholder="Ask me how to find something..." bind:value={input} onkeydown={onKey} disabled={loading} />
                <input type="file" accept="image/*" bind:this={fileInput} onchange={onFile} hidden />
                <button class="chat-img-btn" onclick={() => fileInput?.click()} disabled={loading} aria-label="Upload a boiler part photo" title="Upload a boiler part photo">
                    <ImageIcon size={18} />
                </button>
                <button class="chat-send" onclick={send} disabled={loading || (!input.trim() && !pendingImage)}>Send</button>
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
        white-space: pre-line;
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

    .chat-bubble-img {
        display: block;
        max-width: 100%;
        border-radius: 0.5rem;
        margin-bottom: 0.4rem;
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

    .chat-preview {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.6rem;
        border-top: 1px solid #e2e8f0;
        background-color: #f6f8fb;
    }

    .chat-preview img {
        width: 2.5rem;
        height: 2.5rem;
        object-fit: cover;
        border-radius: 0.4rem;
        flex-shrink: 0;
    }

    .chat-preview-label {
        flex: 1;
        min-width: 0;
        font-size: 0.8rem;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .chat-preview-remove {
        background: none;
        border: none;
        color: #475569;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        flex-shrink: 0;
    }

    .chat-input-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem;
        border-top: 1px solid #e2e8f0;
    }

    .chat-input-row input[type="text"] {
        flex: 1;
        padding: 0.55rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.6rem;
        font-size: 0.9rem;
    }

    ::placeholder {
        font-size: 0.8rem;
    }

    .chat-img-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #cbd5e1;
        background-color: #ffffff;
        color: var(--bme-dark-blue);
        width: 2.3rem;
        height: 2.3rem;
        border-radius: 0.6rem;
        cursor: pointer;
        flex-shrink: 0;
    }

    .chat-img-btn:hover:not(:disabled) {
        background-color: #eef2f7;
    }

    .chat-img-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .chat-send {
        border: none;
        background: var(--bme-dark-blue);
        color: #ffffff;
        padding: 0.5rem 0.9rem;
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
        .chat-root { 
            right: 0.75rem; 
            bottom: 0.75rem; 
        }

        .chat-panel { 
            width: 92vw; 
            height: min(30rem, 70vh); 
        }
    }
</style>