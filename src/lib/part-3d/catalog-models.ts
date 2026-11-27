import * as THREE from 'three';
import {
    B,
    C,
    DEG,
    G,
    M,
    PI,
    RB,
    T,
    at,
    boltsZ,
    circlePath,
    dialFace,
    extrude,
    fitting,
    flangeX,
    flangeY,
    flatPlate,
    handwheel,
    helix,
    hex,
    knob,
    lathe,
    poly,
    rectPath,
    ring,
    roundRect,
    slotPath,
    sphere,
    stripScale,
    thread,
    tubeAlong,
    type Built,
    type Kit,
    type V3
} from './cad-kit';

// =====================================================================
// Instruments: transmitters, level switches, gauges
// =====================================================================

/** Yokogawa EJA-E transmitter with its mounting bracket and flange adapters. */
function yokogawaTransmitter(k: Kit, gaugeOnly: boolean): Built {
    const g = new THREE.Group();
    const tx = new THREE.Group();
    // amplifier housing (axis front-back) with display cover in front, terminal cover behind
    const hy = 1.15;
    tx.add(M(C(0.55, 0.55, 0.9, 48), k.L2, 0, hy, 0, PI / 2));
    for (const s of [1, -1]) {
        tx.add(M(C(0.6, 0.6, 0.2, 48), k.L2, 0, hy, s * 0.55, PI / 2));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * PI * 2;
            tx.add(M(B(0.08, 0.06, 0.2), k.L2, Math.cos(a) * 0.62, hy + Math.sin(a) * 0.62, s * 0.55, 0, 0, a));
        }
    }
    tx.add(M(new THREE.CircleGeometry(0.42, 48), k.D, 0, hy, 0.652));
    tx.add(M(new THREE.CircleGeometry(0.44, 48), k.glass, 0, hy, 0.66));
    tx.add(M(C(0.3, 0.3, 0.04, 32), k.L2, 0, hy, -0.665, PI / 2));
    // conduit entries: blind plug on one side, dust cap on the other
    for (const s of [1, -1]) {
        tx.add(M(C(0.17, 0.19, 0.3, 28), k.L2, s * 0.65, hy - 0.05, 0, 0, 0, PI / 2));
        tx.add(M(s > 0 ? C(0.2, 0.2, 0.14, 28) : hex(0.15, 0.12), s > 0 ? k.L3 : k.L1, s * 0.86, hy - 0.05, 0, 0, 0, PI / 2));
    }
    tx.add(M(C(0.08, 0.08, 0.12, 16), k.L2, 0, hy + 0.6, 0.2));
    // neck, then the capsule with its stainless nameplate band
    tx.add(M(C(0.26, 0.3, 0.32, 32), k.L2, 0, 0.47, 0));
    tx.add(M(C(0.46, 0.46, 0.62, 48), k.L1, 0, 0, 0, 0, 0, PI / 2));
    tx.add(M(C(0.465, 0.465, 0.4, 48, true), k.L2, 0, 0, 0, 0, 0, PI / 2));
    // process cover flanges, bolted through, with vent plugs and process ports
    const sides = gaugeOnly ? [1] : [1, -1];
    for (const s of [1, -1]) {
        const x = s * 0.45;
        tx.add(M(RB(0.24, 0.98, 0.92, 0.04), k.L1, x, -0.05, 0));
        for (const [dy, dz] of [[0.36, 0.34], [0.36, -0.34], [-0.42, 0.34], [-0.42, -0.34]]) {
            tx.add(M(hex(0.07, 0.08), k.L2, x + s * 0.15, -0.05 + dy, dz, 0, 0, PI / 2));
        }
        if (sides.includes(s)) {
            tx.add(M(hex(0.07, 0.12), k.L2, x, 0.5, 0.25));
            tx.add(M(C(0.04, 0.04, 0.12, 12), k.L2, x, 0.6, 0.25));
            tx.add(M(C(0.11, 0.11, 0.02, 24), k.D, x, -0.55, 0));
        } else {
            tx.add(M(hex(0.1, 0.1), k.L2, x, -0.55, 0)); // blanked low-pressure side
        }
    }
    g.add(tx);

    // L-shaped mounting bracket (stainless plate with holes)
    const plate = roundRect(1.25, 1.9, 0.12);
    plate.holes.push(circlePath(0, 0.45, 0.17), circlePath(-0.3, -0.25, 0.1), circlePath(0.3, -0.25, 0.1), circlePath(0, -0.55, 0.13), circlePath(-0.38, 0.75, 0.05), circlePath(0.38, 0.75, 0.05));
    const br = new THREE.Group();
    br.add(M(extrude(plate, 0.05), k.L1, 0, 0.95, 0));
    const foot = roundRect(1.25, 0.7, 0.08);
    foot.holes.push(slotPath(-0.3, 0, 0.3, 0.12), slotPath(0.3, 0, 0.3, 0.12));
    br.add(M(extrude(foot, 0.05), k.L1, 0, 0.0, 0.35, -PI / 2));
    br.add(M(T(0.05, 0.025, 12), k.L1, 0, 0.02, 0.02, 0, 0, 0)); // bend
    at(br, -1.75, -0.5, -0.1, 0, 0.35, 0);
    g.add(br);

    // two oval flange adapters and their bolts, laid out in front
    for (const [x, z] of [[1.3, 0.75], [2.05, 0.75]]) {
        const ov = roundRect(0.55, 1.05, 0.27);
        ov.holes.push(circlePath(0, 0.37, 0.07), circlePath(0, -0.37, 0.07));
        const a = G(M(extrude(ov, 0.22), k.L1, 0, 0, 0), M(C(0.24, 0.24, 0.4, 32), k.L1, 0, 0, 0.25, PI / 2), M(C(0.14, 0.14, 0.42, 24), k.D, 0, 0, 0.26, PI / 2));
        at(a, x, -0.39, z, -PI / 2 + 0.05, 0, 0);
        g.add(a);
    }
    for (let i = 0; i < 4; i++) {
        const bolt = G(M(hex(0.1, 0.09), k.L1, 0, 0.32, 0), M(C(0.06, 0.06, 0.6, 16), k.L1, 0, 0, 0));
        at(bolt, 1.15 + i * 0.32, -0.44, 1.75, PI / 2, 0, 0);
        g.add(bolt);
    }
    return { g };
}

/** Mobrey displacer level control head on its mounting flange, with gasket and bolts. */
function mobreyLevelControl(k: Kit): Built {
    const g = new THREE.Group();
    const fl = new THREE.Shape();
    fl.absarc(0, 0, 0.95, 0, PI * 2, false);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2 + PI / 8;
        fl.holes.push(circlePath(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0.07));
    }
    g.add(flatPlate(fl, 0.14, k.L3, 0));
    g.add(M(C(0.32, 0.32, 0.16, 32), k.L3, 0, 0.15, 0));
    // switch head: black cylinder, lid and label band
    g.add(M(C(0.55, 0.55, 1.05, 48), k.L3, 0, 0.75, 0));
    g.add(M(C(0.58, 0.58, 0.12, 48), k.L3, 0, 1.33, 0));
    g.add(M(C(0.555, 0.555, 0.32, 48, true), k.L1, 0, 0.62, 0));
    g.add(M(C(0.14, 0.14, 0.18, 24), k.L3, 0.5, 1.0, 0, 0, 0, PI / 2));
    // suspension rod through the flange
    g.add(M(C(0.025, 0.025, 4.6, 10), k.L1, -0.35, 0.8, 0.25, 0.06, 0, -0.12));
    // gasket and bolts lying beside
    g.add(M(ring(0.55, 0.32, 0.03), k.L2, 1.65, -0.05, 0.4));
    for (let i = 0; i < 8; i++) {
        const b = G(M(hex(0.07, 0.07), k.L1, 0, 0.3, 0), M(C(0.04, 0.04, 0.55, 12), k.L1, 0, 0, 0));
        at(b, 1.15 + i * 0.17, 0.0, -0.6, 0, 0, -PI / 2);
        g.add(b);
    }
    return { g };
}

/** Mobrey chamber-type level switch with its float on a rod. */
function mobreyLevelSwitch(k: Kit): Built {
    const g = new THREE.Group();
    const prof = new THREE.Shape();
    prof.moveTo(-0.5, -0.9);
    prof.lineTo(0.5, -0.9);
    prof.lineTo(0.5, 1.0);
    prof.absarc(0, 1.0, 0.5, 0, PI, false);
    prof.lineTo(-0.5, -0.9);
    g.add(M(extrude(prof, 0.78, 0.02), k.L3, 0, 0, 0));
    // round inspection window with its white ring
    g.add(M(ring(0.36, 0.25, 0.04), k.L1, 0, 1.0, 0.41, PI / 2));
    g.add(M(new THREE.CircleGeometry(0.25, 40), k.D, 0, 1.0, 0.405));
    g.add(M(new THREE.CircleGeometry(0.26, 40), k.glass, 0, 1.0, 0.43));
    g.add(M(B(0.82, 0.55, 0.02), k.L1, 0, 0.2, 0.41)); // label
    g.add(M(B(0.6, 0.35, 0.015), k.L2, 0, -0.35, 0.41));
    g.add(M(C(0.1, 0.1, 0.3, 20), k.L3, 0.6, 0.3, 0, 0, 0, PI / 2)); // cable gland
    g.add(M(hex(0.12, 0.08), k.L3, 0.78, 0.3, 0, 0, 0, PI / 2));
    // stepped base and square mounting flange
    g.add(M(RB(1.05, 0.45, 0.92, 0.05), k.L3, 0, -1.12, 0));
    g.add(M(RB(1.3, 0.12, 1.2, 0.03), k.L3, 0, -1.4, 0));
    for (const [x, z] of [[0.52, 0.47], [-0.52, 0.47], [0.52, -0.47], [-0.52, -0.47]]) g.add(M(C(0.05, 0.05, 0.125, 12), k.D, x, -1.4, z));
    g.add(M(C(0.15, 0.15, 0.2, 24), k.L2, 0, -1.55, 0));
    // float and its rod
    const fl = new THREE.Group();
    fl.add(M(C(0.02, 0.02, 3.2, 10), k.L1, 0, 0, 0));
    fl.add(M(C(0.24, 0.24, 0.55, 32), k.L1, 0, 0.55, 0));
    fl.add(M(sphere(0.24), k.L1, 0, 0.83, 0));
    fl.children[fl.children.length - 1].scale.y = 0.55;
    fl.add(M(sphere(0.24), k.L1, 0, 0.27, 0));
    fl.children[fl.children.length - 1].scale.y = 0.55;
    fl.add(M(C(0.05, 0.05, 0.2, 12), k.L1, 0, -1.1, 0));
    at(fl, -1.35, -0.1, 0.1);
    g.add(fl);
    return { g };
}

type GaugeOpts = {
    r?: number;
    depth?: number;
    unit: string;
    max: number;
    caseMat?: 'light' | 'dark' | 'mid';
    conn: 'bottom' | 'back' | 'stem-back' | 'stem-angle';
    cap?: boolean;
    liquid?: boolean;
    sub?: boolean;
};

