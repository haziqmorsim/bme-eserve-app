import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PI = Math.PI;
export const DEG = PI / 180;

export type Built = { g: THREE.Group; tick?: (t: number) => void };
export type Kit = ReturnType<typeof makeKit>;

export function makeKit() {
    const textures: THREE.Texture[] = [];
    const mats: THREE.Material[] = [];
    const cad = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.08, ...o });
        mats.push(m);
        return m;
    };
    // four greys, light to dark, plus glass
    const L1 = cad('#c9ced4'); // main body
    const L2 = cad('#b0b7bf'); // second piece (castings, covers)
    const L3 = cad('#79828b'); // dark plastics, motors, knobs
    const D = cad('#41474d', { roughness: 0.85 }); // holes, gaps, screens
    const glass = new THREE.MeshStandardMaterial({
        color: '#eef3f7',
        transparent: true,
        opacity: 0.32,
        roughness: 0.08,
        metalness: 0,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    mats.push(glass);
    // names kept from the coloured version so builders read naturally
    const MT = {
        steel: L1,
        stainless: L1,
        alu: L1,
        white: L1,
        beige: L1,
        grey: L2,
        brass: L2,
        cast: L2,
        iron: L2,
        blue: L2,
        green: L2,
        red: L2,
        orange: L2,
        yellow: L2,
        dark: L3,
        black: L3,
        rubber: L3,
        hole: D,
        screen: D,
        redGlow: L3,
        greenGlow: L2
    };

    /** A flat greyscale face painted on a canvas (gauge dials, scales). */
    function painted(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const g = cv.getContext('2d');
        if (g) draw(g, w, h);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        textures.push(tex);
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0 });
        mats.push(m);
        return m;
    }

    return { MT, L1, L2, L3, D, glass, cad, painted, textures, mats };
}

// ---------------------------------------------------------------- meshes

export function M(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function G(...objs: THREE.Object3D[]): THREE.Group {
    const g = new THREE.Group();
    for (const o of objs) g.add(o);
    return g;
}

/** Place an object and return it (for one-liners). */
export function at<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    return o;
}

/** Cylinder along y. */
export const C = (rTop: number, rBot: number, h: number, seg = 40, open = false) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
export const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const RB = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
export const T = (r: number, t: number, seg = 48) => new THREE.TorusGeometry(r, t, 14, seg);
export const hex = (r: number, h: number) => C(r, r, h, 6);
export const sphere = (r: number) => new THREE.SphereGeometry(r, 40, 24);

/** Lathe a profile of [radius, y] points round the y axis. */
export function lathe(pts: [number, number][], seg = 64): THREE.BufferGeometry {
    return new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        seg
    );
}

/** Flat ring (washer, bearing race) with its axis along y. */
export function ring(ro: number, ri: number, h: number, seg = 56): THREE.BufferGeometry {
    return lathe([[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2], [ri, -h / 2]], seg);
}

export type V3 = [number, number, number];

export function tubeAlong(pts: V3[], r: number, radial = 14, tension: 'centripetal' | 'chordal' | 'catmullrom' = 'centripetal'): THREE.BufferGeometry {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, tension);
    return new THREE.TubeGeometry(curve, Math.max(48, pts.length * 16), r, radial, false);
}

export function helix(r: number, pitch: number, turns: number, y0: number): V3[] {
    const out: V3[] = [];
    for (let i = 0; i <= turns * 32; i++) {
        const a = (i / 32) * PI * 2;
        out.push([Math.cos(a) * r, y0 + (i / 32) * pitch, Math.sin(a) * r]);
    }
    return out;
}

// ---------------------------------------------------------------- 2D outlines

export function poly(pts: [number, number][]): THREE.Shape {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
}

export function circlePath(x: number, y: number, r: number): THREE.Path {
    const p = new THREE.Path();
    p.absarc(x, y, r, 0, PI * 2, true);
    return p;
}

export function rectPath(x0: number, y0: number, x1: number, y1: number): THREE.Path {
    const p = new THREE.Path();
    p.moveTo(x0, y0);
    p.lineTo(x0, y1);
    p.lineTo(x1, y1);
    p.lineTo(x1, y0);
    p.closePath();
    return p;
}

