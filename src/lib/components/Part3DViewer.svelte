<script lang="ts">
    import { onMount } from 'svelte';
    import { Pause, Play, RotateCcw } from '@lucide/svelte';
    import { theme } from '$lib/theme.svelte';

    let {
        photo = null,
        name,
        description = '',
        component = '',
        alt = ''
    }: {
        photo?: string | null;
        name: string;
        description?: string | null;
        component?: string | null;
        alt?: string;
    } = $props();

    let host = $state<HTMLDivElement>();
    let status = $state<'loading' | 'ready' | 'failed'>('loading');
    let spinning = $state(true);
    const dark = $derived(theme.current === 'dark');

    let api: { reset: () => void; spin: (on: boolean) => void; theme: (dark: boolean) => void } | null = null;

    $effect(() => {
        const on = spinning;
        api?.spin(on);
    });
    $effect(() => {
        const d = dark;
        api?.theme(d);
    });

    onMount(() => {
        let dead = false;
        let stop = () => {};
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) spinning = false;

        (async () => {
            try {
                const THREE = await import('three');
                const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
                const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
                const { buildPartModel } = await import('$lib/part-3d/part-models');
                if (dead || !host) return;

                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.toneMapping = THREE.NeutralToneMapping;
                renderer.setClearColor(0x000000, 0);
                host.prepend(renderer.domElement);

                const scene = new THREE.Scene();
                const pmrem = new THREE.PMREMGenerator(renderer);
                const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
                scene.environment = envTex;
                scene.environmentIntensity = 0.3;
                pmrem.dispose();

                const model = buildPartModel({ name, description, component, photo });
                const box = new THREE.Box3().setFromObject(model.group);
                model.group.position.sub(box.getCenter(new THREE.Vector3()));
                const size = box.getSize(new THREE.Vector3());
                scene.add(model.group);
                const R = Math.max(0.5, size.length() / 2);

                const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6066, 1.15);
                const key = new THREE.DirectionalLight(0xffffff, 1.6);
                const rim = new THREE.DirectionalLight(0xffffff, 0.5);
                key.position.set(-R * 1.5, R * 2.5, R * 3.5);
                rim.position.set(R * 3, R, -R * 2);
                scene.add(hemi, key, rim);

                const shadowTex = (() => {
                    const c = document.createElement('canvas');
                    c.width = c.height = 128;
                    const g = c.getContext('2d')!;
                    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
                    grd.addColorStop(0, 'rgba(0,0,0,0.5)');
                    grd.addColorStop(1, 'rgba(0,0,0,0)');
                    g.fillStyle = grd;
                    g.fillRect(0, 0, 128, 128);
                    return new THREE.CanvasTexture(c);
                })();
                const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.4 });
                const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
                shadow.rotation.x = -Math.PI / 2;
                shadow.position.y = -size.y / 2 - R * 0.03;
                shadow.scale.set(Math.max(size.x, size.z) * 1.3, Math.max(size.z, size.x * 0.35) * 1.3, 1);
                scene.add(shadow);

                const FOV = 30;
                const camera = new THREE.PerspectiveCamera(FOV, 1, R / 50, R * 60);
                const az = (model.view.az * Math.PI) / 180;
                const el = (Math.max(-30, Math.min(75, model.view.el)) * Math.PI) / 180;
                const DIR = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
                let homeDist = 1;
                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.enablePan = false;
                controls.rotateSpeed = 0.9;
                controls.autoRotateSpeed = 3;

                function fit() {
                    const w = host!.clientWidth || 1;
                    const h = host!.clientHeight || 1;
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    const vFov = (FOV * Math.PI) / 180;
                    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
                    homeDist = (R * 1.12) / Math.sin(Math.min(vFov, hFov) / 2);
                    controls.minDistance = homeDist * 0.35;
                    controls.maxDistance = homeDist * 2.2;
                    camera.updateProjectionMatrix();
                }

                let resume = 0;
                let held = false;
                let spinningNow = spinning;
                function holdFront() {
                    controls.autoRotate = false;
                    window.clearTimeout(resume);
                    resume = window.setTimeout(() => {
                        if (!held) controls.autoRotate = spinningNow;
                    }, 2000);
                }
                function reset() {
                    fit();
                    controls.target.set(0, 0, 0);
                    camera.position.copy(DIR).multiplyScalar(homeDist);
                    controls.update();
                    holdFront();
                }
                controls.addEventListener('start', () => {
                    held = true;
                    controls.autoRotate = false;
                    window.clearTimeout(resume);
                });
                controls.addEventListener('end', () => {
                    held = false;
                    window.clearTimeout(resume);
                    resume = window.setTimeout(() => (controls.autoRotate = spinningNow), 2500);
                });
                reset();

                function applyTheme(d: boolean) {
                    model.lines.color.set(d ? '#1b1f24' : '#252a30');
                    model.lines.opacity = d ? 0.8 : 0.7;
                    shadowMat.opacity = d ? 0.6 : 0.3;
                }
                applyTheme(dark);

                const ro = new ResizeObserver(() => fit());
                ro.observe(host);

                const clock = new THREE.Clock();
                let raf = 0;
                const loop = () => {
                    raf = requestAnimationFrame(loop);
                    model.tick(clock.getElapsedTime());
                    controls.update();
                    renderer.render(scene, camera);
                };
                loop();

                api = {
                    reset,
                    spin: (on) => {
                        spinningNow = on;
                        if (!on) controls.autoRotate = false;
                        else if (!held) holdFront();
                    },
                    theme: applyTheme
                };
                status = 'ready';

                stop = () => {
                    cancelAnimationFrame(raf);
                    window.clearTimeout(resume);
                    ro.disconnect();
                    controls.dispose();
                    model.dispose();
                    shadow.geometry.dispose();
                    shadowMat.dispose();
                    shadowTex.dispose();
                    envTex.dispose();
                    renderer.dispose();
                    renderer.domElement.remove();
                    api = null;
                };
            } catch (e) {
                console.error('3D part view failed', e);
                if (!dead) status = 'failed';
            }
        })();

        return () => {
            dead = true;
            stop();
        };
    });
