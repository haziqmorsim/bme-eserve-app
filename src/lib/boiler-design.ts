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
    keywords: string[];
    rect: Hotspot;
};

export type ResolvedSection = Section & {
    componentId: string | null;
    componentName: string | null;
};

export type GrateDef = {
    type: GrateType;
    label: string;
    tagline: string;
    img: string;
    sections: Section[];
};

const LEFT_SIDE: Section[] = [
    { key: 'chimney', label: 'Chimney', keywords: ['chimney', 'stack', 'flue', 'duct'], rect: { l: 3, t: 6, w: 12, h: 84 } },
	{ key: 'id_fan', label: 'Induced Draught Fan', keywords: ['fan', 'draught', 'draft', 'blower'], rect: { l: 16, t: 61, w: 14, h: 20 } },
	{ key: 'id_fan_motor', label: 'ID Fan Motor', keywords: ['motor', 'drive', 'vsd', 'electrical'], rect: { l: 27, t: 80, w: 10, h: 10 } },
	{ key: 'dust_collector', label: 'Dust Collector (Cyclone)', keywords: ['dust', 'cyclone', 'multiclone', 'collector'], rect: { l: 36, t: 11, w: 14, h: 60 } },
	{ key: 'air_lock', label: 'Air Lock', keywords: ['air lock', 'airlock', 'rotary'], rect: { l: 38, t: 68, w: 6, h: 12 } }
];

