import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { slaStateWeekday, DEFAULT_SLA } from "$lib/sla";
import { toMap, num } from "$lib/settings";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO'};

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function weekdayMs(startUtcMs: number, endUtcMs: number): number {
    if (!(endUtcMs > startUtcMs)) return 0;
    const s = startUtcMs + MYT_OFFSET_MS;
    const e = endUtcMs + MYT_OFFSET_MS;

    const first = new Date(s);
    first.setUTCHours(0, 0, 0, 0);
    let dayMs = first.getTime();

    let total = 0;
    for (; dayMs < e; dayMs += DAY_MS) {
        const dow = new Date(dayMs).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const from = Math.max(s, dayMs);
        const to = Math.min(e, dayMs + DAY_MS);
        if (to > from) total += to - from;
    }
    return total;
}

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const activitySince = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const [{ data: quoteRows }, { data: approvalRows }, { data: enquiryRows }, { data: eventRows }, { data: chatSessionRows }, { data: chatMessageRows }] = await Promise.all([
        supabase.from('quotes').select('id, reference, status, created_at, reviewed_at, current_level, user_id, quote_items(boiler_code)'), 
        supabase.from('quote_approvals').select('quote_id, level, action, created_at, reviewer_id'), 
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

    let open = 0, closed = 0;
    for (const q of quotes) (q.status === 'closed' ? closed++ : open++);

    let resSum = 0, resN = 0;
    for (const q of quotes) {
        if (q.status === 'closed' && q.reviewed_at) {
            const ms = new Date(q.reviewed_at).getTime() - new Date(q.created_at).getTime();
            if (ms >= 0) {
                resSum += ms;
                resN++;
            }
        }
    }

    const avgResolutionMs = resN ? Math.round(resSum / resN) : null;

    const nowShift = Date.now() + MYT_OFFSET_MS;
    const mytNow = new Date(nowShift);
    const daysSinceMon = (mytNow.getUTCDay() + 6) % 7;
    const weekStart = new Date(nowShift);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMon);
    const weekStartUtcMs = weekStart.getTime() - MYT_OFFSET_MS;
    let newThisWeek = 0;
    for (const q of quotes) {
        if (new Date(q.created_at).getTime() >= weekStartUtcMs) newThisWeek++;
    }

    const createdAt: Record<string, string> = {};
    for (const q of quotes) createdAt[q.id] = q.created_at;

    const byQuote: Record<string, { level: number; action: string; created_at: string; }[]> = {};
    for (const a of approvals) (byQuote[a.quote_id] ??= []).push(a);

    const levelSum: Record<number, number> = { 1: 0, 2: 0, 3: 0};
    const levelN: Record<number, number> = {1: 0, 2: 0, 3: 0};

    for (const [qid, list] of Object.entries(byQuote)) {
        list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
        let arrival = createdAt[qid] ?? list[0].created_at;
        for (const a of list) {
            if (a.action === 'closed' && (a.level === 1 || a.level === 2 || a.level === 3)) {
                const dur = weekdayMs(new Date(arrival).getTime(), new Date(a.created_at).getTime());
                if (dur >= 0) {
                    levelSum[a.level] += dur;
                    levelN[a.level]++;
                }
            }
            arrival = a.created_at;
        }
    }

    const handlingPerLevel = [1, 2, 3].map((l) => ({
        level: l, 
        label: LEVEL_LABEL[l], 
        avgMs: levelN[l] ? Math.round(levelSum[l] / levelN[l]) : null, 
        count: levelN[l]
    }));

    const [{ data: boilerRows }, { data: projectRows }, { data: boilerProjectRows }] = await Promise.all([
        supabase.from('boilers').select('id, code').order('code', { ascending: true }),
        supabase.from('projects').select('id, project_no, name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('boiler_projects').select('boiler_id, project_id')
    ]);

    const { data: slaRows } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['sla_warn_hours', 'sla_overdue_hours']);
    const slaMap = toMap(slaRows);
    const slaThresholds = {
        warnHours: num(slaMap, 'sla_warn_hours', DEFAULT_SLA.warnHours),
        overdueHours: num(slaMap, 'sla_overdue_hours', DEFAULT_SLA.overdueHours)
    };

    const allBoilers = boilerRows ?? [];
    const allProjects = projectRows ?? [];
    const allBoilerProjects = boilerProjectRows ?? [];

    const boilerIdByCode: Record<string, string> = {};
    for (const b of allBoilers) boilerIdByCode[(b as any).code] = (b as any).id;

    const projectIdsByBoiler: Record<string, string[]> = {};
    for (const bp of allBoilerProjects) {
        (projectIdsByBoiler[(bp as any).boiler_id] ??= []).push((bp as any).project_id);
    }

    const boilerCount: Record<string, number> = {};
    for (const b of allBoilers) boilerCount[(b as any).code] = 0;
    const projectCount: Record<string, number> = {};
    for (const p of allProjects) projectCount[(p as any).id] = 0;

    for (const q of quotes) {
        const codes = [...new Set(((q as any).quote_items ?? []).map((it: any) => it.boiler_code).filter(Boolean))] as string[];
        const touchedProjects = new Set<string>();
        for (const code of codes) {
            if (!(code in boilerCount)) continue;
            boilerCount[code]++;
            const bid = boilerIdByCode[code];
            for (const pid of projectIdsByBoiler[bid] ?? []) touchedProjects.add(pid);
        }
        for (const pid of touchedProjects) {
            if (pid in projectCount) projectCount[pid]++;
        }
    }

    const volumeByBoiler = allBoilers
        .map((b: any) => ({ code: b.code, count: boilerCount[b.code] ?? 0 }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    const volumeByProject = allProjects
        .map((p: any) => ({ code: p.project_no, name: p.name, count: projectCount[p.id] ?? 0 }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    const latestApproval: Record<string, string> = {};
    for (const a of approvals) {
        if (!latestApproval[a.quote_id] || a.created_at > latestApproval[a.quote_id]) {
            latestApproval[a.quote_id] = a.created_at;
        }
    }

    const now = Date.now();
    let onTrack = 0, agingCount = 0, overdueCount = 0;
    const agingList: any[] = [];
    for (const q of quotes) {
        if (q.status !== 'open') continue;
        const since = latestApproval[q.id] ?? q.created_at;
        const st = slaStateWeekday(since, now, slaThresholds);
        if (st === 'overdue') overdueCount++;
        else if (st === 'aging') agingCount++;
        else onTrack++;
        const boilers = [...new Set(((q as any).quote_items ?? []).map((it: any) => it.boiler_code).filter(Boolean))];
        agingList.push({
            id: q.id,
            reference: (q as any).reference,
            levelLabel: LEVEL_LABEL[(q as any).current_level] ?? `Level ${(q as any).current_level}`,
            boiler: boilers.join(', ') || '—',
            since,
            created_at: q.created_at,
            state: st
        });
    }
    agingList.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const PAGE_LABELS: Record<string, string> = {
        '/app': 'Home',
        '/app/quotes': 'Quotes',
        '/app/requests': 'Requests',
        '/app/history': 'History',
        '/app/analytics': 'Analytics',
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
        title: 'Analytics', 
        total: quotes.length, 
        newThisWeek, 
        open, 
        closed, 
        avgResolutionMs, 
        handlingPerLevel, 
        volumeByBoiler, 
        volumeByProject, 
        openAging: { onTrack, aging: agingCount, overdue: overdueCount }, 
        slaThresholds, 
        agingList, 
        activitySummary, 
        chatSummary, 
        topUsers, 
        topPages, 
        recentActivity, 
        dailyActivity
    };
};