import { PSM, readLines } from "./ocr";
import { findGrid, openPdf, renderPage, textLayerLines } from "./render";
import type { ExtractResult, Package, PackingContent, PackingList, ProgressFn, RenderedPage, TextLine, TextWord } from "./types";

const REFERENCE_PAGE_HEIGHT = 1755;
const ROW_TOL = 14;
const TOTAL_GAP = 20;
const FUZZ = 0.82;
const INDENT_STEP = 0.1;

const PACKAGE_TYPES = [
    'steel skid',
    'wooden crate',
    'wooden box',
    'wooden pallet',
    'bundle',
    'pallet',
    'crate',
    'skid',
    'carton',
    'drum',
    'loose'
];

const CONTENT_QTY = /^[^0-9A-Za-z]*(\d[\d.,/]*)\s*(nos?|sets?|units?|lots?|[il]{0,2}[gl]ths?|lengths?|rolls?|bales?|kgs?|pcs?|pairs?|boxes?|bags?|coils?|drums?|pkts?|mtrs?|m)\b\.?\s*/i;
const NUMBER = /-?\d[\d,]*\.?\d*/;
const LABELLED = /^\s*[[\]|(){}<>\-–.,;:*]*\s*([A-Za-z][A-Za-z]+)\s*[:;.]\s*(.*)$/;
const DIMS = /(\d[\d.,]*)\s*(?:mm)?\s*[xX*×]\s*(\d[\d.,]*)\s*(?:mm)?\s*[xX*×]\s*(\d[\d.,]*)/;

const alpha = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '');

