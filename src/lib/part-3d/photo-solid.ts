import * as THREE from 'three';
import type { HeightMap } from './relief';

export type PhotoSolid = {
    group: THREE.Group;
    /** Size of the solid in world units (x: width, y: height, z: thickness). */
    size: THREE.Vector3;
    dispose: () => void;
};

/** Square grid resolution for the surface (vertices per side). */
const GRID = 256;

function sample(src: Float32Array, size: number, n: number): Float32Array {
    // bilinear resample of a size x size map to n x n
    const out = new Float32Array(n * n);
    const k = (size - 1) / (n - 1);
    for (let y = 0; y < n; y++) {
        const fy = y * k;
        const y0 = Math.floor(fy);
        const y1 = Math.min(size - 1, y0 + 1);
        const ty = fy - y0;
        for (let x = 0; x < n; x++) {
            const fx = x * k;
            const x0 = Math.floor(fx);
            const x1 = Math.min(size - 1, x0 + 1);
            const tx = fx - x0;
            const a = src[y0 * size + x0] * (1 - tx) + src[y0 * size + x1] * tx;
            const b = src[y1 * size + x0] * (1 - tx) + src[y1 * size + x1] * tx;
            out[y * n + x] = a * (1 - ty) + b * ty;
        }
    }
    return out;
}

/** Distance (in cells) from each inside cell to the nearest outside cell. */
function chamfer(inside: Uint8Array, n: number): Float32Array {
    const d = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) d[i] = inside[i] ? 1e6 : 0;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : d[y * n + x]);
    const D = Math.SQRT2;
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            const i = y * n + x;
            if (inside[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
        }
    for (let y = n - 1; y >= 0; y--)
        for (let x = n - 1; x >= 0; x--) {
            const i = y * n + x;
            if (inside[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
        }
    return d;
}

/** Separable max filter (radius r) — the "local thickness" of the outline. */
function maxFilter(src: Float32Array, n: number, r: number): Float32Array {
    const tmp = new Float32Array(n * n);
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            let m = 0;
            for (let k = Math.max(0, x - r); k <= Math.min(n - 1, x + r); k++) m = Math.max(m, src[y * n + k]);
            tmp[y * n + x] = m;
        }
    for (let x = 0; x < n; x++)
        for (let y = 0; y < n; y++) {
            let m = 0;
            for (let k = Math.max(0, y - r); k <= Math.min(n - 1, y + r); k++) m = Math.max(m, tmp[k * n + x]);
            out[y * n + x] = m;
        }
    return out;
}

/** 3x3 box blur, only mixing cells inside the outline. */
function blurInside(src: Float32Array, inside: Uint8Array, n: number, passes: number): Float32Array {
    let a = src;
    for (let p = 0; p < passes; p++) {
        const b = new Float32Array(n * n);
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const i = y * n + x;
                if (!inside[i]) continue;
                let s = 0;
                let c = 0;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const xx = x + dx;
                        const yy = y + dy;
                        if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
                        const j = yy * n + xx;
                        if (!inside[j]) continue;
                        s += a[j];
                        c++;
                    }
                b[i] = s / c;
            }
        a = b;
    }
    return a;
}