/** Slot (stadium) of length l and width w centred at x, y; horizontal unless vertical. */
export function slotPath(x: number, y: number, l: number, w: number, vertical = false): THREE.Path {
    const p = new THREE.Path();
    const r = w / 2;
    const h = Math.max(0, l / 2 - r);
    if (vertical) {
        p.absarc(x, y + h, r, 0, PI, false);
        p.absarc(x, y - h, r, PI, PI * 2, false);
    } else {
        p.absarc(x + h, y, r, -PI / 2, PI / 2, false);
        p.absarc(x - h, y, r, PI / 2, PI * 1.5, false);
    }
    p.closePath();
    return p;
}

/** Rounded rectangle outline. */
export function roundRect(w: number, h: number, r: number): THREE.Shape {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}

/** Extrude an outline (x, y) through z, centred on z = 0. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0, curveSegments = 24): THREE.BufferGeometry {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: bevel > 0,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 2,
        curveSegments
    });
    g.translate(0, 0, -depth / 2);
    return g;
}

/** A plate lying flat (in x-z), thickness along y, from an outline drawn in x, z. */
export function flatPlate(shape: THREE.Shape, t: number, mat: THREE.Material, y = 0, bevel = 0): THREE.Mesh {
    // outline y becomes -z after laying it down, so the outline is drawn as seen from above
    return M(extrude(shape, t, bevel), mat, 0, y, 0, -PI / 2, 0, 0);
}

// ---------------------------------------------------------------- fasteners and flanges

/** Ring of hex bolt heads on a face whose normal is +z (dir 1) or -z (dir -1). */
export function boltsZ(g: THREE.Object3D, k: Kit, n: number, r: number, z: number, size = 0.07, dir = 1, phase = PI / n, x = 0, y = 0) {
    for (let i = 0; i < n; i++) {
        const a = phase + (i / n) * PI * 2;
        g.add(M(hex(size, size * 0.9), k.L3, x + Math.cos(a) * r, y + Math.sin(a) * r, z + dir * size * 0.45, PI / 2));
    }
}

/** Pipe flange (axis along x) at x, with a bolt circle. */
export function flangeX(g: THREE.Object3D, k: Kit, x: number, r: number, t: number, mat: THREE.Material, dir = 1, y = 0, z = 0, bolts = 8) {
    const f = G(M(C(r, r, t, 48), mat, 0, 0, 0, 0, 0, PI / 2));
    const s = Math.max(0.035, r * 0.1);
    for (let i = 0; i < bolts; i++) {
        const a = PI / bolts + (i / bolts) * PI * 2;
        f.add(M(hex(s, s * 0.9), k.L3, dir * (t / 2 + s * 0.45), Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 0, 0, PI / 2));
    }
    f.add(M(C(r * 0.45, r * 0.45, t + 0.004, 32), k.D, 0, 0, 0, 0, 0, PI / 2));
    f.position.set(x, y, z);
    g.add(f);
    return f;
}

/** Flange facing up (dir 1) or down (dir -1), axis along y. */
export function flangeY(g: THREE.Object3D, k: Kit, y: number, r: number, t: number, mat: THREE.Material, dir = 1, x = 0, z = 0, bolts = 8) {
    const f = G(M(C(r, r, t, 48), mat));
    const s = Math.max(0.035, r * 0.1);
    for (let i = 0; i < bolts; i++) {
        const a = PI / bolts + (i / bolts) * PI * 2;
        f.add(M(hex(s, s * 0.9), k.L3, Math.cos(a) * r * 0.78, dir * (t / 2 + s * 0.45), Math.sin(a) * r * 0.78));
    }
    f.position.set(x, y, z);
    g.add(f);
    return f;
}

/** Handwheel lying flat (axis y). */
export function handwheel(k: Kit, r: number): THREE.Group {
    const w = G(M(T(r, r * 0.08), k.L2, 0, 0, 0, PI / 2), M(C(r * 0.18, r * 0.18, r * 0.25, 20), k.L2));
    for (let i = 0; i < 5; i++) w.add(M(B(r, r * 0.07, r * 0.09), k.L2, (Math.cos((i * 2 * PI) / 5) * r) / 2, 0, (Math.sin((i * 2 * PI) / 5) * r) / 2, 0, -(i * 2 * PI) / 5, 0));
    return w;
}

/** Knurled knob (axis y): a cylinder ringed with small ribs. */
export function knob(k: Kit, r: number, h: number, ribs = 24, mat?: THREE.Material): THREE.Group {
    const m = mat ?? k.L3;
    const g = G(M(C(r * 0.96, r * 0.96, h, 40), m));
    for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * PI * 2;
        g.add(M(B(r * 0.1, h * 0.96, r * 0.12), m, Math.cos(a) * r * 0.97, 0, Math.sin(a) * r * 0.97, 0, -a, 0));
    }
    return g;
}

