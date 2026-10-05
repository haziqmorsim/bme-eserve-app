import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const activitySince = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const [{ data: quoteRows }, { data: approvalRows }, { data: enquiryRows }, { data: eventRows }, { data: chatSessionRows }, { data: chatMessageRows }] = await Promise.all([
        supabase.from('quotes').select('id, reference, created_at, user_id'), 
        supabase.from('quote_approvals').select('quote_id, action, created_at, reviewer_id'), 
        supabase.from('enquiries').select('id, name, created_at'), 
        supabase.from('activity_events').select('user_id, role, event_type, path, created_at').gte('created_at', activitySince).order('created_at', { ascending: false }).limit(5000), 
        supabase.from('chat_sessions').select('id, user_id, started_at, ended_at, end_reason').gte('started_at', activitySince), 
        supabase.from('chat_messages').select('session_id, user_id, role, created_at').gte('created_at', activitySince).limit(10000)
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];
    const enquiries = enquiryRows ?? [];
    const activityEvents = eventRows ?? [];
    const chatSessions = chatSessionRows ?? [];
    const chatMessages = chatMessageRows ?? [];

    const ownerIds = [...new Set(quotes.map((q) => q.user_id).filter(Boolean))];
    const reviewerIds = [...new Set(approvals.map((a) => (a as any).reviewer_id).filter(Boolean))];
    const eventUserIds = [...new Set(activityEvents.map((e: any) => e.user_id).filter(Boolean))];
    const personIds = [...new Set([...ownerIds, ...reviewerIds, ...eventUserIds])];
    const person: Record<string, { name: string; company: string | null; role: string | null }> = {};
    if (personIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, company, role').in('id', personIds);
        for (const p of profs ?? []) {
            person[p.id] = { name: p.full_name || 'User', company: p.company ?? null, role: p.role ?? null };
        } 
    }

    const now = Date.now();

    const PAGE_LABELS: Record<string, string> = {
        '/app': 'Home',
        '/app/quotes': 'Quotes',
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
        '/app/settings': 'Settings',
        '/app/faq': 'FAQ', 
        '/app/policy': 'Policy', 
        '/app/profile': 'Profile'
    };
    const pageLabel = (path: string | null): string => {
        if (!path) return 'Unknown';
        const clean = path.split('?')[0].split('#')[0];
        return PAGE_LABELS[clean] ?? clean;
    };

    const pageViews = activityEvents.filter((e: any) => e.event_type === 'page_view');

    const usersSet = new Set<string>();
    const sessionSet = new Set<string>();
    for (const e of activityEvents) {
        if (!e.user_id) continue;
        usersSet.add(e.user_id);
        sessionSet.add(`${e.user_id}|${String(e.created_at).slice(0, 10)}`);
    }
    const activeUsers = usersSet.size;

    const thirtyAgo = now - 30 * DAY_MS;
    let reviewActions30 = 0;
    for (const a of approvals) if (new Date(a.created_at).getTime() >= thirtyAgo) reviewActions30++;
    let enquiries30 = 0;
    for (const e of enquiries) if (new Date(e.created_at).getTime() >= thirtyAgo) enquiries30++;

    const activitySummary = {
        activeUsers, 
        sessions: sessionSet.size, 
        pageViews: pageViews.length, 
        actions: reviewActions30, 
        enquiries: enquiries30
    };

    const chatUserSet = new Set<string>();
    for (const s of chatSessions) if (s.user_id) chatUserSet.add(s.user_id);

    const userMessageCount = chatMessages.filter((m: any) => m.role === 'user').length;
    const chatSessionCount = chatSessions.length;

    const chatSummary = {
        sessions: chatSessionCount, 
        messages: chatMessages.length, 
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
        const label = pageLabel(e.path);
        pathCount[label] = (pathCount[label] ?? 0) + 1;
    }
    const topPages = Object.entries(pathCount)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const quoteRef: Record<string, string> = {};
    for (const q of quotes) quoteRef[q.id] = (q as any).reference;

    const bizEvents: { ts: string; who: string; action: string; detail: string; kind: string }[] = [];
    for (const q of quotes) {
        bizEvents.push({
            ts: q.created_at, 
            who: person[q.user_id]?.name ?? 'Customer', 
            action: 'submitted request', 
            detail: (q as any).reference ?? '', 
            kind: 'request'
        });
    }
    for (const a of approvals) {
        if (a.action !== 'closed' && a.action !== 'reopened') continue;
        const rid = (a as any).reviewer_id;
        bizEvents.push({
            ts: a.created_at, 
            who: rid ? (person[rid]?.name ?? 'Staff') : 'Staff', 
            action: a.action === 'closed' ? 'closed request' : 'reopened request', 
            detail: quoteRef[a.quote_id] ?? '', 
            kind: String(a.action)
        });
    }
    for (const e of enquiries) {
        bizEvents.push({
            ts: e.created_at, 
            who: (e as any).name || 'Someone', 
            action: 'sent an enquiry', 
            detail: '', 
            kind: 'enquiry'
        });
    }
    bizEvents.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const recentActivity = bizEvents.slice(0, 10);

    const DAYS = 30;
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
    for (const q of quotes) bump(q.created_at);
    for (const a of approvals) bump(a.created_at);
    for (const e of enquiries) bump(e.created_at);

    return {
        title: 'User Activities', 
        activitySummary, 
        chatSummary, 
        topUsers, 
        topPages, 
        recentActivity, 
        dailyActivity
    };
};