</script>

<div
    class="viewer"
    class:dark
    bind:this={host}
    role="img"
    aria-label={`3D view of ${alt || name}. Drag to turn it, scroll or pinch to zoom.`}
>
    {#if status === 'loading'}
        <div class="msg">Loading 3D view…</div>
    {:else if status === 'failed'}
        <div class="msg">The 3D view can't be shown for this part. Switch to Photo to see it.</div>
    {:else}
        <div class="btns">
            <button
                type="button"
                onclick={() => (spinning = !spinning)}
                aria-pressed={!spinning}
                aria-label={spinning ? 'Stop turning' : 'Start turning'}
                title={spinning ? 'Stop turning' : 'Start turning'}
            >
                {#if spinning}<Pause size={15} />{:else}<Play size={15} />{/if}
            </button>
            <button type="button" onclick={() => api?.reset()} aria-label="Reset view" title="Reset view"><RotateCcw size={15} /></button>
        </div>
        <span class="hint">Drag to turn · scroll to zoom</span>
    {/if}
</div>

<style>
    .viewer {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 40%, #ffffff, #e4e8ec 78%);
        touch-action: none;
        cursor: grab;
        overflow: hidden;
    }
    .viewer.dark {
        background: radial-gradient(ellipse at 50% 40%, #33424f, #121a21 78%);
    }
    .viewer:active {
        cursor: grabbing;
    }
    .viewer :global(canvas) {
        position: absolute;
        inset: 0;
        display: block;
        width: 100% !important;
        height: 100% !important;
    }
    .msg {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 20px;
        text-align: center;
        font-size: 13px;
        color: #5d6b7a;
    }
    .dark .msg {
        color: #9fb0c0;
    }
    .btns {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 6px;
    }
    .btns button {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(27, 39, 51, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.92);
        color: #1b2733;
        cursor: pointer;
    }
    .dark .btns button {
        border-color: rgba(185, 212, 238, 0.22);
        background: rgba(10, 16, 22, 0.8);
        color: #e6eef5;
    }
    .btns button:hover {
        filter: brightness(1.06);
    }
    .btns button:focus-visible {
        outline: 2px solid var(--bme-dark-blue, #2f7fd8);
        outline-offset: 1px;
    }
    .hint {
        position: absolute;
        left: 50%;
        bottom: 10px;
        transform: translateX(-50%);
        max-width: calc(100% - 20px);
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid rgba(27, 39, 51, 0.12);
        background: rgba(255, 255, 255, 0.88);
        color: #5d6b7a;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
    }
    .dark .hint {
        border-color: rgba(185, 212, 238, 0.18);
        background: rgba(10, 16, 22, 0.75);
        color: #a9bccb;
    }
</style>