<script lang="ts">
    import BoilerBlueprint from "$lib/components/BoilerBlueprint.svelte";

    let {
        title = 'BME e-Serve App',
        tagline = 'Browse boiler spare parts and track your requests in one place.'
    }: {
        title?: string;
        tagline?: string;
    } = $props();

    const year = new Date().getFullYear();
</script>

<aside class="brand">
    <!-- Decorative boiler blueprint -->
    <div class="bp" aria-hidden="true">
        <BoilerBlueprint />
    </div>

    <div class="content">
        <div class="logo-tile">
            <img src="/images/bme-logo.png" alt="BoilerMech Energy" />
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

    /* faint blueprint grid */
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