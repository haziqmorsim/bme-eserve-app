import { browser } from "$app/environment";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from "$env/static/public";
import { HEAT_COLS, HEAT_ROWS } from "./analytics/behaviour";

type Identity = { id: string; role: string | null } | null;
type Meta = Record<string, unknown>;

type Row = {
    user_id: string | null;
    role: string | null;
    event_type: string;
    path: string | null;
    meta: Meta | null;
    session_id: string | null;
    visitor_id: string | null;
    created_at: string;
};

type PageState = {
    path: string;
    meta: Meta | null;
    startedAt: number;
    visibleMs: number;
    visibleSince: number | null;
    scrollMax: number;
    clicks: number;
    moves: Record<number, number>;
    clickGrid: Record<number, number>;
};

const ANON_TYPES = new Set(['landing', 'enquiry_view', 'enquiry_start', 'enquiry_submit']);

const VISITOR_KEY = 'bme_vid';
const SESSION_KEY = 'bme_sid';
const SESSION_TS_KEY = 'bme_sid_ts';
const TRAFFIC_KEY = 'bme_traffic';
const LANDED_KEY = 'bme_landed';
const SESSION_USER_KEY = 'bme_sid_user';

const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 10_000;
const FLUSH_AT = 25;
const BATCH_SIZE = 40;
const MAX_PAGE_MS = 30 * 60 * 1000;
const FILE_RE = /\.(pdf|xlsx?|csv|docx?|pptx?|zip|txt|png|jpe?g|webp)$/i;

let started = false;
let disabled = false;
let identity: Identity = null;
let accessToken: string | null = null;
let queue: Row[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let current: PageState | null = null;
let lastMove = 0;
let lastScroll = 0;
let lastStamp = 0;

function stamp(): string {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    return new Date(lastStamp).toISOString();
}

function readStore(store: 'local' | 'session', key: string): string | null {
    try {
        return (store === 'local' ? localStorage : sessionStorage).getItem(key);
    } catch {
        return null;
    }
}

function writeStore(store: 'local' | 'session', key: string, value: string): void {
    try {
        (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
    } catch {
        // ignore
    }
}

function newId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
}

function visitorId(): string {
    let id = readStore('local', VISITOR_KEY);
    if (!id) {
        id = newId();
        writeStore('local', VISITOR_KEY, id);
    }
    return id;
}

function sessiodId(): string {
    const now = Date.now();
    let id = readStore('local', SESSION_KEY);
    const last = Number(readStore('local', SESSION_TS_KEY) ?? 0);
    if (!id || !last || now - last > SESSION_IDLE_MS) {
        id = newId();
        writeStore('local', SESSION_KEY, id);
    }
    writeStore('local', SESSION_TS_KEY, String(now));
    return id;
}

function classifySource(host: string, utmSource: string | null): string {
    if (utmSource) return utmSource.toLowerCase();
    if (!host) return 'direct';
    if (/google\.|bing\.|yahoo\.|duckduckgo\./i.test(host)) return 'search';
    if (/outlook\.|office\.|live\.com|mail\./i.test(host)) return 'email';
    if (/whatsapp|facebook|linkedin|instagram|t\.co|twitter|x\.com/i.test(host)) return 'social';
    return 'referral';
}

function trafficInfo(): Meta {
    const saved = readStore('session', TRAFFIC_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            // fall through and recompute
        }
    }
    let host = '';
    try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.host !== location.host) host = ref.host;
    } catch {
        host = '';
    }
    const params = new URLSearchParams(location.search);
    const utmSource = params.get('utm_source');
    const width = window.innerWidth;
    const info: Meta = {
        source: classifySource(host, utmSource),
        referrer: host || null,
        utm_source: utmSource,
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        device: width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop',
        location: location.pathname
    };
    writeStore('session', TRAFFIC_KEY, JSON.stringify(info));
    return info;
}

function enqueue(eventType: string, meta: Meta | null = null, path: string | null = null): void {
    if (!browser || disabled) return;
    if (!identity && !ANON_TYPES.has(eventType)) return;

    queue.push({
        user_id: identity?.id ?? null,
        role: identity ? identity.role : null,
        event_type: eventType,
        path: path ?? location.pathname,
        meta: meta && Object.keys(meta).length ? meta : null,
        session_id: sessiodId(),
        visitor_id: visitorId(),
        created_at: stamp()
    });

    if (queue.length >= FLUSH_AT) {
        flush();
    } else if (!flushTimer) {
        flushTimer = setTimeout(() => flush(), FLUSH_DELAY_MS);
    }
}