/** Dial pressure / temperature gauge. */
function dialGauge(k: Kit, o: GaugeOpts): Built {
    const g = new THREE.Group();
    const R = o.r ?? 1;
    const d = o.depth ?? 0.42 * R;
    const caseM = o.caseMat === 'dark' ? k.L3 : o.caseMat === 'mid' ? k.L2 : k.L1;
    g.add(M(C(R, R, d, 64), caseM, 0, 0, -d / 2, PI / 2));
    // crimped / bayonet bezel and the window
    g.add(M(lathe([[R * 0.88, 0], [R * 1.03, 0], [R * 1.05, 0.06 * R], [R * 1.0, 0.11 * R], [R * 0.9, 0.11 * R]], 72), o.caseMat === 'dark' ? k.L3 : k.L1, 0, 0, 0, PI / 2));
    if (o.liquid) g.add(M(T(R * 1.0, 0.05 * R, 72), k.L1, 0, 0, 0.02 * R));
    g.add(M(new THREE.CircleGeometry(R * 0.9, 64), dialFace(k, o.unit, o.max, { sub: o.sub }), 0, 0, 0.005));
    g.add(M(new THREE.CircleGeometry(R * 0.9, 64), k.glass, 0, 0, 0.1 * R));
    // needle and stopper pin
    const needle = new THREE.Group();
    needle.add(M(B(0.035 * R, 0.78 * R, 0.012), k.D, 0, 0.3 * R, 0));
    needle.add(M(B(0.05 * R, 0.2 * R, 0.012), k.D, 0, -0.08 * R, 0));
    needle.add(M(C(0.06 * R, 0.06 * R, 0.03, 24), k.D, 0, 0, 0.005, PI / 2));
    needle.position.z = 0.03 * R;
    g.add(needle);
    const sa = -140 * DEG;
    g.add(M(C(0.025 * R, 0.025 * R, 0.05 * R, 12), k.L1, Math.sin(sa) * 0.55 * R, Math.cos(sa) * 0.55 * R, 0.04 * R, PI / 2));
    // back: blow-out disc
    g.add(M(C(0.28 * R, 0.28 * R, 0.02, 32), caseM, 0, 0.35 * R, -d - 0.005, PI / 2));
    if (o.liquid) g.add(M(C(0.08 * R, 0.08 * R, 0.12 * R, 16), k.L3, 0, R + 0.04 * R, -d / 2)); // fill plug
    const brass = o.caseMat === 'dark' || o.liquid ? k.L2 : k.L1;
    if (o.conn === 'bottom') {
        g.add(M(B(0.32 * R, 0.24 * R, 0.32 * R), brass, 0, -R - 0.08 * R, -d / 2));
        g.add(M(hex(0.2 * R, 0.16 * R), brass, 0, -R - 0.28 * R, -d / 2));
        g.add(at(thread(k, 0.12 * R, 0.3 * R, brass), 0, -R - 0.51 * R, -d / 2));
        if (o.cap) g.add(M(C(0.14 * R, 0.13 * R, 0.3 * R, 24), k.L3, 0, -R - 0.66 * R, -d / 2));
    } else if (o.conn === 'back') {
        g.add(M(hex(0.18 * R, 0.16 * R), brass, 0, 0, -d - 0.1 * R, PI / 2));
        g.add(at(thread(k, 0.11 * R, 0.3 * R, brass), 0, 0, -d - 0.33 * R, PI / 2));
    } else if (o.conn === 'stem-back') {
        // bimetal thermometer: long stem straight out of the back
        g.add(M(hex(0.16 * R, 0.15 * R), k.L1, 0, 0, -d - 0.08 * R, PI / 2));
        g.add(M(C(0.06 * R, 0.06 * R, 2.2 * R, 20), k.L1, 0, 0, -d - 1.25 * R, PI / 2));
    } else {
        // adjustable-angle thermometer: swivel under the case, union nut, long stem down
        g.add(M(C(0.16 * R, 0.16 * R, 0.28 * R, 24), k.L1, 0, -R - 0.12 * R, -d / 2));
        g.add(M(sphere(0.17 * R), k.L1, 0, -R - 0.32 * R, -d / 2));
        g.add(M(hex(0.18 * R, 0.2 * R), k.L1, 0, -R - 0.58 * R, -d / 2));
        g.add(M(C(0.1 * R, 0.1 * R, 0.3 * R, 20), k.L1, 0, -R - 0.82 * R, -d / 2));
        g.add(M(C(0.06 * R, 0.06 * R, 4.2 * R, 20), k.L1, 0, -R - 3.05 * R, -d / 2));
    }
    const base = -((-135 + 0.45 * 270) * DEG);
    return { g, tick: (t) => (needle.rotation.z = base + Math.sin(t * 0.7) * 0.05) };
}

/** Nagano vertical edgewise draft gauge. */
function edgewiseGauge(k: Kit, labels: string[]): Built {
    const g = new THREE.Group();
    const fr = roundRect(1.25, 2.55, 0.08);
    fr.holes.push(rectPath(-0.42, -1.05, 0.42, 1.05));
    g.add(M(extrude(fr, 0.12, 0.01), k.L3, 0, 0, 0.06));
    for (const [x, y] of [[0.5, 1.12], [-0.5, 1.12], [0.5, -1.12], [-0.5, -1.12]]) g.add(M(C(0.045, 0.045, 0.03, 16), k.L2, x, y, 0.135, PI / 2));
    // curved scale strip behind the window
    const sc = new THREE.CylinderGeometry(1.6, 1.6, 2.1, 24, 1, true, -0.26, 0.52);
    g.add(M(sc, stripScale(k, labels), 0, 0, -1.65));
    g.add(M(B(0.84, 2.1, 0.02), k.glass, 0, 0, 0.02));
    g.add(M(B(0.06, 0.04, 0.02), k.D, -0.1, 0.15, -0.02)); // pointer
    // case behind, slightly tapered
    g.add(M(RB(1.08, 2.3, 1.35, 0.05), k.L3, 0, 0, -0.8));
    // back: connection at the bottom and the clamp screws
    g.add(M(hex(0.12, 0.12), k.L2, 0, -0.85, -1.5, PI / 2));
    g.add(at(thread(k, 0.08, 0.25, k.L2), 0, -0.85, -1.68, PI / 2));
    for (const s of [1, -1]) g.add(M(C(0.05, 0.05, 0.5, 12), k.L2, s * 0.58, 0.6, -0.6, PI / 2));
    return { g };
}

/** Fival bi-colour water level gauge body (lying flat, as in the photo). */
function fivalLevelGauge(k: Kit, straps: number, rods: boolean): Built {
    const g = new THREE.Group();
    const L = 3.6;
    g.add(M(B(L, 0.34, 0.36), k.L1, 0, 0, 0));
    for (const s of [1, -1]) g.add(M(B(L - 0.2, 0.46, 0.07), k.L2, 0, 0, s * 0.215));
    const pitch = (L - 0.3) / straps;
    for (let i = 0; i <= straps; i++) {
        const x = -L / 2 + 0.15 + i * pitch;
        g.add(M(B(0.11, 0.62, 0.62), k.L2, x, 0, 0));
        // stud and nut under each strap, both faces
        for (const s of [1, -1]) {
            g.add(M(C(0.04, 0.04, 0.85, 12), k.L1, x, -0.05, s * 0.2));
            g.add(M(hex(0.07, 0.08), k.L1, x, -0.5, s * 0.2));
            g.add(M(hex(0.07, 0.08), k.L1, x, 0.38, s * 0.2));
        }
        if (i < straps) {
            g.add(M(B(pitch - 0.2, 0.2, 0.02), k.D, x + pitch / 2, 0.02, 0.255));
            g.add(M(B(pitch - 0.2, 0.2, 0.02), k.D, x + pitch / 2, 0.02, -0.255));
        }
    }
    if (rods) for (const s of [1, -1]) g.add(M(C(0.05, 0.05, 1.0, 16), k.L1, s * (L / 2 + 0.5), 0, 0, 0, 0, PI / 2));
    return { g };
}

// =====================================================================
// Valves
// =====================================================================

/** ARI-SAFE spring safety valve: angle body, open bonnet, cap and lifting lever. */
function ariSafetyValve(k: Kit, s: number): Built {
    const g = new THREE.Group();
    const c = k.L2;
    flangeY(g, k, -0.95, 0.62 * s, 0.14, c, -1, 0, 0, 4);
    g.add(M(C(0.34 * s, 0.4 * s, 0.6, 36), c, 0, -0.6, 0));
    const body = M(sphere(0.55 * s), c, 0, 0, 0);
    body.scale.set(1, 0.9, 1);
    g.add(body);
    g.add(M(C(0.36 * s, 0.4 * s, 0.6, 36), c, -0.6 * s, -0.05, 0, 0, 0, PI / 2));
    flangeX(g, k, -0.95 * s, 0.72 * s, 0.14, c, -1, -0.05, 0, 4);
    // body to bonnet flange with studs
    g.add(M(RB(1.0 * s, 0.14, 1.0 * s, 0.05), c, 0, 0.5, 0));
    for (const [x, z] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) {
        g.add(M(C(0.04, 0.04, 0.35, 12), k.L1, x * s, 0.55, z * s));
        g.add(M(hex(0.07, 0.07), k.L1, x * s, 0.66, z * s));
    }
    // bonnet: two pillars with the spring showing front and back
    g.add(M(C(0.42 * s, 0.46 * s, 0.22, 36), c, 0, 0.7, 0));
    for (const side of [1, -1]) g.add(M(B(0.16 * s, 1.15, 0.5 * s), c, side * 0.36 * s, 1.35, 0));
    g.add(M(tubeAlong(helix(0.24 * s, 0.13, 7, 0.86), 0.04 * s, 10), k.L1));
    g.add(M(C(0.3 * s, 0.3 * s, 0.05, 32), k.L1, 0, 0.86, 0));
    g.add(M(C(0.3 * s, 0.3 * s, 0.05, 32), k.L1, 0, 1.82, 0));
    g.add(M(C(0.44 * s, 0.42 * s, 0.16, 36), c, 0, 1.98, 0));
    // cap and lever head
    g.add(M(C(0.2 * s, 0.26 * s, 0.55, 28), c, 0, 2.33, 0));
    g.add(M(RB(0.4 * s, 0.45, 0.32 * s, 0.06), c, 0, 2.75, 0));
    g.add(M(C(0.05, 0.05, 0.4 * s, 12), k.L1, 0, 2.78, 0, PI / 2));
    const lever = M(tubeAlong([[0.1 * s, 2.82, 0], [0.42 * s, 2.86, 0.02], [0.6 * s, 2.5, 0.05], [0.62 * s, 1.9, 0.05], [0.56 * s, 1.55, 0.05]], 0.05 * s, 10), c);
    g.add(lever);
    return { g };
}

/** Blowdown valve with piston actuator (lantern with tie rods). */
function blowdownValve(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(C(0.48, 0.48, 1.15, 40), k.L1, 0, -0.75, 0));
    g.add(M(sphere(0.48), k.L1, 0, -1.32, 0));
    g.children[g.children.length - 1].scale.y = 0.4;
    g.add(M(C(0.3, 0.32, 0.7, 32), k.L1, -0.6, -0.65, 0, 0, 0, PI / 2));
    flangeX(g, k, -1.0, 0.68, 0.14, k.L1, -1, -0.65, 0, 4);
    g.add(M(C(0.3, 0.32, 0.7, 32), k.L1, 0.6, -0.8, 0.12, 0, 0, PI / 2));
    flangeX(g, k, 1.0, 0.68, 0.14, k.L1, 1, -0.8, 0.12, 4);
    g.add(M(B(0.5, 0.3, 0.02), k.L2, 0, -0.85, 0.49)); // nameplate
    // manual lever (paddle) at the lower front
    const pad = poly([[0, 0], [0.75, 0.1], [0.6, -0.75], [0.1, -0.65]]);
    g.add(M(extrude(pad, 0.09, 0.02), k.L2, 0.35, -0.65, 0.55, 0, -0.5, 0));
    // lantern: base ring, four tie rods, cylinder, top flange
    g.add(M(C(0.55, 0.55, 0.14, 40), k.L1, 0, -0.1, 0));
    for (let i = 0; i < 4; i++) {
        const a = PI / 4 + (i / 4) * PI * 2;
        g.add(M(C(0.045, 0.045, 2.15, 12), k.L1, Math.cos(a) * 0.47, 0.95, Math.sin(a) * 0.47));
    }
    g.add(M(C(0.32, 0.32, 0.5, 36), k.L1, 0, 0.25, 0));
    g.add(M(B(0.08, 0.35, 0.02), k.D, 0, 0.3, 0.32));
    g.add(M(C(0.36, 0.36, 1.3, 36), k.L1, 0, 1.15, 0));
    g.add(M(B(0.1, 0.55, 0.02), k.D, 0.12, 1.0, 0.36));
    g.add(M(B(0.25, 0.4, 0.02), k.L2, 0.25, 0.55, 0.3, 0, 0.6, 0)); // warning label
    g.add(M(C(0.62, 0.62, 0.22, 40), k.L1, 0, 2.05, 0));
    boltsZ(g, k, 4, 0.48, 0, 0.06);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        g.add(M(hex(0.05, 0.06), k.L3, Math.cos(a) * 0.5, 2.19, Math.sin(a) * 0.5));
    }
    g.add(M(C(0.25, 0.25, 0.12, 32), k.L1, 0, 2.2, 0));
    return { g };
}

