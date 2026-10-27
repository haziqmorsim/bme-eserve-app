<script lang="ts">
    const bankA = Array.from({ length: 11 }, (_, i) => 204 + i * 12);
    const bankB = Array.from({ length: 6 }, (_, i) => 384 + i * 12);
</script>

<svg class="blueprint" viewBox="0 0 640 660" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false">
    <!-- centre lines -->
    <g class="cl">
        <line x1="330" y1="90" x2="330" y2="610" />
        <line x1="110" y1="278" x2="540" y2="278" />
        <line x1="540" y1="90" x2="540" y2="600" />
    </g>

    <!-- casing / furnace -->
    <rect x="140" y="306" width="360" height="262" rx="3" />
    <rect x="150" y="316" width="340" height="242" rx="2" class="thin" />

    <!-- steam drum -->
    <rect x="170" y="250" width="300" height="56" rx="28" />
    <line x1="196" y1="264" x2="444" y2="264" class="thin" />
    <line x1="196" y1="292" x2="444" y2="292" class="thin" />

    <!-- mud drum -->
    <rect x="190" y="520" width="200" height="36" rx="18" />

    <!-- tube banks -->
    <g class="thin">
        {#each bankA as x (x)}
            <line x1={x} y1="306" x2={x} y2="520" />
        {/each}
        {#each bankB as x (x)}
            <line x1={x} y1="306" x2={x} y2="470" />
        {/each}
    </g>

    <!-- baffle -->
    <path d="M340 306 V430 H372" />

    <!-- superheater coil -->
    <path d="M384 480 H452 a10 10 0 0 1 0 20 H400 a10 10 0 0 0 0 20 H452" class="thin" />

    <!-- furnace grate -->
    <line x1="150" y1="540" x2="190" y2="540" />
    <g class="thin">
        {#each [150, 158, 166, 174, 182] as x (x)}
            <line x1={x} y1="540" x2={x - 5} y2="552" />
        {/each}
    </g>

    <!-- flue duct and stack -->
    <path d="M500 440 H540" />
    <path d="M500 480 H540" />
    <path d="M526 130 H554 L560 108 H520 Z" />
    <rect x="526" y="130" width="28" height="438" />
    <line x1="526" y1="210" x2="554" y2="210" class="thin" />
    <line x1="526" y1="320" x2="554" y2="320" class="thin" />

    <!-- steam outlet, safety valve and gauge -->
    <path d="M280 250 V214 H300 V250" />
    <rect x="272" y="206" width="36" height="8" rx="2" />
    <circle cx="400" cy="226" r="16" />
    <circle cx="400" cy="226" r="11" class="thin" />
    <line x1="400" y1="226" x2="408" y2="219" />
    <path d="M400 242 V250" />

    <!-- water level gauge -->
    <rect x="448" y="236" width="8" height="52" rx="3" class="thin" />

    <!-- manhole -->
    <ellipse cx="170" cy="278" rx="6" ry="16" class="thin" />

    <!-- drum end view (section A-A) -->
    <g>
        <circle cx="86" cy="158" r="58" />
        <circle cx="86" cy="158" r="48" class="thin" />
        <circle cx="86" cy="158" r="20" class="thin" />
        <g class="thin">
            {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
                <circle
                    cx={86 + 34 * Math.cos((i * Math.PI) / 6)}
                    cy={158 + 34 * Math.sin((i * Math.PI) / 6)}
                    r="4"
                />
            {/each}
        </g>
        <line x1="14" y1="158" x2="158" y2="158" class="cl" />
        <line x1="86" y1="86" x2="86" y2="230" class="cl" />
        <text x="58" y="246" class="lbl">SECTION A-A</text>
    </g>

    <!-- dimension lines -->
    <g class="dim">
        <line x1="140" y1="606" x2="500" y2="606" />
        <line x1="140" y1="570" x2="140" y2="616" />
        <line x1="500" y1="570" x2="500" y2="616" />
        <path d="M140 606 l9 -3.5 m-9 3.5 l9 3.5" />
        <path d="M500 606 l-9 -3.5 m9 3.5 l-9 3.5" />
        <text x="302" y="600" class="lbl">3600</text>

        <line x1="598" y1="108" x2="598" y2="568" />
        <line x1="562" y1="108" x2="608" y2="108" />
        <line x1="506" y1="568" x2="608" y2="568" />
        <path d="M598 108 l-3.5 9 m3.5 -9 l3.5 9" />
        <path d="M598 568 l-3.5 -9 m3.5 9 l3.5 -9" />
        <text x="606" y="342" class="lbl" transform="rotate(90 606 342)">5200</text>
    </g>

    <!-- callouts -->
    <g class="thin">
        <path d="M236 250 L214 210 H176" />
        <path d="M290 556 L290 590" />
    </g>
    <text x="146" y="206" class="lbl">STEAM DRUM</text>
    <text x="262" y="586" class="lbl">MUD DRUM</text>
    <text x="408" y="548" class="lbl">SUPERHEATER</text>

    <!-- title block -->
    <g class="thin">
        <rect x="372" y="622" width="236" height="30" />
        <line x1="490" y1="622" x2="490" y2="652" />
    </g>
    <text x="380" y="641" class="lbl">BME-BLR-001</text>
    <text x="498" y="641" class="lbl">SCALE 1:50</text>
</svg>

<style>
    .blueprint {
        display: block;
        width: 100%;
        height: 100%;
    }

    .blueprint .thin {
        stroke-width: 0.8;
        opacity: 0.8;
    }

    .blueprint .cl {
        stroke-width: 0.7;
        stroke-dasharray: 14 4 2 4;
        opacity: 0.7;
    }

    .blueprint .dim {
        stroke-width: 0.8;
    }

    .blueprint .lbl {
        fill: currentColor;
        stroke: none;
        font: 600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: 0.06em;
    }
</style>