export function flush(keepalive = false): void {
    if (!browser) return;
    clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!queue.length || disabled) return;
    if (identity && !accessToken) return;

    const rows = queue;
    queue = [];
    const token = accessToken ?? PUBLIC_SUPABASE_ANON_KEY;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        try {
            void fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/activity_events`, {
                method: 'POST',
                keepalive,
                headers: {
                    apikey: PUBLIC_SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal'
                },
                body: JSON.stringify(batch)
            }).catch(() => {});
        } catch {
            // Analytics must never break the app
        }
    }
}

function scrollDepth(): number {
    const doc = document.documentElement;
    const height = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
    if (height <= window.innerHeight) return 100;
    return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
}

function cellOf(x: number, y: number):number {
    const col = Math.min(HEAT_COLS - 1, Math.max(0, Math.floor((x / window.innerWidth) * HEAT_COLS)));
    const row = Math.min(HEAT_ROWS - 1, Math.max(0, Math.floor((y / window.innerHeight) * HEAT_ROWS)));
    return row * HEAT_COLS * col;
}

export function endPage(): void {
    if (!browser || !current) return;
    const page = current;
    current = null;
    if (page.visibleSince !== null) page.visibleMs += Date.now() - page.visibleSince;

    enqueue(
        'page_leave',
        {
            ...(page.meta ?? {}),
            dur: Math.min(MAX_PAGE_MS, Math.round(page.visibleMs)),
            scroll: Math.max(page.scrollMax, 0),
            clicks: page.clicks,
            grid: page.moves,
            cgrid: page.clickGrid
        },
        page.path
    );
}

export function pageView(path: string, meta: Meta | null = null): void {
    if (!browser || disabled || !identity) return;
    endPage();
    current = {
        path,
        meta,
        startedAt: Date.now(),
        visibleMs: 0,
        visibleSince: document.visibilityState === 'visible' ? Date.now() : null,
        scrollMax: 0,
        clicks: 0,
        moves: {},
        clickGrid: {}
    };
    enqueue('page_view', meta, path);
    setTimeout(() => {
        if (current && current.path === path) current.scrollMax = Math.max(current.scrollMax, scrollDepth());
    }, 600);
}

export function trackingIds(): { session_id: string, visitor_id: string } | null {
    if (!browser || disabled) return null;
    return { session_id: sessiodId(), visitor_id: visitorId() };
}

export function track(eventType: string, meta: Meta | null = null): void {
    enqueue(eventType, meta);
}

function labelOf(el: Element): string {
    const raw = 
        el.getAttribute('data-track') || 
        el.getAttribute('aria-label') || 
        el.getAttribute('title') || 
        (el as HTMLElement).innerText || 
        el.textContent || 
        '';
    const text = raw.replace(/\s+/g, ' ').trim();
    return (text.length > 60 ? `${text.slice(0, 59)}…` : text) || el.tagName.toLowerCase();
}

function onClick(e: MouseEvent): void {
    if (!identity || disabled) return;
    const target = e.target as Element | null;
    if (!target?.closest) return;

    if (current) {
        current.clicks++;
        if (e.clientX || e.clientY) {
            const cell = cellOf(e.clientX, e.clientY);
            current.clickGrid[cell] = (current.clickGrid[cell] ?? 0) + 1;
        }
    }

    if (target.closest('[data-track-ignore]')) return;
    const el = target.closest('a, button, [role="button"], [role="tab"], summary, [data-event]');
    if (!el) return;

    const tagged = el.getAttribute('data-event');
    if (tagged && /^[a-z_]{2,40}$/.test(tagged)) {
        track(tagged, { label: el.getAttribute('data-event-label') || labelOf(el) });
        return;
    }

    if (el instanceof HTMLAnchorElement) {
        let file = el.getAttribute('download') || '';
        let path = '';
        try {
            path = decodeURIComponent(new URL(el.href, location.href).pathname);
        } catch {
            path = '';
        }
        if (!file && FILE_RE.test(path)) file = path.split('/').pop() ?? '';
        if (file || el.hasAttribute('download')) {
            track('file_download', { label: (file || labelOf(el)).replace(/^\d{10,}_/, '').slice(0, 129) });
            return;
        }
    }

    const cta = el.matches('.btn-primary, [data-cta]') || (el.getAttribute('data-track') ?? '').startsWith('cta');
    track('click', {
        label: labelOf(el),
        el: el instanceof HTMLAnchorElement ? 'link' : 'button',
        ...(cta ? { cta: 1 } : {})
    });
}

function onPointerMove(e: PointerEvent): void {
    if (!current || e.pointerType !== 'mouse') return;
    const now = Date.now();
    if (now - lastMove < 120) return;
    lastMove = now;
    const cell = cellOf(e.clientX, e.clientY);
    current.moves[cell] = (current.moves[cell] ?? 0) + 1;
}

function onScroll(): void {
    if (!current) return;
    const now = Date.now();
    if (now - lastScroll < 250) return;
    lastScroll = now;
    current.scrollMax = Math.max(current.scrollMax, scrollDepth());
}

function onVisibility(): void {
    if (current) {
        if (document.visibilityState === 'hidden') {
            if (current.visibleSince !== null) current.visibleMs += Date.now() - current.visibleSince;
            current.visibleSince = null;
        } else if (current.visibleSince === null) {
            current.visibleSince = Date.now();
        }
    }
    if (document.visibilityState === 'hidden') flush(true);
}

function onPageHide(): void {
    endPage();
    flush(true);
}

export function startTracking(signedIn: boolean): void {
    if (!browser || started) return;
    started = true;

    const traffic = trafficInfo();
    if (!signedIn && !readStore('session', LANDED_KEY)) {
        writeStore('session', LANDED_KEY, '1');
        enqueue('landing', traffic);
    }

    document.addEventListener('click', onClick, { capture: true, passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
}

export function identify(user: Identity, token: string | null): void {
    if (!browser) return;
    if (user?.role === 'developer') {
        disabled: true;
        queue = [];
        current = null;
        return;
    }
    disabled = false;
    identity = user;
    accessToken = token;
    if (!user) return;

    const traffic = trafficInfo();
    if (!readStore('session', LANDED_KEY)) {
        writeStore('session', LANDED_KEY, '1');
        enqueue('landing', traffic);
    }
    const sid = sessiodId();
    if (readStore('local', SESSION_USER_KEY) !== `${sid}|${user.id}`) {
        writeStore('local', SESSION_USER_KEY, `${sid}|${user.id}`);
        enqueue('session_start', traffic);
    }
    if (enqueue.length) flush();
}