/** Rotary control valve: flanged body, bracket, rack-and-pinion actuator, positioner. */
function rotaryControlValve(k: Kit): Built {
    const g = new THREE.Group();
    // valve body with flange protection discs
    g.add(M(C(0.42, 0.42, 1.4, 40), k.L2, 0, 0, 0, 0, 0, PI / 2));
    for (const s of [1, -1]) {
        flangeX(g, k, s * 0.8, 0.85, 0.16, k.L2, s, 0, 0, 8);
        g.add(M(C(0.86, 0.86, 0.06, 48), k.L1, s * 0.93, 0, 0, 0, 0, PI / 2));
    }
    g.add(M(C(0.3, 0.32, 0.5, 32), k.L2, 0, 0.55, 0));
    // mounting bracket
    for (const s of [1, -1]) g.add(M(B(0.08, 0.85, 0.9), k.L1, s * 0.4, 1.2, 0));
    g.add(M(B(0.9, 0.08, 0.9), k.L1, 0, 0.82, 0));
    g.add(M(C(0.12, 0.12, 0.7, 20), k.L1, 0, 1.2, 0));
    // actuator: centre housing with two end cylinders
    const ay = 2.05;
    g.add(M(RB(1.1, 1.05, 1.05, 0.12), k.L2, 0, ay, 0));
    for (const s of [1, -1]) {
        g.add(M(C(0.45, 0.45, 0.85, 40), k.L2, s * 0.95, ay, 0, 0, 0, PI / 2));
        g.add(M(C(0.5, 0.5, 0.12, 40), k.L2, s * 1.42, ay, 0, 0, 0, PI / 2));
        for (let i = 0; i < 4; i++) {
            const a = PI / 4 + (i / 4) * PI * 2;
            g.add(M(hex(0.05, 0.05), k.L3, s * 1.5, ay + Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0, 0, PI / 2));
        }
    }
    g.add(M(C(0.08, 0.08, 0.25, 16), k.L1, 0.25, ay + 0.6, 0.2));
    // positioner on top
    g.add(M(RB(1.05, 0.55, 0.9, 0.08), k.L3, -0.2, ay + 0.85, 0.05));
    g.add(M(C(0.2, 0.2, 0.06, 32), k.L3, -0.2, ay + 1.15, 0.05));
    // filter regulator with gauge, solenoid and the tubing loop on the front
    g.add(M(C(0.16, 0.16, 0.5, 24), k.L3, 0.55, ay - 0.15, 0.75));
    g.add(at(knob(k, 0.12, 0.12, 12), 0.55, ay + 0.15, 0.75));
    g.add(M(C(0.17, 0.17, 0.1, 32), k.L1, 0.2, ay - 0.05, 0.62, PI / 2));
    g.add(M(new THREE.CircleGeometry(0.15, 32), dialFace(k, 'bar', 10), 0.2, ay - 0.05, 0.675));
    g.add(M(RB(0.4, 0.35, 0.3, 0.04), k.L3, -0.55, ay - 0.25, 0.68));
    g.add(M(RB(0.3, 0.4, 0.35, 0.04), k.L3, -0.9, ay - 0.25, 0.68));
    g.add(M(tubeAlong([[-0.75, ay + 0.6, 0.5], [-1.0, ay + 0.3, 0.85], [-0.6, ay - 0.65, 0.9], [0.6, ay - 0.65, 0.9], [0.85, ay + 0.1, 0.8], [0.6, ay + 0.6, 0.55]], 0.025, 8), k.L1));
    return { g };
}

/** Auto blowdown: 3-piece ball valve, bracket, rack-and-pinion actuator, NAMUR solenoid. */
function autoBlowdownValve(k: Kit): Built {
    const g = new THREE.Group();
    // ball valve
    g.add(M(RB(0.62, 0.55, 0.55, 0.05), k.L1, 0, 0, 0));
    for (const s of [1, -1]) {
        g.add(M(C(0.29, 0.29, 0.38, 6), k.L1, s * 0.48, 0, 0, PI / 6, 0, PI / 2));
        g.add(M(C(0.16, 0.16, 0.39, 24), k.D, s * 0.48, 0, 0, 0, 0, PI / 2));
    }
    for (const [y, z] of [[0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [-0.2, -0.2]]) {
        g.add(M(C(0.035, 0.035, 1.1, 10), k.L1, 0, y, z, 0, 0, PI / 2));
        for (const s of [1, -1]) g.add(M(hex(0.06, 0.06), k.L1, s * 0.56, y, z, 0, 0, PI / 2));
    }
    g.add(M(C(0.12, 0.14, 0.35, 24), k.L1, 0, 0.45, 0));
    g.add(M(RB(0.55, 0.08, 0.55, 0.02), k.L1, 0, 0.65, 0));
    g.add(M(RB(0.4, 0.55, 0.4, 0.03), k.L1, 0, 0.95, 0));
    g.add(M(B(0.1, 0.3, 0.02), k.D, 0, 0.95, 0.205));
    g.add(M(RB(0.6, 0.08, 0.6, 0.02), k.L1, 0, 1.25, 0));
    // actuator body (extrusion) with end caps
    const ay = 1.75;
    g.add(M(RB(2.1, 0.92, 0.92, 0.1), k.L1, 0, ay, 0));
    for (const s of [1, -1]) {
        g.add(M(RB(0.14, 0.98, 0.98, 0.05), k.L3, s * 1.11, ay, 0));
        for (const [y, z] of [[0.35, 0.35], [0.35, -0.35], [-0.35, 0.35], [-0.35, -0.35]]) g.add(M(C(0.04, 0.04, 0.03, 12), k.L1, s * 1.19, ay + y, z, 0, 0, PI / 2));
    }
    g.add(M(B(1.6, 0.18, 0.02), k.L1, 0, ay + 0.3, 0.465)); // name strip
    // position indicator on top
    g.add(M(C(0.36, 0.36, 0.1, 32), k.L2, 0, ay + 0.51, 0));
    g.add(M(new THREE.SphereGeometry(0.3, 32, 16, 0, PI * 2, 0, PI / 2), k.L2, 0, ay + 0.56, 0));
    // NAMUR solenoid valve on the front, coil to the left
    g.add(M(RB(1.15, 0.5, 0.3, 0.03), k.L1, 0.05, ay - 0.05, 0.61));
    g.add(M(RB(0.42, 0.55, 0.5, 0.04), k.L3, -0.75, ay - 0.08, 0.67));
    g.add(M(RB(0.3, 0.32, 0.16, 0.03), k.L3, -0.75, ay - 0.5, 0.82));
    for (const x of [-0.25, 0.45]) g.add(at(G(M(hex(0.08, 0.1), k.L2, 0, 0.05, 0)), x, ay + 0.2, 0.62));
    g.add(at(fitting(k, 0.07), 0.1, ay + 0.2, 0.62));
    return { g };
}

/** Diaphragm-actuated globe valve with a solenoid (photo of the auto vent valve). */
function diaphragmValve(k: Kit): Built {
    const g = new THREE.Group();
    const b = M(sphere(0.38), k.L1, 0, 0, 0);
    b.scale.set(1.2, 0.95, 0.95);
    g.add(b);
    g.add(M(C(0.18, 0.18, 1.6, 28), k.L1, 0, 0, 0, 0, 0, PI / 2));
    flangeX(g, k, 0.85, 0.5, 0.12, k.L1, 1, 0, 0, 4);
    flangeX(g, k, -0.85, 0.5, 0.12, k.L1, -1, 0, 0, 4);
    g.add(M(C(0.15, 0.18, 0.45, 24), k.L1, 0, 0.5, 0));
    g.add(M(hex(0.2, 0.12), k.L1, 0, 0.78, 0));
    // yoke: bottom ring, two pillars, stem with coupling
    g.add(M(C(0.45, 0.45, 0.08, 40), k.L1, 0, 0.95, 0));
    for (const s of [1, -1]) g.add(M(C(0.055, 0.055, 1.75, 14), k.L1, s * 0.38, 1.85, 0));
    g.add(M(C(0.04, 0.04, 1.8, 12), k.L1, 0, 1.85, 0));
    g.add(M(C(0.1, 0.1, 0.28, 16), k.L1, 0, 1.75, 0));
    g.add(M(B(0.35, 0.05, 0.05), k.L1, 0.15, 1.6, 0));
    // diaphragm casing: two pressed dishes bolted at the rim
    g.add(M(lathe([[0.2, 0], [0.92, 0.0], [0.98, 0.2], [1.02, 0.2]], 64), k.L1, 0, 2.55, 0));
    g.add(M(lathe([[0.0, 0.42], [0.55, 0.42], [0.92, 0.25], [1.02, 0.02], [1.02, 0]], 64), k.L1, 0, 2.77, 0));
    g.add(M(C(1.08, 1.08, 0.06, 64), k.L1, 0, 2.77, 0));
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * PI * 2;
        g.add(M(hex(0.04, 0.14), k.L1, Math.cos(a) * 1.03, 2.77, Math.sin(a) * 1.03));
    }
    for (const s of [1, -1]) g.add(M(B(0.25, 0.08, 0.18), k.L1, s * 1.18, 2.77, 0));
    g.add(M(hex(0.08, 0.12), k.L2, 0, 3.25, 0));
    // solenoid valve and its copper tube to the top connection
    g.add(M(RB(0.32, 0.5, 0.35, 0.03), k.L3, -1.45, 2.85, 0.1));
    g.add(M(RB(0.32, 0.32, 0.28, 0.03), k.L3, -1.45, 2.45, 0.1));
    g.add(M(tubeAlong([[-1.45, 3.1, 0.1], [-1.3, 3.45, 0.05], [-0.4, 3.5, 0], [0, 3.32, 0]], 0.03, 8), k.L2));
    return { g };
}

/** Globe valve with handwheel (fallback for other valves). */
function globeValve(k: Kit): Built {
    const g = new THREE.Group();
    const b = M(sphere(0.55), k.L2, 0, 0, 0);
    b.scale.set(1.1, 0.95, 0.95);
    g.add(b);
    g.add(M(C(0.28, 0.28, 1.9, 32), k.L2, 0, 0, 0, 0, 0, PI / 2));
    flangeX(g, k, 0.96, 0.58, 0.14, k.L2, 1);
    flangeX(g, k, -0.96, 0.58, 0.14, k.L2, -1);
    g.add(M(C(0.32, 0.4, 0.5, 32), k.L2, 0, 0.65, 0));
    flangeY(g, k, 0.92, 0.42, 0.1, k.L2);
    for (const s of [1, -1]) g.add(M(C(0.08, 0.08, 0.6, 12), k.L2, s * 0.2, 1.3, 0));
    g.add(M(B(0.6, 0.12, 0.2), k.L2, 0, 1.62, 0));
    g.add(M(C(0.045, 0.045, 1.0, 12), k.L1, 0, 1.6, 0));
    g.add(at(handwheel(k, 0.55), 0, 2.05, 0));
    return { g };
}

// =====================================================================
// Panel instruments and electronics
// =====================================================================

