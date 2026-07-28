export type SectionDef = { label: string; keywords: string[] };

export const SECTIONS: Record<string, SectionDef> = {
    chimney: { label: 'Chimney', keywords: ['chimney', 'stack', 'flue', 'duct'] },
    id_fan: { label: 'Induced Draught Fan', keywords: ['fan', 'draught', 'draft', 'blower'] },
    id_fan_motor: { label: 'ID Fan Motor', keywords: ['motor', 'drive', 'vsd', 'electrical'] },
    dust_collector: { label: 'Dust Collector (Cyclone)', keywords: ['dust', 'cyclone', 'multiclone', 'collector'] },
    air_lock: { label: 'Air Lock', keywords: ['air lock', 'airlock', 'rotary'] },
    steam_drum: { label: 'Steam Drum', keywords: ['steam drum', 'drum', 'upper drum'] },
    convection_tubes: { label: 'Convection Tubes', keywords: ['tube', 'economiser', 'economizer', 'water wall', 'water-wall', 'bank'] },
    superheater: { label: 'Superheater', keywords: ['superheater', 'super heater', 'tube'] },
    furnace: { label: 'Furnace', keywords: ['furnace', 'refractory', 'membrane', 'wall', 'burner'] },
    fixed_grate: { label: 'Fixed Grate', keywords: ['grate', 'fixed grate', 'fire bar'] },
    ash_hopper: { label: 'Ash Hopper', keywords: ['ash', 'hopper'] },
    ash_pit: { label: 'Ash Pit', keywords: ['ash', 'pit'] },
    super_heater: { label: 'Super Heater', keywords: ['superheater', 'super heater', 'tube'] },
    reciprocating_grate: { label: 'Reciprocating Grate', keywords: ['grate', 'reciprocating'] },
    hydraulic_power_pack: { label: 'Hydraulic Power Pack', keywords: ['hydraulic', 'power pack', 'pump'] },
    submerged_ash_conveyor: { label: 'Submerged Ash Conveyor', keywords: ['conveyor', 'ash', 'submerged', 'drag', 'chain'] },
    vibrating_grate: { label: 'Vibrating Grate', keywords: ['grate', 'vibrating'] },
    vibrating_grate_motor: { label: 'Vibrating Grate Motor', keywords: ['motor', 'grate motor', 'drive', 'electrical'] },
    fuel_conveyor: { label: 'Fuel Conveyor', keywords: ['fuel', 'conveyor', 'feed', 'stoker'] }
};

export function sectionLabel(key: string):string {
    return SECTIONS[key]?.label ?? key;
}

export function matchComponent<T extends { id: string; name: string | null }>(sectionKey: string, components: T[]): T | null {
    const keywords = SECTIONS[sectionKey]?.keywords ?? [];
    if (keywords.length === 0) return null;
    for (const c of components) {
        const lc = (c.name ?? '').toLowerCase();
        if (!lc) continue;
        if (keywords.some((k) => lc.includes(k) || k.includes(lc))) return c;
    }
    return null;
}