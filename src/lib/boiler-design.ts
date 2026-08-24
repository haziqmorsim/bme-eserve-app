import type { Component } from '$lib/types';

export type GrateType = 'fixed' | 'fixed_water_cooled' | 'reciprocating' | 'vibrating';

export type Hotspot = {
    l: number;
    t: number;
    w: number;
    h: number; 
};

export type Section = {
    key: string;
    label: string;
    num: number;
    keywords: string[];
    rect: Hotspot;
};

export type ResolvedSection = Section & {
    componentId: string | null;
    componentIds: string[];
    componentName: string | null;
};

export type GrateDef = {
    type: GrateType;
    label: string;
    tagline: string;
    img: string;
    sections: Section[];
};

export const BOILER_DESIGNS: Record<string, GrateDef> = {
    "BM-0001": {
        type: "fixed",
        label: "BM Fixed Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0001.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 35, t: 2, w: 10, h: 18 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 41, t: 61, w: 8, h: 12 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 27, t: 32, w: 13, h: 42 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 61, t: -17, w: 19, h: 78 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 52, t: 68, w: 15, h: 12 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 15.5, t: 80, w: 11, h: 26 } }
        ]
    },
    "BM-0002": {
        type: "fixed",
        label: "BM Fixed Water Cooled Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0002.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 36, t: 4, w: 10, h: 18 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 46, t: 57, w: 8, h: 12 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 27.7, t: 33, w: 13, h: 42 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 62, t: -15, w: 19, h: 78 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 53, t: 75, w: 15, h: 12 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 16, t: 80, w: 11, h: 26 } }
        ]
    },
    "BM-0003": {
        type: "vibrating",
        label: "BM Vibrating Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0003.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 36, t: -1, w: 10, h: 16 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 44.5, t: 50, w: 8, h: 11 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 28.5, t: 23, w: 13, h: 68 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 61, t: -25, w: 20, h: 85 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 49, t: 75, w: 20, h: 14 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 13, t: 81, w: 12, h: 30 } }
        ]
    },
    "BM-0004": {
        type: "reciprocating",
        label: "BM Reciprocating Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0004.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 36, t: -3, w: 9, h: 18 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 43.5, t: 52, w: 7, h: 10 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 30, t: 23, w: 12, h: 65 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 53, t: -22, w: 22, h: 90 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 46.5, t: 75, w: 18, h: 13 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 20.4, t: 93, w: 11, h: 22 } }
        ]
    },
    "BM-0005": {
        type: "vibrating",
        label: "BM Vibrating Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0005.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 47, t: 7, w: 6, h: 11 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 53.5, t: 48, w: 7, h: 10 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 39.5, t: 25, w: 13, h: 52 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 66, t: -5, w: 20, h: 64 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 57, t: 68, w: 18, h: 8 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 10.7, t: 83, w: 10, h: 17 } }
        ]
    },
    "BM-0006": {
        type: "vibrating",
        label: "BM Vibrating Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0006.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 33, t: 1, w: 9, h: 18 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 39, t: 55, w: 8, h: 11 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 27, t: 22, w: 11, h: 66 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 54, t: -17, w: 24, h: 90 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 41, t: 68, w: 25, h: 16 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 16.5, t: 87, w: 11, h: 26 } }
        ]
    },
    "BM-0007": {
        type: "vibrating",
        label: "BM Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0007.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 46, t: 1, w: 8, h: 16 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 52.5, t: 40, w: 7, h: 9 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 42.5, t: 14, w: 9, h: 78 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 62, t: -20, w: 18, h: 92 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 55, t: 58, w: 16, h: 20 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 17.5, t: 77, w: 13, h: 33 } }
        ]
    },
    "BM-0008": {
        type: "vibrating",
        label: "BM Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0008.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 49, t: 3, w: 8, h: 17 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 53, t: 40, w: 8, h: 10 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 44, t: 2, w: 11, h: 82 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 63, t: -22, w: 20, h: 92 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 55.5, t: 56, w: 18, h: 25 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 16, t: 80, w: 12, h: 32 } }
        ]
    },
    "BM-0009": {
        type: "vibrating",
        label: "BM Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0009.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 33, t: -5, w: 11, h: 26 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 42, t: 40, w: 8, h: 13 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 28.7, t: 33, w: 11, h: 38 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 52, t: -22, w: 20, h: 88 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 41, t: 56, w: 24, h: 28 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 16, t: 75, w: 15, h: 44 } }
        ]
    },
    "BM-0010": {
        type: "vibrating",
        label: "MBM Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0010.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 43, t: 2, w: 10, h: 22 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 49, t: 50, w: 8, h: 10 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 31.5, t: 40, w: 13, h: 50 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 63, t: -20, w: 20, h: 90 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 52, t: 55, w: 21, h: 24 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 19.5, t: 68, w: 10, h: 55 } }
        ]
    },
    "BM-0011": {
        type: "vibrating",
        label: "BM Vibrating Grate Water Tube Boiler",
        tagline: "",
        img: "/boilers/BM-0011.png",
        sections: [
            { key: "steam_drum", label: "Steam Drum", num: 1, keywords: ["steam drum", "drum", "boiler field instrument", "boiler field gauge", "boiler field valve"], rect: { l: 37, t: -3, w: 10, h: 18 } },
            { key: "water_drum", label: "Water Drum", num: 2, keywords: ["water drum", "mud drum", "blow down", "blowdown"], rect: { l: 46, t: 45, w: 7, h: 11 } },
            { key: "dust_collector", label: "Dust Collector", num: 3, keywords: ["dust collector", "dust", "cast iron", "cyclone"], rect: { l: 30.5, t: 17, w: 12, h: 72 } },
            { key: "boiler_front", label: "Boiler Front Section", num: 4, keywords: ["boiler front", "front section", "pressure transmitter", "fire door", "cylinder", "pneumatic"], rect: { l: 59, t: -25, w: 22, h: 88 } },
            { key: "grate_section", label: "Grate Section", num: 5, keywords: ["grate", "fix grate", "reciprocating grate", "vibrating grate", "panel electrical", "inverter", "rocker"], rect: { l: 47.5, t: 57, w: 23, h: 18 } },
            { key: "fan_pump", label: "Fan & Pump", num: 6, keywords: ["fan", "pump", "fan and pump", "feed water", "blower", "draught"], rect: { l: 15.5, t: 73, w: 12, h: 36 } }
        ]
    }
};