/** Rear terminal block with two columns of screws. */
function rearTerminals(k: Kit, g: THREE.Group, w: number, h: number, z: number, rows = 9) {
    g.add(M(B(w, h, 0.1), k.L3, 0, 0, z));
    for (let i = 0; i < rows; i++) {
        for (const x of [-w * 0.25, w * 0.25]) g.add(M(C(0.035, 0.035, 0.03, 12), k.L1, x, -h / 2 + ((i + 0.5) * h) / rows, z - 0.06, PI / 2));
    }
}

/** Ventilation slots across a top face at height y. */
function topSlots(k: Kit, g: THREE.Group, w: number, d: number, y: number, z: number, cols = 6, rows = 3) {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.add(M(B((w * 0.5) / cols, 0.012, 0.03), k.D, -w * 0.35 + (i * w * 0.7) / (cols - 1), y, z - d * 0.2 - (j * d * 0.5) / Math.max(1, rows - 1)));
}

/** Yokogawa UT35A: 96 x 96 controller with large display and round arrow key. */
function ut35a(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.96, 0.96, 0.08, 0.03), k.L2, 0, 0, 0.04));
    g.add(M(B(0.78, 0.5, 0.01), k.D, 0, 0.13, 0.085));
    g.add(M(B(0.12, 0.04, 0.005), k.L1, 0.36, 0.43, 0.085));
    for (const [x, y] of [[-0.36, -0.25], [-0.24, -0.25], [-0.36, -0.37], [-0.24, -0.37]]) g.add(M(C(0.045, 0.045, 0.03, 20), k.L1, x, y, 0.09, PI / 2));
    g.add(M(ring(0.11, 0.05, 0.03, 32), k.L1, -0.04, -0.31, 0.09, PI / 2));
    g.add(M(C(0.045, 0.045, 0.035, 20), k.L1, -0.04, -0.31, 0.09, PI / 2));
    for (const y of [-0.25, -0.37]) g.add(M(RB(0.26, 0.08, 0.03, 0.035), k.L1, 0.25, y, 0.09));
    // housing: top vents, mounting clips, rear terminals
    g.add(M(B(0.91, 0.91, 0.62), k.L2, 0, 0, -0.31));
    topSlots(k, g, 0.91, 0.62, 0.456, -0.05);
    for (const s of [1, -1]) g.add(M(B(0.3, 0.05, 0.2), k.L1, 0, s * 0.47, -0.25));
    rearTerminals(k, g, 0.8, 0.8, -0.67);
    return { g };
}

/** Chino DB1000-series 96 x 96 controller (DB1030). */
function chinoDB1030(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.96, 0.96, 0.08, 0.02), k.L1, 0, 0, 0.04));
    g.add(M(B(0.78, 0.52, 0.01), k.D, 0, 0.14, 0.085));
    for (let i = 0; i < 6; i++) g.add(M(RB(0.11, 0.08, 0.025, 0.01), k.L2, -0.32 + i * 0.128, -0.27, 0.09));
    g.add(M(B(0.25, 0.04, 0.005), k.L3, -0.3, -0.4, 0.085));
    g.add(M(B(0.91, 0.91, 0.95), k.L1, 0, 0, -0.475));
    topSlots(k, g, 0.91, 0.95, 0.456, -0.1, 7, 4);
    for (const s of [1, -1]) for (let i = 0; i < 5; i++) g.add(M(B(0.012, 0.5, 0.03), k.D, s * 0.456, 0, -0.2 - i * 0.12));
    rearTerminals(k, g, 0.8, 0.8, -1.0, 10);
    return { g };
}

/** Chino DB670: display with status column and keys along the bottom. */
function chinoDB670(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.96, 0.96, 0.08, 0.02), k.L1, 0, 0, 0.04));
    g.add(M(B(0.6, 0.58, 0.01), k.D, 0.08, 0.1, 0.085));
    for (let i = 0; i < 6; i++) g.add(M(B(0.07, 0.025, 0.005), k.L3, -0.33, 0.3 - i * 0.07, 0.085));
    g.add(M(B(0.2, 0.06, 0.005), k.L3, -0.3, 0.42, 0.085));
    for (let i = 0; i < 5; i++) g.add(M(RB(0.12, 0.09, 0.025, 0.01), k.L2, -0.25 + i * 0.14, -0.34, 0.09));
    g.add(M(B(0.91, 0.91, 1.15), k.L1, 0, 0, -0.575));
    topSlots(k, g, 0.91, 1.15, 0.456, -0.1, 7, 4);
    rearTerminals(k, g, 0.8, 0.8, -1.2, 10);
    return { g };
}

/** Paperless recorder: 144 x 144 bezel, screen, drop-down key door. */
function paperlessRecorder(k: Kit): Built {
    const g = new THREE.Group();
    const bz = roundRect(1.44, 1.44, 0.05);
    bz.holes.push(rectPath(-0.6, -0.25, 0.6, 0.66));
    g.add(M(extrude(bz, 0.1), k.L2, 0, 0, 0.05));
    g.add(M(B(1.2, 0.91, 0.02), k.D, 0, 0.205, 0.02));
    g.add(M(B(1.2, 0.3, 0.02), k.L3, 0, -0.42, 0.03));
    for (let i = 0; i < 6; i++) g.add(M(RB(0.09, 0.07, 0.03, 0.01), k.L1, 0.12 + (i % 3) * 0.11, -0.37 - Math.floor(i / 3) * 0.09, 0.05));
    g.add(M(ring(0.1, 0.05, 0.03, 32), k.L1, 0.5, -0.41, 0.05, PI / 2));
    g.add(M(B(0.4, 0.05, 0.02), k.D, -0.3, -0.36, 0.045)); // card slot
    // drop-down door hanging open
    const door = G(M(RB(1.3, 0.5, 0.05, 0.02), k.L2, 0, -0.25, 0));
    door.add(M(B(0.9, 0.05, 0.03), k.L1, 0, -0.08, 0.04));
    door.add(M(C(0.1, 0.1, 0.06, 24), k.D, 0.42, -0.36, 0.03, PI / 2));
    at(door, 0, -0.62, 0.12, -1.15, 0, 0);
    g.add(door);
    g.add(M(B(1.38, 1.38, 1.7), k.L2, 0, 0, -0.85));
    // two mounting brackets lying on top, as delivered
    for (const x of [-0.35, 0.3]) {
        const br = G(M(B(0.4, 0.04, 0.35), k.L1, 0, 0, 0), M(B(0.4, 0.2, 0.04), k.L1, 0, 0.1, -0.16));
        at(br, x, 0.72, -0.5, 0, x * 0.6, 0);
        g.add(br);
    }
    rearTerminals(k, g, 1.2, 1.1, -1.75, 12);
    return { g };
}

/** DIN-rail signal splitter: slim housing, blue terminal blocks, green plug. */
function signalSplitter(k: Kit): Built {
    const g = new THREE.Group();
    const side = poly([[-1.1, -1.0], [0.95, -1.0], [1.1, -0.82], [1.1, 0.82], [0.95, 1.0], [-1.1, 1.0]]);
    const body = M(extrude(side, 0.5), k.L1, 0, 0, 0, 0, -PI / 2, 0);
    g.add(body);
    for (const y of [0.78, -0.78]) {
        g.add(M(B(0.5, 0.3, 0.32), k.L2, 0, y, 0.98));
        for (let i = 0; i < 3; i++) g.add(M(C(0.05, 0.05, 0.03, 16), k.D, (i - 1) * 0.15, y + Math.sign(y) * 0.16, 1.0));
        for (let i = 0; i < 3; i++) g.add(M(B(0.09, 0.09, 0.02), k.D, (i - 1) * 0.15, y, 1.145));
    }
    g.add(M(B(0.28, 0.6, 0.32), k.L2, 0.14, 0.2, 1.25)); // pluggable connector
    for (let i = 0; i < 5; i++) g.add(M(C(0.035, 0.035, 0.03, 12), k.D, 0.14, 0.42 - i * 0.11, 1.42, PI / 2));
    g.add(M(C(0.025, 0.025, 0.03, 12), k.L3, -0.12, -0.2, 1.11, PI / 2));
    g.add(M(B(0.12, 0.18, 0.02), k.D, -0.05, -0.42, 1.11)); // USB
    g.add(M(B(0.52, 0.42, 0.06), k.D, 0, 0, -1.08)); // DIN-rail slot
    g.add(M(B(0.02, 1.3, 1.6), k.L2, 0.255, 0, 0)); // printed panel on the side
    return { g };
}

/** MC pneumatic indicating controller: wall case with meter window. */
function mcController(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(B(1.6, 2.2, 0.55), k.L2, 0, 0, -0.3));
    // front cover with a bevelled frame and raised centre
    g.add(M(RB(1.66, 2.26, 0.14, 0.04), k.L2, 0, 0, 0.05));
    const inner = poly([[-0.72, -1.02], [0.72, -1.02], [0.72, 1.02], [-0.72, 1.02]]);
    g.add(M(extrude(inner, 0.04, 0.06), k.L2, 0, 0, 0.15));
    const scale = k.painted(512, 160, (c, w, h) => {
        c.fillStyle = '#fff';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#30363c';
        c.fillStyle = '#30363c';
        for (let i = 0; i <= 40; i++) {
            const x = 40 + (i / 40) * (w - 80);
            c.lineWidth = i % 10 === 0 ? 4 : 2;
            c.beginPath();
            c.moveTo(x, 20);
            c.lineTo(x, i % 10 === 0 ? 60 : 45);
            c.stroke();
            if (i % 10 === 0) {
                c.font = 'bold 34px Arial';
                c.textAlign = 'center';
                c.fillText(String(i), x, 100);
            }
        }
        c.font = 'bold 30px Arial';
        c.fillText('bar', w / 2, 145);
    });
    g.add(M(B(1.1, 0.42, 0.02), k.D, 0, 0.72, 0.24));
    g.add(M(new THREE.PlaneGeometry(1.04, 0.36), scale, 0, 0.72, 0.252));
    g.add(M(B(1.05, 0.38, 0.01), k.glass, 0, 0.72, 0.262));
    g.add(M(B(1.25, 0.14, 0.02), k.L3, 0.0, -0.75, 0.24));
    for (const y of [0.75, -0.75]) g.add(M(C(0.05, 0.05, 0.28, 16), k.L1, -0.85, y, 0.02));
    g.add(M(RB(0.1, 0.28, 0.14, 0.02), k.L1, 0.86, 0.15, 0.02));
    for (const x of [-0.45, 0.45]) {
        g.add(M(hex(0.08, 0.1), k.L1, x, -1.17, -0.1));
        g.add(M(C(0.05, 0.05, 0.18, 12), k.L1, x, -1.3, -0.1));
    }
    for (const s of [1, -1]) g.add(M(B(0.25, 0.1, 0.06), k.L1, s * 0.6, 1.15, -0.55)); // wall lugs
    return { g };
}

