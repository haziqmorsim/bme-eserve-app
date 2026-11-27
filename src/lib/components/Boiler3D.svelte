<script lang="ts">
    import { onMount } from 'svelte';
    import type { GrateDef, ResolvedSection, SectionReadingRow, SectionTelemetry } from '$lib/boiler-design';
    import { readingsFor } from '$lib/boiler-design';
    import BoilerDesign from '$lib/components/BoilerDesign.svelte';
    import type { BuiltScene, ClipMode, SceneLabel } from '$lib/boiler-3d/scene';
    import { FLOW_LEGEND, SECTION_COLORS, type FlowKind } from '$lib/boiler-3d/legend';
    import { theme } from '$lib/theme.svelte';
    import { Pause, Play, WavesHorizontal, Rotate3d, Scissors, SquareDashed, Eye, RotateCcw, X } from '@lucide/svelte';

    let {
        def,
        sections,
        mode = 'dashboard',
        boilerCode = '',
        activeKey = null,
        readings = [],
        imageUrl = null,
        height = '',
        extra = null,
        extraActive = false,
        onextra,
        onselect
    }: {
        def: GrateDef;
        sections: ResolvedSection[];
        mode?: 'dashboard' | 'parts';
        boilerCode?: string;
        activeKey?: string | null;
        readings?: SectionReadingRow[];
        imageUrl?: string | null;
        height?: string;
        extra?: { key: string; label: string; color: string } | null;
        extraActive?: boolean;
        onextra?: () => void;
        onselect?: (key: string, componentIds: string[]) => void;
    } = $props();

    const telemetry = $derived(readingsFor(boilerCode, sections, readings));
    const sectionByKey = $derived(new Map(sections.map((s) => [s.key, s])));

    let stage = $state<HTMLDivElement>();
    let canvasHost = $state<HTMLDivElement>();
    let fallback = $state(false);
    let ready = $state(false);
    let labels = $state<SceneLabel[]>([]);
    let hoverKey = $state<string | null>(null);
    let selectedKey = $state<string | null>(null);

    // ---- toolbar state -------------------------------------------------------
    let paused = $state(false);
    let spinning = $state(false);
    let boxesOn = $state(false);
    let seeThrough = $state(true);
    let clipMode = $state<ClipMode>('front');
    let clipPct = $state(0);
    let flowOn = $state<Record<FlowKind, boolean>>(
        Object.fromEntries(FLOW_LEGEND.map((f) => [f.kind, true])) as Record<FlowKind, boolean>
    );
    let menu = $state<'flows' | 'dissect' | null>(null);
    const flowsShown = $derived(FLOW_LEGEND.filter((f) => flowOn[f.kind]).length);

    // the section shown as selected: the parent owns it in the parts tab
    const currentKey = $derived(mode === 'parts' ? activeKey : selectedKey);

    const labelEls = new Map<string, HTMLElement>();
    const EXTRA_ID = '__extra';

    function registerLabel(node: HTMLElement, id: string) {
        labelEls.set(id, node);
        return {
            destroy() {
                if (labelEls.get(id) === node) labelEls.delete(id);
            }
        };
    }

    // A section can be clicked in the dashboard whenever it exists; in the parts
    // tab only when it actually has components (and therefore spare parts).
    function isClickable(key: string | null): key is string {
        if (!key) return false;
        const s = sectionByKey.get(key);
        if (!s) return false;
        return mode === 'dashboard' || s.componentIds.length > 0;
    }

    function stateOf(key: string | null): string {
        if (!key) return 'none';
        if (mode === 'parts') return isClickable(key) ? 'available' : 'dim';
        return (telemetry[key]?.state ?? 'Normal').toLowerCase();
    }

    // Parts tab: the square in front of a label uses the section's own colour
    // (the same colour as the bar in the parts list). The dashboard keeps the
    // status colours.
    function sqColor(key: string | null): string | null {
        if (mode !== 'parts' || !key) return null;
        return SECTION_COLORS[key] ?? null;
    }

    function labelText(l: SceneLabel): string {
        return (l.section && sectionByKey.get(l.section)?.label) || l.text;
    }

    const panel = $derived.by((): { key: string; label: string; t: SectionTelemetry | null } | null => {
        if (mode !== 'dashboard' || !selectedKey) return null;
        const s = sectionByKey.get(selectedKey);
        if (!s) return null;
        return { key: selectedKey, label: s.label, t: telemetry[selectedKey] ?? null };
    });

    // ---- three.js plumbing (client only) -------------------------------------
    type Three = typeof import('three');
    let api: {
        focusSection: (key: string) => void;
        home: () => void;
        refreshHighlight: () => void;
        rebuild: (type: GrateDef['type']) => void;
        applyTheme: (dark: boolean) => void;
        applyTools: () => void;
        setSpin: (on: boolean) => void;
    } | null = null;

    // the section the camera last flew to, so a selection made in the 3D view
    // isn't flown to a second time when the parent echoes it back
    let focusedKey: string | null = null;

    function selectSection(key: string) {
        if (!isClickable(key)) return;
        selectedKey = key;
        focusedKey = key;
        api?.focusSection(key);
        if (mode === 'parts') {
            const s = sectionByKey.get(key);
            if (s) onselect?.(key, s.componentIds);
        }
    }

    function onLabelClick(l: SceneLabel) {
        if (l.section) selectSection(l.section);
    }

    function closePanel() {
        selectedKey = null;
    }

    function resetView() {
        selectedKey = null;
        focusedKey = null;
        api?.home();
    }

    // Parts tab: follow the section picked in the side panel.
    $effect(() => {
        if (mode !== 'parts') return;
        const key = activeKey;
        if (!api || key === focusedKey) return;
        focusedKey = key;
        if (key) api.focusSection(key);
        else api.home();
    });

    // Highlight follows hover / selection / the parent's activeKey.
    $effect(() => {
        void hoverKey;
        void currentKey;
        void mode;
        void sections;
        void boxesOn;
        api?.refreshHighlight();
    });

    // Toolbar switches
    $effect(() => {
        void flowOn.fuel;
        void flowOn.flame;
        void flowOn.flue;
        void flowOn.air;
        void flowOn.water;
        void flowOn.steam;
        void flowOn.ash;
        void flowOn.dust;
        void seeThrough;
        void clipMode;
        void clipPct;
        api?.applyTools();
    });
    $effect(() => {
        // read first: `api?.setSpin(spinning)` would skip reading `spinning` while api is still null
        const on = spinning;
        api?.setSpin(on);
    });

    // Light / dark theme
    $effect(() => {
        const dark = theme.current === 'dark';
        api?.applyTheme(dark);
    });

    // Rebuild the model when the boiler type changes (switching boilers keeps
    // this component mounted).
    let builtType: string | null = null;
    $effect(() => {
        const t = def.type;
        if (api && builtType !== t) {
            selectedKey = null;
            focusedKey = null;
            api.rebuild(t);
        }
    });

    function toggleMenu(m: 'flows' | 'dissect') {
        menu = menu === m ? null : m;
    }

    function setAllFlows(on: boolean) {
        for (const f of FLOW_LEGEND) flowOn[f.kind] = on;
    }

    function onWindowDown(e: PointerEvent) {
        if (!menu) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('.pop') || t?.closest?.('[data-menu]')) return;
        menu = null;
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape' && menu) menu = null;
    }

    onMount(() => {
        let disposed = false;
        let cleanup: (() => void) | null = null;

        (async () => {
            let THREE: Three;
            try {
                THREE = await import('three');
            } catch {
                fallback = true;
                return;
            }
            const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
            const { buildBoilerScene } = await import('$lib/boiler-3d/scene');
            if (disposed || !canvasHost || !stage) return;

            let renderer: InstanceType<Three['WebGLRenderer']>;
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            } catch {
                fallback = true;
                return;
            }
            const host = canvasHost;
            const stageEl = stage;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.05;
            renderer.localClippingEnabled = true;
            const wantShadows = window.matchMedia('(min-width: 720px)').matches;
            renderer.shadowMap.enabled = wantShadows;
            renderer.shadowMap.type = THREE.PCFShadowMap;
            host.appendChild(renderer.domElement);
            renderer.domElement.style.display = 'block';
            renderer.domElement.style.touchAction = 'none';

            const scene = new THREE.Scene();
            const fog = new THREE.Fog('#0a1520', 55, 130);
            scene.fog = fog;

            const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);

            // lights
            const hemi = new THREE.HemisphereLight('#d7e8ff', '#1a2532', 1.25);
            scene.add(hemi);
            const sun = new THREE.DirectionalLight('#ffffff', 2.2);
            sun.position.set(14, 28, 22);
            sun.castShadow = wantShadows;
            sun.shadow.mapSize.set(2048, 2048);
            sun.shadow.camera.left = -24;
            sun.shadow.camera.right = 24;
            sun.shadow.camera.top = 22;
            sun.shadow.camera.bottom = -6;
            sun.shadow.camera.near = 1;
            sun.shadow.camera.far = 80;
            sun.shadow.bias = -0.0006;
            scene.add(sun);
            const rim = new THREE.DirectionalLight('#7fb2ff', 0.7);
            rim.position.set(-20, 12, -18);
            scene.add(rim);

            // floor + grid
            const floorMat = new THREE.MeshStandardMaterial({ color: '#13212e', roughness: 0.95, metalness: 0.05 });
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            scene.add(floor);
            let grid: InstanceType<Three['GridHelper']> | null = null;
            function makeGrid(a: string, b: string, opacity: number) {
                if (grid) {
                    scene.remove(grid);
                    grid.geometry.dispose();
                    (grid.material as InstanceType<Three['Material']>).dispose();
                }
                grid = new THREE.GridHelper(120, 120, a, b);
                const gm = grid.material as InstanceType<Three['Material']>;
                gm.transparent = true;
                gm.opacity = opacity;
                grid.position.y = 0.005;
                scene.add(grid);
            }
            const plinthMat = new THREE.MeshStandardMaterial({ color: '#2a3a4a', roughness: 0.8 });
            const plinth = new THREE.Mesh(new THREE.BoxGeometry(32, 0.06, 9), plinthMat);
            plinth.position.y = 0.03;
            plinth.receiveShadow = true;
            scene.add(plinth);

            let isDark = true;
            function applyTheme(dark: boolean) {
                isDark = dark;
                if (dark) {
                    fog.color.set('#0a1520');
                    floorMat.color.set('#13212e');
                    plinthMat.color.set('#2a3a4a');
                    hemi.color.set('#d7e8ff');
                    hemi.groundColor.set('#1a2532');
                    hemi.intensity = 1.25;
                    renderer.toneMappingExposure = 1.05;
                    makeGrid('#2c4760', '#1b2d3e', 0.75);
                } else {
                    fog.color.set('#e4ebf2');
                    floorMat.color.set('#d9e2ea');
                    plinthMat.color.set('#bccad7');
                    hemi.color.set('#ffffff');
                    hemi.groundColor.set('#9fb1c2');
                    hemi.intensity = 1.55;
                    renderer.toneMappingExposure = 1.0;
                    makeGrid('#a9bacb', '#c7d3de', 0.9);
                }
                built?.setTheme(dark);
            }

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.screenSpacePanning = true; // right-drag moves up/down/left/right
            controls.minDistance = 4;
            controls.maxDistance = 90;
            controls.maxPolarAngle = Math.PI * 0.495;
            controls.zoomSpeed = 0.9;
            controls.rotateSpeed = 0.8;
            controls.panSpeed = 0.9;
            controls.autoRotateSpeed = 2.2; // about 27 s per turn
            // left = rotate, middle = zoom, right = pan; wheel = zoom
            controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
            controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

            let built: BuiltScene | null = null;
            let atHome = true;
            let width = 1;
            let heightPx = 1;
            let pixelScale = 300;

            const homeTarget = new THREE.Vector3();
            const homePos = new THREE.Vector3();

            // Anchor of the top-right chip (a section with no part in the 3D model, e.g. Panel/Instrument).
            // It lives in the scene like every other chip: at the top right of the boiler in the original
            // view, and it moves with the boiler when the camera zooms into a section.
            const extraAnchor = new THREE.Vector3();
            const FRAME_H = 560; // the shortest stage height in the parts tab; section zoom is defined against it

            function placeExtraAnchor() {
                if (!built) return;
                const b = built.bounds;
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                b.getSize(size);
                b.getCenter(center);
                // the right edge of the original view, just above the top of the boiler;
                // placeLabels keeps the chip inside the stage if that edge is off screen
                extraAnchor.set(center.x + size.x / 2 + 0.6, center.y + size.y / 2 + 3, 0);
            }

            function computeHome() {
                if (!built) return;
                const b = built.bounds;
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                b.getSize(size);
                b.getCenter(center);
                const vfov = THREE.MathUtils.degToRad(camera.fov);
                const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
                const halfW = size.x / 2 + 0.6;
                const halfH = size.y / 2 + 1.2;
                const dist = Math.max(halfW / Math.tan(hfov / 2), halfH / Math.tan(vfov / 2)) + size.z * 0.5;
                // leave room for the toolbar along the bottom
                homeTarget.set(center.x, center.y + 0.1, 0);
                const dir = new THREE.Vector3(0.16, 0.24, 1).normalize();
                homePos.copy(homeTarget).addScaledVector(dir, dist * 1.1);
            }

            // ---- camera tween ----------------------------------------------------
            let tween: {
                fromPos: InstanceType<Three['Vector3']>;
                toPos: InstanceType<Three['Vector3']>;
                fromT: InstanceType<Three['Vector3']>;
                toT: InstanceType<Three['Vector3']>;
                t: number;
                dur: number;
            } | null = null;

            const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

            function flyTo(pos: InstanceType<Three['Vector3']>, target: InstanceType<Three['Vector3']>, dur = 1.1) {
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reduce) {
                    camera.position.copy(pos);
                    controls.target.copy(target);
                    controls.update();
                    return;
                }
                tween = { fromPos: camera.position.clone(), toPos: pos.clone(), fromT: controls.target.clone(), toT: target.clone(), t: 0, dur };
            }

            function focusBox(box: InstanceType<Three['Box3']>) {
                if (!built || box.isEmpty()) return;
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                box.getCenter(center);
                box.getSize(size);
                // keep some of the surrounding boiler in view for context
                const radius = Math.max(size.length() / 2, 3.4);
                // Framed as on a stage FRAME_H px tall and scaled to the real height, so a section is
                // the same size on screen at every level whatever height the stage has when it is picked.
                const vfov = THREE.MathUtils.degToRad(camera.fov);
                const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (width / FRAME_H));
                const dist = Math.max(radius / Math.sin(vfov / 2), radius / Math.sin(hfov / 2)) * 1.35 * (heightPx / FRAME_H);
                // swing round to a three-quarter front view of the section
                const side = center.x < (built.bounds.min.x + built.bounds.max.x) / 2 ? -1 : 1;
                const dir = new THREE.Vector3(0.42 * side, 0.32, 1).normalize();
                atHome = false;
                flyTo(center.clone().addScaledVector(dir, dist), center);
            }

            function focusSection(key: string) {
                if (!built) return;
                focusBox(built.sectionBounds(key));
            }

            function home() {
                computeHome();
                atHome = true;
                flyTo(homePos, homeTarget);
            }

            controls.addEventListener('start', () => {
                tween = null;
                atHome = false;
            });

            // ---- picking -----------------------------------------------------------
            const ray = new THREE.Raycaster();
            const ndc = new THREE.Vector2();

            function pick(clientX: number, clientY: number): { unitId: string; section: string } | null {
                if (!built) return null;
                const r = renderer.domElement.getBoundingClientRect();
                ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
                ray.setFromCamera(ndc, camera);
                const candidates = built.pickables.filter((m) => isClickable(m.userData.section as string));
                const b = built;
                const hit = ray.intersectObjects(candidates, false).find((h) => b.isVisiblePoint(h.point));
                if (!hit) return null;
                return { unitId: hit.object.userData.unitId as string, section: hit.object.userData.section as string };
            }

            let down: { x: number; y: number; button: number } | null = null;
            const el = renderer.domElement;
            const onDown = (e: PointerEvent) => {
                down = { x: e.clientX, y: e.clientY, button: e.button };
                menu = null;
            };
            const onUp = (e: PointerEvent) => {
                if (!down) return;
                const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
                const btn = down.button;
                down = null;
                if (moved > 6 || btn !== 0) return;
                const hit = pick(e.clientX, e.clientY);
                if (hit) selectSection(hit.section);
            };
            let hoverQueued = false;
            let lastMove: PointerEvent | null = null;
            const onMove = (e: PointerEvent) => {
                if (e.pointerType !== 'mouse' || e.buttons) return;
                lastMove = e;
                if (hoverQueued) return;
                hoverQueued = true;
                requestAnimationFrame(() => {
                    hoverQueued = false;
                    if (!lastMove) return;
                    const hit = pick(lastMove.clientX, lastMove.clientY);
                    const key = hit?.section ?? null;
                    if (key !== hoverKey) hoverKey = key;
                    el.style.cursor = key ? 'pointer' : 'grab';
                });
            };
            const onLeave = () => {
                hoverKey = null;
            };
            const onDbl = (e: MouseEvent) => {
                if (!pick(e.clientX, e.clientY)) resetView();
            };
            el.addEventListener('pointerdown', onDown);
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerleave', onLeave);
            el.addEventListener('dblclick', onDbl);
            el.style.cursor = 'grab';

            // ---- highlight + toolbar -------------------------------------------------
            function refreshHighlight() {
                if (!built) return;
                const soft = new Set<string>();
                const strong = new Set<string>();
                if (hoverKey && isClickable(hoverKey)) soft.add(hoverKey);
                if (currentKey) strong.add(currentKey);
                built.setHighlight(soft, strong);
                built.setSectionBoxes(boxesOn, currentKey);
            }

            function applyTools() {
                if (!built) return;
                for (const f of FLOW_LEGEND) built.setFlowVisible(f.kind, flowOn[f.kind]);
                built.setSeeThrough(seeThrough);
                built.setClip(clipMode, clipPct / 100);
            }

            function setSpin(on: boolean) {
                controls.autoRotate = on;
                if (on) tween = null;
            }

            // ---- build / rebuild ---------------------------------------------------
            function rebuild(type: GrateDef['type']) {
                if (built) {
                    scene.remove(built.root);
                    built.dispose();
                    built = null;
                }
                built = buildBoilerScene(type);
                builtType = type;
                scene.add(built.root);
                built.root.traverse((o) => {
                    const m = o as InstanceType<Three['Mesh']>;
                    if (m.isMesh && !wantShadows) m.castShadow = false;
                });
                built.setTheme(isDark);
                // the base slab only reaches 1.2 units past the model (no empty floor to one side)
                const bb = built.bounds;
                plinth.scale.set((bb.max.x - bb.min.x + 2.4) / 32, 1, (bb.max.z - bb.min.z + 2.4) / 9);
                plinth.position.set((bb.min.x + bb.max.x) / 2, 0.03, (bb.min.z + bb.max.z) / 2);
                labels = built.labels;
                placeExtraAnchor();
                computeHome();
                camera.position.copy(homePos);
                controls.target.copy(homeTarget);
                controls.update();
                atHome = true;
                tween = null;
                applyTools();
                refreshHighlight();
            }

            // ---- sizing ------------------------------------------------------------
            // The stage height follows the content next to it, so it changes from level to level.
            // On-screen size is proportional to stage height / camera distance, so when the stage
            // grows or shrinks the camera backs off or comes in by the same ratio: the boiler (and the
            // section the camera is on) keep the same size and only more or less of the scene shows.
            function keepZoom(k: number) {
                const scaleAbout = (p: InstanceType<Three['Vector3']>, t: InstanceType<Three['Vector3']>) => p.sub(t).multiplyScalar(k).add(t);
                scaleAbout(camera.position, controls.target);
                if (tween) {
                    scaleAbout(tween.fromPos, tween.fromT);
                    scaleAbout(tween.toPos, tween.toT);
                }
            }

            function resize() {
                const r = host.getBoundingClientRect();
                const prevH = heightPx;
                width = Math.max(1, Math.round(r.width));
                heightPx = Math.max(1, Math.round(r.height));
                if (built && !atHome && prevH > 1 && heightPx !== prevH) keepZoom(heightPx / prevH);
                renderer.setSize(width, heightPx, false);
                renderer.domElement.style.width = `${width}px`;
                renderer.domElement.style.height = `${heightPx}px`;
                camera.aspect = width / heightPx;
                camera.updateProjectionMatrix();
                chipWidth.clear();
                pixelScale = (heightPx * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
                if (atHome && built) {
                    computeHome();
                    camera.position.copy(homePos);
                    controls.target.copy(homeTarget);
                    controls.update();
                }
            }
            const ro = new ResizeObserver(resize);
            ro.observe(host);

            let visible = true;
            const io = new IntersectionObserver((entries) => {
                visible = entries.some((e) => e.isIntersecting);
            });
            io.observe(stageEl);

            // ---- loop --------------------------------------------------------------
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            const proj = new THREE.Vector3();
            let raf = 0;
            let last = performance.now();
            let simTime = 0;

            // Labels are placed in screen space every frame; a chip that would
            // overlap one already placed is lifted on a longer leader line (or
            // hung below its part).
            const chipWidth = new Map<string, number>();
            const lastLift = new Map<string, number>();
            const lastShift = new Map<string, number>();
            type Rect = { x0: number; y0: number; x1: number; y1: number };
            type PlacedLabel = Pick<SceneLabel, 'id' | 'text' | 'section' | 'anchor' | 'lift'>;
            const placed: Rect[] = [];
            const TOOLS_W = 58; // collapsed toolbar column + margin
            const TOOLS_H = 280;

            function placeLabels() {
                if (!built) return;
                placed.length = 0;
                const cur = currentKey;
                const order: PlacedLabel[] = [...built.labels].sort((a, b) => (a.section === cur ? -1 : 0) - (b.section === cur ? -1 : 0));
                // the top-right chip is placed first so the other chips make room for it
                if (extra) order.unshift({ id: EXTRA_ID, text: extra.label, section: extra.key, anchor: extraAnchor, lift: 0 });
                for (const l of order) {
                    const node = labelEls.get(l.id);
                    if (!node) continue;
                    proj.copy(l.anchor).project(camera);
                    const behind = proj.z > 1 || proj.z < -1;
                    const off = proj.x < -1.1 || proj.x > 1.1 || proj.y < -1.1 || proj.y > 1.1;
                    if (behind || off || (l.id !== EXTRA_ID && !built.isVisiblePoint(l.anchor))) {
                        node.style.visibility = 'hidden';
                        continue;
                    }
                    const x = ((proj.x + 1) / 2) * width;
                    const y = ((1 - proj.y) / 2) * heightPx;

                    let w = chipWidth.get(l.id) ?? 0;
                    if (!w) {
                        const chip = node.firstElementChild as HTMLElement | null;
                        w = chip?.offsetWidth ?? 0;
                        if (w) chipWidth.set(l.id, w);
                        else w = l.text.length * 7 + 26;
                    }
                    const h = 24;
                    const hitAt = (r: Rect) => placed.find((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
                    const above = (lf: number): Rect => ({ x0: x - w / 2 - 3, x1: x + w / 2 + 3, y0: y - lf - h - 2, y1: y - lf + 2 });
                    const under = (dp: number): Rect => ({ x0: x - w / 2 - 3, x1: x + w / 2 + 3, y0: y + dp - 2, y1: y + dp + h + 2 });

                    let lift = l.lift ?? 22;
                    let below = false;
                    let clear = false;
                    for (let i = 0; i < 14; i++) {
                        const r = above(lift);
                        if (r.y0 < 4) break;
                        const hit = hitAt(r);
                        if (!hit) {
                            clear = true;
                            break;
                        }
                        lift += r.y1 - hit.y0 + 1;
                        if (lift > 180) break;
                    }
                    if (!clear) {
                        let drop = 22;
                        for (let i = 0; i < 14; i++) {
                            const r = under(drop);
                            if (r.y1 > heightPx - 4) break;
                            const hit = hitAt(r);
                            if (!hit) {
                                clear = true;
                                below = true;
                                lift = drop;
                                break;
                            }
                            drop += hit.y1 - r.y0 + 1;
                            if (drop > 160) break;
                        }
                    }
                    if (!clear) lift = l.lift ?? 22;
                    // keep the chip inside the stage; the leader stays on its part
                    const r = below ? under(lift) : above(lift);
                    const leftEdge = r.y0 < TOOLS_H ? TOOLS_W : 4;
                    const shift = Math.max(leftEdge + w / 2 - x, Math.min(0, width - 4 - w / 2 - x));
                    placed.push({ x0: r.x0 + shift, x1: r.x1 + shift, y0: r.y0, y1: r.y1 });
                    const rs = Math.round(shift);
                    if (lastShift.get(l.id) !== rs) {
                        lastShift.set(l.id, rs);
                        node.style.setProperty('--shift', `${rs}px`);
                    }
                    node.classList.toggle('below', below);

                    node.style.visibility = 'visible';
                    node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
                    node.style.zIndex = String(1000 - Math.round(proj.z * 500));
                    const rl = Math.round(lift);
                    if (lastLift.get(l.id) !== rl) {
                        lastLift.set(l.id, rl);
                        node.style.setProperty('--lift', `${rl}px`);
                    }
                }
            }

            function frame(now: number) {
                raf = requestAnimationFrame(frame);
                const elapsed = Math.max(0, (now - last) / 1000);
                const dt = Math.min(0.05, elapsed);
                last = now;
                if (!visible || document.hidden) return;

                if (tween) {
                    // wall-clock based, so the fly-to lands on time even on slow GPUs
                    tween.t += Math.min(0.25, elapsed) / tween.dur;
                    const k = ease(Math.min(1, tween.t));
                    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
                    controls.target.lerpVectors(tween.fromT, tween.toT, k);
                    if (tween.t >= 1) tween = null;
                }
                controls.update(dt);

                const step = paused || reduceMotion.matches ? 0 : dt;
                simTime += step;
                built?.update(simTime, step, pixelScale);
                renderer.render(scene, camera);
                placeLabels();
            }

            applyTheme(theme.current === 'dark');
            rebuild(def.type);
            resize();
            ready = true;
            raf = requestAnimationFrame(frame);

            api = { focusSection, home, refreshHighlight, rebuild, applyTheme, applyTools, setSpin };
            setSpin(spinning);
            // the parent may already have a section selected
            if (mode === 'parts' && activeKey) {
                focusedKey = activeKey;
                focusSection(activeKey);
            }

            cleanup = () => {
                cancelAnimationFrame(raf);
                ro.disconnect();
                io.disconnect();
                el.removeEventListener('pointerdown', onDown);
                el.removeEventListener('pointerup', onUp);
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerleave', onLeave);
                el.removeEventListener('dblclick', onDbl);
                controls.dispose();
                if (built) {
                    scene.remove(built.root);
                    built.dispose();
                }
                floor.geometry.dispose();
                floorMat.dispose();
                plinth.geometry.dispose();
                plinthMat.dispose();
                if (grid) {
                    grid.geometry.dispose();
                    (grid.material as InstanceType<Three['Material']>).dispose();
                }
                renderer.dispose();
                renderer.domElement.remove();
                api = null;
            };
            if (disposed) cleanup();
        })().catch(() => {
            fallback = true;
        });

        return () => {
            disposed = true;
            cleanup?.();
        };
    });
