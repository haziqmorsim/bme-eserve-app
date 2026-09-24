import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RenderedPage, TextLine } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const DEFAULT_DPI = 150;

const TEXT_LAYER_MIN_ITEMS = 12;

export async function openPdf(data: ArrayBuffer): Promise<{
    doc: pdfjs.PDFDocumentProxy;
    close: () => Promise<void>;
}> {
    const task = pdfjs.getDocument({ data, isEvalSupported: false });
    const doc = await task.promise;
    return { doc, close: () => task.destroy() };
}

export async function renderPage(
    doc: pdfjs.PDFDocumentProxy,
    index: number,
    dpi = DEFAULT_DPI
): Promise<RenderedPage> {
    const page = await doc.getPage(index);
    const viewport = page.getViewport({ scale: dpi / 72 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser would not provide a 2D canvas.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const grey = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        grey[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    }

    let hasTextLayer = false;
    try {
        const content = await page.getTextContent();
        hasTextLayer =
            content.items.filter((i) => 'str' in i && i.str.trim().length > 0).length >=
            TEXT_LAYER_MIN_ITEMS;
    } catch {
        hasTextLayer = false;
    }

    page.cleanup();
    return { index, width: canvas.width, height: canvas.height, canvas, grey, hasTextLayer };
}

export async function textLayerLines(
    doc: pdfjs.PDFDocumentProxy,
    index: number,
    dpi = DEFAULT_DPI
): Promise<TextLine[]> {
    const page = await doc.getPage(index);
    const viewport = page.getViewport({ scale: dpi / 72 });
    const content = await page.getTextContent();

    type Item = { text: string; x: number; y: number; w: number; h: number };
    const items: Item[] = [];
    for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const [, , , , e, f] = item.transform;
        const [x, yBottom] = viewport.convertToViewportPoint(e, f);
        const height = Math.abs(item.height || 0) * viewport.scale;
        items.push({
            text: item.str,
            x,
            y: yBottom - height / 2,
            w: (item.width || 0) * viewport.scale,
            h: height || 1
        });
    }
    page.cleanup();

    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const lines: TextLine[] = [];
    let bucket: Item[] = [];
    const flush = () => {
        if (!bucket.length) return;
        bucket.sort((a, b) => a.x - b.x);
        const left = Math.min(...bucket.map((i) => i.x));
        const right = Math.max(...bucket.map((i) => i.x + i.w));
        lines.push({
            text: bucket
                .map((i) => i.text)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim(),
            x: left,
            y: bucket.reduce((s, i) => s + i.y, 0) / bucket.length,
            width: right - left,
            height: Math.max(...bucket.map((i) => i.h)),
            confidence: 100,
            words: bucket.map((i) => ({ text: i.text.trim(), x: i.x, width: i.w, confidence: 100 }))
        });
        bucket = [];
    };
    for (const item of items) {
        if (!bucket.length) {
            bucket.push(item);
            continue;
        }
        const reference = bucket[bucket.length - 1];
        if (Math.abs(item.y - reference.y) <= Math.max(2, reference.h * 0.5)) bucket.push(item);
        else {
            flush();
            bucket.push(item);
        }
    }
    flush();
    return lines.filter((l) => l.text).sort((a, b) => a.y - b.y);
}

const INK_THRESHOLD = 160;
const RULE_OF_DARKEST_ROW = 0.55;
const RULE_OF_DARKEST_COL = 0.3;
const RULE_FLOOR = 0.25;

export function profile(
    page: RenderedPage,
    axis: 'row' | 'col',
    band?: { top: number; bottom: number }
): number[] {
    const { width, height, grey } = page;
    const top = Math.max(0, band?.top ?? 0);
    const bottom = Math.min(height, band?.bottom ?? height);

    if (axis === 'row') {
        const out = new Array<number>(height).fill(0);
        for (let y = 0; y < height; y += 1) {
            let ink = 0;
            const row = y * width;
            for (let x = 0; x < width; x += 1) if (grey[row + x] < INK_THRESHOLD) ink += 1;
            out[y] = (ink / width) * 255;
        }
        return out;
    }

    const out = new Array<number>(width).fill(0);
    const rows = Math.max(1, bottom - top);
    for (let y = top; y < bottom; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) if (grey[row + x] < INK_THRESHOLD) out[x] += 1;
    }
    for (let x = 0; x < width; x += 1) out[x] = (out[x] / rows) * 255;
    return out;
}

export function rulePositions(values: number[], ratio: number, keep = 0): number[] {
    const peak = values.length ? Math.max(...values) : 0;
    const threshold = Math.max(255 * RULE_FLOOR, peak * ratio);

    const groups: number[][] = [];
    for (let i = 0; i < values.length; i += 1) {
        if (values[i] <= threshold) continue;
        const last = groups[groups.length - 1];
        if (last && i - last[last.length - 1] <= 3) last.push(i);
        else groups.push([i]);
    }

    let chosen = groups;
    if (keep && groups.length > keep) {
        chosen = [...groups]
            .sort((a, b) => Math.max(...b.map((i) => values[i])) - Math.max(...a.map((i) => values[i])))
            .slice(0, keep)
            .sort((a, b) => a[0] - b[0]);
    }
    return chosen.map((g) => Math.round(g.reduce((s, i) => s + i, 0) / g.length));
}

export type Grid = {
    hlines: number[];
    vlines: number[];
    bodyTop: number;
    bodyBottom: number;
    columns: Array<[number, number]>;
};

export function findGrid(page: RenderedPage, columnRules = 6): Grid | null {
    const rows = profile(page, 'row');
    const hlines = rulePositions(rows, RULE_OF_DARKEST_ROW);
    if (hlines.length < 2) return null;
    if (hlines[hlines.length - 1] - hlines[0] < page.height * 0.1) return null;

    const cols = profile(page, 'col', { top: hlines[0], bottom: hlines[hlines.length - 1] });
    const vlines = rulePositions(cols, RULE_OF_DARKEST_COL, columnRules);
    if (vlines.length < columnRules) return null;

    return {
        hlines,
        vlines,
        bodyTop: hlines.length > 2 ? hlines[1] : hlines[0],
        bodyBottom: hlines[hlines.length - 1],
        columns: vlines.slice(0, -1).map((v, i) => [v, vlines[i + 1]] as [number, number])
    };
}