<script lang="ts">
    let {
        title = 'BME e-Serve App',
        tagline = 'Browse boiler spare parts and track your requests in one place.'
    }: {
        title?: string;
        tagline?: string;
    } = $props();

    const year = new Date().getFullYear();

    const bankA = Array.from({ length: 11 }, (_, i) => 204 + i * 12);
    const bankB = Array.from({ length: 6 }, (_, i) => 384 + i * 12);
</script>

<aside class="brand">
    <svg class="bp" viewBox="0 0 640 660" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false">
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

    <div class="content">
        <div class="logo-tile">
            <img src="/images/bme-logo.png" alt="Boilermech Energy" />
        </div>

        <h1>{title}</h1>
        <span class="accent" aria-hidden="true"></span>
        <p class="tagline">{tagline}</p>
    </div>

    <p class="copy">&copy; {year} Boilermech Sdn Bhd</p>
</aside>

<style>
    .brand {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 32px;
        min-height: 100vh;
        padding: 44px;
        color: #ffffff;
        background:
            linear-gradient(160deg, var(--bme-navy) 0%, color-mix(in srgb, var(--bme-dark-blue) 32%, var(--bme-navy)) 62%, color-mix(in srgb, var(--bme-dark-blue) 50%, var(--bme-navy)) 100%);
    }
 
    .brand::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
        background-size: 32px 32px;
        -webkit-mask-image: linear-gradient(160deg, transparent 5%, #000 75%);
        mask-image: linear-gradient(160deg, transparent 5%, #000 75%);
    }
 
    .bp {
        position: absolute;
        z-index: -1;
        right: -6%;
        bottom: 12px;
        width: 96%;
        max-width: 700px;
        height: auto;
        color: rgba(160, 205, 255, 0.22);
        -webkit-mask-image: linear-gradient(to top, #000 55%, transparent 98%);
        mask-image: linear-gradient(to top, #000 55%, transparent 98%);
        pointer-events: none;
    }
 
    .bp .thin {
        stroke-width: 0.8;
        opacity: 0.8;
    }
 
    .bp .cl {
        stroke-width: 0.7;
        stroke-dasharray: 14 4 2 4;
        opacity: 0.7;
    }
 
    .bp .dim {
        stroke-width: 0.8;
    }
 
    .bp .lbl {
        fill: currentColor;
        stroke: none;
        font: 600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: 0.06em;
    }
 
    .content {
        max-width: 360px;
    }
 
    .logo-tile {
        display: grid;
        place-items: center;
        width: 112px;
        height: 96px;
        margin-bottom: 36px;
        border-radius: 22px;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    }
 
    .logo-tile img {
        display: block;
        width: 88px;
        height: auto;
    }
 
    h1 {
        margin: 0;
        font-size: 34px;
        line-height: 1.15;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #ffffff;
    }
 
    .accent {
        display: block;
        width: 44px;
        height: 3px;
        margin: 14px 0 12px;
        border-radius: 2px;
        background: var(--bme-light-blue);
    }
 
    .tagline {
        margin: 0;
        font-size: 16px;
        line-height: 1.5;
        color: rgba(226, 238, 250, 0.86);
    }
 
    .copy {
        margin: 0;
        font-size: 12.5px;
        color: rgba(226, 238, 250, 0.6);
    }
 
    @media (max-width: 860px) {
        .brand {
            min-height: 0;
            padding: 22px 22px 20px;
            gap: 0;
        }
 
        .content {
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: center;
            column-gap: 16px;
            max-width: none;
        }
 
        .logo-tile {
            grid-row: 1 / span 3;
            width: 72px;
            height: 64px;
            margin: 0;
            border-radius: 14px;
        }
 
        .logo-tile img {
            width: 56px;
        }
 
        h1 {
            font-size: 22px;
        }
 
        .accent {
            display: none;
        }
 
        .tagline {
            margin-top: 4px;
            font-size: 14px;
        }
 
        .copy {
            display: none;
        }
 
        .bp {
            right: -20%;
            bottom: -30%;
            width: 110%;
            opacity: 0.8;
        }
    }
</style>