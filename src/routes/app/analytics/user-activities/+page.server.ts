import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

import { STAFF_ROLES as STAFF, staffTitle } from '$lib/roles';
import { BEHAVIOURS, BEHAVIOUR_INDEX, behaviourOf, emptyCounts, HEAT_COLS, HEAT_ROWS } from '$lib/analytics/behaviour';

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_EVENTS = 40000;
const MAX_PAGE_MS = 30 * 60 * 1000;
const HEAT_CELLS = HEAT_COLS * HEAT_ROWS;

const ENTITY_LABEL: Record<string, string> = {
    project: 'a project',
    boiler: 'a boiler',
    part: 'a part',
    user: 'a user'
};
const CHANGE_VERB: Record<string, { text: string; kind: string }> = {
    created: { text: 'added', kind: 'added' },
    updated: { text: 'edited', kind: 'edited' },
    deleted: { text: 'deleted', kind: 'deleted' }
};
const FAQ_VERB: Record<string, string> = { created: 'Added', updated: 'Edited', deleted: 'Deleted' };

const ACTION_FEED: Record<string, { action: string; kind: string }> = {
    sign_in: { action: 'signed in', kind: 'login' },
    sign_out: { action: 'signed out', kind: 'logout' },
    invoice_converted: { action: 'converted a shipping invoice', kind: 'converted' },
    packing_converted: { action: 'converted a packing list', kind: 'converted' },
    profile_updated: { action: 'updated their profile', kind: 'profile' },
    general_settings_updated: { action: 'updated general settings', kind: 'settings' },
    faq_created: { action: 'updated FAQ settings', kind: 'settings' },
    faq_updated: { action: 'updated FAQ settings', kind: 'settings' },
    faq_deleted: { action: 'updated FAQ settings', kind: 'settings' },
    cart_add: { action: 'added a part to the cart', kind: 'request' },
    file_download: { action: 'downloaded a file', kind: 'converted' }
};
for (const entity of Object.keys(ENTITY_LABEL)) {
    for (const [change, verb] of Object.entries(CHANGE_VERB)) {
        ACTION_FEED[`${entity}_${change}`] = { action: `${verb.text} ${ENTITY_LABEL[entity]}`, kind: verb.kind };
    }
}

const PAGE_LABELS: Record<string, string> = {
    '/app/quotes': 'Cart',
    '/app/requests': 'Requests',
    '/app/history': 'History',
    '/app/analytics': 'Analytics',
    '/app/analytics/customer-requests': 'Customer Requests',
    '/app/analytics/user-activities': 'User Activities',
    '/app/analytics/email-log': 'E-mail Deliveries',
    '/app/analytics/forecasts': 'Forecasts',
    '/app/analytics/service-records': 'Service Records',
    '/app/analytics/suggestions': 'Suggestion Reviews',
    '/app/analytics/training-data': 'Training Data',
    '/app/enquiries': 'Enquiries',
    '/app/others': 'Others',
    '/app/settings': 'Settings',
    '/app/faq': 'FAQ',
    '/app/policy': 'Policy',
    '/app/profile': 'Profile',
    '/login': 'Sign In',
    '/enquiry': 'Enquiry Form'
};

const SOURCE_LABELS: Record<string, string> = {
    direct: 'Direct',
    search: 'Search engine',
    email: 'E-mail',
    social: 'Social / messaging',
    referral: 'Other websites'
};

function pageLabel(path: string | null, meta: Record<string, unknown> | null): string {
    if (!path) return 'Unknown';
    const clean = path.split('?')[0].split('#')[0];
    if (clean === '/app') {
        if (meta?.view === 'boilers' || meta?.trigger === 'boiler_search') return 'Boilers';
        if (meta?.tab === 'dashboard') return 'Dashboard';
        return 'Parts';
    }
    return PAGE_LABELS[clean] ?? clean;
}