function similar(a: string, b: string): number {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;

    const previous = new Array<number>(b.length + 1).fill(0);
    let best = 0;
    for (let i = 1; i <= a.length; i += 1) {
        let diagonal = 0;
        for (let j = 1; j <= b.length; j += 1) {
            const temp = previous[j];
            previous[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(previous[j], previous[j - 1]);
            diagonal = temp;
        }
    }
    best = previous[b.length];
    return (2 * best) / (a.length + b.length);
}

function toNumber(text: string): number | null {
    const m = NUMBER.exec(text.replace(/\s/g, ''));
    if (!m) return null;
    const value = Number(m[0].replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
}

function splitContent(text: string): { quantity: string; description: string } {
    const m = CONTENT_QTY.exec(text);
    if (!m) return { quantity: '', description: text.replace(/^[\s,\-–•+~=*.|]+/, '').trim() };
    let unit = m[2].toLowerCase();
    unit = unit.replace(/^[il]{0,2}[gl](ths?)$/, 'lg$1');
    return {
        quantity: `${m[1]} ${unit}`,
        description: text.slice(m[0].length).replace(/^[\s,\-–•+~=*|]+/, '').trim()
    };
}

function tidyQuantity(text: string): string {
    const { quantity } = splitContent(text);
    return quantity || text.replace(/\s+/g, ' ').replace(/^[\s,.;:|]+|[\s,.;:|]+$/g, '');
}

const commonPrefix = (a: string, b: string) => {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
    return n;
}

function matchPackageType(text: string): string {
    const words = text.split(/\s+/);
    for (const span of [2, 1]) {
        if (words.length < span) continue;
        const candidate = alpha(words.slice(0, span).join(' '));
        if (!candidate) continue;
        for (const name of PACKAGE_TYPES) {
            const target = alpha(name);
            const close = 
                similar(candidate, target) >= FUZZ || 
                (commonPrefix(candidate, target) >=4 && candidate.length <= target.length + 2);
            if (close) return name.replace(/\b\w/g, (c) => c.toUpperCase());
        }
    }
    return '';
}

function matchLabel(text: string, label: string): string | null {
    const m = LABELLED.exec(text);
    if (!m) return null;
    if (similar(alpha(m[1]), label) < FUZZ) return null;
    return m[2].trim();
}

function isConsisting(text: string): boolean {
    const stripped = alpha(text);
    if (!stripped || stripped.length > 16) return false;
    return ['consistingof', 'consistsof', 'consisting', 'consistof'].some(
        (form) => similar(stripped, form) >= FUZZ
    );
}

function volumeFromDimension(dimension: string): number | null {
    const m = DIMS.exec(dimension || '');
    if (!m) return null;
    const [a, b, c] = m.slice(1, 4).map((g) => Number(g.replace(/,/g, '')));
    if (![a, b, c].every((n) => Number.isFinite(n) && n > 0)) return null;
    return (a * b * c) / 1_000_000_000;
}

type PageTable = {
    index: number;
    height: number;
    items: TextLine[];
    quantities: TextLine[];
    descriptions: TextLine[];
    volumes: TextLine[];
    weights: TextLine[];
    headerLines: TextLine[];
    descX0: number;
    descX1: number;
};

const within = (lines: TextLine[], y: number, tol: number) =>   
    lines.find((l) => Math.abs(l.y - y) <= tol) ?? null;

function sliceLine(line: TextLine, words: TextWord[]): TextLine {
    const left = Math.min(...words.map((w) => w.x));
    const right = Math.max(...words.map((w) => w.x + w.width));
    return {
        text: words.map((w) => w.text).join(' ').replace(/\s+/g, '').trim(),
        x: left,
        y: line.y,
        width: right - left,
        height: line.height,
        confidence: words.reduce((s, w) => s + w.confidence, 0) / words.length,
        words
    };
}

async function readTable(
    page: RenderedPage,
    layerLines: TextLine[] | null
): Promise<PageTable | null> {
    const grid = findGrid(page);
    if (!grid) return null;

    const columns = grid.columns.slice(-5);
    if (columns.length < 5) return null;
    const [itemC, qtyC, descC, volC, wtC] = columns;
    const { bodyTop, bodyBottom } = grid;

    const table: PageTable = {
        index: page.index,
        height: page.height,
        items: [],
        quantities: [],
        descriptions: [],
        volumes: [],
        weights: [],
        headerLines: [],
        descX0: descC[0],
        descX1: descC[1]
    };

    const inBody = (l: TextLine) => l.y > bodyTop && l.y < bodyBottom;
    const between = (l: TextLine, a: number, b: number) => l.x + 1 >= a && l.x < b;

    if (layerLines) {
        const body = layerLines.filter(inBody);
        table.items = body.filter((l) => between(l, itemC[0], itemC[1]));
        table.quantities = body.filter((l) => between(l, qtyC[0], qtyC[1]));
        table.descriptions = body.filter((l) => between(l, descC[0], descC[1]));
        table.volumes = body.filter((l) => between(l, volC[0], volC[1]));
        table.weights = body.filter((l) => between(l, wtC[0], wtC[1]));
        table.headerLines = layerLines.filter((l) => l.y < grid.hlines[0]);
        return table;
    }

    const height = bodyBottom - bodyTop;
    const unit = Math.max(1, page.height / 1755);
    const narrow = 3 / unit;
    const wide = 2 / unit;

    const left = await readLines(page.canvas, {
        rect: { left: itemC[0], top: bodyTop, width: qtyC[1] - itemC[0], height },
        scale: narrow
    });
    for (const line of left) {
        const itemWords = line.words.filter((w) => w.x + w.width / 2 < itemC[1]);
        const qtyWords = line.words.filter((w) => w.x + w.width / 2 >= itemC[1]);
        if (itemWords.length) table.quantities.push(sliceLine(line, qtyWords));
    }

    table.descriptions = await readLines(page.canvas, {
        rect: { left: descC[0], top: bodyTop, width: descC[1] - descC[0], height },
        scale: wide
    });

    const numeric = { psm: PSM.SINGLE_COLUMN, whitelist: '0123456789.,mkg ', scale: narrow };
    table.volumes = await readLines(page.canvas, {
        rect: { left: volC[0], top: bodyTop, width: volC[1] - volC[0], height },
        ...numeric
    });
    table.weights = await readLines(page.canvas, {
        rect: { left: wtC[0], top: bodyTop, width: wtC[1] - wtC[0], height },
        ...numeric
    });

    if (grid.hlines[0] > 20) {
        table.headerLines = await readLines(page.canvas, {
            rect: { left: 0, top: 0, width: page.width, height: grid.hlines[0] },
            scale: wide
        });
    }
    return table;
}

function headerFields(lines: TextLine[]) {
    const out: Record<string, string> = { project: '', client: '', date: ''};
    for (const line of lines) {
        for (const key of Object.keys(out)) {
            if (out[key]) continue;
            let value = matchLabel(line.text, key);
            if (value === null) {
                const words = line.text.trim().split(/\s+/);
                if (words.length > 1 && similar(alpha(words[0]), key) >= FUZZ) {
                    value = words.slice(1).join(' ');
                }
            }
            if (value) {
                out[key] = value.replace(/^[\s:;.\-–—_]+|[\s:;.\-–—_]+$/g, '');
                break;
            }
        }
    }
    return out;
}

function nextItemNo(packages: Package[]): string {
    for (let i = packages.length - 1; i >= 0; i -= 1) {
        if (/^\d+$/.test(packages[i].itemNo)) return String(Number(packages[i].itemNo) + 1);
    }
    return String(packages.length + 1);
}

function assemble(tables: PageTable[], sourceFile: string) {
    const doc: PackingList = {
        project: '',
        client: '',
        date: '',
        product: '',
        packages: [],
        totalWeight: null,
        sourceFile
    };
    const warnings: string[] = [];

    for (const table of tables) {
        if (!table.headerLines.length) continue;
        const found = headerFields(table.headerLines);
        doc.project ||= found.project;
        doc.client ||= found.client;
        doc.date ||= found.date;
    }

    const indents = tables.flatMap((t) => t.descriptions.filter((d) => CONTENT_QTY.test(d.text)).map((d) => d.x));
    const width = tables.length ? tables[0].descX1 - tables[0].descX0 : 0;
    const subCut = indents.length ? Math.min(...indents) + width * INDENT_STEP : Infinity;

    let current: Package | null = null;
    let orphaned = false;
    for (const table of tables) {
        const unit = Math.max(1, table.height / REFERENCE_PAGE_HEIGHT);
        const rowTol = ROW_TOL * unit;

        const anchors = table.quantities
            .filter((q) => CONTENT_QTY.test(q.text))
            .sort((a, b) => a.y - b.y)
            .map((q) => ({ y: q.y, quantity: q.text, pkg: null as Package | null }));

        for (const anchor of anchors) {
            const numbered = table.items.find(
                (it) => /^\d+%/.test(it.text.trim()) && Math.abs(it.y - anchor.y) <= rowTol
            );
            const previous = doc.packages.length
                ? Number(doc.packages[doc.packages.length - 1].itemNo)
                : 0;
            const read = numbered ? Number(numbered.text.trim()) : NaN;
            const inSequence = Number.isFinite(read) && read > previous;
            const volume = within(table.volumes, anchor.y, rowTol);
            const weight = within(table.weights, anchor.y, rowTol);
            const pkg: Package = {
                itemNo: inSequence ? String(read) : nextItemNo(doc.packages),
                quantity: tidyQuantity(anchor.quantity),
                packageType: '',
                dimension: '',
                volume: volume ? toNumber(volume.text) : null,
                weight: weight ? toNumber(weight.text) : null,
                contents: [],
                sourceFile,
                sourcePage: table.index,
                confidence: inSequence && numbered && numbered.confidence >= 70 ? 'high' : numbered ? 'medium' : 'low'
            };
            anchor.pkg = pkg;
            doc.packages.push(pkg);
        }

        const anchorFor = (y: number) => {
            let chosen: (typeof anchors)[number] | null = null;
            for (const a of anchors) {
                if (y >= a.y - rowTol) chosen = a;
                else break;
            }
            return chosen;
        };

        for (const line of table.descriptions) {
            const text = line.text;
            if (!text) continue;

            const anchor = anchorFor(line.y);
            let owner: Package;
            if (!anchor) {
                if (!current) {
                    if (table.index === 1) doc.product = `${doc.product} ${text}`.trim();
                    else if (!orphaned) {
                        orphaned = true;
                        warnings.push(`${sourceFile} p${table.index}: lines before the first item number on this page could not be assigned to a package.`);
                    }
                    continue;
                }
                owner = current;
            } else {
                owner = anchor.pkg as Package;
                current = owner;
            }

            if (isConsisting(text)) continue;

            if (!owner.contents.length && !owner.packageType) {
                const kind = matchPackageType(text);
                if (kind) {
                    owner.packageType = kind;
                    continue;
                }
            }

            const dimension = matchLabel(text, 'dimension');
            if (dimension !== null && !owner.contents.length) {
                owner.dimension = owner.dimension ? `${owner.dimension}; ${dimension}` : dimension;
                continue;
            }

            const { quantity, description } = splitContent(text);
            const indented = line.x > subCut;
            if (!quantity && indented && owner.contents.length) {
                const previous = owner.contents[owner.contents.length - 1];
                previous.description = `${previous.description} ${description}`.trim();
                continue;
            }
            if (!quantity && !description) continue;

            const content: PackingContent = {
                quantity,
                description,
                subItem: indented,
                sourcePage: table.index
            };
            owner.contents.push(content);
        }
    }

    const last = tables[tables.length - 1];
    if (last) {
        const floor = Math.max(
            0,
            ...last.items.filter((i) => /^\d+$/.test(i.text.trim())).map((i) => i.y),
            ...last.descriptions.map((d) => d.y)
        );
        const gap = TOTAL_GAP * Math.max(1, last.height / REFERENCE_PAGE_HEIGHT);
        for (const w of last.weights) {
            if (w.y > floor + gap) doc.totalWeight = toNumber(w.text);
        }
    }

    for (const pkg of doc.packages) {
        const expected = volumeFromDimension(pkg.dimension);
        if (!expected || !pkg.volume) continue;
        const ratio = pkg.volume / expected;
        if (ratio > 2 || ratio < 0.5) {
            warnings.push(
                `${sourceFile}: item ${pkg.itemNo} shows ${pkg.volume} m³ but its dimensions give about ${expected.toFixed(2)} m³ — please check the volume.`
            );
        }
    }

    const summed = doc.packages.reduce((s, p) => s + (p.weight ?? 0), 0);
    if (doc.totalWeight && Math.abs(doc.totalWeight - summed) > 1) {
        warnings.push(
            `${sourceFile}: the printed total (${doc.totalWeight} kg) differs from the sum of the item weights (${Math.round(summed)} kg).`
        );
    }
    if (!doc.packages.length) warnings.push(`${sourceFile}: no packing-list rows were found.`);

    return { doc, warnings };
}

export async function extractPackingList(
    file: File,
    onProgress?: ProgressFn
): Promise<ExtractResult<PackingList>> {
    const { doc, close } = await openPdf(await file.arrayBuffer());
    const tables: PageTable[] = [];
    const warnings: string[] = [];

    try {
        for (let i = 1; i <= doc.numPages; i += 1) {
            onProgress?.(i - 1, doc.numPages, `Reading page ${i} of ${doc.numPages}`);
            const page = await renderPage(doc, i);
            try {
                const layer = page.hasTextLayer ? await textLayerLines(doc, i) : null;
                const table = await readTable(page, layer);
                if (table) tables.push(table);
                else warnings.push(`${file.name} p${i}: no packing-list table on this page.`);
            } finally {
                page.canvas.width = 0;
                page.canvas.height = 0;
            }
            onProgress?.(i, doc.numPages, `Read page ${i} of ${doc.numPages}`);
        }
    } finally {
        await close();
    }

    if (!tables.length) {
        warnings.push(`${file.name}: no packing-list rows were found.`);
        return {
            rows: [
                {
                    project: '',
                    client: '',
                    date: '',
                    product: '',
                    packages: [],
                    totalWeight: null,
                    sourceFile: file.name
                }
            ],
            warnings
        };
    }

    const { doc: list, warnings: more } = assemble(tables, file.name);
    return { rows: [list], warnings: [...warnings, ...more] };
}