</script>

<svelte:window onpointerdown={onWindowDown} onkeydown={onKey} />

{#if fallback}
    <BoilerDesign {def} {sections} {mode} {boilerCode} {activeKey} {readings} {imageUrl} {onselect} />
{:else}
    <div
        class="b3d"
        class:light={theme.current === 'light'}
        style:--b3d-h={height || null}
        bind:this={stage}
        role="region"
        aria-label={`${def.label} 3D boiler model`}
    >
        <div class="canvas" bind:this={canvasHost}></div>

        {#if !ready}
            <div class="loading" aria-live="polite"><span class="spinner"></span>Loading 3D model…</div>
        {/if}

        <div class="labels" aria-hidden={!ready}>
            {#each labels as l (l.id)}
                {@const live = isClickable(l.section)}
                <div class="lbl" class:hot={!!l.section && (hoverKey === l.section || currentKey === l.section)} use:registerLabel={l.id}>
                    <button
                        type="button"
                        class="chip"
                        data-state={stateOf(l.section)}
                        style:--sq={sqColor(l.section)}
                        disabled={!live}
                        title={live ? labelText(l) : 'No spare parts for this section'}
                        onclick={() => onLabelClick(l)}
                        onpointerenter={() => (hoverKey = live ? l.section : null)}
                        onpointerleave={() => (hoverKey = null)}
                    >
                        <span class="sq"></span>{labelText(l)}
                    </button>
                    <span class="leader"></span>
                </div>
            {/each}

            {#if extra}
                <!-- a section with no part of the 3D model: a chip anchored at the top right of the original view -->
                <div class="lbl extra-lbl" use:registerLabel={EXTRA_ID}>
                    <button
                        type="button"
                        class="chip"
                        class:on={extraActive}
                        style:--sq={extra.color}
                        aria-pressed={extraActive}
                        title={extra.label}
                        onclick={() => onextra?.()}
                    >
                        <span class="sq"></span>{extra.label}
                    </button>
                </div>
            {/if}
        </div>

        {#if ready}
            <div class="tools" role="toolbar" aria-orientation="vertical" aria-label="3D view controls">
                <button type="button" class="tb" class:alert={paused} aria-pressed={paused} onclick={() => (paused = !paused)} title={paused ? 'Play flow' : 'Pause flow'}>
                    {#if paused}<Play size={16} />{:else}<Pause size={16} />{/if}
                    <span class="tl">{paused ? 'Play flow' : 'Pause flow'}</span>
                </button>
                <button type="button" class="tb" data-menu aria-expanded={menu === 'flows'} aria-controls="b3d-flows" onclick={() => toggleMenu('flows')} title="Show or hide flows">
                    <WavesHorizontal size={16} /><span class="tl">Flows</span>
                    <span class="cnt">{flowsShown === FLOW_LEGEND.length ? 'All' : flowsShown === 0 ? 'Off' : `${flowsShown}/${FLOW_LEGEND.length}`}</span>
                </button>
                <button type="button" class="tb" aria-pressed={spinning} onclick={() => (spinning = !spinning)} title={spinning ? 'Stop rotating' : 'Rotate the boiler'}>
                    <Rotate3d size={16} /><span class="tl">Rotate</span>
                </button>
                <button type="button" class="tb" data-menu aria-expanded={menu === 'dissect'} aria-controls="b3d-dissect" onclick={() => toggleMenu('dissect')} title="Cut the boiler open">
                    <Scissors size={16} /><span class="tl">Dissect</span>
                    <span class="cnt">{clipPct > 0 ? `${clipPct}%` : 'Off'}</span>
                </button>
                <button type="button" class="tb" aria-pressed={boxesOn} onclick={() => (boxesOn = !boxesOn)} title="Show a box around each section">
                    <SquareDashed size={16} /><span class="tl">Section boxes</span>
                </button>
                <button type="button" class="tb" aria-pressed={seeThrough} onclick={() => (seeThrough = !seeThrough)} title="See through every part of the boiler">
                    <Eye size={16} /><span class="tl">See-through</span>
                </button>
                <button type="button" class="tb" onclick={resetView} title="Reset the camera">
                    <RotateCcw size={16} /><span class="tl">Reset view</span>
                </button>

                {#if menu === 'flows'}
                    <div class="pop" id="b3d-flows" role="group" aria-label="Show or hide flows">
                        <p class="pop-h">Show flows</p>
                        {#each FLOW_LEGEND as f (f.kind)}
                            <label class="sw-row">
                                <span class="sw"><input type="checkbox" bind:checked={flowOn[f.kind]} /><i></i></span>
                                <span class="dot" style:background={f.color}></span>{f.label}
                            </label>
                        {/each}
                        <div class="pop-acts">
                            <button type="button" onclick={() => setAllFlows(true)}>All on</button>
                            <button type="button" onclick={() => setAllFlows(false)}>All off</button>
                        </div>
                    </div>
                {:else if menu === 'dissect'}
                    <div class="pop" id="b3d-dissect" role="group" aria-label="Dissect the boiler">
                        <p class="pop-h">Dissect the boiler</p>
                        <div class="axis">
                            <button type="button" aria-pressed={clipMode === 'front'} onclick={() => { clipMode = 'front'; if (!clipPct) clipPct = 50; }}>Cut from front</button>
                            <button type="button" aria-pressed={clipMode === 'top'} onclick={() => { clipMode = 'top'; if (!clipPct) clipPct = 50; }}>Cut from top</button>
                        </div>
                        <input id="b3d-cut" type="range" min="0" max="100" step="1" bind:value={clipPct} aria-label="How deep to cut" />
                        <div class="scale"><span>Whole</span><span>Half</span><span>Deep</span></div>
                        <div class="pop-acts">
                            <button type="button" onclick={() => (clipPct = 50)}>Cut in half</button>
                            <button type="button" onclick={() => (clipPct = 0)}>Close up</button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        {#if panel}
            <div class="panel" data-state={stateOf(panel.key)}>
                <div class="p-head">
                    <span class="p-title">{panel.label}</span>
                    {#if panel.t}
                        <span class="badge {panel.t.state.toLowerCase()}">{panel.t.state}</span>
                    {/if}
                    <button type="button" class="p-close" onclick={closePanel} aria-label="Close readings"><X size={14} /></button>
                </div>
                {#if panel.t}
                    <dl class="p-metrics">
                        {#each panel.t.metrics as m (m.label)}
                            <div class="row"><dt>{m.label}</dt><dd>{m.value}</dd></div>
                        {/each}
                    </dl>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    /* Colours: dark stage by default, light stage with the app's light theme. */
    .b3d {
        --st-bg: radial-gradient(120% 80% at 50% 10%, #1d3550 0%, #0e1c2a 55%, #08121b 100%);
        --st-border: #1d2f42;
        --st-chip-bg: rgba(14, 22, 31, 0.9);
        --st-chip-ink: #eef3f8;
        --st-chip-dim: #8394a5;
        --st-chip-line: rgba(255, 255, 255, 0.08);
        --st-chip-hot: rgba(20, 54, 86, 0.96);
        --st-leader: 220, 232, 245;
        --st-bar: rgba(8, 14, 21, 0.82);
        --st-btn: rgba(160, 190, 215, 0.1);
        --st-btn-hover: rgba(160, 190, 215, 0.2);
        --st-btn-line: rgba(185, 212, 238, 0.16);
        --st-ink: #dbe6f1;
        --st-muted: #93a6b8;
        --st-accent: #ffb23e;
        --st-accent-ink: #1b1204;
        --st-pop: #0f1822;
        --st-panel: rgba(12, 20, 29, 0.94);
        --st-panel-line: #27415a;
        --st-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);

        position: relative;
        width: 100%;
        height: var(--b3d-h, 540px);
        border-radius: 12px;
        overflow: hidden;
        background: var(--st-bg);
        border: 1px solid var(--st-border);
        user-select: none;
        isolation: isolate;
        container-type: inline-size;
        color: var(--st-ink);
    }

    .b3d.light {
        --st-bg: radial-gradient(120% 80% at 50% 10%, #ffffff 0%, #eaf0f5 55%, #d8e2ea 100%);
        --st-border: #d3dde6;
        --st-chip-bg: rgba(255, 255, 255, 0.95);
        --st-chip-ink: #142233;
        --st-chip-dim: #8a97a5;
        --st-chip-line: #d3dde6;
        --st-chip-hot: #e5f1fc;
        --st-leader: 40, 66, 92;
        --st-bar: rgba(255, 255, 255, 0.9);
        --st-btn: #f1f5f9;
        --st-btn-hover: #e4ecf3;
        --st-btn-line: #d3dde6;
        --st-ink: #1c2b3a;
        --st-muted: #5f7184;
        --st-accent: #d98a12;
        --st-accent-ink: #ffffff;
        --st-pop: #ffffff;
        --st-panel: rgba(255, 255, 255, 0.97);
        --st-panel-line: #d3dde6;
        --st-shadow: 0 10px 26px rgba(20, 40, 60, 0.16);
    }

    .canvas {
        position: absolute;
        inset: 0;
    }

    .loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--st-muted);
        font-size: 13px;
        z-index: 5;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid currentColor;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* ---- section labels ---- */
    .labels {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 3;
    }

    .lbl {
        position: absolute;
        left: 0;
        top: 0;
        visibility: hidden;
        will-change: transform;
    }

    .chip {
        position: absolute;
        left: 0;
        bottom: var(--lift, 22px);
        transform: translateX(calc(-50% + var(--shift, 0px)));
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border-radius: 5px;
        border: 1px solid var(--st-chip-line);
        background: var(--st-chip-bg);
        color: var(--st-chip-ink);
        font: 600 12px/1.1 inherit;
        font-family: inherit;
        white-space: nowrap;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: var(--st-shadow);
        transition: background 140ms ease, border-color 140ms ease;
    }

    .chip:disabled {
        cursor: default;
        color: var(--st-chip-dim);
    }

    .chip:not(:disabled):hover,
    .chip:focus-visible,
    .lbl.hot .chip {
        background: var(--st-chip-hot);
        border-color: #4fb3ff;
        outline: none;
    }

    .lbl.hot {
        z-index: 2000 !important;
    }

    .chip .sq {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        background: var(--sq, #8a97a5);
        flex: none;
    }

    .chip[data-state='normal'] { --sq: #2fbf5b; }
    .chip[data-state='warning'] { --sq: #f2b400; }
    .chip[data-state='attention'] { --sq: #f0453a; }
    .chip[data-state='available'] { --sq: #4fb3ff; }
    .chip[data-state='dim'] { --sq: #8a97a5; }

    .leader {
        position: absolute;
        left: -0.5px;
        bottom: 0;
        width: 1px;
        height: var(--lift, 22px);
        background: linear-gradient(to bottom, rgba(var(--st-leader), 0.75), rgba(var(--st-leader), 0.15));
    }

    .lbl:global(.below) .chip {
        bottom: auto;
        top: var(--lift, 22px);
    }

    .lbl:global(.below) .leader {
        bottom: auto;
        top: 0;
        background: linear-gradient(to top, rgba(var(--st-leader), 0.75), rgba(var(--st-leader), 0.15));
    }

    /* ---- top-right chip (a section with no part of the 3D model) ---- */
    .extra-lbl .chip.on {
        background: var(--st-chip-hot);
        border-color: #4fb3ff;
    }

    /* ---- toolbar: a slim icon column; hover (or keyboard focus) shows the names ---- */
    .tools {
        position: absolute;
        left: 10px;
        top: 10px;
        z-index: 6;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 5px;
        border: 1px solid var(--st-btn-line);
        border-radius: 10px;
        background: var(--st-bar);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
    }

    .tb {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        height: 32px;
        min-width: 32px;
        padding: 0 8px;
        border: 1px solid var(--st-btn-line);
        border-radius: 7px;
        background: var(--st-btn);
        color: var(--st-ink);
        font: 600 12.5px/1 inherit;
        font-family: inherit;
        white-space: nowrap;
        cursor: pointer;
        overflow: hidden;
    }

    .tb :global(svg) {
        flex: none;
    }

    .tb .tl,
    .tb .cnt {
        max-width: 0;
        margin-left: 0;
        opacity: 0;
        overflow: hidden;
        transition: max-width 0.2s ease, margin-left 0.2s ease, opacity 0.15s ease;
    }

    .tb .cnt {
        margin-left: auto;
        padding-left: 0;
        font-weight: 500;
        font-size: 11px;
        color: var(--st-muted);
    }

    .tools:has(:focus-visible) .tb .tl {
        max-width: 110px;
        margin-left: 8px;
        opacity: 1;
    }

    .tools:has(:focus-visible) .tb .cnt {
        max-width: 48px;
        padding-left: 10px;
        opacity: 1;
    }

    @media (hover: hover) {
        .tools:hover .tb .tl {
            max-width: 110px;
            margin-left: 8px;
            opacity: 1;
        }

        .tools:hover .tb .cnt {
            max-width: 48px;
            padding-left: 10px;
            opacity: 1;
        }
    }

    .tb:hover {
        background: var(--st-btn-hover);
    }

    .tb:focus-visible {
        outline: 2px solid var(--st-accent);
        outline-offset: 1px;
    }

    .tb[aria-pressed='true'],
    .tb[aria-expanded='true'] {
        background: color-mix(in srgb, var(--st-accent) 16%, transparent);
        border-color: color-mix(in srgb, var(--st-accent) 55%, transparent);
        color: var(--st-accent);
    }

    .tb.alert[aria-pressed='true'] {
        background: rgba(255, 90, 79, 0.14);
        border-color: rgba(255, 90, 79, 0.6);
        color: #ff6f64;
    }

    /* ---- popovers ---- */
    .pop {
        position: absolute;
        left: calc(100% + 8px);
        top: 0;
        z-index: 7;
        width: 250px;
        max-width: calc(100cqw - 80px);
        cursor: default;
        padding: 10px 12px 12px;
        border: 1px solid var(--st-btn-line);
        border-radius: 10px;
        background: var(--st-pop);
        box-shadow: var(--st-shadow);
        color: var(--st-ink);
        font-size: 13px;
    }

    .pop-h {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--st-muted);
    }

    .sw-row {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 32px;
        cursor: pointer;
    }

    .sw {
        position: relative;
        width: 34px;
        height: 19px;
        flex: none;
    }

    .sw input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
    }

    .sw i {
        position: absolute;
        inset: 0;
        border-radius: 10px;
        background: var(--st-btn-hover);
        border: 1px solid var(--st-btn-line);
        pointer-events: none;
        transition: background 0.15s;
    }

    .sw i::after {
        content: '';
        position: absolute;
        left: 2px;
        top: 2px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #cfd8e0;
        transition: transform 0.15s;
    }

    .sw input:checked + i {
        background: var(--st-accent);
        border-color: transparent;
    }

    .sw input:checked + i::after {
        transform: translateX(15px);
        background: #fff;
    }

    .sw input:focus-visible + i {
        outline: 2px solid var(--st-accent);
        outline-offset: 2px;
    }

    .dot {
        width: 14px;
        height: 4px;
        border-radius: 2px;
        flex: none;
    }

    .pop-acts,
    .axis {
        display: flex;
        gap: 6px;
        margin-top: 8px;
    }

    .axis {
        margin: 2px 0 10px;
    }

    .pop-acts button,
    .axis button {
        flex: 1;
        height: 30px;
        border: 1px solid var(--st-btn-line);
        border-radius: 6px;
        background: var(--st-btn);
        color: var(--st-ink);
        font: 600 12px/1 inherit;
        font-family: inherit;
        cursor: pointer;
    }

    .axis button[aria-pressed='true'] {
        background: var(--st-accent);
        border-color: transparent;
        color: var(--st-accent-ink);
    }

    #b3d-cut {
        width: 100%;
        accent-color: var(--st-accent);
    }

    .scale {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--st-muted);
    }

    /* ---- dashboard readings ---- */
    .panel {
        position: absolute;
        right: 12px;
        top: 12px;
        z-index: 6;
        width: 230px;
        max-width: calc(100% - 24px);
        padding: 11px 12px;
        border-radius: 10px;
        background: var(--st-panel);
        border: 1px solid var(--st-panel-line);
        box-shadow: var(--st-shadow);
        color: var(--st-ink);
        animation: panel-in 200ms ease-out;
    }

    @keyframes panel-in {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
        to {
            opacity: 1;
            transform: none;
        }
    }

    .p-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .p-title {
        font-size: 13px;
        font-weight: 700;
        flex: 1;
        min-width: 0;
    }

    .p-close {
        border: 0;
        background: transparent;
        color: var(--st-muted);
        cursor: pointer;
        display: inline-flex;
        padding: 2px;
        border-radius: 4px;
    }

    .p-close:hover {
        color: var(--st-ink);
        background: var(--st-btn-hover);
    }

    .badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 2px 7px;
        border-radius: 999px;
        white-space: nowrap;
    }

    .badge.normal { color: #9adf6c; background: #1e3212; }
    .badge.warning { color: #ffcc66; background: #3a2f0f; }
    .badge.attention { color: #ff9d8f; background: #3a1c18; }

    .light .badge.normal { color: #1f7a3a; background: #dcf3e2; }
    .light .badge.warning { color: #8a5a00; background: #fdf0cf; }
    .light .badge.attention { color: #a7281d; background: #fbe2de; }

    .p-metrics {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .p-metrics .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
    }

    .p-metrics dt {
        font-size: 12px;
        color: var(--st-muted);
    }

    .p-metrics dd {
        margin: 0;
        font-size: 12.5px;
        font-weight: 700;
    }

    @container (max-width: 520px) {
        /* phones: the toolbar stays a slim icon column so its menus fit beside it */
        .tools:hover .tb .tl,
        .tools:hover .tb .cnt {
            max-width: 0;
            margin-left: 0;
            padding-left: 0;
            opacity: 0;
        }

        .chip {
            font-size: 10.5px;
            padding: 3px 6px;
        }

        .panel {
            top: 10px;
            right: 10px;
            left: 10px;
            width: auto;
        }
    }

    @media (max-width: 900px) {
        .b3d {
            height: var(--b3d-h, 460px);
        }
    }

    @media (max-width: 560px) {
        .b3d {
            height: var(--b3d-h, 380px);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .panel {
            animation: none;
        }
    }
</style>