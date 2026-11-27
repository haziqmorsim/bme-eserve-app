import * as THREE from 'three';
import { makeKit, outline, type Built, type Kit } from './cad-kit';
import { castBuilders as cb, instrumentBuilders as ib, panelBuilders as pb } from './catalog-models';

export type PartInfo = {
    name: string;
    description?: string | null;
    component?: string | null;
    /** The part's photo URL; its file name identifies catalogue parts. */
    photo?: string | null;
};

export type PartModel = {
    group: THREE.Group;
    /** Which entry was used, e.g. "vane"; handy for checking. */
    kind: string;
    /** The angle the model is first shown from, matching the photo: degrees round (az) and above (el). */
    view: { az: number; el: number };
    /** The outline material, so the viewer can tune it for light / dark. */
    lines: THREE.LineBasicMaterial;
    tick: (t: number) => void;
    dispose: () => void;
};

type Entry = { id: string; re: RegExp; view: [number, number]; build: (k: Kit, text: string) => Built };

const inches = (t: string) => {
    const m = t.match(/(\d+(?:\.\d+)?)\s*in\b/);
    return m ? parseFloat(m[1]) : 0;
};

// Order matters: the more specific names come first.
const CATALOG: Entry[] = [
    { id: 'dpTransmitter', re: /\bdp\b.*transmitter|differential/, view: [-35, 18], build: (k) => ib.yokogawaTransmitter(k, false) },
    { id: 'pressureTransmitter', re: /pressure transmitter|transmitter/, view: [-35, 18], build: (k) => ib.yokogawaTransmitter(k, true) },
    { id: 'mobreyControl', re: /l(e)?v(e)?l\s*control|ds13/, view: [-15, 18], build: (k) => ib.mobreyLevelControl(k) },
    { id: 'mobreySwitch', re: /level\s*switch|bd\s*14|mobrey/, view: [-12, 8], build: (k) => ib.mobreyLevelSwitch(k) },
    { id: 'epRegulator', re: /itv|e\s*\/?\s*p\s*regulator|electro.?pneumatic/, view: [0, 8], build: (k) => pb.itvRegulator(k) },
    { id: 'airCylinderPositioner', re: /air\s*cyl\w*\s*(50|80)|ip\s*200/, view: [0, 16], build: (k, t) => pb.airCylinderPositioner(k, /\b80\b|80-|80\s/.test(t) ? 80 : 50) },
    { id: 'airCylinder', re: /air\s*cyl|cylinder/, view: [0, 14], build: (k) => pb.airCylinder(k) },
    { id: 'mistSeparator', re: /mist|separator|sprt/, view: [0, 6], build: (k) => pb.smcFilter(k, true) },
    { id: 'airFilter', re: /air\s*filter|filter/, view: [0, 6], build: (k) => pb.smcFilter(k, false) },
    { id: 'airRegulator', re: /air\s*reg|regulator|pr\s*[34]000/, view: [0, 6], build: (k, t) => pb.smcRegulator(k, /4000|ar\s*40/.test(t) ? 1.1 : 1) },
    { id: 'levelGauge', re: /bi.?colou?r|level\s*gauge/, view: [0, 22], build: (k) => ib.fivalLevelGauge(k, 7, true) },
    { id: 'centrePiece', re: /cent(er|re)\s*piece/, view: [0, 22], build: (k) => ib.fivalLevelGauge(k, 8, true) },
    { id: 'draftGauge', re: /nagano|draft\s*gauge/, view: [28, 10], build: (k, t) => ib.edgewiseGauge(k, /200/.test(t) ? ['0', '-50', '-100', '-150', '-200'] : ['75', '50', '25', '0', '-25']) },
    { id: 'tempGaugeAngle', re: /tem(p|perature)?\b.*gauge.*angle|thermometer.*angle/, view: [0, 6], build: (k) => ib.dialGauge(k, { unit: '°C', max: 600, conn: 'stem-angle', caseMat: 'mid', depth: 0.5 }) },
    { id: 'tempGauge', re: /tem(p|perature)?\b.*gauge|thermometer/, view: [28, 0], build: (k) => ib.dialGauge(k, { unit: '°C', max: 500, conn: 'stem-back', caseMat: 'mid', depth: 0.55 }) },
    { id: 'oilGauge', re: /\bp\s*gauge|gauge\s*oil|liquid/, view: [0, 0], build: (k) => ib.dialGauge(k, { unit: 'bar', max: 60, conn: 'bottom', liquid: true, sub: true, depth: 0.5 }) },
    { id: 'pressureGauge4', re: /pressure\s*gauge\s*4\s*in|gauge\s*4in/, view: [0, 0], build: (k) => ib.dialGauge(k, { unit: 'kg/cm²', max: 20, conn: 'bottom', caseMat: 'dark', sub: true }) },
    { id: 'pressureGauge', re: /pressure\s*gauge|gauge/, view: [0, 0], build: (k, t) => ib.dialGauge(k, { unit: 'bar', max: 70, conn: 'bottom', cap: true, depth: inches(t) >= 10 ? 0.32 : 0.42 }) },
    { id: 'autoBlowdown', re: /auto\s*-?\s*blow\s*-?\s*down/, view: [0, 14], build: (k) => ib.autoBlowdownValve(k) },
    { id: 'blowdownValve', re: /blow\s*-?\s*down|pa46/, view: [0, 14], build: (k) => ib.blowdownValve(k) },
    { id: 'autoVent', re: /auto\s*-?\s*vent/, view: [0, 8], build: (k) => ib.diaphragmValve(k) },
    { id: 'controlValve', re: /control\s*v(al)?v/, view: [35, 28], build: (k) => ib.rotaryControlValve(k) },
    { id: 'safetyValve', re: /safety\s*v(al)?v/, view: [32, 10], build: (k, t) => ib.ariSafetyValve(k, /3\s*in\s*x\s*4/.test(t) ? 1.2 : /2\s*in\s*x\s*3/.test(t) ? 1.1 : 1) },
    { id: 'ut35a', re: /ut\s*35|ut35a/, view: [-18, 14], build: (k) => pb.ut35a(k) },
    { id: 'db1030', re: /db\s*1030|db1000/, view: [-22, 14], build: (k) => pb.chinoDB1030(k) },
    { id: 'db670', re: /db\s*670/, view: [-18, 14], build: (k) => pb.chinoDB670(k) },
    { id: 'recorder', re: /recorder/, view: [-15, 16], build: (k) => pb.paperlessRecorder(k) },
    { id: 'pneumaticController', re: /mc\s*43|pneumatic\s*controller|controllermc/, view: [0, 16], build: (k) => pb.mcController(k) },
    { id: 'signalSplitter', re: /splitter|isolator/, view: [-55, 12], build: (k) => pb.signalSplitter(k) },
    { id: 'loadingStation', re: /loading\s*station/, view: [14, 10], build: (k) => pb.loadingStation(k) },
    { id: 'biasRelay', re: /bias\s*relay|relay/, view: [10, 14], build: (k) => pb.biasRelay(k) },
    { id: 'inverterBlack', re: /inverter.*5\.?5|5\.5\s*kw/, view: [-28, 14], build: (k) => pb.blackInverter(k) },
    { id: 'inverter', re: /inverter|vfd/, view: [0, 6], build: (k) => pb.fujiInverter(k) },
    { id: 'feedPump', re: /pump/, view: [-22, 16], build: (k) => pb.feedPumpSet(k) },
    { id: 'cone', re: /\bcone\b/, view: [0, 18], build: (k) => cb.castCone(k) },
    { id: 'vane', re: /vane/, view: [0, 32], build: (k) => cb.vaneRing(k) },
    { id: 'fireDoor', re: /fire\s*door|door/, view: [0, 22], build: (k) => cb.fireDoor(k) },
    { id: 'fireGrate', re: /fire\s*grate|grate\s*bar/, view: [8, 24], build: (k, t) => cb.fireGrate(k, /1220/.test(t) ? 4.9 : 4.0) },
    { id: 'ashBar', re: /ash\s*bar/, view: [35, 38], build: (k) => cb.ashBar(k) },
    { id: 'tuyereHolder', re: /tuy\w*\s*holder/, view: [0, 72], build: (k) => cb.vgTuyereHolder(k) },
    { id: 'tuyereRight', re: /tuy\w*\s*(right|left)/, view: [0, 72], build: (k) => cb.vgTuyere(k, true) },
    { id: 'tuyereMiddle', re: /tuy\w*/, view: [0, 72], build: (k) => cb.vgTuyere(k, false) },
    { id: 'pipeBar', re: /pipe\s*bar|hex\s*shape/, view: [0, 12], build: (k) => cb.vgPipeBar(k) },
    { id: 'sealBar', re: /seal\s*bar/, view: [0, 10], build: (k) => cb.vgSealBar(k) },
    { id: 'lBar', re: /side\s*l\s*bar|\bl[\s-]bar\b/, view: [0, 18], build: (k) => cb.vgLBar(k) },
    { id: 'vgNonActive', re: /non[\s-]?active/, view: [0, 62], build: (k) => cb.vgPlate(k, false) },
    { id: 'vgActive', re: /active|\bvg\b/, view: [0, 62], build: (k) => cb.vgPlate(k, true) },
    { id: 'steelPlate', re: /17\s*-?\s*4\s*ph|stainless\s*steel|\bplate\b(?!.*bearing)|sheet/, view: [0, 60], build: (k) => cb.steelPlate(k) },
    { id: 'adjustingPlate', re: /adjusting\s*plate/, view: [0, 58], build: (k) => cb.adjustingPlates(k) },
    { id: 'plainBearing', re: /gez|spherical\s*plain|rod\s*end/, view: [0, 0], build: (k) => cb.sphericalPlainBearing(k) },
    { id: 'rollerBearing', re: /bearing|22320/, view: [0, 0], build: (k) => cb.sphericalRollerBearing(k) },
    { id: 'eccentricShaft', re: /eccentric|shaft/, view: [0, 10], build: (k) => cb.eccentricShaft(k) },
    { id: 'lockPin', re: /\bpin\b|rocker/, view: [0, 6], build: (k) => cb.lockPin(k) },
    { id: 'valve', re: /\bvalve\b|\bvlv\b/, view: [25, 15], build: (k) => ib.globeValve(k) },
    { id: 'motor', re: /motor/, view: [-25, 15], build: (k) => cb.motor(k) },
    { id: 'gasket', re: /gasket|o[\s-]?ring|washer/, view: [0, 20], build: (k) => cb.gasket(k) }
];