/** Panel loading station: plate with two gauges, auto/manual selector and +/- regulator. */
function loadingStation(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(B(2.0, 2.05, 0.08), k.L3, 0, 0, 0));
    for (const y of [0.45, -0.55]) {
        g.add(M(ring(0.42, 0.33, 0.05, 48), k.L2, -0.45, y, 0.065, PI / 2));
        g.add(M(C(0.34, 0.34, 0.1, 48), k.L1, -0.45, y, 0.08, PI / 2));
        g.add(M(new THREE.CircleGeometry(0.3, 48), dialFace(k, 'bar', 2.5), -0.45, y, 0.132));
        g.add(M(new THREE.CircleGeometry(0.31, 48), k.glass, -0.45, y, 0.14));
        g.add(M(C(0.3, 0.3, 0.25, 32), k.L1, -0.45, y, -0.17, PI / 2)); // gauge back
        g.add(M(B(0.6, 0.1, 0.01), k.L1, -0.45, y + 0.5, 0.045)); // label
    }
    // auto / manual selector with its lever
    g.add(M(C(0.22, 0.22, 0.32, 32), k.L1, 0.45, 0.42, 0.2, PI / 2));
    g.add(M(C(0.18, 0.18, 0.12, 32), k.L1, 0.45, 0.42, 0.4, PI / 2));
    g.add(M(tubeAlong([[0.5, 0.48, 0.42], [0.55, 0.75, 0.45], [0.58, 1.0, 0.45]], 0.035, 8), k.L1));
    g.add(M(C(0.06, 0.07, 0.32, 16), k.L3, 0.58, 1.15, 0.45));
    g.add(M(B(0.6, 0.1, 0.01), k.L1, 0.45, 0.95 - 0.1, 0.045));
    // +inc / -dec push regulator
    g.add(M(C(0.13, 0.13, 0.18, 24), k.L1, 0.45, -0.55, 0.12, PI / 2));
    g.add(M(C(0.16, 0.16, 0.12, 24), k.L1, 0.45, -0.55, 0.26, PI / 2));
    g.add(M(B(0.6, 0.1, 0.01), k.L1, 0.45, -0.05, 0.045));
    // behind the plate: valve bodies and tubing
    g.add(M(RB(0.4, 0.4, 0.4, 0.03), k.L1, 0.45, 0.42, -0.25));
    g.add(M(RB(0.35, 0.35, 0.35, 0.03), k.L1, 0.45, -0.55, -0.22));
    g.add(M(tubeAlong([[-0.45, 0.45, -0.32], [0.0, 0.2, -0.45], [0.45, 0.2, -0.42], [0.45, -0.4, -0.38]], 0.025, 8), k.L1));
    return { g };
}

/** Type 650 positive bias relay. */
function biasRelay(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.95, 0.62, 0.95, 0.1), k.L2, 0, -0.62, 0));
    g.add(M(C(0.13, 0.13, 0.04, 24), k.D, 0, -0.75, 0.47, PI / 2));
    g.add(M(C(0.13, 0.13, 0.04, 24), k.D, 0.47, -0.65, 0, 0, 0, PI / 2));
    g.add(M(C(0.6, 0.6, 0.16, 48), k.L3, 0, -0.22, 0));
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + PI / 6;
        g.add(M(hex(0.05, 0.08), k.L1, Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55));
    }
    g.add(M(RB(0.98, 0.72, 0.98, 0.16), k.L2, 0, 0.25, 0));
    g.add(M(B(0.62, 0.42, 0.01), k.L1, 0, 0.27, 0.495));
    for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) g.add(M(C(0.05, 0.05, 0.04, 12), k.L1, x, 0.62, z));
    g.add(M(C(0.2, 0.25, 0.16, 32), k.L2, 0, 0.69, 0));
    g.add(at(thread(k, 0.07, 0.38, k.L1), 0, 0.95, 0));
    g.add(M(hex(0.12, 0.07), k.L1, 0, 0.82, 0));
    g.add(at(knob(k, 0.46, 0.2, 36), 0, 1.22, 0));
    g.add(M(C(0.38, 0.38, 0.02, 40), k.L3, 0, 1.33, 0));
    return { g };
}

/** SMC ITV2010 electro-pneumatic regulator with its coiled cable. */
function itvRegulator(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.8, 0.8, 0.8, 0.04), k.L1, 0, -0.45, 0));
    for (const s of [1, -1]) g.add(M(C(0.14, 0.14, 0.02, 24), k.D, s * 0.405, -0.5, 0, 0, 0, PI / 2));
    g.add(M(C(0.12, 0.12, 0.02, 24), k.D, 0, -0.5, 0.405, PI / 2));
    g.add(M(RB(0.8, 1.0, 0.78, 0.04), k.L1, 0, 0.47, 0));
    g.add(M(B(0.5, 0.26, 0.01), k.D, 0, 0.6, 0.395));
    for (const x of [-0.15, 0.15]) g.add(M(RB(0.14, 0.08, 0.03, 0.01), k.L2, x, 0.33, 0.395));
    g.add(M(RB(0.82, 0.18, 0.8, 0.03), k.L2, 0, 1.05, 0));
    g.add(M(C(0.12, 0.12, 0.25, 20), k.L2, 0, 1.25, 0));
    // the cable: up from the connector, three loose loops round the unit, end with plug and wires
    const pts: V3[] = [[0, 1.35, 0], [0, 1.8, -0.1]];
    for (let i = 0; i <= 3 * 24; i++) {
        const a = PI / 2 + (i / 24) * PI * 2;
        const r = 1.75 + 0.06 * Math.sin(i * 0.7);
        pts.push([Math.cos(a) * r * 1.05, 0.2 + Math.sin(a) * r, -0.5 - (i / 72) * 0.25]);
    }
    pts.push([-0.9, -1.4, -0.2], [-0.5, -1.7, 0.4]);
    g.add(M(tubeAlong(pts, 0.045, 8, 'catmullrom'), k.L1));
    g.add(M(C(0.08, 0.08, 0.35, 16), k.L1, -0.35, -1.85, 0.55, 0.9, 0, 0.6));
    for (let i = 0; i < 4; i++) g.add(M(C(0.012, 0.012, 0.4, 6), k.L2, -0.9 + i * 0.05, -1.75, 0.5, 0.3, 0, 1.2));
    return { g };
}

/** Fuji FRENIC-Ace inverter (grey). */
function fujiInverter(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(1.4, 2.25, 1.3, 0.05), k.L2, 0, 0, 0));
    // keypad and upper cover
    g.add(M(RB(0.62, 0.8, 0.05, 0.03), k.L3, 0.15, 0.6, 0.66));
    g.add(M(B(0.42, 0.13, 0.01), k.D, 0.15, 0.85, 0.69));
    for (let i = 0; i < 6; i++) g.add(M(C(0.05, 0.05, 0.03, 20), k.L1, 0.0 + (i % 2) * 0.13, 0.62 - Math.floor(i / 2) * 0.13, 0.695, PI / 2));
    for (const y of [0.65, 0.45]) g.add(M(C(0.07, 0.07, 0.03, 20), k.L1, 0.36, y, 0.695, PI / 2));
    g.add(M(B(1.38, 0.015, 0.02), k.D, 0, 0.1, 0.655)); // cover split
    g.add(M(RB(0.28, 0.25, 0.04, 0.02), k.L3, -0.1, 0.0, 0.67));
    g.add(M(C(0.04, 0.04, 0.03, 12), k.L3, -0.35, -0.25, 0.665, PI / 2));
    g.add(M(B(0.6, 0.6, 0.01), k.L1, 0.25, -0.5, 0.655)); // warning label
    for (let i = 0; i < 6; i++) g.add(M(B(0.5, 0.03, 0.02), k.D, -0.1, -0.95 + i * 0.05, 0.655));
    // side vents, rear heat sink fins, top vents
    for (const s of [1, -1]) for (let i = 0; i < 8; i++) g.add(M(B(0.02, 0.04, 0.5), k.D, s * 0.705, -0.8 + i * 0.08, -0.2));
    for (let i = 0; i < 11; i++) g.add(M(B(0.035, 1.9, 0.22), k.L1, -0.6 + i * 0.12, 0, -0.75));
    for (let i = 0; i < 8; i++) g.add(M(B(0.08, 0.015, 0.6), k.D, -0.45 + i * 0.13, 1.125, 0));
    return { g };
}

/** Black inverter (5.5 kW) with its top mounting bracket. */
function blackInverter(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(1.3, 2.1, 1.25, 0.05), k.L3, 0, 0, 0));
    g.add(M(RB(0.5, 0.72, 0.05, 0.03), k.L3, -0.15, 0.4, 0.64));
    g.add(M(B(0.36, 0.12, 0.01), k.D, -0.15, 0.62, 0.67));
    for (let i = 0; i < 8; i++) g.add(M(C(0.045, 0.045, 0.03, 20), i === 5 ? k.L2 : k.L1, -0.3 + (i % 3) * 0.15, 0.42 - Math.floor(i / 3) * 0.13, 0.675, PI / 2));
    g.add(M(B(0.08, 0.08, 0.02), k.L1, -0.48, 0.6, 0.665));
    g.add(M(B(1.28, 0.015, 0.02), k.D, 0, -0.05, 0.63));
    g.add(M(B(0.5, 0.3, 0.01), k.L2, 0.2, -0.75, 0.63)); // label
    g.add(M(B(1.3, 0.12, 0.06), k.L3, 0, 0.95, 0.65));
    // top bracket and the loose knob/cover on top
    const br = new THREE.Shape();
    br.moveTo(-0.45, 0);
    br.lineTo(0.45, 0);
    br.lineTo(0.45, 0.55);
    br.lineTo(-0.45, 0.55);
    br.closePath();
    br.holes.push(rectPath(-0.15, 0.2, 0.15, 0.42));
    g.add(M(extrude(br, 0.05), k.L3, -0.1, 1.05, -0.35));
    g.add(M(RB(0.3, 0.2, 0.3, 0.05), k.L3, 0.35, 1.15, 0.1, 0, 0.5, 0));
    // rear heat sink
    for (let i = 0; i < 10; i++) g.add(M(B(0.035, 1.8, 0.2), k.L3, -0.55 + i * 0.12, 0, -0.72));
    return { g };
}

// =====================================================================
// Pneumatics
// =====================================================================

/** Air cylinder with IP200 positioner, feedback tube and gauges. */
function airCylinderPositioner(k: Kit, bore: number): Built {
    const g = new THREE.Group();
    const r = bore >= 80 ? 0.42 : 0.32;
    g.add(M(C(r, r, 3.0, 40), k.L1, 0.2, 0, 0, 0, 0, PI / 2));
    for (const x of [-1.38, 1.78]) g.add(M(RB(0.28, r * 2.3, r * 2.3, 0.05), k.L2, x, 0, 0));
    for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(M(C(0.03, 0.03, 3.4, 8), k.L1, 0.2, y * r * 0.95, z * r * 0.95, 0, 0, PI / 2));
    // rod, rod-end eye
    g.add(M(C(0.07, 0.07, 0.6, 16), k.L1, 2.2, 0, 0, 0, 0, PI / 2));
    g.add(M(hex(0.1, 0.1), k.L1, 2.45, 0, 0, 0, 0, PI / 2));
    g.add(M(B(0.25, 0.22, 0.22), k.L1, 2.62, 0, 0));
    g.add(M(ring(0.14, 0.07, 0.22, 24), k.L1, 2.82, 0, 0, PI / 2));
    // rear clevis bracket
    g.add(M(B(0.25, 0.2, 0.9), k.L2, -1.62, -0.15, 0));
    for (const s of [1, -1]) g.add(M(B(0.35, 0.45, 0.06), k.L2, -1.8, -0.15, s * 0.3));
    g.add(M(C(0.05, 0.05, 0.75, 12), k.L1, -1.85, -0.2, 0, PI / 2));
    // feedback tube above, linked to the rod end
    g.add(M(C(0.13, 0.13, 2.9, 24), k.L1, 0.55, r + 0.32, 0, 0, 0, PI / 2));
    g.add(M(B(0.12, r + 0.4, 0.12), k.L1, 2.45, (r + 0.32) / 2, 0));
    // positioner block with two gauges
    g.add(M(RB(0.95, 0.5, 0.75, 0.05), k.L2, -0.95, r + 0.3, 0));
    for (const x of [-1.2, -0.72]) {
        g.add(M(C(0.04, 0.04, 0.2, 10), k.L1, x, r + 0.62, 0.1));
        g.add(M(C(0.2, 0.2, 0.12, 32), k.L1, x, r + 0.88, 0.1, PI / 2));
        g.add(M(new THREE.CircleGeometry(0.17, 32), dialFace(k, 'MPa', 1), x, r + 0.88, 0.162));
    }
    for (const x of [-1.38, 1.78]) g.add(M(C(0.05, 0.05, 0.15, 12), k.L2, x, r * 1.15 + 0.07, 0.15));
    return { g };
}

