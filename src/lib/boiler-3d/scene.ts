import * as THREE from 'three';
import type { GrateType } from '$lib/boiler-design';
import { FLOW_LEGEND, SECTION_COLORS, type FlowKind } from './legend';

export { FLOW_LEGEND, SECTION_COLORS, type FlowKind };

const FLOW_COLOR: Record<FlowKind, string> = Object.fromEntries(
    FLOW_LEGEND.map((f) => [f.kind, f.color])
) as Record<FlowKind, string>;

export type SceneLabel = {
    id: string;
    text: string;
    unitId: string;
    section: string | null;
    anchor: THREE.Vector3;
    small?: boolean;
    lift?: number;
    primary?: boolean;
};

export type SceneUnit = {
    id: string;
    section: string | null;
    object: THREE.Object3D;
};

export type ClipMode = 'front' | 'top';

export type BuiltScene = {
    root: THREE.Group;
    pickables: THREE.Mesh[];
    units: Map<string, SceneUnit>;
    labels: SceneLabel[];
    fireLight: THREE.PointLight;
    bounds: THREE.Box3;
    setHighlight: (sections: Set<string>, strong: Set<string>) => void;
    unitBounds: (unitId: string) => THREE.Box3;
    sectionBounds: (key: string) => THREE.Box3;
    setFlowVisible: (kind: FlowKind, on: boolean) => void;
    setClip: (mode: ClipMode, t: number) => void;
    isVisiblePoint: (p: THREE.Vector3) => boolean;
    setSectionBoxes: (on: boolean, selected: string | null) => void;
    setSeeThrough: (on: boolean) => void;
    setTheme: (dark: boolean) => void;
    update: (time: number, dt: number, pixelScale: number) => void;
    dispose: () => void;
};

type XY = { x: number; y: number };
type Pt = [number, number, number];

type Layout = {
    chimney: { x: number; h: number; r: number };
    idFan: { x: number; y: number; r: number };
    idMotor: XY;
    collector:
        | { kind: 'cyclone'; x: number; r: number; yTop: number; yBody: number; yCone: number; frameTop: number }
        | { kind: 'box'; x: number; w: number; yTop: number; yBody: number; yCone: number; frameTop: number };
    ductUpY: number;
    airLocks: XY[];
    boiler: { x0: number; xMid: number; x1: number; y0: number; y1: number; depth: number };
    steamDrum: { x: number; y: number; r: number };
    waterDrum: { x: number; y: number; r: number };
    hoppers: { x: number; yTop: number; h: number; w: number }[];
    grate: { x0: number; y0: number; x1: number; y1: number };
    ashPits: { x: number; w: number }[];
    fuel: { x: number; yTop: number; yBend: number; yIn: number };
    vgMotor?: XY;
    hydraulic?: XY;
    conveyor?: { x: number; y: number };
};

const LAYOUTS: Record<GrateType, Layout> = {
    fixed: {
        chimney: { x: -15.4, h: 12.8, r: 0.7 },
        idFan: { x: -11.1, y: 2.0, r: 1.25 },
        idMotor: { x: -9.4, y: 0.55 },
        collector: { kind: 'cyclone', x: -6.7, r: 1.3, yTop: 10.2, yBody: 6.2, yCone: 3.4, frameTop: 10.2 },
        ductUpY: 11.4,
        airLocks: [{ x: -7.35, y: 1.6 }, { x: -6.1, y: 1.6 }],
        boiler: { x0: -5.0, xMid: -0.3, x1: 4.3, y0: 2.2, y1: 12.0, depth: 5 },
        steamDrum: { x: -2.75, y: 11.9, r: 0.95 },
        waterDrum: { x: -2.75, y: 3.9, r: 0.8 },
        hoppers: [
            { x: -4.0, yTop: 2.2, h: 1.6, w: 1.6 },
            { x: -1.5, yTop: 2.2, h: 1.6, w: 1.6 }
        ],
        grate: { x0: -0.1, y0: 2.0, x1: 4.1, y1: 2.0 },
        ashPits: [{ x: 2.0, w: 3.8 }],
        fuel: { x: 5.9, yTop: 9.9, yBend: 6.0, yIn: 3.9 }
    },
    fixed_water_cooled: {
        chimney: { x: -15.6, h: 12.9, r: 0.7 },
        idFan: { x: -11.3, y: 2.1, r: 1.25 },
        idMotor: { x: -9.5, y: 0.55 },
        collector: { kind: 'cyclone', x: -6.8, r: 1.3, yTop: 10.4, yBody: 6.3, yCone: 3.4, frameTop: 10.4 },
        ductUpY: 11.5,
        airLocks: [{ x: -7.45, y: 1.6 }, { x: -6.2, y: 1.6 }],
        boiler: { x0: -5.0, xMid: -0.2, x1: 4.4, y0: 2.2, y1: 12.1, depth: 5 },
        steamDrum: { x: -2.6, y: 12.0, r: 0.95 },
        waterDrum: { x: -2.6, y: 4.0, r: 0.8 },
        hoppers: [
            { x: -3.9, yTop: 2.2, h: 1.6, w: 1.6 },
            { x: -1.4, yTop: 2.2, h: 1.6, w: 1.6 }
        ],
        grate: { x0: 0.0, y0: 2.0, x1: 4.2, y1: 2.0 },
        ashPits: [{ x: 2.1, w: 3.8 }],
        fuel: { x: 6.0, yTop: 10.2, yBend: 6.2, yIn: 4.0 }
    },
    reciprocating: {
        chimney: { x: -14.5, h: 14.4, r: 0.95 },
        idFan: { x: -9.7, y: 2.0, r: 1.4 },
        idMotor: { x: -7.8, y: 0.5 },
        collector: { kind: 'cyclone', x: -5.6, r: 1.05, yTop: 13.2, yBody: 7.0, yCone: 4.5, frameTop: 12.2 },
        ductUpY: 11.6,
        airLocks: [{ x: -6.3, y: 2.3 }, { x: -6.3, y: 1.4 }],
        boiler: { x0: -4.4, xMid: -0.6, x1: 4.0, y0: 1.2, y1: 13.0, depth: 5 },
        steamDrum: { x: -2.4, y: 13.3, r: 0.75 },
        waterDrum: { x: -2.3, y: 5.3, r: 0.6 },
        hoppers: [
            { x: -3.5, yTop: 4.7, h: 1.6, w: 1.2 },
            { x: -1.3, yTop: 4.7, h: 1.6, w: 1.2 }
        ],
        grate: { x0: -0.3, y0: 1.15, x1: 3.8, y1: 2.15 },
        ashPits: [
            { x: 0.4, w: 1.2 },
            { x: 1.75, w: 1.2 },
            { x: 3.1, w: 1.2 }
        ],
        fuel: { x: 5.4, yTop: 9.0, yBend: 5.0, yIn: 3.1 },
        hydraulic: { x: -1.5, y: 1.0 }
    },
    vibrating: {
        chimney: { x: -14.8, h: 14.6, r: 0.95 },
        idFan: { x: -10.2, y: 2.15, r: 1.85 },
        idMotor: { x: -7.6, y: 0.6 },
        collector: { kind: 'box', x: -5.0, w: 2.9, yTop: 14.0, yBody: 5.3, yCone: 2.6, frameTop: 14.0 },
        ductUpY: 7.6,
        airLocks: [{ x: -5.6, y: 1.6 }, { x: -5.6, y: 0.75 }],
        boiler: { x0: -2.9, xMid: 0.6, x1: 6.5, y0: 2.0, y1: 14.2, depth: 5 },
        steamDrum: { x: -1.0, y: 14.5, r: 0.75 },
        waterDrum: { x: -0.8, y: 5.2, r: 0.55 },
        hoppers: [
            { x: -2.05, yTop: 2.0, h: 1.5, w: 1.4 },
            { x: -0.35, yTop: 2.0, h: 1.5, w: 1.4 }
        ],
        grate: { x0: 0.6, y0: 1.85, x1: 6.4, y1: 3.0 },
        ashPits: [
            { x: 1.4, w: 1.7 },
            { x: 3.5, w: 1.7 },
            { x: 5.6, w: 1.7 }
        ],
        fuel: { x: 7.6, yTop: 11.3, yBend: 6.4, yIn: 4.6 },
        vgMotor: { x: 0.3, y: 0.85 },
        conveyor: { x: 8.0, y: 0.5 }
    }
};

const C = {
    steel: '#c3c9d1',
    steelDark: '#7d8690',
    green: '#6cc03a',
    greenDark: '#3f8a1f',
    frame: '#7a2a1d',
    casing: '#e39a3a',
    brick: '#a9472b',
    red: '#e2382f',
    blue: '#2f8fe0',
    iron: '#3b3e44',
    drum: '#bfd3e6',
    duct: '#cfd5dc',
    chute: '#7a2b22'
};

