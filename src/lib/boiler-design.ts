import type { Component } from '$lib/types';

export type GrateType = 'fixed' | 'reciprocating' | 'vibrating';

export type Hotspot = {
    l: number;
    t: number;
    w: number;
    h: number; 
};

export type Section = {
    key: string;
    label: string;
    num: number; // official mimic section number (from the reference drawing)
    keywords: string[];
    rect: Hotspot;
};

export type ResolvedSection = Section & {
    componentId: string | null; // first matching component (back-compat)
    componentIds: string[]; // every component in this section
    componentName: string | null;
};

export type GrateDef = {
    type: GrateType;
    label: string;
    tagline: string;
    img: string;
    sections: Section[];
};

export const GRATES: Record<GrateType, GrateDef> = {
    fixed: {
        type: 'fixed',
        label: 'Fixed Grate',
        tagline: 'Economical, rugged and low operating cost',
        img: '/boilers/fixed-grate.jpg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 57, t: 6, w: 13, h: 13 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 55, t: 63, w: 13, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 36, t: 30, w: 14, h: 45 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 70, t: 34, w: 20, h: 44 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 68, t: 80, w: 22, h: 10 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 16, t: 60, w: 16, h: 22 } }
        ]
    },

    reciprocating: {
        type: 'reciprocating',
        label: 'Reciprocating Grate',
        tagline: 'Suitable for very high moisture fuel',
        img: '/boilers/reciprocating-grate.jpg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 55, t: 10, w: 12, h: 11 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 53, t: 58, w: 12, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 36, t: 30, w: 14, h: 42 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 68, t: 26, w: 21, h: 46 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 64, t: 80, w: 26, h: 10 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 16, t: 60, w: 16, h: 22 } }
        ]
    },

    vibrating: {
        type: 'vibrating',
        label: 'Vibrating Grate',
        tagline: 'Automation and efficient combustion',
        img: '/boilers/vibrating-grate.jpg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 49, t: 10, w: 11, h: 11 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 47, t: 62, w: 12, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 34, t: 32, w: 13, h: 40 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 63, t: 28, w: 23, h: 42 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 54, t: 78, w: 33, h: 12 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 16, t: 60, w: 16, h: 22 } }
        ]
    }
};

function hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function grateTypeFor(seed: string, name?: string | null): GrateType {
    const n = (name ?? '').toLowerCase();
    if (n.includes('reciprocating')) return 'reciprocating';
    if (n.includes('vibrating')) return 'vibrating';
    if (n.includes('fixed')) return 'fixed';

    const types: GrateType[] = ['fixed', 'reciprocating', 'vibrating'];
    return types[hashStr(seed || 'boiler') % 3];
}

export function grateFor(seed: string, name?: string | null): GrateDef {
    return GRATES[grateTypeFor(seed, name)];
}

export function resolveSections(def: GrateDef, components: Component[] = []): ResolvedSection[] {
    const comps = components.map((c) => ({
        ...c,
        lc: (c.name ?? '').toLowerCase(),
        sk: ((c as any).section_key ?? null) as string | null
    }));

    return def.sections.map((s) => {
        // Primary: match on section_key (exact, set by migration 0041).
        let hits = comps.filter((c) => c.sk === s.key);

        // Fallback for components without a section_key: keyword match on name.
        if (hits.length === 0) {
            hits = comps.filter(
                (c) => c.sk == null && s.keywords.some((k) => c.lc.includes(k) || k.includes(c.lc))
            );
        }

        return {
            ...s,
            componentIds: hits.map((c) => (c as any).id),
            componentId: hits.length ? (hits[0] as any).id : null,
            componentName: hits.length ? hits[0].name : null
        };
    });
}

export type SectionState = 'Normal' | 'Warning' | 'Attention';
export type Metric = { label: string; value: string };
export type SectionTelemetry = { state: SectionState; metrics: Metric[] };

type MetricSpec = { label: string; unit: string; min: number; max: number; dp?: number};