export function buildPhotoSolid(photo: HTMLImageElement, hm: HeightMap): PhotoSolid {
    const n = GRID;
    const mask = sample(hm.mask, hm.size, n);
    const depth = sample(hm.z, hm.size, n);

    // inside = the part; shave one cell off the outline to drop the photo's background fringe
    const raw = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) raw[i] = mask[i] > 0.5 ? 1 : 0;
    const inside = new Uint8Array(n * n);
    for (let y = 1; y < n - 1; y++)
        for (let x = 1; x < n - 1; x++) {
            const i = y * n + x;
            inside[i] = raw[i] & raw[i - 1] & raw[i + 1] & raw[i - n] & raw[i + n];
        }

    const dist = chamfer(inside, n);
    const local = maxFilter(dist, n, Math.round(n * 0.05));
    const cap = n * 0.16;
    const body = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
        if (!inside[i]) continue;
        const d = dist[i] - 1;
        const L = Math.max(1, local[i]);
        body[i] = Math.min(cap, 0.55 * Math.sqrt(Math.max(0, d * (2 * L - d))));
    }

    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n * n; i++)
        if (inside[i]) {
            lo = Math.min(lo, depth[i]);
            hi = Math.max(hi, depth[i]);
        }
    const span = hi > lo ? hi - lo : 1;
    const det = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) if (inside[i]) det[i] = (depth[i] - lo) / span;
    const detail = blurInside(det, inside, n, 3);
    const DETAIL = n * 0.07;
    const front = new Float32Array(n * n);
    const back = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
        if (!inside[i]) continue;
        const fade = Math.min(1, Math.max(0, (dist[i] - 1) / 5));
        const dd = detail[i] * DETAIL * fade * fade;
        front[i] = body[i] + dd;
        back[i] = body[i] + dd * 0.6;
    }

    // world size: the photo's aspect, 2 units across its long side
    const aspect = photo.naturalWidth / Math.max(1, photo.naturalHeight);
    const W = aspect >= 1 ? 2 : 2 * aspect;
    const H = aspect >= 1 ? 2 / aspect : 2;
    const cell = (W + H) / 2 / (n - 1);

    // two grids (front and back) sharing the rim
    const count = n * n;
    const pos = new Float32Array(count * 2 * 3);
    const uv = new Float32Array(count * 2 * 2);
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            const i = y * n + x;
            const px = (x / (n - 1) - 0.5) * W;
            const py = (0.5 - y / (n - 1)) * H;
            const u = x / (n - 1);
            const v = 1 - y / (n - 1);
            pos.set([px, py, front[i] * cell], i * 3);
            pos.set([px, py, -back[i] * cell], (count + i) * 3);
            uv.set([u, v], i * 2);
            uv.set([u, v], (count + i) * 2);
        }
    const index: number[] = [];
    let zMin = 0;
    let zMax = 0;
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let y = 0; y < n - 1; y++)
        for (let x = 0; x < n - 1; x++) {
            const a = y * n + x;
            const b = a + 1;
            const c = a + n;
            const d = c + 1;
            if (!(inside[a] | inside[b] | inside[c] | inside[d])) continue;
            index.push(a, c, b, b, c, d); // front faces +z
            index.push(count + a, count + b, count + c, count + b, count + d, count + c); // back faces -z
            for (const k of [a, b, c, d]) {
                if (!inside[k]) continue;
                zMax = Math.max(zMax, front[k] * cell);
                zMin = Math.min(zMin, -back[k] * cell);
                xMin = Math.min(xMin, pos[k * 3]);
                xMax = Math.max(xMax, pos[k * 3]);
                yMin = Math.min(yMin, pos[k * 3 + 1]);
                yMax = Math.max(yMax, pos[k * 3 + 1]);
            }
        }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();

    const nrm = geo.getAttribute('normal');
    const col = new Float32Array(count * 2 * 3);
    const L1 = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
    const L2 = new THREE.Vector3(-0.35, 0.45, -0.82).normalize();
    const v3 = new THREE.Vector3();
    for (let i = 0; i < count * 2; i++) {
        v3.fromBufferAttribute(nrm, i);
        const s = Math.min(1.04, 0.62 + 0.5 * Math.max(0, v3.dot(L1), v3.dot(L2)));
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const map = new THREE.Texture(photo);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
    const mc = document.createElement('canvas');
    mc.width = mc.height = 1024;
    const mg = mc.getContext('2d')!;
    mg.imageSmoothingEnabled = true;
    mg.imageSmoothingQuality = 'high';
    mg.drawImage(hm.maskCanvas, 0, 0, 1024, 1024);
    const alpha = new THREE.CanvasTexture(mc);
    const mat = new THREE.MeshBasicMaterial({
        map,
        alphaMap: alpha,
        alphaTest: 0.75,
        vertexColors: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(-(xMin + xMax) / 2, -(yMin + yMax) / 2, -(zMin + zMax) / 2);
    const holder = new THREE.Group();
    holder.add(group);

    return {
        group: holder,
        size: new THREE.Vector3(xMax - xMin, yMax - yMin, zMax - zMin),
        dispose: () => {
            geo.dispose();
            mat.dispose();
            map.dispose();
            alpha.dispose();
        }
    };
}