/** Plain air cylinder with clevis mountings. */
function airCylinder(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(C(0.22, 0.22, 3.2, 36), k.L1, 0, 0, 0, 0, 0, PI / 2));
    for (const x of [-1.72, 1.72]) {
        g.add(M(RB(0.26, 0.5, 0.5, 0.05), k.L2, x, 0, 0));
        g.add(M(C(0.045, 0.045, 0.12, 12), k.L2, x, 0.3, 0));
    }
    g.add(M(C(0.06, 0.06, 0.6, 16), k.L1, -2.1, 0, 0, 0, 0, PI / 2));
    g.add(M(hex(0.08, 0.08), k.L1, -2.35, 0, 0, 0, 0, PI / 2));
    for (const s of [1, -1]) g.add(M(B(0.3, 0.22, 0.05), k.L1, -2.55, 0, s * 0.1));
    g.add(M(C(0.04, 0.04, 0.3, 12), k.L1, -2.62, 0, 0, PI / 2));
    g.add(M(B(0.2, 0.3, 0.12), k.L2, 1.95, 0, 0));
    const tab = poly([[0, -0.2], [0.35, -0.12], [0.35, 0.12], [0, 0.2]]);
    g.add(M(extrude(tab, 0.06), k.L2, 2.05, -0.2, 0, 0, 0, -0.6));
    return { g };
}

/** SMC filter / mist separator with auto drain (bowl up, as photographed). */
function smcFilter(k: Kit, mist: boolean): Built {
    const g = new THREE.Group();
    g.add(M(RB(0.85, 0.55, 0.85, 0.06), k.L1, 0, -1.05, 0));
    for (const s of [1, -1]) g.add(M(C(0.16, 0.16, 0.02, 24), k.D, s * 0.43, -1.05, 0, 0, 0, PI / 2));
    // bowl guard: frame with front window
    for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) g.add(M(B(0.12, 0.5, 0.12), k.L1, x, -0.53, z));
    g.add(M(RB(0.85, 0.1, 0.85, 0.03), k.L1, 0, -0.27, 0));
    g.add(M(B(0.4, 0.38, 0.02), k.L2, 0, -0.55, 0.36));
    // clear bowl with the element inside
    g.add(M(C(0.42, 0.42, 1.15, 48, true), k.glass, 0, 0.32, 0));
    g.add(M(new THREE.SphereGeometry(0.42, 40, 12, 0, PI * 2, 0, PI / 2), k.glass, 0, 0.9, 0));
    g.add(M(C(0.425, 0.425, 0.22, 48, true), k.L1, 0, 0.05, 0)); // label band
    if (mist) g.add(M(C(0.24, 0.24, 0.95, 32), k.L1, 0, 0.3, 0));
    else {
        g.add(M(C(0.24, 0.24, 0.5, 32), k.L3, 0, 0.05, 0));
        g.add(M(C(0.2, 0.2, 0.45, 32), k.L2, 0, 0.55, 0));
    }
    // auto drain and push-in fitting on top
    g.add(M(C(0.16, 0.2, 0.42, 24), k.L3, 0, 1.25, 0));
    g.add(at(fitting(k, 0.09), 0, 1.45, 0));
    return { g };
}

/** SMC AR-series regulator with front gauge. */
function smcRegulator(k: Kit, s: number): Built {
    const g = new THREE.Group();
    g.add(M(RB(1.0 * s, 0.85, 0.95 * s, 0.05), k.L1, 0, 0, 0));
    g.add(M(B(0.6 * s, 0.12, 0.02), k.L2, 0.15, -0.2, 0.48 * s));
    for (const side of [1, -1]) g.add(M(C(0.17, 0.17, 0.02, 24), k.D, side * 0.505 * s, 0, 0, 0, 0, PI / 2));
    g.add(M(C(0.08, 0.08, 0.02, 16), k.D, 0, 0.0, 0.48 * s, PI / 2));
    // gauge on the front port
    g.add(M(C(0.06, 0.06, 0.25, 12), k.L1, -0.32, -0.38, 0.55));
    g.add(M(C(0.34, 0.34, 0.2, 40), k.L1, -0.32, -0.38, 0.72, PI / 2));
    g.add(M(new THREE.CircleGeometry(0.3, 40), dialFace(k, 'MPa', 1), -0.32, -0.38, 0.822));
    g.add(M(new THREE.CircleGeometry(0.31, 40), k.glass, -0.32, -0.38, 0.83));
    // bonnet, threaded neck, knob
    g.add(M(C(0.44 * s, 0.46 * s, 0.22, 40), k.L1, 0, 0.53, 0));
    g.add(at(thread(k, 0.4 * s, 0.42, k.L2), 0, 0.85, 0));
    g.add(at(knob(k, 0.48 * s, 0.55, 30, k.L2), 0, 1.33, 0));
    g.add(M(C(0.44 * s, 0.44 * s, 0.03, 40), k.L2, 0, 1.62, 0));
    g.add(M(B(0.4, 0.12, 0.4), k.L1, 0, -0.48, 0));
    return { g };
}

// =====================================================================
// Pump set
// =====================================================================

/** Feed water pump: motor, coupling guard and multistage pump on a channel base. */
function feedPumpSet(k: Kit): Built {
    const g = new THREE.Group();
    // base frame
    for (const s of [1, -1]) {
        g.add(M(B(7.2, 0.42, 0.1), k.L2, 0, -1.05, s * 0.85));
        g.add(M(B(7.2, 0.06, 0.25), k.L2, 0, -0.85, s * 0.75));
        g.add(M(B(7.2, 0.06, 0.25), k.L2, 0, -1.25, s * 0.75));
    }
    for (const x of [-3.55, -1.0, 1.2, 3.55]) g.add(M(B(0.1, 0.42, 1.6), k.L2, x, -1.05, 0));
    // motor
    const mx = -1.95;
    g.add(M(C(0.8, 0.8, 2.3, 48), k.L2, mx, 0.15, 0, 0, 0, PI / 2));
    for (let i = 0; i < 20; i++) {
        const a = (i / 20) * PI * 2;
        if (Math.sin(a) < -0.6) continue;
        g.add(M(B(2.1, 0.05, 0.12), k.L2, mx, 0.15 + Math.sin(a) * 0.8, Math.cos(a) * 0.8, a, 0, 0));
    }
    g.add(M(C(0.82, 0.82, 0.65, 48, true), k.L2, mx - 1.45, 0.15, 0, 0, 0, PI / 2));
    g.add(M(new THREE.CircleGeometry(0.82, 48), k.L3, mx - 1.78, 0.15, 0, 0, -PI / 2, 0));
    for (const r of [0.3, 0.5, 0.7]) g.add(M(T(r, 0.02, 40), k.L2, mx - 1.79, 0.15, 0, 0, PI / 2, 0));
    g.add(M(C(0.78, 0.82, 0.2, 48), k.L2, mx + 1.25, 0.15, 0, 0, 0, PI / 2));
    g.add(M(RB(0.65, 0.55, 0.6, 0.04), k.L2, mx + 0.3, 1.18, 0));
    g.add(M(T(0.12, 0.03, 16), k.L2, mx - 0.7, 1.05, 0));
    for (const x of [mx - 0.8, mx + 0.8]) g.add(M(B(0.45, 0.55, 1.45), k.L2, x, -0.6, 0));
    // coupling guard and bearing lantern
    g.add(M(RB(0.85, 0.95, 0.9, 0.04), k.L2, -0.35, 0.1, 0));
    g.add(M(C(0.35, 0.42, 0.55, 32), k.L2, 0.35, 0.1, 0, 0, 0, PI / 2));
    // multistage pump: stage casings with tie rods
    for (let i = 0; i < 5; i++) g.add(M(C(0.5, 0.5, 0.26, 40), k.L2, 0.85 + i * 0.29, 0.1, 0, 0, 0, PI / 2));
    g.add(M(C(0.58, 0.58, 0.3, 40), k.L2, 2.45, 0.1, 0, 0, 0, PI / 2));
    g.add(M(C(0.58, 0.58, 0.3, 40), k.L2, 0.68, 0.1, 0, 0, 0, PI / 2));
    for (const [y, z] of [[0.55, 0.3], [0.55, -0.3], [-0.35, 0.3], [-0.35, -0.3]]) g.add(M(C(0.035, 0.035, 2.0, 8), k.L1, 1.55, 0.1 + y, z, 0, 0, PI / 2));
    // suction branch facing the front, discharge on top
    g.add(M(C(0.22, 0.25, 0.5, 28), k.L2, 0.75, 0.1, 0.55, PI / 2));
    const fz = G(M(C(0.42, 0.42, 0.1, 40), k.L2), M(C(0.4, 0.4, 0.03, 40), k.L1, 0, 0.065, 0));
    g.add(at(fz, 0.75, 0.1, 0.82, PI / 2));
    g.add(M(C(0.2, 0.22, 0.5, 28), k.L2, 2.35, 0.65, 0));
    flangeY(g, k, 0.92, 0.36, 0.09, k.L2, 1, 2.35, 0, 4);
    for (const x of [0.75, 2.45]) g.add(M(B(0.35, 0.55, 1.0), k.L2, x, -0.55, 0));
    return { g };
}

export const panelBuilders = {
    ut35a,
    chinoDB1030,
    chinoDB670,
    paperlessRecorder,
    signalSplitter,
    mcController,
    loadingStation,
    biasRelay,
    itvRegulator,
    fujiInverter,
    blackInverter,
    airCylinderPositioner,
    airCylinder,
    smcFilter,
    smcRegulator,
    feedPumpSet
};

// =====================================================================
// Castings and grate parts
// =====================================================================

/** Cast cone 12": collar, tapered wall, base flange with two lugs. */
function castCone(k: Kit): Built {
    const g = new THREE.Group();
    g.add(
        M(
            lathe([
                [0.58, 1.5],
                [0.74, 1.5],
                [0.74, 1.36],
                [0.7, 1.3],
                [1.12, -0.25],
                [1.3, -0.4],
                [1.3, -0.6],
                [1.08, -0.6],
                [1.04, -0.38],
                [0.6, 1.3],
                [0.58, 1.5]
            ], 72),
            k.L2
        )
    );
    // lugs either side with bolt holes
    for (const s of [1, -1]) {
        const lug = new THREE.Shape();
        lug.moveTo(0, -0.3);
        lug.lineTo(0.42, -0.3);
        lug.absarc(0.42, 0, 0.3, -PI / 2, PI / 2, false);
        lug.lineTo(0, 0.3);
        lug.closePath();
        lug.holes.push(circlePath(0.42, 0, 0.12));
        const side = G(at(flatPlate(lug, 0.14, k.L2), 1.18, -0.53, 0, -PI / 2, 0, 0));
        side.rotation.y = s > 0 ? 0 : PI;
        g.add(side);
    }
    return { g };
}

/** Cast swirl vane ring 12": a band with ten swept blades round the outside. */
function vaneRing(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(lathe([[0.92, -0.38], [1.0, -0.38], [1.0, 0.38], [0.92, 0.38], [0.92, -0.38]], 72), k.L2));
    const blade = poly([[0, -0.38], [0.22, -0.38], [0.75, -0.18], [0.75, 0.14], [0.36, 0.38], [0, 0.38]]);
    const geo = extrude(blade, 0.07, 0.01);
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        const piv = new THREE.Group();
        piv.rotation.y = -a;
        const b = M(geo, k.L2, 0.97, 0, 0);
        b.rotation.x = 0.62; // blades are swept round the ring
        piv.add(b);
        if (i % 3 === 0) piv.add(M(C(0.03, 0.03, 0.18, 10), k.L2, 1.5, -0.44, 0.1));
        g.add(piv);
    }
    return { g };
}