function metaOf(ev: any): Record<string, unknown> {
    return ev?.meta && typeof ev.meta === 'object' ? (ev.meta as Record<string, unknown>) : {};
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function dayStartUtc(ts: string | number): number {
    const shifted = new Date(ts).getTime() + MYT_OFFSET_MS;
    return Math.floor(shifted / DAY_MS) * DAY_MS - MYT_OFFSET_MS;
}

function topN<T>(entries: [string, T][], score: (v: T) => number, n: number): [string, T][] {
    return entries.sort((a, b) => score(b[1]) - score(a[1])).slice(0, n);
}

type FeedItem = { ts: string; who: string; action: string; detail: string; kind: string };
type Step = { t: number; label: string; kind: string };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const now = Date.now();
    const since = new Date(now - WINDOW_DAYS * DAY_MS).toISOString();

    const fetchEvents = async (): Promise<{ rows: any[]; capped: boolean; tracking: boolean }> => {
        const run = async (columns: string) => {
            const first = await supabase
                .from('activity_events')
                .select(columns, { count: 'exact' })
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .range(0, PAGE_SIZE - 1);
            if (first.error) return { error: first.error, rows: [] as any[], total: 0 };
            const total = Math.min(first.count ?? 0, MAX_EVENTS);
            const rest = [];
            for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) {
                rest.push(
                    supabase
                        .from('activity_events')
                        .select(columns)
                        .gte('created_at', since)
                        .order('created_at', { ascending: false })
                        .range(from, Math.min(from + PAGE_SIZE, total) - 1)
                );
            }
            const pages = await Promise.all(rest);
            const rows = [...(first.data ?? []), ...pages.flatMap((p) => p.data ?? [])];
            return { error: null, rows, total: first.count ?? 0 };
        };

        const full = await run('user_id, role, event_type, path, meta, created_at, session_id, visitor_id');
        if (!full.error) return { rows: full.rows, capped: full.total > MAX_EVENTS, tracking: true };
        const basic = await run('user_id, role, event_type, path, meta, created_at');
        return { rows: basic.rows, capped: basic.total > MAX_EVENTS, tracking: false };
    };

    const [{ data: quoteRows }, { data: approvalRows }, { data: enquiryRows }, events] = await Promise.all([
        supabase.from('quotes').select('id, reference, created_at, user_id'),
        supabase.from('quote_approvals').select('quote_id, action, created_at, reviewer_id'),
        supabase.from('enquiries').select('id, name, created_at, replied_at, replied_by'),
        fetchEvents()
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];
    const enquiries = enquiryRows ?? [];
    const allEvents = events.rows;

    const personIds = [...new Set([
        ...quotes.map((q) => q.user_id),
        ...approvals.map((a) => (a as any).reviewer_id),
        ...allEvents.map((e: any) => e.user_id),
        ...enquiries.map((e: any) => e.replied_by)
    ].filter(Boolean))];

    const person: Record<string, { name: string; role: string | null; rawRole: string | null }> = {};
    for (let i = 0; i < personIds.length; i += 300) {
        const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, role, position')
            .in('id', personIds.slice(i, i + 300));
        for (const p of profs ?? []) {
            person[p.id] = {
                name: p.full_name || 'User',
                role: (p.role === 'customer' ? 'Customer' : staffTitle(p.position, p.role)) || null,
                rawRole: p.role ?? null
            };
        }
    }

    const isDeveloper = (userId: string | null | undefined) => !!userId && person[userId]?.rawRole === 'developer';
    const ev = allEvents.filter((e: any) => e.role !== 'developer' && !isDeveloper(e.user_id));
    const sinceMs = now - WINDOW_DAYS * DAY_MS;
    const inWindow = (ts: string | null | undefined) => !!ts && new Date(ts).getTime() >= sinceMs;
    const nameOf = (userId: string | null | undefined, fallback: string) =>
        userId ? (person[userId]?.name ?? fallback) : fallback;

    const quotesIn = quotes.filter((q) => inWindow(q.created_at) && !isDeveloper(q.user_id));
    const approvalsIn = approvals.filter((a) => inWindow(a.created_at) && !isDeveloper((a as any).reviewer_id));
    const reviewActions = approvalsIn.filter((a) => a.action === 'closed' || a.action === 'reopened');
    const enquiriesIn = enquiries.filter((e) => inWindow(e.created_at));

    const pageViews = ev.filter((e: any) => e.event_type === 'page_view');
    const pageLeaves = ev.filter((e: any) => e.event_type === 'page_leave');

    const SERVER_SIDE = new Set(['sign_in', 'sign_out']);
    const sessionKey = (e: any): string | null =>
        e.session_id
            ? `s:${e.session_id}`
            : e.user_id && !SERVER_SIDE.has(e.event_type)
                ? `u:${e.user_id}|${String(e.created_at).slice(0, 10)}`
                : null;

    // ---------- day buckets ----------
    const todayShift = new Date(now + MYT_OFFSET_MS);
    todayShift.setUTCHours(0, 0, 0, 0);
    const todayMidnightUtc = todayShift.getTime() - MYT_OFFSET_MS;
    const days: { start: number; label: string }[] = [];
    const dayIndex: Record<number, number> = {};
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
        const start = todayMidnightUtc - i * DAY_MS;
        const d = new Date(start + MYT_OFFSET_MS);
        dayIndex[start] = days.length;
        days.push({ start, label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}` });
    }
    const dayOf = (ts: string) => dayIndex[dayStartUtc(ts)];

    // ---------- behaviour breakdowns (day / user / page) ----------
    const daily = days.map(() => emptyCounts());
    const byUser: Record<string, number[]> = {};
    const byPage: Record<string, number[]> = {};
    const add = (key: number | undefined, user: string | null, page: string | null, b: keyof typeof BEHAVIOUR_INDEX) => {
        const i = BEHAVIOUR_INDEX[b];
        if (key !== undefined) daily[key][i]++;
        if (user) (byUser[user] ??= emptyCounts())[i]++;
        if (page) (byPage[page] ??= emptyCounts())[i]++;
    };

    for (const e of ev as any[]) {
        const b = behaviourOf(e.event_type);
        if (!b) continue;
        add(dayOf(e.created_at), e.user_id ?? null, e.path ? pageLabel(e.path, metaOf(e)) : null, b);
    }
    for (const q of quotesIn) add(dayOf(q.created_at), q.user_id ?? null, null, 'requests');
    for (const a of approvalsIn) add(dayOf(a.created_at), (a as any).reviewer_id ?? null, null, 'requests');
    for (const e of enquiriesIn) add(dayOf(e.created_at), null, null, 'enquiries');

    const series = BEHAVIOURS.map((b) => ({ key: b.key, label: b.label }));
    const dailyActivity = days.map((d, i) => ({ label: d.label, values: daily[i] }));

    const total = (v: number[]) => v.reduce((s, n) => s + n, 0);
    const topUsers = topN(Object.entries(byUser), total, 8).map(([id, values]) => ({
        name: person[id]?.name ?? 'User',
        sub: person[id]?.role ?? null,
        values
    }));
    const topPages = topN(Object.entries(byPage), total, 8).map(([label, values]) => ({ name: label, sub: null, values }));

    // ---------- traffic & engagement ----------
    const visitors = new Set<string>();
    const signedInUsers = new Set<string>();
    const sessions = new Set<string>();
    const dailyVisitors = days.map(() => new Set<string>());
    const dailySessions = days.map(() => new Set<string>());
    for (const e of ev as any[]) {
        const who = e.user_id ? `u:${e.user_id}` : e.visitor_id ? `v:${e.visitor_id}` : null;
        if (e.user_id) signedInUsers.add(e.user_id);
        if (who) visitors.add(who);
        const sk = sessionKey(e);
        if (sk) sessions.add(sk);
        const di = dayOf(e.created_at);
        if (di !== undefined) {
            if (who) dailyVisitors[di].add(who);
            if (sk) dailySessions[di].add(sk);
        }
    }
    const visitorTrend = days.map((d, i) => ({
        label: d.label,
        values: [dailyVisitors[i].size, dailySessions[i].size]
    }));

    // Per tracked session: ordered events for bounce, exits, funnels and journeys.
    const bySession = new Map<string, any[]>();
    for (const e of ev as any[]) {
        if (!e.session_id) continue;
        let list = bySession.get(e.session_id);
        if (!list) bySession.set(e.session_id, (list = []));
        list.push(e);
    }
    for (const list of bySession.values()) list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

    let sessionsWithViews = 0;
    let bounced = 0;
    const exits: Record<string, number> = {};
    for (const list of bySession.values()) {
        const views = list.filter((e) => e.event_type === 'page_view');
        if (!views.length) continue;
        sessionsWithViews++;
        if (views.length === 1) bounced++;
        const last = pageLabel(views[views.length - 1].path, metaOf(views[views.length - 1]));
        exits[last] = (exits[last] ?? 0) + 1;
    }
    const bounceRate = sessionsWithViews ? Math.round((bounced / sessionsWithViews) * 100) : null;

    // Page engagement: time on page and scroll depth come from page_leave events.
    type PageStat = { views: number; users: Set<string>; time: number; timeN: number; scroll: number; scrollN: number };
    const pageStats: Record<string, PageStat> = {};
    const stat = (label: string) => (pageStats[label] ??= { views: 0, users: new Set(), time: 0, timeN: 0, scroll: 0, scrollN: 0 });
    for (const e of pageViews as any[]) {
        const s = stat(pageLabel(e.path, metaOf(e)));
        s.views++;
        if (e.user_id) s.users.add(e.user_id);
    }
    let timeSum = 0, timeN = 0, scrollSum = 0, scrollN = 0;
    const heat: Record<string, { moves: number[]; clicks: number[]; samples: number }> = {};
    for (const e of pageLeaves as any[]) {
        const m = metaOf(e);
        const label = pageLabel(e.path, m);
        const s = stat(label);
        const dur = Math.min(MAX_PAGE_MS, num(m.dur));
        if (dur > 0) {
            s.time += dur; s.timeN++;
            timeSum += dur; timeN++;
        }
        if (typeof m.scroll === 'number') {
            s.scroll += m.scroll; s.scrollN++;
            scrollSum += m.scroll; scrollN++;
        }
        const h = (heat[label] ??= { moves: Array(HEAT_CELLS).fill(0), clicks: Array(HEAT_CELLS).fill(0), samples: 0 });
        h.samples++;
        for (const [grid, target] of [[m.grid, h.moves], [m.cgrid, h.clicks]] as const) {
            if (!grid || typeof grid !== 'object') continue;
            for (const [cell, count] of Object.entries(grid as Record<string, unknown>)) {
                const idx = Number(cell);
                if (idx >= 0 && idx < HEAT_CELLS) target[idx] += num(count);
            }
        }
    }

    const pageEngagement = topN(Object.entries(pageStats), (s) => s.views, 12).map(([label, s]) => ({
        label,
        views: s.views,
        users: s.users.size,
        avgTime: s.timeN ? Math.round(s.time / s.timeN / 1000) : null,
        avgScroll: s.scrollN ? Math.round(s.scroll / s.scrollN) : null,
        exitRate: s.views ? Math.round(((exits[label] ?? 0) / s.views) * 100) : null
    }));

    const heatmaps = Object.entries(heat)
        .filter(([, h]) => h.moves.some((n) => n > 0) || h.clicks.some((n) => n > 0))
        .sort((a, b) => b[1].samples - a[1].samples)
        .slice(0, 10)
        .map(([label, h]) => ({ label, ...h }));

    // Traffic sources & devices from landing events (one per browser-tab visit).
    const sourceCount: Record<string, number> = {};
    const deviceCount: Record<string, number> = {};
    for (const e of ev as any[]) {
        if (e.event_type !== 'landing') continue;
        const m = metaOf(e);
        const key = str(m.source) || 'direct';
        const label = SOURCE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
        sourceCount[label] = (sourceCount[label] ?? 0) + 1;
        const device = str(m.device) || 'desktop';
        deviceCount[device] = (deviceCount[device] ?? 0) + 1;
    }
    const knownSources = Object.values(SOURCE_LABELS);
    const customSources = Object.entries(sourceCount).filter(([label]) => !knownSources.includes(label));
    const trafficSources = [
        ...knownSources.map((label) => ({ label, value: sourceCount[label] ?? 0 })),
        ...(customSources.length
            ? [
                  customSources.length === 1
                      ? { label: customSources[0][0], value: customSources[0][1] }
                      : { label: 'Other', value: customSources.reduce((sum, [, n]) => sum + n, 0) }
              ]
            : [])
    ]
        .map((it, i) => ({ ...it, i }))
        .sort((x, y) => y.value - x.value || x.i - y.i)
        .map(({ label, value }) => ({ label, value }));
    const deviceOrder = ['desktop', 'tablet', 'mobile'];
    const devices = deviceOrder.map((d) => ({
        label: d.charAt(0).toUpperCase() + d.slice(1),
        value: deviceCount[d] ?? 0
    }));

    // ---------- conversion funnels ----------
    let fParts = 0, fCart = 0, fCartView = 0, fSubmit = 0;
    for (const list of bySession.values()) {
        const viewedParts = list.some((e) => e.event_type === 'page_view' && pageLabel(e.path, metaOf(e)) === 'Parts');
        const added = list.some((e) => e.event_type === 'cart_add');
        const viewedCart = list.some((e) => e.event_type === 'page_view' && pageLabel(e.path, metaOf(e)) === 'Cart');
        const submitted = list.some((e) => e.event_type === 'request_submitted');
        if (!viewedParts) continue;
        fParts++;
        if (!added) continue;
        fCart++;
        if (!viewedCart) continue;
        fCartView++;
        if (submitted) fSubmit++;
    }
    const checkoutFunnel = [
        { label: 'Viewed spare parts', value: fParts },
        { label: 'Added a part to the cart', value: fCart },
        { label: 'Opened the cart', value: fCartView },
        { label: 'Submitted a request', value: fSubmit }
    ];

    const leadVisitors = (type: string) =>
        new Set((ev as any[]).filter((e) => e.event_type === type).map((e) => e.visitor_id ?? e.user_id ?? e.session_id)).size;
    const leadFunnel = [
        { label: 'Opened the enquiry form', value: leadVisitors('enquiry_view') },
        { label: 'Started filling it in', value: leadVisitors('enquiry_start') },
        { label: 'Sent the enquiry', value: leadVisitors('enquiry_submit') }
    ];

    // ---------- clicks, CTAs & custom events ----------
    const clickCount: Record<string, { count: number; cta: boolean }> = {};
    let ctaClicks = 0;
    let totalClicks = 0;
    const imageCount: Record<string, number> = {};
    const downloadCount: Record<string, number> = {};
    for (const e of ev as any[]) {
        const m = metaOf(e);
        if (e.event_type === 'click') {
            totalClicks++;
            const label = str(m.label) || 'Unlabelled';
            const key = `${label}\u0000${e.path ? pageLabel(e.path, m) : ''}`;
            const c = (clickCount[key] ??= { count: 0, cta: false });
            c.count++;
            if (m.cta) { c.cta = true; ctaClicks++; }
        } else if (e.event_type === 'image_view') {
            const label = str(m.label) || 'Image';
            imageCount[label] = (imageCount[label] ?? 0) + 1;
        } else if (e.event_type === 'file_download') {
            const label = str(m.label) || 'File';
            downloadCount[label] = (downloadCount[label] ?? 0) + 1;
        }
    }
    const topClicks = topN(Object.entries(clickCount), (c) => c.count, 10).map(([key, c]) => {
        const [label, page] = key.split('\u0000');
        return { label, page, count: c.count, cta: c.cta };
    });
    const toList = (counts: Record<string, number>, n: number) =>
        topN(Object.entries(counts), (v) => v, n).map(([label, count]) => ({ label, count }));
    const customEvents = {
        imageViews: Object.values(imageCount).reduce((s, n) => s + n, 0),
        downloads: Object.values(downloadCount).reduce((s, n) => s + n, 0),
        cartAdds: (ev as any[]).filter((e) => e.event_type === 'cart_add').length,
        ctaClicks,
        topImages: toList(imageCount, 5),
        topDownloads: toList(downloadCount, 5)
    };

    // ---------- headline numbers ----------
    const conversionRate = fCart ? Math.round((fSubmit / fCart) * 100) : null;
    const summary = {
        uniqueVisitors: visitors.size,
        activeUsers: signedInUsers.size,
        sessions: sessions.size,
        pageViews: pageViews.length,
        avgTimeOnPage: timeN ? Math.round(timeSum / timeN / 1000) : null,
        bounceRate,
        avgScroll: scrollN ? Math.round(scrollSum / scrollN) : null,
        clicks: totalClicks,
        reviewActions: reviewActions.length,
        enquiries: enquiriesIn.length,
        conversionRate
    };

    // ---------- session journeys ("replay" of the navigation path) ----------
    const stepOf = (e: any): Step | null => {
        const m = metaOf(e);
        const t = new Date(e.created_at).getTime();
        switch (e.event_type) {
            case 'page_view': {
                const label = pageLabel(e.path, m);
                return { t, label: `Viewed ${label}${label === 'Parts' && str(m.boiler) ? ` (${str(m.boiler)})` : ''}`, kind: 'views' };
            }
            case 'page_leave':
                return num(m.dur) ? { t, label: `Left ${pageLabel(e.path, m)} after ${Math.round(num(m.dur) / 1000)}s · scrolled ${num(m.scroll)}%`, kind: 'leave' } : null;
            case 'click':
                return { t, label: `Clicked “${str(m.label)}”${m.cta ? ' (CTA)' : ''}`, kind: 'interactions' };
            case 'boiler_search':
                return { t, label: 'Searched the boiler list', kind: 'interactions' };
            case 'image_view':
                return { t, label: `Viewed image ${str(m.label)}`, kind: 'interactions' };
            case 'file_download':
                return { t, label: `Downloaded ${str(m.label)}`, kind: 'interactions' };
            case 'cart_add':
                return { t, label: `Added ${str(m.label)} to the cart`, kind: 'requests' };
            case 'cart_remove':
                return { t, label: `Removed ${str(m.label)} from the cart`, kind: 'requests' };
            case 'request_submitted':
                return { t, label: `Submitted request ${str(m.label)}`.trim(), kind: 'requests' };
            case 'enquiry_view':
                return { t, label: 'Opened the enquiry form', kind: 'enquiries' };
            case 'enquiry_start':
                return { t, label: 'Started filling in the enquiry form', kind: 'enquiries' };
            case 'enquiry_submit':
                return { t, label: 'Sent an enquiry', kind: 'enquiries' };
            case 'landing':
            case 'session_start': {
                const src = SOURCE_LABELS[str(m.source)] ?? (str(m.source) || 'Direct');
                return e.event_type === 'landing' ? { t, label: `Arrived from ${src} on ${str(m.device) || 'desktop'}`, kind: 'signins' } : null;
            }
        }
        const feed = ACTION_FEED[e.event_type];
        if (feed) return { t, label: feed.action.charAt(0).toUpperCase() + feed.action.slice(1), kind: behaviourOf(e.event_type) ?? 'updates' };
        return null;
    };
    const journeys = [...bySession.entries()]
        .map(([id, list]) => ({ id, list, last: list[list.length - 1].created_at }))
        .filter((s) => s.list.some((e) => e.event_type === 'page_view' || e.event_type.startsWith('enquiry_')))
        .sort((a, b) => (a.last < b.last ? 1 : -1))
        .slice(0, 15)
        .map(({ id, list }) => {
            const start = new Date(list[0].created_at).getTime();
            const end = new Date(list[list.length - 1].created_at).getTime();
            const userId = list.find((e) => e.user_id)?.user_id ?? null;
            const steps = list.map(stepOf).filter((s): s is Step => !!s);
            return {
                id,
                who: userId ? nameOf(userId, 'User') : 'Visitor (signed out)',
                role: userId ? person[userId]?.role ?? null : null,
                start: list[0].created_at,
                durationMs: end - start,
                pages: list.filter((e) => e.event_type === 'page_view').length,
                steps: steps.slice(0, 60).map((s) => ({ offset: s.t - start, label: s.label, kind: s.kind })),
                more: Math.max(0, steps.length - 60)
            };
        });

    // ---------- recent activity feed ----------
    const quoteRef: Record<string, string> = {};
    for (const q of quotes) quoteRef[q.id] = (q as any).reference;

    const feed: FeedItem[] = [];
    for (const q of quotesIn) {
        feed.push({ ts: q.created_at, who: nameOf(q.user_id, 'Customer'), action: 'submitted a request', detail: (q as any).reference ?? '', kind: 'request' });
    }
    for (const a of reviewActions) {
        feed.push({
            ts: a.created_at,
            who: nameOf((a as any).reviewer_id, 'Staff'),
            action: a.action === 'closed' ? 'closed a request' : 'reopened a request',
            detail: quoteRef[a.quote_id] ?? '',
            kind: String(a.action)
        });
    }
    for (const e of enquiries) {
        if (inWindow(e.created_at)) {
            feed.push({ ts: e.created_at, who: (e as any).name || 'Someone', action: 'sent an enquiry', detail: '', kind: 'enquiry' });
        }
        const rid = (e as any).replied_by;
        if ((e as any).replied_at && inWindow((e as any).replied_at) && !isDeveloper(rid)) {
            feed.push({ ts: (e as any).replied_at, who: nameOf(rid, 'Staff'), action: 'marked an enquiry as replied', detail: (e as any).name ?? '', kind: 'replied' });
        }
    }
    for (const e of ev as any[]) {
        const meta = metaOf(e);
        const who = nameOf(e.user_id, 'Someone');

        if (e.event_type === 'page_view') {
            const label = pageLabel(e.path, meta);
            feed.push({
                ts: e.created_at,
                who,
                action: `viewed the ${label} page`,
                detail: label === 'Parts' && typeof meta.boiler === 'string' ? meta.boiler : '',
                kind: 'page_view'
            });
            continue;
        }

        const feedType = ACTION_FEED[e.event_type];
        if (!feedType || !e.user_id) continue;

        let detail = '';
        if (e.event_type === 'sign_out' && meta.reason === 'timeout') {
            detail = 'session timed out';
        } else if (e.event_type === 'invoice_converted' || e.event_type === 'packing_converted') {
            const names = Array.isArray(meta.names) ? (meta.names.filter((n) => typeof n === 'string') as string[]) : [];
            const files = typeof meta.files === 'number' ? meta.files : names.length;
            if (names.length) {
                detail = names.join(', ');
                if (files > names.length) detail += ` +${files - names.length} more`;
            } else if (files > 1) {
                detail = `${files} files`;
            }
        } else if (e.event_type.startsWith('faq_')) {
            const verb = FAQ_VERB[e.event_type.slice(4)] ?? 'Edited';
            detail = typeof meta.name === 'string' && meta.name ? `${verb}: ${meta.name}` : '';
        } else if (typeof meta.name === 'string') {
            detail = meta.name;
        } else if (typeof meta.label === 'string') {
            detail = meta.label;
        }

        feed.push({ ts: e.created_at, who, action: feedType.action, detail, kind: feedType.kind });
    }
    feed.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

    return {
        title: 'User Activities',
        windowDays: WINDOW_DAYS,
        eventsCapped: events.capped,
        trackingReady: events.tracking,
        summary,
        series,
        dailyActivity,
        visitorTrend,
        topUsers,
        topPages,
        pageEngagement,
        heatmaps,
        heatCols: HEAT_COLS,
        heatRows: HEAT_ROWS,
        trafficSources,
        devices,
        checkoutFunnel,
        leadFunnel,
        topClicks,
        customEvents,
        journeys,
        recentActivity: feed
    };
};