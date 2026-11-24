<script lang="ts">
    import { onMount } from 'svelte';
    import { estimateHeightMap, loadHeightMap, loadImage, type HeightMap } from '$lib/part-3d/relief';
    import { RotateCcw } from '@lucide/svelte';

    let { src, alt = '' }: { src: string; alt?: string } = $props();

    let host = $state<HTMLDivElement>();
    let status = $state<'loading' | 'ready' | 'failed'>('loading');
    let reset: (() => void) | null = null;
    let bg = $state('#ffffff');

    const DEPTH = 0.38;
    const BACK = 0.5;
    const MAX_TURN = (40 * Math.PI) / 180;
    const MAX_TILT = (30 * Math.PI) / 180;

    function squared(img: HTMLImageElement): HTMLCanvasElement {
        const w = img.naturalWidth, h = img.naturalHeight, n = Math.max(w, h);
        const c = document.createElement('canvas');
        c.width = c.height = Math.min(n, 2048);
        const k = c.width / n;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, 1, 1, 0, 0, c.width, c.height);
        g.drawImage(img, ((n - w) / 2) * k, ((n - h) / 2) * k, w * k, h * k);
        return c;
    }

    onMount(() => {
        let dead = false;
        let stop = () => {};

        (async () => {
            try {
                const THREE = await import('three');
                const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

                const photo = squared(await loadImage(src, true));
                const px = photo.getContext('2d')!.getImageData(2, 2, 1, 1).data;
                bg = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
                let height: HeightMap;
                try {
                    height = await loadHeightMap(src);
                } catch {
                    height = estimateHeightMap(photo);
                }
                if (dead || !host) return;

                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.toneMapping = THREE.NoToneMapping;
                renderer.setClearColor(0xffffff, 0);
                host.prepend(renderer.domElement);

                const scene = new THREE.Scene();
                const FOV = 15;
                const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);

                const { size, z, mask } = height;
                const sample = (arr: Float32Array, u: number, v: number) => {
                    const x = Math.min(size - 1, Math.max(0, u * (size - 1)));
                    const y = Math.min(size - 1, Math.max(0, v * (size - 1)));
                    const x0 = Math.floor(x), y0 = Math.floor(y);
                    const x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1);
                    const fx = x - x0, fy = y - y0;
                    const a = arr[y0 * size + x0] * (1 - fx) + arr[y0 * size + x1] * fx;
                    const b = arr[y1 * size + x0] * (1 - fx) + arr[y1 * size + x1] * fx;
                    return a * (1 - fy) + b * fy;
                };

                const G = 220;
                const pos: number[] = [];
                const uv: number[] = [];
                const idx: number[] = [];
                const used: boolean[] = [];
                for (let j = 0; j <= G; j++)
                    for (let i = 0; i <= G; i++) {
                        const u = i / G, v = j / G;
                        used.push(sample(mask, u, v) > 0.01);
                    }
                for (const side of [1, -BACK])
                    for (let j = 0; j <= G; j++)
                        for (let i = 0; i <= G; i++) {
                            const u = i / G, v = j / G;
                            pos.push(u * 2 - 1, 1 - v * 2, sample(z, u, v) * DEPTH * side);
                            uv.push(u, 1 - v);
                        }
                const back = (G + 1) * (G + 1);
                const vid = (i: number, j: number) => j * (G + 1) + i;
                for (let j = 0; j < G; j++)
                    for (let i = 0; i < G; i++) {
                        const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
                        if (!(used[a] || used[b] || used[c] || used[d])) continue;
                        idx.push(a, d, b, b, d, c); // front faces +z
                        idx.push(back + a, back + b, back + d, back + b, back + c, back + d); // back faces -z
                    }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
                geo.setIndex(idx);
                geo.computeVertexNormals();
                const nrm = geo.getAttribute('normal');
                const col = new Float32Array(nrm.count * 3);
                for (let k = 0; k < nrm.count; k++) {
                    const s = 0.62 + 0.38 * Math.abs(nrm.getZ(k));
                    col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
                }
                geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

                const map = new THREE.CanvasTexture(photo);
                map.colorSpace = THREE.SRGBColorSpace;
                map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                map.needsUpdate = true;
                const alphaMap = new THREE.CanvasTexture(height.maskCanvas);
                const mat = new THREE.MeshBasicMaterial({
                    map,
                    alphaMap,
                    alphaTest: 0.6,
                    vertexColors: true,
                    side: THREE.FrontSide
                });
                const mesh = new THREE.Mesh(geo, mat);
                let sum = 0, cnt = 0;
                for (let k = 0; k < size * size; k++)
                    if (mask[k] > 0.5) {
                        sum += z[k];
                        cnt++;
                    }
                mesh.position.z = -(cnt ? sum / cnt : 0) * DEPTH;
                scene.add(mesh);

                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.enablePan = false;
                controls.rotateSpeed = 0.7;
                controls.minAzimuthAngle = -MAX_TURN;
                controls.maxAzimuthAngle = MAX_TURN;
                controls.minPolarAngle = Math.PI / 2 - MAX_TILT;
                controls.maxPolarAngle = Math.PI / 2 + MAX_TILT;

                let fitD = 5;
                const goHome = () => {
                    camera.position.set(0, 0, fitD);
                    controls.target.set(0, 0, 0);
                    controls.update();
                };
                reset = goHome;

                const fit = () => {
                    if (!host) return;
                    const w = host.clientWidth, h = host.clientHeight;
                    if (!w || !h) return;
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    const vHalf = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
                    const prev = fitD;
                    fitD = 1 / Math.min(vHalf, vHalf * camera.aspect);
                    controls.minDistance = fitD * 0.35;
                    controls.maxDistance = fitD * 1.8;
                    if (prev === 5) goHome();
                    else camera.position.multiplyScalar(fitD / prev);
                };
                const ro = new ResizeObserver(fit);
                ro.observe(host);
                fit();

                renderer.setAnimationLoop(() => {
                    controls.update();
                    renderer.render(scene, camera);
                });
                status = 'ready';

                stop = () => {
                    renderer.setAnimationLoop(null);
                    ro.disconnect();
                    controls.dispose();
                    geo.dispose();
                    mat.dispose();
                    map.dispose();
                    alphaMap.dispose();
                    renderer.dispose();
                    renderer.domElement.remove();
                };
            } catch (e) {
                console.error(e);
                if (!dead) status = 'failed';
            }
        })();

        return () => {
            dead = true;
            stop();
        };
    });