/** Cast fire door with frame: two leaves, handles, peep sight, hinges and latch. */
function fireDoor(k: Kit): Built {
    const g = new THREE.Group();
    // D-shaped frame plate with mounting holes
    const frame = new THREE.Shape();
    frame.moveTo(-1.7, 1.05);
    frame.lineTo(1.7, 1.05);
    frame.lineTo(1.7, -0.15);
    frame.absellipse(0, -0.15, 1.7, 1.15, 0, -PI, true, 0);
    frame.lineTo(-1.7, 1.05);
    const holes: [number, number][] = [[-1.45, 0.9], [1.45, 0.9], [-0.7, 0.92], [0.7, 0.92], [-1.58, -0.4], [1.58, -0.4], [-1.15, -0.95], [1.15, -0.95], [0, -1.22]];
    for (const [x, y] of holes) frame.holes.push(circlePath(x, y, 0.04));
    g.add(M(extrude(frame, 0.08), k.L2, 0, 0, 0));
    // the two leaves follow the frame outline, split down the middle
    const leaf = (sgn: number) => {
        const pts: [number, number][] = [[sgn * 0.02, 0.88], [sgn * 1.38, 0.88], [sgn * 1.38, -0.15]];
        for (let i = 1; i <= 16; i++) {
            const a = (i / 16) * (PI / 2);
            pts.push([sgn * Math.cos(a) * 1.38, -0.15 - Math.sin(a) * 0.92]);
        }
        pts.push([sgn * 0.02, -1.07]);
        return poly(sgn > 0 ? pts : pts.reverse());
    };
    for (const sgn of [1, -1]) {
        g.add(M(extrude(leaf(sgn), 0.1, 0.03), k.L2, 0, 0, 0.12));
        g.add(M(tubeAlong([[sgn * 0.45, 0.62, 0.17], [sgn * 0.45, 0.62, 0.36], [sgn * 0.95, 0.62, 0.36], [sgn * 0.95, 0.62, 0.17]], 0.03, 8, 'chordal'), k.L2));
        // hinge pin with knuckles on the outer edge
        g.add(M(C(0.05, 0.05, 1.3, 14), k.L2, sgn * 1.58, 0.45, 0.32));
        for (const y of [0.95, 0.55, -0.05]) g.add(M(RB(0.22, 0.14, 0.16, 0.03), k.L2, sgn * 1.52, y, 0.3));
        for (const y of [1.12, -0.22]) g.add(M(hex(0.07, 0.08), k.L3, sgn * 1.58, y, 0.32));
    }
    // peep sight on the right leaf, with its swing cover
    g.add(M(C(0.3, 0.3, 0.05, 32), k.L2, 0.55, 0.05, 0.27, PI / 2));
    g.add(M(C(0.2, 0.2, 0.16, 32), k.L2, 0.55, 0.05, 0.35, PI / 2));
    g.add(M(C(0.08, 0.08, 0.17, 20), k.D, 0.55, 0.05, 0.36, PI / 2));
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2 + 0.4;
        g.add(M(hex(0.04, 0.04), k.L3, 0.55 + Math.cos(a) * 0.26, 0.05 + Math.sin(a) * 0.26, 0.31, PI / 2));
    }
    g.add(M(C(0.02, 0.02, 0.5, 8), k.L2, 0.95, 0.15, 0.3, 0, 0, 1.3));
    // latch lever at the bottom
    g.add(M(C(0.1, 0.1, 0.1, 20), k.L3, -0.1, -0.88, 0.3, PI / 2));
    g.add(M(tubeAlong([[-0.1, -0.88, 0.33], [0.3, -0.92, 0.33], [0.65, -0.8, 0.33]], 0.035, 8), k.L2));
    g.add(M(C(0.025, 0.025, 0.25, 8), k.L2, 0.65, -0.75, 0.38));
    // back: refractory lining behind each leaf
    for (const sgn of [1, -1]) g.add(M(B(1.1, 1.5, 0.18), k.L2, sgn * 0.62, -0.05, -0.13));
    return { g };
}

/** Fire grate bar: web with a row of air holes, raised ridge and end lugs. */
function fireGrate(k: Kit, L: number): Built {
    const g = new THREE.Group();
    const h = L / 2;
    const prof = poly([
        [-h, 0],
        [h, 0],
        [h, 0.34],
        [h - 0.18, 0.34],
        [h - 0.3, 0.22],
        [L * 0.18, 0.3],
        [-L * 0.08, 0.46],
        [-h + 0.55, 0.3],
        [-h + 0.3, 0.3],
        [-h + 0.3, 0.6],
        [-h, 0.6]
    ]);
    const n = Math.round(L * 3.2);
    for (let i = 0; i < n; i++) prof.holes.push(circlePath(-h + 0.5 + (i * (L - 0.9)) / (n - 1), 0.12, 0.035));
    g.add(M(extrude(prof, 0.12), k.L2, 0, 0, 0));
    g.add(M(B(L, 0.06, 0.42), k.L2, 0, 0.03, 0));
    g.add(M(B(L * 0.86, 0.05, 0.22), k.L2, -L * 0.02, 0.4, 0));
    g.add(M(B(0.3, 0.6, 0.42), k.L2, -h + 0.15, 0.3, 0));
    g.add(M(B(0.12, 0.25, 0.42), k.L2, -h + 0.06, 0.73, 0));
    g.add(M(B(0.22, 0.34, 0.42), k.L2, h - 0.11, 0.17, 0));
    return { g };
}

/** Vibrating-grate ash bar: base plate, back wall with holes, ribs and notched tips. */
function ashBar(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(B(3.0, 0.08, 2.3), k.L2, 0.85, 0, 0));
    // back wall (along z) with bolt holes
    const wall = poly([[-1.15, 0], [1.15, 0], [1.15, 0.85], [-1.15, 0.85]]);
    for (let i = 0; i < 5; i++) wall.holes.push(circlePath(-0.9 + i * 0.45, 0.45, 0.05));
    g.add(M(extrude(wall, 0.14), k.L2, -0.05, 0.04, 0, 0, PI / 2, 0));
    // four ribs running out from the wall, each ending in a notched tip
    const rib = poly([[0, 0], [0, 0.55], [0.2, 0.45], [1.6, 0.32], [1.95, 0.42], [2.25, 0.42], [2.25, 0]]);
    for (const z of [-0.78, -0.26, 0.26, 0.78]) {
        g.add(M(extrude(rib, 0.09), k.L2, 0.02, 0.04, z));
        g.add(M(extrude(poly([[0, 0], [0.05, 0.18], [1.4, 0.12], [1.4, 0]]), 0.32), k.L2, 0.3, 0.04, z + 0.21));
        const tip = new THREE.Shape();
        tip.moveTo(-0.16, 0);
        tip.lineTo(0.16, 0);
        tip.lineTo(0.16, 0.4);
        tip.lineTo(0.08, 0.4);
        tip.absarc(0, 0.4, 0.08, 0, PI, false);
        tip.lineTo(-0.16, 0.4);
        tip.closePath();
        g.add(M(extrude(tip, 0.3), k.L2, 2.2, 0.04, z, 0, PI / 2, 0));
    }
    return { g };
}

/** VG grate plate (active has air holes through the plate). */
function vgPlate(k: Kit, active: boolean): Built {
    const g = new THREE.Group();
    const L = 4.0;
    const W = 1.3;
    const outline = poly([[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]]);
    if (active) {
        for (let i = 0; i < 14; i++) {
            const x = -L / 2 + 0.25 + (i * (L - 0.5)) / 13;
            for (const z of [-0.5, -0.17, 0.17, 0.5]) outline.holes.push(circlePath(x, z, 0.065));
        }
    }
    g.add(flatPlate(outline, 0.1, k.L2, 0));
    // two raised ribs along the length, notched at both ends
    const ridge = poly([[-0.14, 0], [0.14, 0], [0.09, 0.2], [-0.09, 0.2]]);
    for (const z of [-0.33, 0.33]) {
        g.add(M(extrude(ridge, L - 0.12), k.L2, 0, 0.05, z, 0, PI / 2, 0));
        // semicircular notch cast into each end of the rib
        for (const s of [1, -1]) g.add(M(C(0.075, 0.075, 0.22, 20), k.D, s * (L / 2 - 0.13), 0.16, z));
    }
    g.add(M(RB(0.7, 0.03, 0.22, 0.01), k.L2, 0.6, 0.065, 0)); // cast mark
    // underside: two shallow runners
    for (const z of [-0.45, 0.45]) g.add(M(B(L - 0.3, 0.06, 0.1), k.L2, 0, -0.08, z));
    g.rotation.y = PI / 2; // long side towards the viewer, as photographed
    return { g: G(g) };
}

/** VG side pipe bar: flat bar with four holes, two top tabs and a back ledge. */
function vgPipeBar(k: Kit): Built {
    const g = new THREE.Group();
    const bar = poly([[-1.6, -0.27], [1.6, -0.27], [1.6, 0.27], [-1.6, 0.27]]);
    for (const x of [-1.15, -0.65, 0.65, 1.15]) bar.holes.push(circlePath(x, 0.02, 0.075));
    g.add(M(extrude(bar, 0.14), k.L2, 0, 0, 0));
    for (const x of [-0.45, 0.45]) g.add(M(B(0.1, 0.12, 0.1), k.L2, x, 0.33, 0));
    g.add(M(B(3.2, 0.08, 0.3), k.L2, 0, -0.27, -0.2));
    return { g };
}

/** VG side L bar: comb plate with open slots, bottom flange and gussets. */
function vgLBar(k: Kit): Built {
    const g = new THREE.Group();
    const fw = 0.26;
    const sw = 0.36;
    const n = 6;
    const total = n * fw + (n - 1) * sw;
    const x0 = -total / 2;
    const pts: [number, number][] = [[x0, 0]];
    pts.push([x0 + total, 0]);
    for (let i = n - 1; i >= 0; i--) {
        const xl = x0 + i * (fw + sw);
        pts.push([xl + fw + 0.06, 1.15]);
        pts.push([xl + 0.06, 1.15]);
        if (i > 0) {
            pts.push([xl, 0.28]);
            pts.push([xl - sw, 0.28]);
        }
    }
    const comb = poly(pts);
    comb.holes.push(circlePath(x0 + 0.5, 0.12, 0.04));
    g.add(M(extrude(comb, 0.1), k.L2, 0, 0, 0));
    g.add(M(B(total + 0.2, 0.08, 0.55), k.L2, 0, 0.0, 0.22));
    for (let i = 0; i < n - 1; i++) {
        const x = x0 + i * (fw + sw) + fw + sw / 2;
        g.add(M(extrude(poly([[-0.14, 0], [0.14, 0], [0.09, 0.16], [-0.09, 0.16]]), 0.3, 0.01), k.L2, x, 0.04, 0.25));
    }
    return { g };
}

/** VG side seal bar: long bar with a rebated edge and three lugs (standing, as photographed). */
function vgSealBar(k: Kit): Built {
    const g = new THREE.Group();
    const bar = poly([[-0.36, -1.75], [0.32, -1.75], [0.36, -1.6], [0.36, 1.75], [-0.36, 1.75]]);
    g.add(M(extrude(bar, 0.12), k.L2, 0, 0, 0));
    g.add(M(B(0.2, 3.4, 0.08), k.L2, 0.27, 0, -0.1));
    for (const y of [-1.3, 0, 1.3]) g.add(M(RB(0.2, 0.16, 0.12, 0.03), k.L2, -0.2, y, 0.11));
    return { g };
}