export const GRATES: Record<GrateType, GrateDef> = {
    fixed: {
        type: 'fixed',
        label: 'Fixed Grate',
        tagline: 'Economical, rugged and low operating cost',
        img: '/boilers/bme-fixed-grate.jpeg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 34, t: 0, w: 13, h: 13 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 42, t: 55, w: 13, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 27, t: 48, w: 14, h: 14 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 58, t: 16, w: 20, h: 14 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 47, t: 70, w: 22, h: 14 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 14.5, t: 90, w: 16, h: 14 } }
        ]
    },

    fixed_water_cooled: {
        type: 'fixed_water_cooled',
        label: 'Fixed Water Cooled Grate',
        tagline: 'Water-cooled grate bars for longer service life',
        img: '/boilers/bme-fixed-water-cooled-grate.jpeg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 33, t: 0, w: 13, h: 13 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 42, t: 58, w: 13, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 26.5, t: 49, w: 14, h: 14 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 59, t: 15, w: 20, h: 14 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 48, t: 72, w: 22, h: 14 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 13.5, t: 93, w: 16, h: 14 } }
        ]
    },

    reciprocating: {
        type: 'reciprocating',
        label: 'Reciprocating Grate',
        tagline: 'Suitable for very high moisture fuel',
        img: '/boilers/bme-reciprocating-grate.png',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 29, t:0, w: 12, h: 11 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 40.5, t: 50, w: 12, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 27, t: 45, w: 14, h: 14 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 53, t: 17, w: 21, h: 14 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 42, t: 78, w: 26, h: 14 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 15.5, t: 98, w: 16, h: 14 } }
        ]
    },

    vibrating: {
        type: 'vibrating',
        label: 'Vibrating Grate',
        tagline: 'Automation and efficient combustion',
        img: '/boilers/bme-vibrating-grate.jpeg',
        sections: [
            { key: 'steam_drum', label: 'Steam Drum', num: 1, keywords: ['steam drum', 'drum', 'boiler field instrument', 'boiler field gauge', 'boiler field valve'], rect: { l: 35, t: 1, w: 11, h: 11 } },
            { key: 'water_drum', label: 'Water Drum', num: 2, keywords: ['water drum', 'mud drum', 'blow down', 'blowdown'], rect: { l: 44.5, t: 53, w: 12, h: 12 } },
            { key: 'dust_collector', label: 'Dust Collector', num: 3, keywords: ['dust collector', 'dust', 'cast iron', 'cyclone'], rect: { l: 31.5, t: 55, w: 13, h: 14 } },
            { key: 'boiler_front', label: 'Boiler Front Section', num: 4, keywords: ['boiler front', 'front section', 'pressure transmitter', 'fire door', 'cylinder', 'pneumatic'], rect: { l: 59, t: 13, w: 23, h: 14 } },
            { key: 'grate_section', label: 'Grate Section', num: 5, keywords: ['grate', 'fix grate', 'reciprocating grate', 'vibrating grate', 'panel electrical', 'inverter', 'rocker'], rect: { l: 43, t: 72, w: 33, h: 12 } },
            { key: 'fan_pump', label: 'Fan & Pump', num: 6, keywords: ['fan', 'pump', 'fan and pump', 'feed water', 'blower', 'draught'], rect: { l: 13.5, t: 96, w: 16, h: 14 } }
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
    if (n.includes('water cooled') || n.includes('water-cooled')) return 'fixed_water_cooled';
    if (n.includes('fixed')) return 'fixed';

    const types: GrateType[] = ['fixed', 'fixed_water_cooled', 'reciprocating', 'vibrating'];
    return types[hashStr(seed || 'boiler') % types.length];
}

export const USE_REAL_BOILER_IMAGES = false;

export function grateFor(seed: string, name?: string | null): GrateDef {
    if (USE_REAL_BOILER_IMAGES) {
        const real = BOILER_DESIGNS[seed];
        if (real) return real;
    }
    return GRATES[grateTypeFor(seed, name)];
}

export function resolveSections(def: GrateDef, components: Component[] = []): ResolvedSection[] {
    const comps = components.map((c) => ({
        ...c,
        lc: (c.name ?? '').toLowerCase(),
        sk: ((c as any).section_key ?? null) as string | null
    }));

    return def.sections.map((s) => {
        let hits = comps.filter((c) => c.sk === s.key);

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