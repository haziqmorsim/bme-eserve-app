export type HeightMap = { size: number; z: Float32Array; mask: Float32Array; maskCanvas: HTMLCanvasElement };

const DEPTH_DIR = '/parts-3d';

export function supports3D(url: string | null | undefined): boolean {
    const u = (url ?? '').trim();
    if (!u || u === '-') return false;
    if (/\.svg(\?|$)/i.test(u) || /picsum\.photos/i.test(u)) return false;
    return true;
}

export function reliefKey(url: string): string {
    let base = url.split('?')[0].split('#')[0].split('/').pop() ?? '';
    try {
        base = decodeURIComponent(base);
    } catch {
        // keep as is
    }
    return base
        .replace(/\.[a-z0-9]+$/i, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
}

export function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (cors) img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load ${src}`));
        img.src = src;
    });
}

function pixels(img: CanvasImageSource, size: number): Uint8ClampedArray {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, size, size);
    return g.getImageData(0, 0, size, size).data;
}

function maskCanvasFrom(mask: Float32Array, size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    for ( let i = 0; i < size * size; i++) {
        const v = Math.round(mask[i] * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}

export async function loadHeightMap(photoUrl: string): Promise<HeightMap> {
    const img = await loadImage(`${DEPTH_DIR}/${encodeURIComponent(reliefKey(photoUrl))}.png`, false);
    const size = img.naturalWidth;
    const d = pixels(img, size);
    const z = new Float32Array(size * size);
    const mask = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
        z[i] = ((d[i * 4] << 8) | d[i * 4 + 2]) / 65535;
        mask[i] = d[i * 4 + 1] / 255;
    }
    return { size, z, mask, maskCanvas: maskCanvasFrom(mask, size) };
}

export function estimateHeightMap(photo: CanvasImageSource, size = 256): HeightMap {
    const d = pixels(photo, size);
    const n = size * size;
    const border: number[][] = [[], [], []];
    for (let i = 0; i < size; i++)
        for (const p of [i, (size - 1) * size + i, i * size, i * size + size - 1])
            for (let c = 0; c < 3; c++) border[c].push(d[p * 4 + c]);
    const bg = border.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
    const inside = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const diff = Math.max(
            Math.abs(d[i * 4] - bg[0]),
            Math.abs(d[i * 4 + 1] - bg[1]),
            Math.abs(d[i * 4 + 2] - bg[2])
        );
        inside[i] = diff > 28 ? 1 : 0;
    }
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = inside[i] ? 1e6 : 0;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : dist[y * size + x]);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            if (!inside[i]) continue;
            dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
        }
    for (let y = size - 1; y >= 0; y--)
        for (let x = size - 1; x >= 0; x--) {
            const i = y * size + x;
            if (!inside[i]) continue;
            dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
        }
    let max = 1;
    for (let i = 0; i < n; i++) max = Math.max(max, dist[i]);
    const z = new Float32Array(n);
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        mask[i] = inside[i];
        const t = Math.min(1, dist[i] / Math.max(4, max));
        z[i] = inside[i] ? Math.sqrt(t) * 0.8 : 0;
    }
    return { size, z, mask, maskCanvas: maskCanvasFrom(mask, size) };
}