function photoKey(url?: string | null): string {
    if (!url) return '';
    try {
        const file = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
        return file.replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[-_]+/g, ' ');
    } catch {
        return '';
    }
}

function pick(info: PartInfo): { entry: Entry | null; text: string } {
    const candidates = [photoKey(info.photo), info.name, info.description, info.component].map((t) => (t ?? '').toLowerCase().trim());
    for (const t of candidates) {
        if (!t) continue;
        const entry = CATALOG.find((e) => e.re.test(t));
        if (entry) return { entry, text: `${t} ${(info.name ?? '').toLowerCase()}` };
    }
    return { entry: null, text: (info.name ?? '').toLowerCase() };
}

/** The entry a part would get (for checking the matching). */
export function partKind(info: PartInfo): string {
    return pick(info).entry?.id ?? 'block';
}

export function buildPartModel(info: PartInfo): PartModel {
    const k = makeKit();
    const { entry, text } = pick(info);
    let built: Built;
    try {
        built = entry ? entry.build(k, text) : castBlock(k);
    } catch (e) {
        console.error('Part model failed, using a generic one', e);
        built = castBlock(k);
    }
    const group = new THREE.Group();
    group.add(built.g);
    const lines = outline(group, k);
    return {
        group,
        kind: entry?.id ?? 'block',
        view: { az: entry?.view[0] ?? 30, el: entry?.view[1] ?? 18 },
        lines,
        tick: built.tick ?? (() => {}),
        dispose: () => {
            group.traverse((o) => {
                const m = o as THREE.Mesh;
                if (m.geometry) m.geometry.dispose();
            });
            for (const m of k.mats) m.dispose();
            for (const t of k.textures) t.dispose();
        }
    };
}

function castBlock(k: Kit): Built {
    return cb.block(k);
}