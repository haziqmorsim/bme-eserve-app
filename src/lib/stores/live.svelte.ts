import { levelFor, type MetricRow } from "$lib/telemetry";

export type Reading = { v: number; t: string };
export type BoilerValues = Record<string, Reading>;

export type BoilerMeta = {
    id: string;
    code: string;
    projectNo: string | null;
};

export type AttentionEvent = {
    boilerId: string;
    boilerCode: string;
    projectNo: string | null;
    metricKey: string;
    metricLabel: string;
    unit: string;
    value: number;
    sectionKey: string | null;
};

const LIVE_MS = 5000;

function stepValue(v: number, m: MetricRow): number {
    const lo = Number(m.min_normal);
    const hi = Number(m.max_normal);
    const span = Math.max(hi - lo, 0.001);
    const mid = (lo + hi) / 2;

    let next = v + (mid - v) * 0.12 + (Math.random() - 0.5) * span * 0.18;
    if (Math.random() < 0.04) {
        next += (Math.random() < 0.5 ? -1 : 1) * span * 0.6;
    }

    const floor = Number(m.min_warning) - span * 0.2;
    const ceil = Number(m.max_warning) + span * 0.2;
    return Math.round(Math.max(floor, Math.min(ceil, next)) * 100) / 100;
}

class LiveTelemetry {
    metrics = $state<MetricRow[]>([]);
    values = $state<Record<string, BoilerValues>>({});

    #meta: Record<string, BoilerMeta> = {};
    #timer: ReturnType<typeof setInterval> | null = null;
    #seedKey = '';
    #notified = new Set<string>();
    #onAttention: ((e: AttentionEvent) => void) | null = null;

    seed(metrics: MetricRow[], rows: { boiler_id: string; metric_key: string; value: number; recorded_at: string }[], meta: BoilerMeta[]) {
        const key = meta.map((m) => m.id).sort().join(',') + '|' + metrics.length;
        if (key === this.#seedKey) return;
        this.#seedKey = key;

        this.metrics = metrics;
        this.#meta = Object.fromEntries(meta.map((m) => [m.id, m]));

        const next: Record<string, BoilerValues> = {};
        for (const r of rows) {
            (next[r.boiler_id] ??= {})[r.metric_key] = {
                v: Number(r.value),
                t: r.recorded_at
            };
        }
        this.values = next;
    }

    start(onAttention: (e: AttentionEvent) => void) {
        this.#onAttention = onAttention;
        if (this.#timer) return;
        this.#timer = setInterval(() => this.tick(), LIVE_MS);
    }

    stop() {
        if (this.#timer) clearInterval(this.#timer);
        this.#timer = null;
    }

    valuesFor(boilerId: string): BoilerValues {
        return this.values[boilerId] ?? {};
    }

    tick() {
        const ms = this.metrics;
        if (!ms.length) return;

        const now = new Date().toISOString();
        const next: Record<string, BoilerValues> = {};
        const raised: AttentionEvent[] = [];
        const stillAttention = new Set<string>();

        for(const [boilerId, current] of Object.entries(this.values)) {
            const out: BoilerValues = {};
            for (const m of ms) {
                const cur = current[m.metric_key];
                if (!cur) continue;

                const v = stepValue(cur.v, m);
                out[m.metric_key] = { v, t: now };

                const key = `${boilerId}:${m.metric_key}`;
                if (levelFor(v, m) === 'attention') {
                    stillAttention.add(key);
                    if (!this.#notified.has(key)) {
                        const meta = this.#meta[boilerId];
                        raised.push({
                            boilerId,
                            boilerCode: meta?.code ?? '',
                            projectNo: meta?.projectNo ?? null,
                            metricKey: m.metric_key,
                            metricLabel: m.label,
                            unit: m.unit,
                            value: v,
                            sectionKey: m.section_key
                        });
                    }
                }
            }
            next[boilerId] = out;
        }

        this.values = next;

        for (const key of [...this.#notified]) {
            if (!stillAttention.has(key)) this.#notified.delete(key);
        }
        for (const e of raised) {
            this.#notified.add(`${e.boilerId}:${e.metricKey}`);
            this.#onAttention?.(e);
        }
    }
}

export const live = new LiveTelemetry();