const METRICS: Record<string, MetricSpec[]> = {
    steam_drum: [
        { label: 'Pressure', unit: 'barg', min: 18, max: 24, dp: 1 },
        { label: 'Water Level', unit: '%', min: 45, max: 65 },
        { label: 'Steam Temp', unit: '°C', min: 205, max: 225 }
    ],
    water_drum: [
        { label: 'Temp', unit: '°C', min: 180, max: 215 },
        { label: 'Blowdown Rate', unit: '%', min: 1, max: 5, dp: 1 },
        { label: 'TDS', unit: 'ppm', min: 1500, max: 3500 }
    ],
    dust_collector: [
        { label: 'Pressure Drop', unit: 'mbar', min: 6, max: 14, dp: 1 },
        { label: 'Collection Eff', unit: '%', min: 92, max: 99, dp: 1 },
        { label: 'Outlet Dust', unit: 'mg/Nm³', min: 20, max: 95 }
    ],
    boiler_front: [
        { label: 'Furnace Pressure', unit: 'mbar', min: -3, max: 2, dp: 1 },
        { label: 'Steam Pressure', unit: 'barg', min: 18, max: 24, dp: 1 },
        { label: 'Front Wall Temp', unit: '°C', min: 180, max: 320 }
    ],
    grate_section: [
        { label: 'Bed / Grate Temp', unit: '°C', min: 600, max: 900 },
        { label: 'Under-grate Air', unit: 'Pa', min: 400, max: 900 },
        { label: 'Drive Current', unit: 'A', min: 6, max: 18, dp: 1 }
    ],
    fan_pump: [
        { label: 'ID Fan Speed', unit: 'rpm', min: 900, max: 1450 },
        { label: 'Feed Pump Pressure', unit: 'barg', min: 20, max: 28 },
        { label: 'Motor Current', unit: 'A', min: 38, max: 62 }
    ]
};

const FALLBACK_METRICS: MetricSpec[] = [
    { label: 'Temperature', unit: '°C', min: 60, max: 240 },
    { label: 'Load', unit: '%', min: 40, max: 90 }
];

export function sampleSpecs(boilerCode: string): Metric[] {
    const rand = rng(hashStr(`${boilerCode}::specs`));
    const pick = (min: number, max: number, dp = 0) => {
        const v = min + rand() * (max - min);
        return dp ? v.toFixed(dp) : Math.round(v).toString();
    };
    const pickNum = (min: number, max: number) => Math.round(min + rand() * (max - min));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return [
        { label: 'Thermal Efficiency', value: `${pick(82, 89, 1)} %` },
        { label: 'Feedwater Temp', value: `${pick(95, 130)} °C` },
        { label: 'Flue Gas Temp', value: `${pick(150, 190)} °C` },
        { label: 'Operating Hours', value: `${pickNum(38, 92) * 100} h` },
        { label: 'Availability (30d)', value: `${pick(94, 99, 1)} %` },
        { label: 'Last Service', value: `${months[Math.floor(rand() * 12)]} 2025` },
    ];
}

export function sectionTelemetry(boilerCode: string, sectionKey: string): SectionTelemetry {
    const rand = rng(hashStr(`${boilerCode}::${sectionKey}`));
    const specs = METRICS[sectionKey] ?? FALLBACK_METRICS;

    const metrics = specs.map((m) => {
        const raw = m.min + rand() * (m.max - m.min);
        const val = m.dp ? raw.toFixed(m.dp) : Math.round(raw).toString();
        return { label: m.label, value: `${val} ${m.unit}`.trim() };
    });

    const r = rand();
    const state: SectionState = r > 0.92 ? 'Attention' : r > 0.72 ? 'Warning' : 'Normal';

    return { state, metrics };
}

export type SpecRow = {
    id?: string;
    boiler_id?: string;
    label: string;
    value: string;
    sort_order?: number;
};

export type SectionReadingRow = {
    id?: string;
    boiler_id?: string;
    section_key: string;
    state: SectionState;
    metrics: Metric[];
    sort_order?: number;
};

export function specsFor(boilerCode: string, rows: SpecRow[] = []): Metric[] {
    if (rows.length) {
        return [...rows]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((r) => ({ label: r.label, value: r.value }));
    }
    return sampleSpecs(boilerCode);
}

export function readingFor(
    boilerCode: string,
    sectionKey: string,
    rows: SectionReadingRow[] = []
): SectionTelemetry {
    const hit = rows.find((r) => r.section_key === sectionKey);
    if (hit) {
        return {
            state: hit.state ?? 'Normal',
            metrics: Array.isArray(hit.metrics) ? hit.metrics : []
        };
    }
    return sectionTelemetry(boilerCode, sectionKey);
}

export function readingsFor(
    boilerCode: string,
    sections: { key: string }[],
    rows: SectionReadingRow[] = []
): Record<string, SectionTelemetry> {
    return Object.fromEntries(
        sections.map((s) => [s.key, readingFor(boilerCode, s.key, rows)])
    );
}

export function allSectionKeys(): { key: string; label: string }[] {
    const seen = new Map<string, string>();
    for (const def of Object.values(GRATES)) {
        for (const s of def.sections) if (!seen.has(s.key)) seen.set(s.key, s.label);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
}