function std(color: string, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3, ...o });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
}

function cylY(r: number, h: number, mat: THREE.Material, seg = 32, rTop = r): THREE.Mesh {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg);
    g.translate(0, h / 2, 0);
    return mesh(g, mat);
}

function cylZ(r: number, len: number, mat: THREE.Material, seg = 32): THREE.Mesh {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    return mesh(g, mat);
}

function cylX(r: number, len: number, mat: THREE.Material, seg = 24): THREE.Mesh {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2);
    return mesh(g, mat);
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T {
    o.position.set(x, y, z);
    return o;
}

const V = (p: Pt) => new THREE.Vector3(p[0], p[1], p[2]);

function elbowPath(points: Pt[], radius = 0.6): THREE.CurvePath<THREE.Vector3> {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const pts = points.map(V);
    let cursor = pts[0].clone();
    for (let i = 1; i < pts.length; i++) {
        const cur = pts[i];
        if (i === pts.length - 1) {
            if (cursor.distanceTo(cur) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), cur.clone()));
            break;
        }
        const next = pts[i + 1];
        const dIn = cur.clone().sub(pts[i - 1]);
        const dOut = next.clone().sub(cur);
        const r = Math.min(radius, dIn.length() / 2, dOut.length() / 2);
        const a = cur.clone().sub(dIn.normalize().multiplyScalar(r));
        const b = cur.clone().add(dOut.normalize().multiplyScalar(r));
        if (cursor.distanceTo(a) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), a));
        path.add(new THREE.QuadraticBezierCurve3(a.clone(), cur.clone(), b.clone()));
        cursor = b;
    }
    return path;
}

function pipe(points: Pt[], r: number, mat: THREE.Material, corner = 0.6, segs = 0): THREE.Mesh {
    const curve = elbowPath(points, corner);
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, segs || Math.max(16, Math.round(len * 6)), r, 18, false);
    return mesh(g, mat);
}

function smoothTube(points: Pt[], r: number, mat: THREE.Material): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, 64, r, 10, false);
    return mesh(g, mat, false);
}

