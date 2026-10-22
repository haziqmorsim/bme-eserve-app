import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

import { STAFF_ROLES as STAFF, staffTitle } from '$lib/roles';

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_EVENTS = 10000;

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
    faq_deleted: { action: 'updated FAQ settings', kind: 'settings' }
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
    '/app/profile': 'Profile'
};

function pageLabel(path: string | null, meta: Record<string, unknown> | null): string {
    if (!path) return 'Unknown';
    const clean = path.split('?')[0].split('#')[0];
    if (clean === '/app') {
        if (meta?.trigger === 'boiler_search') return 'Boilers';
        if (meta?.tab === 'dashboard') return 'Dashboard';
        return 'Parts';
    }
    return PAGE_LABELS[clean] ?? clean;
}

function metaOf(ev: any): Record<string, unknown> {
    return ev?.meta && typeof ev.meta === 'object' ? (ev.meta as Record<string, unknown>) : {};
}

type FeedItem = { ts: string; who: string; action: string; detail: string; kind: string };

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

    const fetchEvents = async () => {
        const rows: any[] = [];
        for (let from = 0; from < MAX_EVENTS; from += PAGE_SIZE) {
            const { data } = await supabase
                .from('activity_events')
                .select('user_id, role, event_type, path, meta, created_at')
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .range(from, from + PAGE_SIZE - 1);
            const chunk = data ?? [];
            rows.push(...chunk);
            if (chunk.length < PAGE_SIZE) break;
        }
        return rows;
    };

    const [{ data: quoteRows }, { data: approvalRows }, { data: enquiryRows }, eventRows, { data: chatSessionRows }, { data: chatMessageRows }] = await Promise.all([
        supabase.from('quotes').select('id, reference, created_at, user_id'), 
        supabase.from('quote_approvals').select('quote_id, action, created_at, reviewer_id'), 
        supabase.from('enquiries').select('id, name, created_at, replied_at, replied_by'), 
        fetchEvents(), 
        supabase.from('chat_sessions').select('id, user_id, started_at, ended_at, end_reason').gte('started_at', since), 
        supabase.from('chat_messages').select('session_id, user_id, role, created_at').gte('created_at', since).limit(10000)
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];
    const enquiries = enquiryRows ?? [];
    const allEvents = eventRows ?? [];
    const chatMessages = chatMessageRows ?? [];
    const eventsCapped = allEvents.length >= MAX_EVENTS;

    const ownerIds = quotes.map((q) => q.user_id);
    const reviewerIds = approvals.map((a) => (a as any).reviewer_id);
    const eventUserIds = allEvents.map((e: any) => e.user_id);
    const enquiryReplierIds = enquiries.map((e: any) => e.replied_by);
    const chatUserIds = (chatSessionRows ?? []).map((s: any) => s.user_id);
    const personIds = [...new Set([...ownerIds, ...reviewerIds, ...eventUserIds, ...enquiryReplierIds, ...chatUserIds].filter(Boolean))];

    const person: Record<string, { name: string; company: string | null; role: string | null; rawRole: string | null }> = {};
    if (personIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, company, role, position').in('id', personIds);
        for (const p of profs ?? []) {
            person[p.id] = {
                name: p.full_name || 'User',
                company: p.company ?? null,
                role: (p.role === 'customer' ? 'Customer' : staffTitle(p.position, p.role)) || null,
                rawRole: p.role ?? null
            };
        }
    }

    const isDeveloper = (userId: string | null | undefined) => !!userId && person[userId]?.rawRole === 'developer';
    const activityEvents = allEvents.filter((e: any) => e.role !== 'developer' && !isDeveloper(e.user_id));
    const chatSessions = (chatSessionRows ?? []).filter((s: any) => !isDeveloper(s.user_id));
    const devSessionIds = new Set((chatSessionRows ?? []).filter((s: any) => isDeveloper(s.user_id)).map((s: any) => s.id));
    const chatMsgs = chatMessages.filter((m: any) => !devSessionIds.has(m.session_id) && !isDeveloper(m.user_id));

    const now = Date.now();
    const sinceMs = now - WINDOW_DAYS * DAY_MS;
    const inWindow = (ts: string | null | undefined) => !!ts && new Date(ts).getTime() >= sinceMs;

    const pageViews = activityEvents.filter((e: any) => e.event_type === 'page_view');

    const usersSet = new Set<string>();
    const sessionSet = new Set<string>();
    for (const e of activityEvents) {
        if (!e.user_id) continue;
        usersSet.add(e.user_id);
        sessionSet.add(`${e.user_id}|${String(e.created_at).slice(0, 10)}`);
    }

    let reviewActions30 = 0;
    for (const a of approvals) {
        if (isDeveloper((a as any).reviewer_id)) continue;
        if (inWindow(a.created_at)) reviewActions30++;
    }
    let enquiries30 = 0;
    for (const e of enquiries) if (inWindow(e.created_at)) enquiries30++;

    const activitySummary = {
        activeUsers: usersSet.size, 
        sessions: sessionSet.size, 
        pageViews: pageViews.length, 
        actions: reviewActions30, 
        enquiries: enquiries30
    };

    const chatUserSet = new Set<string>();
    for (const s of chatSessions) if (s.user_id) chatUserSet.add(s.user_id);
    const userMessageCount = chatMsgs.filter((m: any) => m.role === 'user').length;
    const chatSessionCount = chatSessions.length;
    const chatSummary = {
        sessions: chatSessionCount, 
        messages: chatMsgs.length, 
        users: chatUserSet.size, 
        avgMessagesPerSession: chatSessionCount > 0 ? Math.round((userMessageCount / chatSessionCount) * 10) / 10 : 0
    };

    const userCount: Record<string, number> = {};
    for (const e of activityEvents) if (e.user_id) userCount[e.user_id] = (userCount[e.user_id] ?? 0) + 1;
    const topUsers = Object.entries(userCount)
        .map(([id, count]) => ({ name: person[id]?.name ?? 'User', role: person[id]?.role ?? null, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const pathCount: Record<string, number> = {};
    for (const e of pageViews) {
        const label = pageLabel(e.path, metaOf(e));
        pathCount[label] = (pathCount[label] ?? 0) + 1;
    }
    const topPages = Object.entries(pathCount)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const quoteRef: Record<string, string> = {};
    for (const q of quotes) quoteRef[q.id] = (q as any).reference;
    const nameOf = (userId: string | null | undefined, fallback: string) =>
        userId ? (person[userId]?.name ?? fallback) : fallback;

    const feed: FeedItem[] = [];
    for (const q of quotes) {
        if (!inWindow(q.created_at) || isDeveloper(q.user_id)) continue;
        feed.push({
            ts: q.created_at, 
            who: nameOf(q.user_id, 'Customer'), 
            action: 'submitted a request', 
            detail: (q as any).reference ?? '', 
            kind: 'request'
        });
    }
    for (const a of approvals) {
        if (a.action !== 'closed' && a.action !== 'reopened') continue;
        const rid = (a as any).reviewer_id;
        if (!inWindow(a.created_at) || isDeveloper(rid)) continue;
        feed.push({
            ts: a.created_at, 
            who: nameOf(rid, 'Staff'), 
            action: a.action === 'closed' ? 'closed a request' : 'reopened a request', 
            detail: quoteRef[a.quote_id] ?? '', 
            kind: String(a.action)
        });
    }
    for (const e of enquiries) {
        if (inWindow(e.created_at)) {
            feed.push({
                ts: e.created_at, 
                who: (e as any).name || 'Someone', 
                action: 'sent an enquiry', 
                detail: '', 
                kind: 'enquiry'
            });
        }
        const rid = (e as any).replied_by;
        if ((e as any).replied_at && inWindow((e as any).replied_at) && !isDeveloper(rid)) {
            feed.push({
                ts: (e as any).replied_at, 
                who: nameOf(rid, 'Staff'), 
                action: 'marked an enquiry as replied', 
                detail: (e as any).name ?? '', 
                kind: 'replied'
            });
        }
    }
    for (const ev of activityEvents as any[]) {
        const meta = metaOf(ev);
        const who = nameOf(ev.user_id, 'Someone');

        if (ev.event_type === 'page_view') {
            const label = pageLabel(ev.path, meta);
            feed.push({
                ts: ev.created_at, 
                who, 
                action: `viewed the ${label} page`, 
                detail: label === 'Parts' && typeof meta.boiler === 'string' ? meta.boiler : '', 
                kind: 'page_view'
            });
            continue;
        }

        const feedType = ACTION_FEED[ev.event_type];
        if (!feedType) continue;

        let detail = '';
        if (ev.event_type === 'sign_out' && meta.reason === 'timeout') {
            detail = 'session timed out';
        } else if (ev.event_type === 'invoice_converted' || ev.event_type === 'packing_converted') {
            const names = Array.isArray(meta.names) ? meta.names.filter((n) => typeof n === 'string') as string[] : [];
            const files = typeof meta.files === 'number' ? meta.files : names.length;
            if (names.length) {
                detail = names.join(', ');
                if (files > names.length) detail += ` +${files - names.length} more`;
            } else if (files > 1) {
                detail = `${files} files`;
            }
        } else if (ev.event_type.startsWith('faq_')) {
            const verb = FAQ_VERB[ev.event_type.slice(4)] ?? 'Edited';
            detail = typeof meta.name === 'string' && meta.name ? `${verb}: ${meta.name}` : '';
        } else if (typeof meta.name === 'string') {
            detail = meta.name;
        }

        feed.push({ ts: ev.created_at, who, action: feedType.action, detail, kind: feedType.kind });
    }
    feed.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

    const DAYS = WINDOW_DAYS;
    const todayShift = new Date(now + MYT_OFFSET_MS);
    todayShift.setUTCHours(0, 0, 0, 0);
    const todayMidnightUtc = todayShift.getTime() - MYT_OFFSET_MS;
    const dailyActivity: { label: string; count: number }[] = [];
    const dayIndex: Record<number, number> = {};
    for (let i = DAYS - 1; i >= 0; i--) {
        const dayStartUtc = todayMidnightUtc - i * DAY_MS;
        const d = new Date(dayStartUtc + MYT_OFFSET_MS);
        dayIndex[dayStartUtc] = dailyActivity.length;
        dailyActivity.push({ label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, count: 0 });
    }
    const bump = (ts: string) => {
        const shifted = new Date(ts).getTime() + MYT_OFFSET_MS;
        const dayStartUtc = Math.floor(shifted / DAY_MS) * DAY_MS - MYT_OFFSET_MS;
        const i = dayIndex[dayStartUtc];
        if (i !== undefined) dailyActivity[i].count++;
    };
    for (const q of quotes) if (!isDeveloper(q.user_id)) bump(q.created_at);
    for (const a of approvals) if (!isDeveloper((a as any).reviewer_id)) bump(a.created_at);
    for (const e of enquiries) bump(e.created_at);

    return {
        title: 'User Activities', 
        activitySummary, 
        chatSummary, 
        topUsers, 
        topPages, 
        recentActivity: feed, 
        windowDays: WINDOW_DAYS, 
        eventsCapped, 
        dailyActivity
    };
};