/** VG tuyere tray (middle "L" / right "R"): rimmed tray with air holes and a curled tongue. */
function vgTuyere(k: Kit, right: boolean): Built {
    const g = new THREE.Group();
    const s = right ? -1 : 1; // the right-hand tray is the mirror pattern of the middle one
    const base = right
        ? poly([[-0.5, -1.1], [0.5, -1.1], [0.5, 0.8], [0.2, 0.8], [0.2, 1.1], [-0.5, 1.1]])
        : poly([[-0.5, -0.75], [-0.15, -0.75], [-0.15, -1.1], [0.5, -1.1], [0.5, 1.1], [-0.5, 1.1]].map(([x, y]) => [-x, y] as [number, number]));
    const holeY = right ? -0.95 : 0.95;
    for (const x of [-0.25, 0, 0.25]) base.holes.push(circlePath(x, holeY, 0.05));
    g.add(flatPlate(base, 0.1, k.L2, 0));
    // rim walls along both sides and the hole end
    const yTop = right ? 0.8 : 1.1;
    const yBot = right ? -1.1 : -0.75;
    for (const x of [-0.46, 0.46]) g.add(M(B(0.08, 0.18, yTop - yBot), k.L2, x, 0.14, -(yTop + yBot) / 2));
    g.add(M(B(0.92, 0.18, 0.08), k.L2, 0, 0.14, right ? 1.06 : -1.06));
    // curled tongue at the open end
    const tx = right ? -0.15 : s * 0.175;
    g.add(M(new THREE.CylinderGeometry(0.16, 0.16, 0.65, 20, 1, true, 0, PI), k.L2, tx, -0.11, right ? -1.1 : 1.1, 0, right ? PI / 2 : -PI / 2, PI / 2));
    g.add(M(RB(0.12, 0.03, 0.12, 0.01), k.L2, 0, 0.065, 0)); // cast letter
    return { g };
}

/** VG tuyere holder: bar with two large holes and a stepped, curled tail. */
function vgTuyereHolder(k: Kit): Built {
    const g = new THREE.Group();
    const bar = poly([[-0.27, -1.2], [0.08, -1.2], [0.08, -0.7], [0.27, -0.7], [0.27, 1.2], [-0.27, 1.2]]);
    bar.holes.push(circlePath(0, 0.75, 0.13), circlePath(0, 0.3, 0.13));
    g.add(flatPlate(bar, 0.18, k.L2, 0));
    g.add(M(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 20, 1, true, 0, PI), k.L2, -0.095, -0.05, 1.2, 0, PI / 2, PI / 2));
    return { g };
}

/** Stainless steel 17-4PH plate, 36" x 108". */
function steelPlate(k: Kit): Built {
    return { g: G(M(B(1.2, 0.025, 3.6), k.L1, 0, 0, 0)) };
}

// =====================================================================
// Bearings, pins, shafts, plates
// =====================================================================

/** SKF 22320 spherical roller bearing (face to the front). */
function sphericalRollerBearing(k: Kit): Built {
    const g = new THREE.Group();
    const f = new THREE.Group();
    const outer: [number, number][] = [[1.0, -0.3], [1.0, 0.3]];
    for (let i = 0; i <= 12; i++) {
        const y = 0.3 - (i / 12) * 0.6;
        outer.push([Math.sqrt(0.9 * 0.9 - y * y) - 0.02, y]);
    }
    outer.push([1.0, -0.3]);
    f.add(M(lathe(outer, 72), k.L1));
    f.add(M(lathe([[0.5, -0.31], [0.66, -0.31], [0.7, -0.22], [0.66, -0.02], [0.7, 0], [0.66, 0.02], [0.7, 0.22], [0.66, 0.31], [0.5, 0.31], [0.5, -0.31]], 64), k.L1));
    const barrel = lathe([[0, -0.12], [0.085, -0.12], [0.1, 0], [0.085, 0.12], [0, 0.12]], 18);
    for (const row of [1, -1]) {
        for (let i = 0; i < 17; i++) {
            const a = ((i + (row > 0 ? 0 : 0.5)) / 17) * PI * 2;
            const piv = new THREE.Group();
            piv.rotation.y = -a;
            piv.add(M(barrel, k.L1, 0.79, row * 0.14, 0, 0, 0, row * 0.22));
            f.add(piv);
        }
    }
    f.add(M(ring(0.74, 0.69, 0.5, 64), k.L2)); // cage
    f.rotation.x = PI / 2;
    g.add(f);
    return { g };
}

/** SKF GEZ spherical plain bearing with seals. */
function sphericalPlainBearing(k: Kit): Built {
    const g = new THREE.Group();
    const f = new THREE.Group();
    const outer: [number, number][] = [[1.0, -0.28], [1.0, 0.28]];
    for (let i = 0; i <= 10; i++) {
        const y = 0.28 - (i / 10) * 0.56;
        outer.push([Math.sqrt(0.82 * 0.82 - y * y), y]);
    }
    outer.push([1.0, -0.28]);
    f.add(M(lathe(outer, 72), k.L1));
    f.add(M(new THREE.SphereGeometry(0.8, 64, 24, 0, PI * 2, PI / 2 - 0.42, 0.84), k.L1));
    f.add(M(ring(0.62, 0.55, 0.72, 56), k.L1));
    for (const y of [0.31, -0.31]) f.add(M(ring(0.62, 0.55, 0.02, 56), k.L1, 0, y * 1.15));
    for (const y of [0.29, -0.29]) f.add(M(ring(0.9, 0.74, 0.03, 64), k.L3, 0, y));
    f.add(M(B(0.02, 0.57, 0.1), k.D, 0.95, 0, 0)); // split in the outer ring
    f.rotation.x = PI / 2;
    g.add(f);
    return { g };
}

/** Rocker-arm lock pin: collar, hex end and plain shank. */
function lockPin(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(C(0.33, 0.33, 1.75, 48), k.L1, 0.35, 0, 0, 0, 0, PI / 2));
    g.add(M(C(0.3, 0.33, 0.06, 48), k.L1, 1.255, 0, 0, 0, 0, PI / 2));
    g.add(M(C(0.42, 0.42, 0.12, 48), k.L1, -0.58, 0, 0, 0, 0, PI / 2));
    g.add(M(C(0.24, 0.24, 0.32, 6), k.L1, -0.8, 0, 0, PI / 6, 0, PI / 2));
    return { g };
}

/** Stepped eccentric shaft (standing upright, as photographed). */
function eccentricShaft(k: Kit): Built {
    const g = new THREE.Group();
    const steps: [number, number, number][] = [
        // radius, length, x offset
        [0.2, 0.9, 0],
        [0.24, 0.25, 0],
        [0.3, 0.06, 0],
        [0.26, 0.55, 0.04],
        [0.31, 0.08, 0.04],
        [0.26, 0.5, 0.04],
        [0.23, 0.2, 0],
        [0.2, 0.85, 0]
    ];
    let y = -1.65;
    for (const [r, l, dx] of steps) {
        g.add(M(C(r, r, l, 48), k.L1, dx, y + l / 2, 0));
        y += l;
    }
    g.add(M(B(0.07, 0.45, 0.04), k.D, 0, 1.0, 0.19));
    g.add(M(B(0.07, 0.45, 0.04), k.D, 0, -1.25, 0.19));
    return { g };
}

/** Adjusting plate bearing pair: mirrored base plates with raised bearing plates. */
function adjustingPlates(k: Kit): Built {
    const g = new THREE.Group();
    const one = () => {
        const a = new THREE.Group();
        const base = poly([[-1.0, -1.0], [0.55, -1.0], [1.0, -0.15], [0.8, 1.0], [-1.0, 1.0]]);
        for (const [x, y] of [[-0.85, 0.85], [0.6, 0.85], [-0.85, -0.85], [0.85, -0.2]]) base.holes.push(circlePath(x, y, 0.04));
        a.add(flatPlate(base, 0.05, k.L2, 0));
        // raised plate: centre bore, four slots, four small holes
        const top = poly([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
        top.holes.push(circlePath(0, 0, 0.16));
        top.holes.push(slotPath(-0.35, 0, 0.3, 0.07, true), slotPath(0.35, 0, 0.3, 0.07, true), slotPath(0, 0.36, 0.3, 0.07), slotPath(0, -0.36, 0.3, 0.07));
        for (const [x, y] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]]) top.holes.push(circlePath(x, y, 0.03));
        const tp = flatPlate(top, 0.07, k.L2, 0.32);
        const sub = G(tp);
        // angle supports under two edges
        const ang = poly([[0, 0], [0.12, 0], [0.12, 0.28], [0.03, 0.28], [0.03, 0.0]]);
        sub.add(M(extrude(ang, 0.9), k.L2, -0.52, 0.03, 0));
        sub.add(M(extrude(ang, 0.9), k.L2, 0, 0.03, 0.52, 0, PI / 2, 0));
        at(sub, -0.05, 0, 0.1, 0, 0.35, 0);
        a.add(sub);
        // loose bar with two lugs
        const bar = G(M(B(0.9, 0.12, 0.22), k.L2, 0, 0.06, 0));
        for (const x of [-0.3, 0.3]) bar.add(M(B(0.08, 0.14, 0.2), k.L2, x, 0.18, 0));
        at(bar, 0.25, 0.03, 0.75, 0, 0.15, 0);
        a.add(bar);
        return a;
    };
    const left = one();
    left.position.x = -1.1;
    const right = one();
    right.scale.x = -1; // the right-hand plate is the opposite-hand pattern
    right.position.x = 1.1;
    g.add(left, right);
    return { g };
}

// =====================================================================
// Fallbacks for parts not in the photo catalogue
// =====================================================================

function motor(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(C(0.75, 0.75, 2.0, 48), k.L2, 0, 0, 0, 0, 0, PI / 2));
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        if (Math.sin(a) < -0.6) continue;
        g.add(M(B(1.8, 0.05, 0.12), k.L2, 0, Math.sin(a) * 0.75, Math.cos(a) * 0.75, a, 0, 0));
    }
    g.add(M(C(0.77, 0.77, 0.45, 40, true), k.L2, -1.2, 0, 0, 0, 0, PI / 2));
    g.add(M(C(0.12, 0.12, 0.5, 20), k.L1, 1.25, 0, 0, 0, 0, PI / 2));
    g.add(M(RB(0.55, 0.35, 0.5, 0.04), k.L2, 0, 0.9, 0));
    for (const x of [-0.6, 0.6]) g.add(M(B(0.35, 0.5, 1.3), k.L2, x, -0.6, 0));
    return { g };
}

function gasket(k: Kit): Built {
    const s = new THREE.Shape();
    s.absarc(0, 0, 1.1, 0, PI * 2, false);
    s.holes.push(circlePath(0, 0, 0.7));
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        s.holes.push(circlePath(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.06));
    }
    return { g: G(M(extrude(s, 0.08), k.L2)) };
}

function block(k: Kit): Built {
    const g = new THREE.Group();
    g.add(M(RB(2.2, 1.2, 1.4, 0.1), k.L1));
    g.add(M(C(0.32, 0.32, 0.3, 32), k.L1, 0, 0.75, 0));
    g.add(M(C(0.2, 0.2, 0.32, 24), k.D, 0, 0.76, 0));
    for (const [x, z] of [[-0.85, 0.5], [0.85, 0.5], [-0.85, -0.5], [0.85, -0.5]]) g.add(M(hex(0.1, 0.1), k.L3, x, 0.63, z));
    return { g };
}

export const castBuilders = {
    castCone,
    vaneRing,
    fireDoor,
    fireGrate,
    ashBar,
    vgPlate,
    vgPipeBar,
    vgLBar,
    vgSealBar,
    vgTuyere,
    vgTuyereHolder,
    steelPlate,
    sphericalRollerBearing,
    sphericalPlainBearing,
    lockPin,
    eccentricShaft,
    adjustingPlates,
    motor,
    gasket,
    block
};

export const instrumentBuilders = {
    yokogawaTransmitter,
    mobreyLevelControl,
    mobreyLevelSwitch,
    dialGauge,
    edgewiseGauge,
    fivalLevelGauge,
    ariSafetyValve,
    blowdownValve,
    rotaryControlValve,
    autoBlowdownValve,
    diaphragmValve,
    globeValve
};