import { createWorker, PSM, type Worker } from "tesseract.js";
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import coreSimdUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import corePlainUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import type { Rect, TextLine } from "./types";

const LANG_PATH = '/tesseract';
const LANG = 'eng';

function hasSimd(): boolean {
    try {
        return WebAssembly.validate(
            new Uint8Array([
                0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
                10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
            ])
        );
    } catch {
        return false;
    }
}

let workerPromise: Promise<Worker> | null = null;
let currentPsm: PSM | null = null;
let currentWhitelist = '';

export function getWorker(onStatus?: (note: string) => void): Promise<Worker> {
    if (!workerPromise) {
        workerPromise = createWorker(LANG, 1, {
            workerPath: workerUrl,
            corePath: hasSimd() ? coreSimdUrl : corePlainUrl,
            langPath: LANG_PATH,
            gzip: true,
            logger: (m: { status?: string }) => onStatus?.(m.status ?? '')
        }).catch((err) => {
            workerPromise = null;
            throw err;
        });
    }
    return workerPromise;
}

export async function disposeWorker(): Promise<void> {
    const pending = workerPromise;
    workerPromise = null;
    currentPsm = null;
    currentWhitelist = '';
    if (!pending) return;
    try {
        const worker = await pending;
        await worker.terminate();
    } catch {
        // already gone
    }
}

export async function readLines(
    canvas: HTMLCanvasElement,
    options: {
        rect?: Rect;
        psm?: PSM;
        whitelist?: string;
        scale?: number;
        onStatus?: (note: string) => void;
    } = {}
): Promise<TextLine[]> {
    const worker = await getWorker(options.onStatus);

    const psm = options.psm ?? PSM.SINGLE_BLOCK;
    const whitelist = options.whitelist ?? '';
    if (psm !== currentPsm || whitelist !== currentWhitelist) {
        await worker.setParameters({
            tessedit_pageseg_mode: psm,
            tessedit_char_whitelist: whitelist
        });
        currentPsm = psm;
        currentWhitelist = whitelist;
    }

    const rect = options.rect;
    const scale = Math.max(1, Math.round(options.scale ?? 1));

    let target: HTMLCanvasElement = canvas;
    let rectangle: Rect | undefined = rect;
    let offsetX = 0;
    let offsetY = 0;
    if (rect && scale > 1) {
        const inset = 2;
        const sx = rect.left + inset;
        const sy = rect.top + inset;
        const sw = Math.max(1, rect.width - inset * 2);
        const sh = Math.max(1, rect.height - inset * 2);

        const crop = document.createElement('canvas');
        crop.width = Math.max(1, Math.round(sw * scale));
        crop.height = Math.max(1, Math.round(sh * scale));
        const context = crop.getContext('2d');
        if (!context) throw new Error('This browser would not provide a 2D canvas.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);

        target = crop;
        rectangle = undefined;
        offsetX = sx;
        offsetY = sy;
    }

    const { data } = await worker.recognize(target, rectangle ? { rectangle } : {}, {
        blocks: true
    });

    const back = (v: number) => v / (target === canvas ? 1 : scale);
    const lines: TextLine[] = [];
    for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
                const text = (line.text ?? '').replace(/\s+/g, '').trim();
                if (!text) continue;
                const box = line.bbox;
                lines.push({
                    text,
                    x: offsetX + back(box.x0),
                    y: offsetY + back((box.y0 + box.y1) / 2),
                    width: back(box.x1 - box.x0),
                    height: back(box.y1 - box.y0),
                    confidence: line.confidence ?? 0,
                    words: (line.words ?? [])
                        .filter((w) => (w.text ?? '').trim())
                        .map((w) => ({
                            text: w.text.trim(),
                            x: offsetX + back(w.bbox.x0),
                            width: back(w.bbox.x1 - w.bbox.x0),
                            confidence: w.confidence ?? 0
                        }))
                });
            }
        }
    }

    if (target !== canvas) {
        target.width = 0;
        target.height = 0;
    }
    lines.sort((a, b) => a.y - b.y);
    return lines;
}

export async function readText(
    canvas: HTMLCanvasElement,
    options: { psm?: PSM; onStatus?: (note: string) => void } = {}
): Promise<string> {
    const lines = await readLines(canvas, { psm: options.psm, onStatus: options.onStatus });
    return lines.map((l) => l.text).join('\n');
}

export { PSM };