/** Thread look: a row of thin rings along y. */
export function thread(k: Kit, r: number, h: number, mat?: THREE.Material): THREE.Group {
    const m = mat ?? k.L1;
    const g = G(M(C(r * 0.94, r * 0.94, h, 32), m));
    const n = Math.max(3, Math.round(h / (r * 0.18)));
    for (let i = 0; i < n; i++) g.add(M(T(r * 0.95, r * 0.05, 32), m, 0, -h / 2 + ((i + 0.5) * h) / n, 0, PI / 2));
    return g;
}

/** Push-in tube fitting pointing along +y. */
export function fitting(k: Kit, r: number): THREE.Group {
    return G(M(hex(r * 1.15, r * 0.7), k.L2, 0, r * 0.35), M(C(r, r, r * 1.1, 24), k.L2, 0, r * 1.25), M(C(r * 1.05, r * 1.05, r * 0.35, 24), k.L3, 0, r * 1.95), M(C(r * 0.45, r * 0.45, r * 0.4, 16), k.D, 0, r * 2.0));
}

// ---------------------------------------------------------------- dials

/** Greyscale gauge dial: ticks and numbers in an arc. */
export function dialFace(k: Kit, unit: string, max: number, opts: { sub?: boolean } = {}) {
    return k.painted(512, 512, (g, w) => {
        const c = w / 2;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, w);
        g.strokeStyle = '#30363c';
        g.fillStyle = '#30363c';
        const R = w * 0.43;
        const at2 = (a: number, r: number) => [c + Math.sin(a) * r, c - Math.cos(a) * r];
        const a0 = -135 * DEG;
        const span = 270 * DEG;
        for (let i = 0; i <= 50; i++) {
            const a = a0 + (i / 50) * span;
            const major = i % 5 === 0;
            const [x1, y1] = at2(a, R);
            const [x2, y2] = at2(a, R - (major ? 36 : 18));
            g.lineWidth = major ? 5 : 2;
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke();
            if (major) {
                const [tx, ty] = at2(a, R - 66);
                g.font = 'bold 34px Arial, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                const v = (i / 50) * max;
                g.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), tx, ty);
            }
        }
        if (opts.sub) {
            // second (inner) scale, as on dual-unit gauges
            g.strokeStyle = '#8a9198';
            g.lineWidth = 2;
            g.beginPath();
            g.arc(c, c, R * 0.55, a0 - PI / 2, a0 + span - PI / 2);
            g.stroke();
        }
        g.font = 'bold 40px Arial, sans-serif';
        g.fillStyle = '#30363c';
        g.fillText(unit, c, c + R * 0.45);
    });
}

/** Straight vertical scale (edgewise draft gauges). */
export function stripScale(k: Kit, labels: string[]) {
    return k.painted(256, 512, (g, w, h) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#30363c';
        g.fillStyle = '#30363c';
        const n = (labels.length - 1) * 5;
        for (let i = 0; i <= n; i++) {
            const y = 40 + (i / n) * (h - 80);
            const major = i % 5 === 0;
            g.lineWidth = major ? 5 : 2;
            g.beginPath();
            g.moveTo(w * 0.15, y);
            g.lineTo(w * (major ? 0.55 : 0.4), y);
            g.stroke();
            if (major) {
                g.font = 'bold 40px Arial, sans-serif';
                g.textAlign = 'right';
                g.textBaseline = 'middle';
                g.fillText(labels[i / 5], w * 0.92, y);
            }
        }
    });
}

/**
 * Outline the hard edges of every mesh in dark grey.
 * Returns the line material so the viewer can adjust it for the theme.
 */
export function outline(root: THREE.Object3D, k: Kit, angle = 32): THREE.LineBasicMaterial {
    const mat = new THREE.LineBasicMaterial({ color: '#252a30', transparent: true, opacity: 0.7, depthWrite: false });
    k.mats.push(mat);
    const cache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material !== k.glass) meshes.push(m);
    });
    for (const m of meshes) {
        if (m.geometry.attributes.position.count > 20000) continue;
        let eg = cache.get(m.geometry);
        if (!eg) {
            eg = new THREE.EdgesGeometry(m.geometry, angle);
            cache.set(m.geometry, eg);
        }
        const line = new THREE.LineSegments(eg, mat);
        line.raycast = () => {};
        m.add(line);
    }
    return mat;
}