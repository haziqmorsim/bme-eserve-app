export type FlowKind = 'fuel' | 'flame' | 'flue' | 'air' | 'water' | 'steam' | 'ash';

export const FLOW_LEGEND: { kind: FlowKind; label: string; color: string }[] = [
    { kind: 'fuel', label: 'Biomass fuel', color: '#c99a5b' },
    { kind: 'flame', label: 'Flame', color: '#ff8a2a' },
    { kind: 'flue', label: 'Flue gas', color: '#ffb35c' },
    { kind: 'air', label: 'Combustion air', color: '#2fd0b5' },
    { kind: 'water', label: 'Water', color: '#3b8cff' },
    { kind: 'steam', label: 'Steam', color: '#e6f4ff' },
    { kind: 'ash', label: 'Ash', color: '#a8865c' }
];

export const SECTION_COLORS: Record<string, string> = {
    steam_drum: '#ff8a3d',
    water_drum: '#3b8cff',
    dust_collector: '#a78bfa',
    boiler_front: '#f5b83d',
    grate_section: '#ff5a4f',
    fan_pump: '#2fd0b5'
};