</script>

<div class="viewer" bind:this={host} style:background={bg} role="img" aria-label="3D view of {alt}">
    {#if status === 'loading'}
        <img class="poster" {src} alt="" />
        <span class="hint">Loading 3D view…</span>
    {:else if status === 'failed'}
        <img class="poster" {src} alt="" />
        <span class="hint">3D view isn't available for this part. Showing the photo.</span>
    {:else}
        <button type="button" class="reset" onclick={() => reset?.()} title="Reset view" aria-label="Reset view">
            <RotateCcw size={16} />
        </button>
        <span class="hint">Drag to rotate, scroll or pinch to zoom</span>
    {/if}
</div>

<style>
    .viewer {
        position: absolute;
        inset: 0;
        background: #fff;
        touch-action: none;
        cursor: grab;
        overflow: hidden;
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
    .poster {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .reset {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border: 1px solid var(--bme-border, #e2e8ef);
        border-radius: 8px;
        background: #fff;
        color: var(--bme-navy);
        cursor: pointer;
    }
    .reset:focus-visible {
        outline: 2px solid var(--bme-blue, #2f7fd8);
        outline-offset: 1px;
    }
    .hint {
        position: absolute;
        left: 50%;
        bottom: 10px;
        transform: translateX(-50%);
        max-width: calc(100% - 20px);
        font-size: 12px;
        color: var(--bme-navy);
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--bme-border, #e2e8ef);
        padding: 3px 10px;
        border-radius: 999px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
    }
</style>