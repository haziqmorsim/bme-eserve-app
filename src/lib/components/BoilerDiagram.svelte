<script lang="ts">
    import type { Component } from "$lib/types";

    let { components, activeComponentId, onselect } = $props<{
        components: Component[];
        activeComponentId: string | null;
        onselect: (componentId: string) => void;
    }>();

    type Zone = {
        key: string;
        label: string;
        keywords: string[];
        x: number; y: number; w: number; h: number;
        pill?: boolean;
    };

    const zones: Zone[] = [
        { key: 'feedwater', label: 'FEEDWATER',        keywords: ['feedwater', 'feed water', 'econom', 'tube'],                 x: 24,  y: 96,  w: 120, h: 46 },
        { key: 'fuel',      label: 'FUEL HANDLING',    keywords: ['fuel', 'feeder', 'conveyor', 'electrical'],                  x: 24,  y: 250, w: 120, h: 46 },
        { key: 'fans',      label: 'FD / ID FANS',     keywords: ['fan', 'id fan', 'fd fan', 'motor', 'electrical'],            x: 24,  y: 320, w: 120, h: 46 },
        { key: 'steamdrum', label: 'UPPER STEAM DRUM', keywords: ['steam drum', 'drum', 'gasket', 'internal'],                  x: 178, y: 46,  w: 214, h: 40, pill: true },
        { key: 'furnace',   label: 'FURNACE',          keywords: ['furnace', 'membrane', 'wall', 'refractory', 'tube'],         x: 198, y: 104, w: 152, h: 150 },
        { key: 'sh',        label: 'SH',               keywords: ['superheat', 'superheater', 'tube'],                          x: 366, y: 104, w: 44,  h: 120 },
        { key: 'econ',      label: 'ECON',             keywords: ['econom', 'economiser', 'economizer', 'finned', 'tube'],      x: 430, y: 96,  w: 64,  h: 66 },
        { key: 'mdc',       label: 'MDC',              keywords: ['dust', 'collector', 'mdc', 'cyclone', 'electrical'],         x: 430, y: 178, w: 64,  h: 66 },
        { key: 'grate',     label: 'VIBRATING GRATE',  keywords: ['grate', 'vibrat'],                                          x: 196, y: 262, w: 156, h: 34 },
        { key: 'muddrum',   label: 'LOWER MUD DRUM',   keywords: ['mud drum', 'drum', 'blowdown'],                             x: 200, y: 312, w: 148, h: 36, pill: true },
        { key: 'safety',    label: 'SAFETY VALVES',    keywords: ['safety', 'valve', 'relief'],                                x: 200, y: 374, w: 148, h: 40 },
    ];

    function matchId(z: Zone): string | null {
        const c = components.find((comp: Component) =>
            z.keywords.some((k) => comp.name.toLowerCase().includes(k))
        );
        return c ? c.id : null;
    }

    function handle(z: Zone) {
        const id = matchId(z);
        if (id) onselect(id);
    }
</script>

<svg viewBox="0 0 520 440" class="boiler-svg" role="group" aria-label="Interactive boiler diagram">
    <defs>
        <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#c0392b" />
            <stop offset="100%" stop-color="#f2a900" stop-opacity="0.55" />
        </linearGradient>
    </defs>

    <g class="wires">
        <line x1="284" y1="86"  x2="274" y2="104" />
        <line x1="350" y1="150" x2="366" y2="150" />
        <line x1="410" y1="140" x2="430" y2="130" />
        <line x1="462" y1="162" x2="462" y2="178" />
        <line x1="274" y1="254" x2="274" y2="262" />
        <line x1="274" y1="296" x2="274" y2="312" />
        <line x1="144" y1="119" x2="178" y2="66" />
        <line x1="144" y1="273" x2="196" y2="279" />
    </g>

    <rect x="216" y="206" width="116" height="42" rx="4" fill="url(#flame)" class="flame" />

    {#each zones as z (z.key)}
        {@const mid = matchId(z)}
        {@const isActive = mid !== null && mid === activeComponentId}
        <g
            class="zone"
            class:active={isActive}
            class:dim={mid === null}
            role="button"
            aria-label={z.label}
            aria-pressed={isActive}
            tabindex={mid ? 0 : -1}
            onclick={() => handle(z)}
            onkeydown={(e) => {
                if (mid && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handle(z);
                }
            }}
        >
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={z.pill ? z.h / 2 : 8} />
            <text x={z.x + z.w / 2} y={z.y + z.h / 2}>{z.label}</text>
        </g>
    {/each}
</svg>

<style>
    .boiler-svg {
        width: 100%;
        height: auto;
        display: block;
        user-select: none;
    }

    .wires line {
        stroke: var(--bme-border);
        stroke-width: 2;
    }

    .flame {
        pointer-events: none;
    }

    .zone rect {
        fill: #ffffff;
        stroke: var(--bme-dark-blue);
        stroke-width: 1.5;
        transition: fill 0.3s ease, stroke 0.3s ease;
    }

    .zone text {
        fill: var(--bme-ink);
        font-family: var(--font);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
    }

    .zone {
        cursor: pointer;
        outline: none;
    }

    .zone:hover rect,
    .zone:focus-visible rect {
        fill: #eaeff3;
        stroke: var(--bme-darker-blue);
    }

    .zone.active rect {
        fill: var(--bme-dark-blue);
        stroke: var(--bme-darker-blue);
    }

    .zone.active text {
        fill: #ffffff;
    }

    .zone.dim {
        cursor: default;
        opacity: 0.4;
    }

    .zone.dim:hover rect {
        fill: #ffffff;
        stroke: var(--bme-dark-blue);
    }
</style>