export const GRATES: Record<GrateType, GrateDef> = {
    fixed: {
        type: 'fixed', 
        label: 'Fixed Grate', 
        tagline: 'Economical, rugged and low operating cost', 
        img: '/boilers/fixed-grate.jpg',
        sections: [
            ...LEFT_SIDE,
			{ key: 'steam_drum', label: 'Steam Drum', keywords: ['steam drum', 'drum', 'upper drum'], rect: { l: 54, t: 7, w: 12, h: 12 } },
			{ key: 'convection_tubes', label: 'Convection Tubes', keywords: ['tube', 'economiser', 'economizer', 'water wall', 'water-wall', 'bank'], rect: { l: 49, t: 20, w: 19, h: 48 } },
			{ key: 'superheater', label: 'Superheater', keywords: ['superheater', 'super heater', 'tube'], rect: { l: 70, t: 9, w: 21, h: 30 } },
			{ key: 'furnace', label: 'Furnace', keywords: ['furnace', 'refractory', 'membrane', 'wall', 'burner'], rect: { l: 70, t: 40, w: 20, h: 42 } },
			{ key: 'fixed_grate', label: 'Fixed Grate', keywords: ['grate', 'fixed grate', 'fire bar'], rect: { l: 70, t: 83, w: 19, h: 6 } },
			{ key: 'ash_hopper', label: 'Ash Hopper', keywords: ['ash', 'hopper'], rect: { l: 51, t: 70, w: 15, h: 17 } },
			{ key: 'ash_pit', label: 'Ash Pit', keywords: ['ash', 'pit'], rect: { l: 72, t: 89, w: 18, h: 7 } }
        ]
    }, 

    reciprocating: {
        type: 'reciprocating', 
        label: 'Reciprocating Grate', 
        tagline: 'Suitable for very high moisture fuel', 
        img: '/boilers/reciprocating-grate.jpg', 
        sections: [
            ...LEFT_SIDE,
			{ key: 'super_heater', label: 'Super Heater', keywords: ['superheater', 'super heater', 'tube'], rect: { l: 66, t: 4, w: 17, h: 9 } },
			{ key: 'steam_drum', label: 'Steam Drum', keywords: ['steam drum', 'drum', 'upper drum'], rect: { l: 55, t: 11, w: 10, h: 10 } },
			{ key: 'convection_tubes', label: 'Convection Tubes', keywords: ['tube', 'economiser', 'economizer', 'water wall', 'water-wall', 'bank'], rect: { l: 50, t: 16, w: 18, h: 52 } },
			{ key: 'furnace', label: 'Furnace', keywords: ['furnace', 'refractory', 'membrane', 'wall', 'burner'], rect: { l: 68, t: 22, w: 21, h: 54 } },
			{ key: 'ash_hopper', label: 'Ash Hopper', keywords: ['ash', 'hopper'], rect: { l: 52, t: 68, w: 12, h: 14 } },
			{ key: 'reciprocating_grate', label: 'Reciprocating Grate', keywords: ['grate', 'reciprocating'], rect: { l: 66, t: 80, w: 22, h: 10 } },
			{ key: 'hydraulic_power_pack', label: 'Hydraulic Power Pack', keywords: ['hydraulic', 'power pack', 'pump'], rect: { l: 50, t: 82, w: 10, h: 13 } },
			{ key: 'submerged_ash_conveyor', label: 'Submerged Ash Conveyor', keywords: ['conveyor', 'ash', 'submerged', 'drag', 'chain'], rect: { l: 86, t: 73, w: 12, h: 15 } }
        ]
    },

    vibrating: {
        type: 'vibrating', 
        label: 'Vibrating Grate', 
        tagline: 'Automation and efficient combustion', 
        img: '/boilers/vibrating-grate.jpg', 
        sections: [
            ...LEFT_SIDE,
			{ key: 'steam_drum', label: 'Steam Drum', keywords: ['steam drum', 'drum', 'upper drum'], rect: { l: 52, t: 13, w: 9, h: 10 } },
			{ key: 'convection_tubes', label: 'Convection Tubes', keywords: ['tube', 'economiser', 'economizer', 'water wall', 'water-wall', 'bank'], rect: { l: 46, t: 18, w: 18, h: 52 } },
			{ key: 'furnace', label: 'Furnace', keywords: ['furnace', 'refractory', 'membrane', 'wall', 'burner'], rect: { l: 64, t: 24, w: 22, h: 48 } },
			{ key: 'ash_hopper', label: 'Ash Hopper', keywords: ['ash', 'hopper'], rect: { l: 47, t: 70, w: 11, h: 13 } },
			{ key: 'vibrating_grate', label: 'Vibrating Grate', keywords: ['grate', 'vibrating'], rect: { l: 55, t: 78, w: 30, h: 12 } },
			{ key: 'vibrating_grate_motor', label: 'Vibrating Grate Motor', keywords: ['motor', 'grate motor', 'drive', 'electrical'], rect: { l: 47, t: 82, w: 10, h: 12 } },
			{ key: 'fuel_conveyor', label: 'Fuel Conveyor', keywords: ['fuel', 'conveyor', 'feed', 'stoker'], rect: { l: 86, t: 44, w: 13, h: 12 } },
			{ key: 'submerged_ash_conveyor', label: 'Submerged Ash Conveyor', keywords: ['conveyor', 'ash', 'submerged', 'drag', 'chain'], rect: { l: 86, t: 76, w: 13, h: 14 } }
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

export function grateTypeFor(seed: string): GrateType {
    const types: GrateType[] = ['fixed', 'reciprocating', 'vibrating'];
    return types[hashStr(seed || 'boiler') % 3];
}

export function grateFor(seed: string): GrateDef {
    return GRATES[grateTypeFor(seed)];
}

export function resolveSections(def: GrateDef, components: Component[] = []): ResolvedSection[] {
    const comps = components.map((c) => ({ ...c, lc: (c.name ?? '').toLowerCase() }));
    return def.sections.map((s) => {
        const hit = comps.find((c) => s.keywords.some((k) => c.lc.includes(k) || k.includes(c.lc)));
        return {
            ...s, 
            componentId: hit ? (hit as any).id : null, 
            componentName: hit ? hit.name : null
        };
    });
}

export type SectionState = 'Normal' | 'Warning' | 'Attention';
export type Metric = { label: string; value: string };
export type SectionTelemetry = { state: SectionState; metrics: Metric[] };

type MetricSpec = { label: string; unit: string; min: number; max: number; dp?: number};

const METRICS: Record<string, MetricSpec[]> = {
    chimney: [
        { label: 'Flue Gas Temp', unit: '°C', min: 140, max: 190 },
        { label: 'Draught', unit: 'Pa', min: -320, max: -180 },
        { label: 'O₂', unit: '%', min: 4, max: 8, dp: 1 }
    ],
    id_fan: [
        { label: 'Speed', unit: 'rpm', min: 900, max: 1450 },
        { label: 'Motor Current', unit: 'A', min: 38, max: 62 },
        { label: 'Vibration', unit: 'mm/s', min: 1.2, max: 4.5, dp: 1 }
    ],
    id_fan_motor: [
        { label: 'Winding Temp', unit: '°C', min: 55, max: 95 },
        { label: 'Load', unit: '%', min: 55, max: 92 },
        { label: 'Current', unit: 'A', min: 40, max: 64 }
    ],
    dust_collector: [
        { label: 'Pressure Drop', unit: 'mbar', min: 6, max: 14, dp: 1 },
        { label: 'Collection Eff', unit: '%', min: 92, max: 99, dp: 1 },
        { label: 'Outlet Dust', unit: 'mg/Nm³', min: 20, max: 95 }
    ],
    air_lock: [
        { label: 'Speed', unit: 'rpm', min: 8, max: 22 },
        { label: 'Torque', unit: 'Nm', min: 40, max: 120 }
    ],
    steam_drum: [
        { label: 'Pressure', unit: 'barg', min: 18, max: 24, dp: 1 },
        { label: 'Water Level', unit: '%', min: 45, max: 65 },
        { label: 'Temp', unit: '°C', min: 205, max: 225 }
    ],
    super_heater: [
        { label: 'Steam Temp', unit: '°C', min: 380, max: 445 },
        { label: 'Metal Temp', unit: '°C', min: 420, max: 500 },
        { label: 'Pressure', unit: 'barg', min: 16, max: 24, dp: 1 }
    ],
    superheater: [
        { label: 'Steam Temp', unit: '°C', min: 380, max: 445 },
        { label: 'Metal Temp', unit: '°C', min: 420, max: 500 },
        { label: 'Pressure', unit: 'barg', min: 16, max: 24, dp: 1 }
    ],
    convection_tubes: [
        { label: 'Gas In', unit: '°C', min: 620, max: 780 },
        { label: 'Gas Out', unit: '°C', min: 180, max: 260 },
        { label: 'Fouling Index', unit: '%', min: 5, max: 35 }
    ],
    furnace: [
        { label: 'Bed/Flame Temp', unit: '°C', min: 820, max: 1050 },
        { label: 'Furnace Pressure', unit: 'mbar', min: -3, max: 2, dp: 1 },
        { label: 'O₂', unit: '°C', min: 4, max: 8, dp: 1 }
    ],
    fixed_grate: [
        { label: 'Grate Temp', unit: '°C', min: 600, max: 850 },
        { label: 'Under-grate Air', unit: 'Pa', min: 400, max: 900 }
    ],
    reciprocating_grate: [
        { label: 'Grate Temp', unit: '°C', min: 600, max: 860 },
        { label: 'Stroke Rate', unit: '/min', min: 2, max: 8, dp: 1 },
        { label: 'Motor Current', unit: 'A', min: 6, max: 18, dp: 1 }
    ],
    vibrating_grate: [
        { label: 'Grate Temp', unit: '°C', min: 600, max: 860 },
        { label: 'Cycle', unit: 's', min: 60, max: 250 },
        { label: 'Cooling Water', unit: '°C', min: 30, max: 55 }
    ],
    vibrating_grate_motor: [
        { label: 'Winding Temp', unit: '°C', min: 50, max: 92 },
        { label: 'Load', unit: '%', min: 40, max: 85 },
        { label: 'Current', unit: 'A', min: 5, max: 15, dp: 1 },
    ],
    hydraulic_power_pack: [
        { label: 'Pressure', unit: 'bar', min: 90, max: 160 },
        { label: 'Oil Temp', unit: '°C', min: 35, max: 62 },
        { label: 'Reservoir', unit: '%', min: 55, max: 95 }
    ],
    ash_hopper: [
        { label: 'Level', unit: '%', min: 10, max: 85 },
        { label: 'Temp', unit: '°C', min: 90, max: 260 }
    ],
    ash_pit: [
        { label: 'Level', unit: '%', min: 10, max: 80 },
        { label: 'Temp', unit: '°C', min: 60, max: 180 }
    ],
    submerged_ash_conveyor: [
        { label: 'Speed', unit: 'm/min', min: 0.5, max: 3, dp: 1 },
        { label: 'Drive Current', unit: 'A', min: 4, max: 14, dp: 1 },
        { label: 'Water Temp', unit: '°C', min: 35, max: 60 }
    ],
    fuel_conveyor: [
        { label: 'Feed Rate', unit: 't/h', min: 3, max: 12, dp: 1 },
        { label: 'Speed', unit: 'm/min', min: 4, max: 16, dp: 1 },
        { label: 'Drive Current', unit: 'A', min: 5, max: 16, dp: 1 }
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