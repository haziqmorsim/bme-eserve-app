import { env } from "$env/dynamic/private";

export type ImageBlock = {
    type: 'image';
    source: { type: 'base64'; media_type: string; data: string }
};

const TIMEOUT_MS = 8000

type PreprocessResponse = {
    data: string;
    media_type: string;
    width: string;
    height: string;
    original_bytes: number;
    processed_bytes: number;
    rotated: boolean;
};

async function preprocessOne(block: ImageBlock): Promise<ImageBlock> {
    const base = env.IMAGING_SERVICE_URL;
    if (!base) return block;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch (`${base.replace(/\$/, '')}/preprocess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(env.IMAGING_SERVICE_KEY ? { 'x-eserve-key': env.IMAGING_SERVICE_KEY } : {})
            },
            body: JSON.stringify({
                data: block.source.data,
                media_type: block.source.media_type
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            console.warn('imaging: preprocess returned', res.status);
            return block;
        }

        const json = ( await res.json()) as PreprocessResponse;
        if (!json?.data) return block;

        return {
            type: 'image',
            source: {
                type: 'base64',
                media_type: json.media_type || 'image/jpeg',
                data: json.data
            }
        };
    } catch (e) {
        console.warn('imaging: preprocess unavailable, using original image', e);
        return block;
    } finally {
        clearTimeout(timer);
    }
}

export async function preprocessImageBlocks<T>(content: T): Promise<T> {
    if (!Array.isArray(content)) return content;
    if (!env.IMAGING_SERVICE_URL) return content;

    const hasImage = content.some((b: any) => b?.type === 'image' && b?.source?.type === 'base64');
    if (!hasImage) return content;

    const processed = await Promise.all(
        content.map(async (b: any) => 
            b?.type === 'image' && b?.source?.type === 'base64'
                ? await preprocessOne(b as ImageBlock)
                : b
        )
    );

    return processed as T;
}