function hopper(wTop: number, wBottom: number, h: number, dTop: number, mat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2 * (wBottom / wTop), h, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    geo.translate(0, h / 2, 0);
    const m = mesh(geo, mat);
    g.add(m);
    g.scale.set(wTop, 1, dTop);
    return g;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (ctx) draw(ctx);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function brickTexture(): THREE.CanvasTexture {
    const t = canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = '#7d3020';
        ctx.fillRect(0, 0, 256, 256);
        const bw = 64;
        const bh = 24;
        for (let row = 0; row < 256 / bh + 1; row++) {
            const off = row % 2 ? bw / 2 : 0;
            for (let col = -1; col < 256 / bw + 1; col++) {
                const shade = 150 + Math.floor(Math.random() * 40);
                ctx.fillStyle = `rgb(${shade + 20}, ${Math.floor(shade * 0.45)}, ${Math.floor(shade * 0.3)})`;
                ctx.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
            }
        }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function dotTexture(soft = false): THREE.CanvasTexture {
    return canvasTexture(64, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        if (soft) {
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
    });
}

function cloudTexture(): THREE.CanvasTexture {
    return canvasTexture(128, 128, (ctx) => {
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 26;
            const x = 64 + Math.cos(a) * d;
            const y = 64 + Math.sin(a) * d;
            const r = 22 + Math.random() * 20;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const v = 215 + Math.floor(Math.random() * 40);
            g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
            g.addColorStop(0.6, `rgba(${v},${v},${v},0.22)`);
            g.addColorStop(1, `rgba(${v},${v},${v},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 128, 128);
        }
        ctx.globalCompositeOperation = 'destination-in';
        const m = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
        m.addColorStop(0, 'rgba(0,0,0,1)');
        m.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = m;
        ctx.fillRect(0, 0, 128, 128);
    });
}

function emberTexture(): THREE.CanvasTexture {
    const t = canvasTexture(512, 256, (ctx) => {
        ctx.fillStyle = '#140604';
        ctx.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 1400; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 256;
            const r = 3 + Math.random() * 9;
            const hot = Math.random();
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const c = hot > 0.8 ? '255,236,170' : hot > 0.45 ? '255,150,40' : '200,60,10';
            g.addColorStop(0, `rgba(${c},${0.55 + hot * 0.45})`);
            g.addColorStop(1, `rgba(${c},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

class Particles {
    readonly points: THREE.Points;
    readonly pos: Float32Array;
    readonly col: Float32Array;
    readonly size: Float32Array;
    readonly alpha: Float32Array;
    readonly rot: Float32Array;
    private readonly geo: THREE.BufferGeometry;
    private readonly mat: THREE.ShaderMaterial;

    constructor(readonly count: number, map: THREE.Texture, additive: boolean) {
        this.pos = new Float32Array(count * 3);
        this.col = new Float32Array(count * 3);
        this.size = new Float32Array(count);
        this.alpha = new Float32Array(count);
        this.rot = new Float32Array(count);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
        this.geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uMap: { value: map }, uScale: { value: 300 } },
            vertexShader: `
                attribute vec3 aColor;
                attribute float aSize;
                attribute float aAlpha;
                attribute float aRot;
                uniform float uScale;
                varying vec3 vColor;
                varying float vAlpha;
                varying float vRot;
                void main() {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * uScale / max(0.001, -mv.z);
                    gl_Position = projectionMatrix * mv;
                    vColor = aColor;
                    vAlpha = aAlpha;
                    vRot = aRot;
                }`,
            fragmentShader: `
                uniform sampler2D uMap;
                varying vec3 vColor;
                varying float vAlpha;
                varying float vRot;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float c = cos(vRot);
                    float s = sin(vRot);
                    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5;
                    vec4 t = texture2D(uMap, uv);
                    if (t.a * vAlpha < 0.01) discard;
                    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
                }`,
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        this.points = new THREE.Points(this.geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 3 : 2;
    }

    setAdditive(on: boolean) {
        this.mat.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending;
        this.mat.needsUpdate = true;
    }

    set(i: number, p: THREE.Vector3, c: THREE.Color, size: number, alpha: number, rot = 0) {
        this.rot[i] = rot;
        this.pos[i * 3] = p.x;
        this.pos[i * 3 + 1] = p.y;
        this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = c.r;
        this.col[i * 3 + 1] = c.g;
        this.col[i * 3 + 2] = c.b;
        this.size[i] = size;
        this.alpha[i] = alpha;
    }

    commit(scale: number) {
        this.mat.uniforms.uScale.value = scale;
        (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
        (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
        (this.geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
        (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
        (this.geo.getAttribute('aRot') as THREE.BufferAttribute).needsUpdate = true;
    }

    hide() {
        this.alpha.fill(0);
        (this.geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    }

    dispose() {
        this.geo.dispose();
        this.mat.dispose();
    }
}

type Stream = {
    kind: FlowKind;
    samples: THREE.Vector3[];
    color: THREE.Color;
    count: number;
    speed: number;
    size: number;
    offset: number;
    jitter: number;
};

function sampled(curve: THREE.Curve<THREE.Vector3>, n = 160): THREE.Vector3[] {
    return curve.getSpacedPoints(n);
}

function sampleAt(samples: THREE.Vector3[], u: number, out: THREE.Vector3): THREE.Vector3 {
    const f = (((u % 1) + 1) % 1) * (samples.length - 1);
    const i = Math.floor(f);
    const k = f - i;
    const a = samples[i];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    return out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
}

export function buildBoilerScene(type: GrateType): BuiltScene {
    const L = LAYOUTS[type];
    const root = new THREE.Group();
    root.name = `boiler-${type}`;

    const units = new Map<string, SceneUnit>();
    const labels: SceneLabel[] = [];
    const pickables: THREE.Mesh[] = [];
    const disposables: { dispose: () => void }[] = [];
    const tickers: ((t: number, dt: number) => void)[] = [];

    function unit(id: string, section: string | null): THREE.Group {
        const g = new THREE.Group();
        g.name = id;
        g.userData.unitId = id;
        g.userData.section = section;
        root.add(g);
        units.set(id, { id, section, object: g });
        return g;
    }

    function label(text: string, unitId: string, x: number, y: number, z = 0, opt: boolean | { small?: boolean; lift?: number; primary?: boolean } = false) {
        const u = units.get(unitId);
        const o: { small?: boolean; lift?: number; primary?: boolean } = typeof opt === 'boolean' ? { small: opt } : opt;
        labels.push({
            id: `${unitId}:${labels.length}`,
            text,
            unitId,
            section: u?.section ?? null,
            anchor: new THREE.Vector3(x, y, z),
            small: o.small,
            lift: o.lift,
            primary: o.primary
        });
    }

    const B = L.boiler;
    const D = B.depth;
    const zF = D / 2;

    {
        const g = unit('chimney', null);
        const steel = std(C.steel, { metalness: 0.55, roughness: 0.4 });
        g.add(at(cylY(L.chimney.r * 1.35, 0.35, std(C.steelDark)), L.chimney.x, 0));
        g.add(at(cylY(L.chimney.r, L.chimney.h, steel, 36), L.chimney.x, 0.35));
        for (const f of [0.35, 0.7]) {
            const ring = mesh(new THREE.TorusGeometry(L.chimney.r * 1.01, 0.05, 8, 40), std(C.steelDark));
            ring.rotation.x = Math.PI / 2;
            g.add(at(ring, L.chimney.x, 0.35 + L.chimney.h * f));
        }
        const lip = mesh(new THREE.TorusGeometry(L.chimney.r * 1.05, 0.09, 10, 40), std(C.steelDark));
        lip.rotation.x = Math.PI / 2;
        g.add(at(lip, L.chimney.x, 0.35 + L.chimney.h));
        g.add(at(box(0.5, 0.8, 0.08, std(C.steelDark)), L.chimney.x, 1.2, L.chimney.r * 0.98));
        if (type === 'fixed' || type === 'fixed_water_cooled') {
            const red = std(C.frame);
            const lx = L.chimney.x + L.chimney.r + 0.35;
            for (const dz of [-0.25, 0.25]) g.add(at(box(0.05, 5.2, 0.05, red), lx, 2.8 + 2.6, dz));
            for (let i = 0; i < 13; i++) g.add(at(box(0.05, 0.04, 0.5, red), lx, 3 + i * 0.4, 0));
            g.add(at(box(0.7, 0.06, 0.9, red), lx + 0.15, 8.0));
        }
    }

    const fanImpellers: THREE.Object3D[] = [];

    function centrifugalFan(parent: THREE.Group, x: number, y: number, r: number, depth: number, outletLeft: boolean) {
        const green = std(C.green, { metalness: 0.2, roughness: 0.45 });
        const greenD = std(C.greenDark, { metalness: 0.2, roughness: 0.5 });
        const body = cylZ(r, depth, green, 40);
        parent.add(at(body, x, y));
        const out = box(r * 1.05, r * 0.85, depth * 0.9, green);
        parent.add(at(out, x + (outletLeft ? -r * 0.55 : r * 0.55), y + r * 0.55));
        const ring = mesh(new THREE.TorusGeometry(r * 0.68, r * 0.07, 10, 40), greenD);
        parent.add(at(ring, x, y, depth / 2 + 0.02));
        const eye = mesh(new THREE.CircleGeometry(r * 0.66, 40), std('#1b2b14', { roughness: 0.9 }));
        parent.add(at(eye, x, y, depth / 2 + 0.015));
        const imp = new THREE.Group();
        const bladeMat = std('#9bdc6a', { metalness: 0.3 });
        for (let i = 0; i < 5; i++) {
            const blade = box(r * 0.5, r * 0.14, 0.05, bladeMat);
            blade.position.x = r * 0.3;
            const holder = new THREE.Group();
            holder.rotation.z = (i / 5) * Math.PI * 2;
            blade.rotation.z = 0.5;
            holder.add(blade);
            imp.add(holder);
        }
        imp.add(cylZ(r * 0.12, 0.12, greenD));
        parent.add(at(imp, x, y, depth / 2 + 0.06));
        fanImpellers.push(imp);
        parent.add(at(box(r * 2.1, 0.2, depth * 1.2, std(C.steelDark)), x, y - r - 0.1));
    }

    function motor(parent: THREE.Group, x: number, y: number, len = 1.0, r = 0.32) {
        const green = std(C.green, { metalness: 0.25, roughness: 0.45 });
        parent.add(at(cylX(r, len, green), x, y));
        for (let i = 0; i < 6; i++) parent.add(at(cylX(r * 1.06, 0.04, std(C.greenDark)), x - len / 2 + 0.15 + i * (len - 0.3) / 5, y));
        parent.add(at(box(len * 1.1, 0.14, r * 2.2, std(C.steelDark)), x, y - r - 0.07));
        parent.add(at(cylZ(r * 0.55, 0.1, std(C.greenDark)), x, y, r + 0.05));
    }

    {
        const g = unit('id_fan', 'fan_pump');
        centrifugalFan(g, L.idFan.x, L.idFan.y, L.idFan.r, L.idFan.r * 0.9, true);
        label('Fan & Pump', 'id_fan', L.idFan.x, L.idFan.y + L.idFan.r + 0.9, 0, { primary: true });
    }
    {
        const g = unit('id_motor', 'fan_pump');
        motor(g, L.idMotor.x, L.idMotor.y + 0.32, 1.0, 0.34);
        const shaftLen = Math.abs(L.idMotor.x - L.idFan.x) - 0.6;
        g.add(at(cylX(0.06, shaftLen, std(C.steelDark)), (L.idMotor.x + L.idFan.x) / 2, L.idMotor.y + 0.32));
    }

    const ductMat = std(C.duct, { metalness: 0.6, roughness: 0.35 });
    {
        const g = unit('ducts', null);
        const col = L.collector;
        const fanTop = L.idFan.y + L.idFan.r;
        const ductR = type === 'vibrating' ? 0.62 : 0.55;
        if (col.kind === 'cyclone') {
            g.add(pipe([
                [col.x - col.r * 0.4, col.yTop + 0.2, 0],
                [col.x - col.r * 0.4, L.ductUpY, 0],
                [L.idFan.x, L.ductUpY, 0],
                [L.idFan.x, fanTop - 0.1, 0]
            ], ductR, ductMat, 1.1));
        } else {
            g.add(pipe([
                [col.x - col.w / 2, L.ductUpY, 0],
                [L.idFan.x + 0.2, L.ductUpY, 0],
                [L.idFan.x + 0.2, fanTop - 0.1, 0]
            ], ductR, ductMat, 1.1));
        }
        g.add(pipe([
            [L.idFan.x - L.idFan.r * 0.9, L.idFan.y + L.idFan.r * 0.55, 0],
            [L.chimney.x + L.chimney.r * 0.6, L.idFan.y + L.idFan.r * 0.55, 0]
        ], 0.42, ductMat));
        const inletY = col.kind === 'cyclone' ? col.yTop - 0.9 : col.yTop - 2.0;
        const colSide = col.kind === 'cyclone' ? col.x + col.r * 0.9 : col.x + col.w / 2;
        g.add(pipe([
            [B.x0 + 0.1, inletY, 0],
            [colSide - 0.1, inletY, 0]
        ], 0.45, ductMat));
    }

    {
        const g = unit('dust_collector', 'dust_collector');
        const col = L.collector;
        const grey = std('#b7bdc4', { metalness: 0.55, roughness: 0.4 });
        const frame = std(C.frame, { metalness: 0.2, roughness: 0.6 });
        if (col.kind === 'cyclone') {
            const bodyH = col.yTop - col.yBody;
            g.add(at(cylY(col.r, bodyH, grey, 36), col.x, col.yBody));
            g.add(at(cylY(col.r * 1.04, 0.18, std(C.steelDark)), col.x, col.yTop - 0.05));
            const coneH = col.yBody - col.yCone;
            const cone = mesh(new THREE.CylinderGeometry(col.r, 0.22, coneH, 36), grey);
            cone.position.set(col.x, col.yCone + coneH / 2, 0);
            g.add(cone);
            const band = mesh(
                new THREE.CylinderGeometry(col.r * 1.005, col.r * 1.005, bodyH * 0.3, 36, 1, true, -Math.PI / 2.4, Math.PI / 1.2),
                std('#6f7780', { transparent: true, opacity: 0.35, side: THREE.DoubleSide })
            );
            band.position.set(col.x, col.yTop - bodyH * 0.25, 0);
            g.add(band);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const t = cylY(0.16, bodyH * 0.45, std('#e9edf1', { metalness: 0.5 }), 16);
                t.position.set(col.x + Math.cos(a) * col.r * 0.55, col.yTop - bodyH * 0.5, Math.sin(a) * col.r * 0.55);
                g.add(t);
            }
            g.add(at(cylY(0.2, col.yCone - (L.airLocks[0]?.y ?? 1) - 0.2, grey, 16), col.x, (L.airLocks[0]?.y ?? 1) + 0.25));
            label('Dust Collector', 'dust_collector', col.x, col.yTop + 0.7, 0, { primary: true });
        } else {
            const bodyH = col.yTop - col.yBody;
            g.add(at(box(col.w, bodyH, 3.4, grey), col.x, col.yBody + bodyH / 2));
            const glass = std('#8e98a3', { transparent: true, opacity: 0.25 });
            g.add(at(box(col.w * 0.9, bodyH * 0.55, 0.02, glass), col.x, col.yBody + bodyH * 0.55, 1.71));
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 2; j++) {
                    g.add(at(cylY(0.2, bodyH * 0.45, std('#e6eaee', { metalness: 0.5 }), 16), col.x - col.w * 0.33 + i * col.w * 0.22, col.yBody + bodyH * 0.3, 0.9 - j * 1.6));
                }
            }
            const hw = col.w / 2;
            for (const dx of [-hw / 2, hw / 2]) {
                const hp = hopper(hw * 0.98, 0.3, col.yBody - col.yCone, 3.3, grey);
                hp.rotation.x = Math.PI;
                hp.position.set(col.x + dx, col.yBody, 0);
                g.add(hp);
            }
            label('Dust Collector', 'dust_collector', col.x, col.yTop + 0.7, 0, { primary: true });
        }
        const fw = col.kind === 'cyclone' ? col.r * 2.3 : col.w + 0.3;
        const fd = col.kind === 'cyclone' ? col.r * 2.0 : 3.6;
        const struct = unit('collector_frame', null);
        for (const dx of [-fw / 2, fw / 2]) {
            for (const dz of [-fd / 2, fd / 2]) {
                struct.add(at(box(0.18, col.frameTop, 0.18, frame), col.x + dx, col.frameTop / 2, dz));
            }
            const h = Math.min(col.frameTop * 0.55, 6);
            const diag = Math.hypot(fd, h);
            for (const s of [1, -1]) {
                const br = box(0.08, diag, 0.08, frame);
                br.rotation.x = s * Math.atan2(fd, h);
                struct.add(at(br, col.x + dx, h / 2 + 0.6));
            }
        }
        for (const y of [col.frameTop * 0.35, col.frameTop]) {
            struct.add(at(box(fw, 0.14, 0.14, frame), col.x, y, fd / 2));
            struct.add(at(box(fw, 0.14, 0.14, frame), col.x, y, -fd / 2));
        }
    }

    L.airLocks.forEach((a, i) => {
        const id = `air_lock_${i + 1}`;
        const g = unit(id, 'dust_collector');
        const green = std(C.green);
        g.add(at(cylZ(0.3, 0.45, green), a.x, a.y));
        g.add(at(box(0.5, 0.12, 0.5, std(C.greenDark)), a.x, a.y + 0.33));
        g.add(at(box(0.5, 0.12, 0.5, std(C.greenDark)), a.x, a.y - 0.33));
    });

    const brick = brickTexture();
    disposables.push(brick);
    const frontGlass = new THREE.MeshPhysicalMaterial({
        color: '#bcd6ee',
        transparent: true,
        opacity: 0.08,
        roughness: 0.1,
        metalness: 0,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    {
        const g = unit('casing', null);
        const casing = std(C.casing, { roughness: 0.7, metalness: 0.1 });
        const brickMat = std('#ffffff', { map: brick, roughness: 0.9, metalness: 0 });
        const glass = frontGlass;
        const H = B.y1 - B.y0;
        const convW = B.xMid - B.x0;
        const furnW = B.x1 - B.xMid;
        g.add(at(box(convW, H, 0.15, casing), B.x0 + convW / 2, B.y0 + H / 2, -zF));
        const back = box(furnW, H, 0.15, brickMat);
        brick.repeat.set(furnW / 2.5, H / 2.5);
        g.add(at(back, B.xMid + furnW / 2, B.y0 + H / 2, -zF));
        g.add(at(box(0.15, H, D, casing), B.x0, B.y0 + H / 2));
        const roof = box(B.x1 - B.x0 + 0.3, 0.2, D + 0.2, std(C.steel, { metalness: 0.4 }));
        g.add(at(roof, (B.x0 + B.x1) / 2, B.y1 + 0.1));
        g.add(at(box(0.25, H * 0.72, D, brickMat), B.xMid, B.y0 + H * 0.36));
        const front = box(B.x1 - B.x0, H, 0.02, glass);
        front.castShadow = false;
        g.add(at(front, (B.x0 + B.x1) / 2, B.y0 + H / 2, zF));
        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(B.x1 - B.x0, H, D)),
            new THREE.LineBasicMaterial({ color: '#f2b25c', transparent: true, opacity: 0.55 })
        );
        g.add(at(edges, (B.x0 + B.x1) / 2, B.y0 + H / 2));
        for (let i = 0; i < 5; i++) {
            const x = B.xMid + 0.3 + (i * (furnW - 0.6)) / 4;
            g.add(at(box(0.12, 0.35, 0.12, std(C.frame)), x, B.y1 + 0.35, zF - 0.2));
        }
        const legMat = std(C.frame);
        for (const x of [B.x0 + 0.2, B.xMid, B.x1 - 0.2]) {
            for (const z of [-zF + 0.2, zF - 0.2]) {
                if (B.y0 > 0.3) g.add(at(box(0.3, B.y0, 0.3, legMat), x, B.y0 / 2, z));
            }
        }
    }

    {
        const g = unit('boiler_front', 'boiler_front');
        const H = B.y1 - B.y0;
        const brickMat = std('#ffffff', { map: brick, roughness: 0.9, metalness: 0 });
        g.add(at(box(0.3, H, D, brickMat), B.x1, B.y0 + H / 2));
        const doorY = Math.max(B.y0, (L.grate.y0 + L.grate.y1) / 2) + 1.0;
        g.add(at(box(0.12, 0.9, 1.1, std('#4a4f57', { metalness: 0.6 })), B.x1 + 0.2, doorY, 1.2));
        g.add(at(cylX(0.05, 0.25, std('#d0d4d9')), B.x1 + 0.32, doorY, 1.55));
        g.add(at(cylY(0.12, 1.1, std('#d9dde2', { metalness: 0.6 })), B.x1 + 0.32, doorY + 0.5, 0.45));
        const gauge = cylX(0.22, 0.08, std('#f2f2f2', { metalness: 0.1, roughness: 0.3 }));
        g.add(at(gauge, B.x1 + 0.2, doorY + 2.0, -0.8));
        label('Boiler Front Section', 'boiler_front', B.x1 + 0.2, B.y1 - 1.6, zF - 0.3, { primary: true });
    }

    {
        const g = unit('steam_drum', 'steam_drum');
        const sd = L.steamDrum;
        const shell = std(C.drum, { metalness: 0.6, roughness: 0.3 });
        g.add(at(cylZ(sd.r, D + 0.6, shell, 40), sd.x, sd.y));
        for (const s of [1, -1]) {
            const cap = mesh(new THREE.SphereGeometry(sd.r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell);
            cap.rotation.x = (s * Math.PI) / 2;
            cap.scale.y = 0.35;
            g.add(at(cap, sd.x, sd.y, s * (D / 2 + 0.3)));
        }
        for (const z of [-1.2, 0, 1.2]) {
            g.add(at(cylY(0.09, 0.45, std('#d33b2f')), sd.x - 0.2, sd.y + sd.r - 0.05, z));
            g.add(at(cylY(0.14, 0.12, std('#d33b2f')), sd.x - 0.2, sd.y + sd.r + 0.38, z));
        }
        g.add(at(box(0.12, 1.1, 0.1, std('#7ec8ff', { emissive: '#1b5d99', emissiveIntensity: 0.6 })), sd.x + sd.r * 0.7, sd.y - 0.2, D / 2 + 0.45));
        const red = std(C.red, { metalness: 0.35 });
        const outPts: Pt[] = [
            [sd.x + 0.2, sd.y + sd.r - 0.1, 0],
            [sd.x + 0.2, sd.y + sd.r + 1.0, 0],
            [sd.x + 2.4, sd.y + sd.r + 1.0, 0]
        ];
        g.add(pipe(outPts, 0.16, red, 0.35));
        const arrow = mesh(new THREE.ConeGeometry(0.28, 0.6, 20), red);
        arrow.rotation.z = -Math.PI / 2;
        g.add(at(arrow, sd.x + 2.7, sd.y + sd.r + 1.0));
        label('Steam Drum', 'steam_drum', sd.x - 0.4, sd.y + sd.r + 0.55, zF, { primary: true });
    }
    {
        const g = unit('water_drum', 'water_drum');
        const wd = L.waterDrum;
        const shell = std('#3ea0ea', { metalness: 0.45, roughness: 0.35 });
        g.add(at(cylZ(wd.r, D + 0.5, shell, 40), wd.x, wd.y));
        for (const s of [1, -1]) {
            const cap = mesh(new THREE.SphereGeometry(wd.r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell);
            cap.rotation.x = (s * Math.PI) / 2;
            cap.scale.y = 0.35;
            g.add(at(cap, wd.x, wd.y, s * (D / 2 + 0.25)));
        }
        g.add(at(cylY(0.07, 0.6, std(C.steelDark)), wd.x, wd.y - wd.r - 0.55, 1.5));
        g.add(at(box(0.3, 0.22, 0.22, std('#c23a2f')), wd.x, wd.y - wd.r - 0.6, 1.5));
        label('Water Drum', 'water_drum', wd.x, wd.y + wd.r + 0.25, zF, { primary: true });
    }

    {
        const g = unit('tubes', null);
        const sd = L.steamDrum;
        const wd = L.waterDrum;
        const red = std(C.red, { metalness: 0.3, roughness: 0.45 });
        const blue = std(C.blue, { metalness: 0.3, roughness: 0.45 });
        const zs = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8];
        const cols = [-0.55, -0.2, 0.15, 0.5];
        const geo = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);
        disposables.push(geo);
        const bank = new THREE.InstancedMesh(geo, red, cols.length * zs.length);
        const m4 = new THREE.Matrix4();
        let k = 0;
        const yA = wd.y + wd.r * 0.6;
        const yB = sd.y - sd.r * 0.6;
        for (const dx of cols) {
            for (const z of zs) {
                m4.compose(
                    new THREE.Vector3((sd.x + wd.x) / 2 + dx, (yA + yB) / 2, z),
                    new THREE.Quaternion(),
                    new THREE.Vector3(1, yB - yA, 1)
                );
                bank.setMatrixAt(k++, m4);
            }
        }
        bank.castShadow = true;
        g.add(bank);
        for (const z of [-1.8, -0.6, 0.6, 1.8]) {
            g.add(smoothTube([
                [sd.x - sd.r * 0.9, sd.y - 0.2, z],
                [B.x0 + 0.45, sd.y - 1.0, z],
                [B.x0 + 0.4, (sd.y + wd.y) / 2, z],
                [B.x0 + 0.5, wd.y + 0.7, z],
                [wd.x - wd.r * 0.9, wd.y, z]
            ], 0.07, blue));
        }
        for (const z of [-2.0, -1.2, -0.4, 0.4, 1.2, 2.0]) {
            g.add(smoothTube([
                [B.x1 - 0.35, Math.max(B.y0, L.grate.y1) + 0.4, z],
                [B.x1 - 0.35, B.y1 - 0.9, z],
                [B.x1 - 1.0, B.y1 - 0.35, z],
                [B.xMid + 0.4, B.y1 - 0.35, z],
                [sd.x + sd.r * 0.9, sd.y - 0.05, z]
            ], 0.065, red));
            g.add(smoothTube([
                [B.xMid + 0.25, Math.max(B.y0, L.grate.y0) + 0.3, z],
                [B.xMid + 0.25, B.y1 - 2.2, z],
                [(B.xMid + sd.x) / 2 + 0.6, sd.y - 0.6, z],
                [sd.x + sd.r * 0.7, sd.y - 0.4, z]
            ], 0.05, red));
        }
    }

    {
        const g = unit('hoppers', null);
        const mat = std('#9a8a74', { roughness: 0.8, metalness: 0.2 });
        L.hoppers.forEach((h) => {
            const hp = hopper(h.w, 0.3, h.h, D * 0.8, mat);
            hp.rotation.x = Math.PI;
            hp.position.set(h.x, h.yTop, 0);
            g.add(hp);
            g.add(at(cylY(0.12, 0.35, std(C.steelDark), 12), h.x, h.yTop - h.h - 0.35));
        });
    }

    const grateAnim: { obj: THREE.Object3D; base: THREE.Vector3; dir: THREE.Vector3; phase: number; amp: number; freq: number }[] = [];
    {
        const g = unit('grate', 'grate_section');
        const gr = L.grate;
        const len = Math.hypot(gr.x1 - gr.x0, gr.y1 - gr.y0);
        const ang = Math.atan2(gr.y1 - gr.y0, gr.x1 - gr.x0);
        const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
        const holder = new THREE.Group();
        holder.position.set((gr.x0 + gr.x1) / 2, (gr.y0 + gr.y1) / 2, 0);
        holder.rotation.z = ang;
        g.add(holder);
        const iron = std(C.iron, { metalness: 0.5, roughness: 0.6, emissive: '#5a1e05', emissiveIntensity: 0.35 });
        const width = D - 0.4;

        if (type === 'fixed' || type === 'fixed_water_cooled') {
            const n = 16;
            for (let i = 0; i < n; i++) {
                const z = -width / 2 + (i + 0.5) * (width / n);
                holder.add(at(box(len, 0.14, width / n - 0.05, iron), 0, 0, z));
            }
            for (const fx of [-0.45, 0, 0.45]) holder.add(at(box(0.16, 0.2, width, std(C.steelDark)), fx * len, -0.17));
            if (type === 'fixed_water_cooled') {
                const blue = std(C.blue, { metalness: 0.35 });
                for (let i = 0; i < 9; i++) {
                    const z = -width / 2 + (i + 0.5) * (width / 9);
                    holder.add(at(cylX(0.075, len, blue), 0, -0.14, z));
                }
                for (const fx of [-0.5, 0.5]) holder.add(at(cylZ(0.13, width + 0.2, blue), fx * len, -0.14));
                for (let i = 0; i < 11; i++) holder.add(at(mesh(new THREE.SphereGeometry(0.09, 12, 8), blue), -len / 2 + (i + 0.5) * (len / 11), 0.02, width / 2 + 0.05));
            }
        } else if (type === 'reciprocating') {
            const steps = 9;
            const stepL = len / steps;
            for (let i = 0; i < steps; i++) {
                const bar = box(stepL * 1.15, 0.2, width, iron);
                bar.position.set(-len / 2 + (i + 0.5) * stepL, (i % 2) * 0.05, 0);
                holder.add(bar);
                if (i % 2 === 0) grateAnim.push({ obj: bar, base: bar.position.clone(), dir: new THREE.Vector3(1, 0, 0), phase: 0, amp: stepL * 0.18, freq: 0.35 });
            }
            if (L.hydraulic) {
                const hp = L.hydraulic;
                g.add(at(cylX(0.38, 1.0, std(C.green)), hp.x, hp.y));
                g.add(at(box(1.1, 0.2, 0.9, std(C.steelDark)), hp.x, hp.y - 0.45));
                g.add(at(cylX(0.06, 1.4, std('#d9dde2', { metalness: 0.6 })), hp.x + 1.1, hp.y + 0.1));
            }
        } else {
            const deck = new THREE.Group();
            deck.add(box(len, 0.16, width, iron));
            for (let i = 0; i < 24; i++) deck.add(at(box(0.04, 0.02, width * 0.95, std('#ff8c3a', { emissive: '#ff6a00', emissiveIntensity: 0.6 })), -len / 2 + (i + 0.5) * (len / 24), 0.09));
            holder.add(deck);
            grateAnim.push({ obj: deck, base: deck.position.clone(), dir: new THREE.Vector3(1, 0.4, 0).normalize(), phase: 0, amp: 0.03, freq: 7 });
            for (let i = 0; i < 6; i++) {
                const spring = box(0.06, 0.6, width * 0.9, std(C.steelDark));
                spring.rotation.z = -0.35;
                holder.add(at(spring, -len / 2 + 0.4 + (i * (len - 0.8)) / 5, -0.38));
            }
        }
        label('Grate Section', 'grate', (gr.x0 + gr.x1) / 2, Math.max(gr.y0, gr.y1) + 0.35, zF - 0.2, { primary: true });

        const ash = std('#9b8f80', { roughness: 0.85, metalness: 0.15 });
        L.ashPits.forEach((p) => {
            const top = Math.min(gr.y0, gr.y1) - 0.25;
            const h = Math.max(0.6, top - 0.1);
            const hp = hopper(p.w, 0.35, h, D * 0.75, ash);
            hp.rotation.x = Math.PI;
            hp.position.set(p.x, top, 0);
            g.add(hp);
        });
        if (L.vgMotor) {
            motor(g, L.vgMotor.x, L.vgMotor.y, 0.8, 0.28);
        }
        if (L.conveyor) {
            const cv = L.conveyor;
            const trough = box(3.2, 0.5, 1.4, std(C.green, { roughness: 0.6 }));
            trough.rotation.z = 0.12;
            g.add(at(trough, cv.x, cv.y + 0.25));
            g.add(at(cylZ(0.3, 1.5, std(C.greenDark)), cv.x + 1.5, cv.y + 0.45));
        }
    }

    {
        const g = unit('fuel_supply', 'boiler_front');
        const f = L.fuel;
        const chute = std(C.chute, { roughness: 0.6, metalness: 0.25 });
        g.add(pipe([
            [f.x, f.yTop, 0],
            [f.x, f.yBend, 0],
            [B.x1 + 0.1, f.yIn, 0]
        ], 0.42, chute, 0.8));
        g.add(at(box(1.0, 0.8, 1.0, std(C.green)), f.x, f.yTop + 0.4));
        g.add(at(cylZ(0.28, 1.05, std(C.greenDark)), f.x, f.yTop + 0.4));
        const arr = mesh(new THREE.ConeGeometry(0.3, 0.55, 18), std('#e23b2e', { emissive: '#a01a10', emissiveIntensity: 0.4 }));
        arr.rotation.z = Math.PI;
        g.add(at(arr, f.x, f.yTop + 1.3));
        g.add(at(cylY(0.08, 0.5, std('#e23b2e')), f.x, f.yTop + 1.45));
    }

    const dot = dotTexture();
    const soft = dotTexture(true);
    const cloud = cloudTexture();
    disposables.push(dot, soft, cloud);

    const streams: Stream[] = [];
    function stream(kind: FlowKind, pts: Pt[], count: number, speed: number, size = 0.32, corner = 0.5, jitter = 0.05, color?: string) {
        const samples = sampled(elbowPath(pts, corner));
        streams.push({ kind, samples, color: new THREE.Color(color ?? FLOW_COLOR[kind]), count, speed, size, offset: Math.random(), jitter });
    }
    function curveStream(kind: FlowKind, pts: Pt[], count: number, speed: number, size: number, color?: string) {
        const c = new THREE.CatmullRomCurve3(pts.map(V), false, 'centripetal');
        streams.push({ kind, samples: sampled(c), color: new THREE.Color(color ?? FLOW_COLOR[kind]), count, speed, size, offset: Math.random(), jitter: 0 });
    }

    const sd = L.steamDrum;
    const wd = L.waterDrum;
    const gr = L.grate;
    const gyTop = Math.max(gr.y0, gr.y1);
    const gyLow = Math.min(gr.y0, gr.y1);
    const steamTip = new THREE.Vector3(sd.x + 3.0, sd.y + sd.r + 1.0, 0);
    {
        const col = L.collector;
        const fx = (B.xMid + B.x1) / 2;
        const colTop = col.yTop;
        const colInY = col.kind === 'cyclone' ? col.yTop - 0.9 : col.yTop - 2.0;
        const colX = col.x;
        const fanTop = L.idFan.y + L.idFan.r;

        for (const z of [-1.6, -0.6, 0.4, 1.4]) {
            stream('flue', [
                [fx, gyTop + 0.6, z],
                [fx, B.y1 - 1.0, z],
                [B.xMid - 0.3, B.y1 - 1.1, z],
                [B.xMid - 0.6, wd.y + 1.3, z * 0.6],
                [B.x0 + 1.0, wd.y + 1.0, z * 0.6],
                [B.x0 + 0.9, colInY, 0],
                [B.x0 - 0.3, colInY, 0],
                [colX + (col.kind === 'cyclone' ? col.r : col.w / 2) - 0.2, colInY, 0]
            ], 18, 0.05, 0.34, 0.9, 0.14);
        }
        const cleanStart: Pt[] = col.kind === 'cyclone'
            ? [[colX, colInY, 0], [colX - col.r * 0.4, colTop + 0.2, 0], [colX - col.r * 0.4, L.ductUpY, 0]]
            : [[colX, colInY, 0], [colX - col.w / 2 + 0.2, L.ductUpY, 0]];
        const fanX = col.kind === 'cyclone' ? L.idFan.x : L.idFan.x + 0.2;
        stream('flue', [
            ...cleanStart,
            [fanX, L.ductUpY, 0],
            [fanX, fanTop, 0],
            [L.idFan.x, L.idFan.y + L.idFan.r * 0.55, 0],
            [L.chimney.x, L.idFan.y + L.idFan.r * 0.55, 0],
            [L.chimney.x, 0.35 + L.chimney.h, 0]
        ], 40, 0.04, 0.28, 0.8, 0.08, '#d8b48a');

        const f = L.fuel;
        for (const z of [-0.25, 0.25]) {
            stream('fuel', [
                [f.x, f.yTop + 0.3, z],
                [f.x, f.yBend, z],
                [B.x1, f.yIn, z],
                [gr.x1 - 0.3, gyTop + 0.18, z * 4],
                [gr.x0 + 0.5, gyLow + 0.2, z * 6]
            ], 16, 0.06, 0.24, 0.7, 0.16);
        }

        const nAir = 7;
        for (let i = 0; i < nAir; i++) {
            const x = gr.x0 + 0.4 + (i * (gr.x1 - gr.x0 - 0.8)) / (nAir - 1);
            const y = gr.y0 + (x - gr.x0) * ((gr.y1 - gr.y0) / Math.max(0.001, gr.x1 - gr.x0));
            for (const z of [-1.2, 0.0, 1.2]) {
                stream('air', [[x + 0.3, Math.max(0.25, y - 1.6), z + 0.3], [x, y - 0.1, z], [x - 0.15, y + 0.9, z * 0.8]], 3, 0.32, 0.18, 0.3, 0.06);
            }
        }

        for (const z of [-1.8, -0.6, 0.6, 1.8]) {
            curveStream('water', [
                [sd.x - sd.r * 0.9, sd.y - 0.2, z],
                [B.x0 + 0.45, sd.y - 1.0, z],
                [B.x0 + 0.4, (sd.y + wd.y) / 2, z],
                [B.x0 + 0.5, wd.y + 0.7, z],
                [wd.x - wd.r * 0.9, wd.y, z]
            ], 9, 0.12, 0.2);
        }
        for (const z of [-2.0, -0.4, 1.2]) {
            curveStream('steam', [
                [B.x1 - 0.35, gyTop + 0.4, z],
                [B.x1 - 0.35, B.y1 - 0.9, z],
                [B.x1 - 1.0, B.y1 - 0.35, z],
                [B.xMid + 0.4, B.y1 - 0.35, z],
                [sd.x + sd.r * 0.9, sd.y - 0.05, z]
            ], 12, 0.1, 0.2);
        }
        const yA = wd.y + wd.r * 0.6;
        const yB = sd.y - sd.r * 0.6;
        for (const dx of [-0.55, -0.2, 0.15, 0.5]) {
            for (const z of [-1.2, 0, 1.2]) {
                const x = (sd.x + wd.x) / 2 + dx;
                stream('water', [[x, yA, z], [x, yB, z]], 4, 0.16 + Math.random() * 0.1, 0.13, 0.1, 0.02, '#cdeeff');
            }
        }
        stream('steam', [
            [sd.x + 0.2, sd.y + sd.r - 0.1, 0],
            [sd.x + 0.2, sd.y + sd.r + 1.0, 0],
            [steamTip.x, steamTip.y, 0]
        ], 14, 0.16, 0.24, 0.35, 0.0);
        if (type === 'fixed_water_cooled') {
            for (const z of [-1.5, 0, 1.5]) {
                stream('water', [[gr.x1, gr.y1 - 0.14, z], [gr.x0, gr.y0 - 0.14, z]], 8, 0.18, 0.16, 0.1, 0);
            }
        }
        L.ashPits.forEach((pit) => {
            for (const z of [-0.6, 0.6]) {
                stream('ash', [[pit.x + z * 0.3, gyLow - 0.1, z], [pit.x, 0.35, z * 0.6]], 4, 0.22, 0.16, 0.1, 0.22);
            }
        });
        const al = L.airLocks[L.airLocks.length - 1];
        stream('ash', [[colX, col.yCone, 0], [al.x, al.y, 0], [al.x, 0.1, 0]], 7, 0.2, 0.15, 0.2, 0.06);
    }

    const TAIL = 2;
    const flowCount = streams.reduce((a, s) => a + s.count, 0) * (TAIL + 1);
    const flows = new Particles(flowCount, dot, true);
    root.add(flows.points);

    const len = gr.x1 - gr.x0;
    const slope = (gr.y1 - gr.y0) / Math.max(0.001, len);
    const bedY = (x: number) => gr.y0 + (x - gr.x0) * slope + 0.12;
    const flameTop = Math.min(B.y1 - 1.5, gyTop + (B.y1 - B.y0) * 0.55);
    const fireW = D - 0.8;

    const ember = emberTexture();
    disposables.push(ember);
    ember.repeat.set(Math.max(1, len / 2.5), 1);
    const bedMat = new THREE.MeshStandardMaterial({ color: '#2a1208', emissive: '#ffffff', emissiveMap: ember, emissiveIntensity: 1.2, roughness: 1, metalness: 0 });
    {
        const holder = new THREE.Group();
        holder.position.set((gr.x0 + gr.x1) / 2, (gr.y0 + gr.y1) / 2 + 0.1, 0);
        holder.rotation.z = Math.atan2(gr.y1 - gr.y0, len);
        const bed = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(len, gr.y1 - gr.y0) - 0.2, fireW + 0.3), bedMat);
        bed.rotation.x = -Math.PI / 2;
        holder.add(bed);
        root.add(holder);
    }

    const TONGUES = 12;
    const tongues = Array.from({ length: TONGUES }, (_, i) => ({
        x: gr.x0 + 0.35 + ((i + 0.5) / TONGUES) * (len - 0.7) + (Math.random() - 0.5) * 0.3,
        z: (Math.random() - 0.5) * fireW,
        h: 0.55 + Math.random() * 0.45,
        seed: Math.random() * 10
    }));
    const FLAME = 300;
    const GLOW = 46;
    const fire = new Particles(FLAME + GLOW, soft, true);
    root.add(fire.points);
    type Flame = { life: number; speed: number; t: number; dx: number; dz: number; seed: number };
    const flames: Flame[] = Array.from({ length: FLAME }, () => ({ life: Math.random(), speed: 1, t: 0, dx: 0, dz: 0, seed: 0 }));
    const resetFlame = (s: Flame) => {
        s.t = Math.floor(Math.random() * TONGUES);
        s.dx = (Math.random() - 0.5) * 0.9;
        s.dz = (Math.random() - 0.5) * 0.9;
        s.speed = 0.7 + Math.random() * 0.7;
        s.seed = Math.random() * 10;
    };
    flames.forEach(resetFlame);
    const glows = Array.from({ length: GLOW }, () => ({ x: gr.x0 + Math.random() * len, z: (Math.random() - 0.5) * fireW, seed: Math.random() * 10 }));

    const EMBERS = 90;
    const embers = new Particles(EMBERS, dot, true);
    root.add(embers.points);
    type Ember = { life: number; dur: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; seed: number };
    const emberState: Ember[] = Array.from({ length: EMBERS }, () => ({ life: Math.random(), dur: 2, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, seed: 0 }));
    const resetEmber = (e: Ember) => {
        e.x = gr.x0 + 0.3 + Math.random() * (len - 0.6);
        e.z = (Math.random() - 0.5) * fireW;
        e.y = bedY(e.x);
        e.vx = (Math.random() - 0.5) * 0.5;
        e.vz = (Math.random() - 0.5) * 0.4;
        e.vy = 1.4 + Math.random() * 2.2;
        e.dur = 1.2 + Math.random() * 1.8;
        e.seed = Math.random() * 10;
    };
    emberState.forEach((e) => {
        resetEmber(e);
        e.y += e.vy * e.life * e.dur * 0.6;
    });

    const fireLight = new THREE.PointLight('#ff7a1a', 30, 9, 1.6);
    fireLight.position.set((gr.x0 + gr.x1) / 2, gyTop + 1.4, 0.5);
    root.add(fireLight);
    const fireLight2 = new THREE.PointLight('#ff9a3a', 14, 7, 1.8);
    fireLight2.position.set(gr.x0 + len * 0.25, gyTop + 0.8, -0.8);
    root.add(fireLight2);

    const SMOKE = 130;
    const smoke = new Particles(SMOKE, cloud, false);
    root.add(smoke.points);
    const smokeState = Array.from({ length: SMOKE }, (_, i) => ({ life: i / SMOKE, seed: Math.random() * 10, spin: (Math.random() - 0.5) * 1.6 }));
    const stackTop = new THREE.Vector3(L.chimney.x, 0.35 + L.chimney.h + 0.1, 0);

    const PLUME = 46;
    const plume = new Particles(PLUME, cloud, false);
    root.add(plume.points);
    const plumeState = Array.from({ length: PLUME }, (_, i) => ({ life: i / PLUME, seed: Math.random() * 10, spin: (Math.random() - 0.5) * 2 }));

    for (const u of units.values()) {
        if (!u.section) continue;
        u.object.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.userData.unitId = u.id;
            m.userData.section = u.section;
            const src = m.material as THREE.MeshStandardMaterial;
            if (src && (src as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const own = src.clone();
                own.userData.baseEmissive = own.emissive.clone();
                own.userData.baseIntensity = own.emissiveIntensity;
                m.material = own;
                pickables.push(m);
            }
        });
    }

    const HL = new THREE.Color('#2f8fff');
    const HL_STRONG = new THREE.Color('#3aa0ff');
    function setHighlight(sections: Set<string>, strong: Set<string>) {
        for (const m of pickables) {
            const mat = m.material as THREE.MeshStandardMaterial;
            const key = m.userData.section as string;
            if (strong.has(key)) {
                mat.emissive.copy(HL_STRONG);
                mat.emissiveIntensity = 0.3;
            } else if (sections.has(key)) {
                mat.emissive.copy(HL);
                mat.emissiveIntensity = 0.18;
            } else {
                mat.emissive.copy(mat.userData.baseEmissive as THREE.Color);
                mat.emissiveIntensity = mat.userData.baseIntensity as number;
            }
        }
    }

    function unitBounds(unitId: string): THREE.Box3 {
        const u = units.get(unitId);
        const b = new THREE.Box3();
        if (!u) return b;
        u.object.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) b.expandByObject(m);
        });
        return b;
    }

    function sectionBounds(key: string): THREE.Box3 {
        const b = new THREE.Box3();
        for (const u of units.values()) if (u.section === key) b.union(unitBounds(u.id));
        return b;
    }

    const bounds = new THREE.Box3();
    for (const u of units.values()) bounds.union(unitBounds(u.id));
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);
    root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!(m.isMesh || (o as THREE.LineSegments).isLineSegments)) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) if (mat && !(mat as THREE.ShaderMaterial).isShaderMaterial) mat.clippingPlanes = [clipPlane];
    });
    function setClip(mode: ClipMode, t: number) {
        const k = Math.max(0, Math.min(1, t));
        if (k <= 0) {
            clipPlane.constant = 1e5;
            return;
        }
        if (mode === 'front') {
            clipPlane.normal.set(0, 0, -1);
            clipPlane.constant = bounds.max.z + 0.05 - k * (bounds.max.z - bounds.min.z);
        } else {
            clipPlane.normal.set(0, -1, 0);
            clipPlane.constant = bounds.max.y + 0.05 - k * (bounds.max.y - 0.3);
        }
    }
    const isVisiblePoint = (p: THREE.Vector3) => clipPlane.distanceToPoint(p) >= 0;

    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const boxFill = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(boxEdges, boxFill);
    const sectionBoxes = new Map<string, { group: THREE.Group; line: THREE.LineBasicMaterial; fill: THREE.MeshBasicMaterial }>();
    for (const key of Object.keys(SECTION_COLORS)) {
        const b = sectionBounds(key);
        if (b.isEmpty()) continue;
        b.expandByScalar(0.18);
        const color = SECTION_COLORS[key];
        const line = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7, depthTest: false });
        const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.04, depthWrite: false });
        const g = new THREE.Group();
        const l = new THREE.LineSegments(boxEdges, line);
        l.renderOrder = 20;
        g.add(l, new THREE.Mesh(boxFill, fill));
        b.getCenter(g.position);
        b.getSize(g.scale);
        g.visible = false;
        root.add(g);
        sectionBoxes.set(key, { group: g, line, fill });
    }
    function setSectionBoxes(on: boolean, selected: string | null) {
        for (const [key, b] of sectionBoxes) {
            b.group.visible = on;
            const sel = key === selected;
            b.line.opacity = sel ? 1 : selected ? 0.35 : 0.7;
            b.fill.opacity = sel ? 0.1 : 0.04;
        }
    }

    const glassColor = new THREE.Color('#bcd6ee');
    const solidColor = new THREE.Color(C.casing);
    function setSeeThrough(on: boolean) {
        frontGlass.color.copy(on ? glassColor : solidColor);
        frontGlass.opacity = on ? 0.08 : 1;
        frontGlass.transparent = on;
        frontGlass.depthWrite = !on;
        frontGlass.roughness = on ? 0.1 : 0.7;
        frontGlass.needsUpdate = true;
    }

    const flowOn: Record<FlowKind, boolean> = { fuel: true, flame: true, flue: true, air: true, water: true, steam: true, ash: true };
    function setFlowVisible(kind: FlowKind, on: boolean) {
        flowOn[kind] = on;
        if (kind === 'flame') {
            fireLight.visible = fireLight2.visible = on;
            if (!on) {
                fire.hide();
                embers.hide();
            }
            bedMat.emissiveIntensity = on ? 1.2 : 0.35;
        }
        if (kind === 'flue' && !on) smoke.hide();
        if (kind === 'steam' && !on) plume.hide();
    }

    let dark = true;
    const smokeNear = new THREE.Color();
    const smokeFar = new THREE.Color();
    const plumeCol = new THREE.Color();
    function setTheme(isDark: boolean) {
        dark = isDark;
        flows.setAdditive(isDark);
        smokeNear.set(isDark ? '#6f757c' : '#8d949c');
        smokeFar.set(isDark ? '#c9cfd6' : '#c3c9d0');
        plumeCol.set(isDark ? '#eef6ff' : '#b9c7d6');
    }
    setTheme(true);

    const tmp = new THREE.Vector3();
    const cFire = [new THREE.Color('#fff6d0'), new THREE.Color('#ffc240'), new THREE.Color('#ff7a1a'), new THREE.Color('#d8340c'), new THREE.Color('#4a1206')];
    const cGlow = new THREE.Color('#ff6a18');
    const cTmp = new THREE.Color();
    const cEmber = new THREE.Color();
    const tailCol = new THREE.Color();

    tickers.push((t) => {
        for (const imp of fanImpellers) imp.rotation.z = -t * 9;
        for (const a of grateAnim) {
            const s = Math.sin(t * a.freq * Math.PI * 2 + a.phase);
            a.obj.position.copy(a.base).addScaledVector(a.dir, s * a.amp);
        }
        ember.offset.x = (t * 0.015) % 1;
        if (flowOn.flame) bedMat.emissiveIntensity = 1.05 + Math.sin(t * 5.3) * 0.18 + Math.sin(t * 13.1) * 0.08;
    });

    function update(time: number, dt: number, pixelScale: number) {
        dt = Math.max(0, dt);
        for (const tk of tickers) tk(time, dt);

        let i = 0;
        for (const s of streams) {
            const on = flowOn[s.kind];
            const pathLen = s.samples.length;
            const step = 0.9 / Math.max(8, pathLen);
            for (let k = 0; k < s.count; k++) {
                const u0 = s.offset + k / s.count + time * s.speed;
                for (let j = 0; j <= TAIL; j++) {
                    if (!on) {
                        flows.alpha[i++] = 0;
                        continue;
                    }
                    const u = u0 - j * step * (s.speed > 0.1 ? 1.6 : 1);
                    sampleAt(s.samples, u, tmp);
                    if (s.jitter) {
                        tmp.x += Math.sin(k * 12.9 + time * 2) * s.jitter;
                        tmp.y += Math.cos(k * 7.3 + time * 2.3) * s.jitter;
                        tmp.z += Math.sin(k * 3.1 + time * 1.7) * s.jitter;
                    }
                    const frac = ((u % 1) + 1) % 1;
                    const fade = Math.min(1, frac * 8, (1 - frac) * 8);
                    const tailK = 1 - j / (TAIL + 1);
                    const pulse = 0.9 + 0.1 * Math.sin(time * 6 + k * 1.7);
                    tailCol.copy(s.color);
                    if (s.kind === 'ash' && !dark) tailCol.multiplyScalar(0.7);
                    flows.set(i++, tmp, tailCol, s.size * (0.55 + 0.45 * tailK) * pulse, (dark ? 0.9 : 0.85) * fade * tailK * tailK);
                }
            }
        }
        flows.commit(pixelScale);

        if (flowOn.flame) {
            for (let k = 0; k < FLAME; k++) {
                const s = flames[k];
                s.life += dt * s.speed * 0.85;
                if (s.life >= 1) {
                    s.life -= 1;
                    resetFlame(s);
                }
                const l = Math.min(0.999, Math.max(0, s.life));
                const tg = tongues[s.t];
                const floor = bedY(tg.x);
                const top = floor + (flameTop - floor) * tg.h;
                const y = floor + l * (top - floor);
                const taper = 1 - l * 0.75;
                const sway = Math.sin(time * 2.3 + tg.seed + l * 2.5) * 0.35 * l + Math.sin(time * 7 + s.seed) * 0.06;
                tmp.set(tg.x + s.dx * taper + sway, y, tg.z + s.dz * taper + Math.cos(time * 1.9 + tg.seed) * 0.2 * l);
                const ci = Math.min(3.999, l * 4);
                const ia = Math.floor(ci);
                cTmp.copy(cFire[ia]).lerp(cFire[ia + 1], ci - ia);
                const flick = 0.85 + 0.25 * Math.sin(time * 11 + s.seed * 3);
                const size = (1.25 - l * 0.75) * flick;
                const alpha = Math.pow(Math.sin(Math.PI * Math.min(1, l * 1.1)), 0.8) * (0.75 - l * 0.25);
                fire.set(k, tmp, cTmp, size, alpha);
            }
            for (let k = 0; k < GLOW; k++) {
                const g = glows[k];
                tmp.set(g.x, bedY(g.x) + 0.25 + Math.sin(time * 3 + g.seed) * 0.08, g.z);
                fire.set(FLAME + k, tmp, cGlow, 1.6 + Math.sin(time * 4 + g.seed) * 0.3, 0.16 + Math.sin(time * 6.5 + g.seed) * 0.05);
            }
            fire.commit(pixelScale);

            for (let k = 0; k < EMBERS; k++) {
                const e = emberState[k];
                e.life += dt / e.dur;
                if (e.life >= 1) {
                    e.life = 0;
                    resetEmber(e);
                }
                e.vx += Math.sin(time * 3 + e.seed) * 0.8 * dt;
                e.vy *= 1 - 0.35 * dt;
                e.x += e.vx * dt;
                e.y = Math.min(flameTop + 1.2, e.y + e.vy * dt);
                e.z += e.vz * dt;
                tmp.set(e.x, e.y, e.z);
                const tw = 0.6 + 0.4 * Math.sin(time * 25 + e.seed * 7);
                cEmber.setRGB(1, 0.55 + 0.35 * (1 - e.life), 0.15 * (1 - e.life));
                embers.set(k, tmp, cEmber, 0.09 + 0.06 * (1 - e.life), (1 - e.life) * tw);
            }
            embers.commit(pixelScale);
            fireLight.intensity = 26 + Math.sin(time * 13) * 5 + Math.sin(time * 7.3) * 3 + Math.sin(time * 23) * 1.5;
            fireLight2.intensity = 12 + Math.sin(time * 9.1 + 1) * 3 + Math.sin(time * 17) * 1.5;
        }

        if (flowOn.flue) {
            for (let k = 0; k < SMOKE; k++) {
                const s = smokeState[k];
                s.life += dt * 0.16;
                if (s.life >= 1) {
                    s.life -= 1;
                    s.seed = Math.random() * 10;
                }
                const l = s.life;
                const rise = 1 - Math.pow(1 - l, 1.6);
                tmp.set(
                    stackTop.x + l * l * 3.2 + Math.sin(time * 0.7 + s.seed) * 0.45 * l + Math.sin(time * 1.9 + s.seed * 2) * 0.12,
                    stackTop.y + rise * 7.5,
                    Math.cos(time * 0.55 + s.seed) * 0.55 * l
                );
                cTmp.copy(smokeNear).lerp(smokeFar, Math.min(1, l * 1.4));
                const a = Math.min(1, l * 10) * Math.pow(1 - l, 1.3) * (dark ? 0.55 : 0.42);
                smoke.set(k, tmp, cTmp, 0.8 + rise * 5.2, a, s.seed + time * s.spin * 0.3);
            }
            smoke.commit(pixelScale);
        }

        if (flowOn.steam) {
            for (let k = 0; k < PLUME; k++) {
                const s = plumeState[k];
                s.life += dt * 0.45;
                if (s.life >= 1) {
                    s.life -= 1;
                    s.seed = Math.random() * 10;
                }
                const l = s.life;
                tmp.set(
                    steamTip.x + 0.3 + l * 1.6 + Math.sin(time * 1.3 + s.seed) * 0.15 * l,
                    steamTip.y + l * l * 2.2,
                    Math.cos(time + s.seed) * 0.3 * l
                );
                plume.set(k, tmp, plumeCol, 0.35 + l * 2.2, Math.min(1, l * 8) * (1 - l) * 0.5, s.seed + time * s.spin * 0.4);
            }
            plume.commit(pixelScale);
        }
    }

    function dispose() {
        root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
        });
        for (const d of disposables) d.dispose();
    }

    return {
        root,
        pickables,
        units,
        labels,
        fireLight,
        bounds,
        setHighlight,
        unitBounds,
        sectionBounds,
        setFlowVisible,
        setClip,
        isVisiblePoint,
        setSectionBoxes,
        setSeeThrough,
        setTheme,
        update,
        dispose
    };
}