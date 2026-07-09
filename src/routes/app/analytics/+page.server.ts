import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { slaState, slaStateBusiness } from "$lib/sla";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO'};

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const WORK_START_MIN = 8 * 60 + 30; // 08:30
const WORK_END_MIN = 18 * 60;       // 18:00
const DAY_MS = 24 * 60 * 60 * 1000;

function businessMs(startUtcMs: number, endUtcMs: number): number {
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
        const winStart = dayMs + WORK_START_MIN * 60000;
        const winEnd = dayMs + WORK_END_MIN * 60000;
        const from = Math.max(s, winStart);
        const to = Math.min(e, winEnd);
        if (to > from) total += to - from;
    }
    return total;
}

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Staff only');

    const [{ data: quoteRows }, { data: approvalRows }, { data: regionRows }, { data: enquiryRows }] = await Promise.all([
        supabase.from('quotes').select('id, reference, status, created_at, reviewed_at, current_level, user_id, quote_items(boiler_code)'), 
        supabase.from('quote_approvals').select('quote_id, level, action, created_at, reviewer_id'), 
        supabase.from('regions').select('id, name'), 
        supabase.from('enquiries').select('id, name, created_at')
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];
    const regions = regionRows ?? [];
    const enquiries = enquiryRows ?? [];

    const RegionMap: Record<string, string> = {};
    for (const r of regions) RegionMap[r.id] = r.name;
    const ownerIds = [...new Set(quotes.map((q) => q.user_id).filter(Boolean))];
    const reviewerIds = [...new Set(approvals.map((a) => (a as any).reviewer_id).filter(Boolean))];
    const personIds = [...new Set([...ownerIds, ...reviewerIds])];
    const ownerRegion: Record<string, string | null> = {};
    const person: Record<string, { name: string; company: string | null; role: string | null }> = {};
    if (personIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, company, role, region_id').in('id', personIds);
        for (const p of profs ?? []) {
            ownerRegion[p.id] = p.region_id ? (RegionMap[p.region_id] ?? null) : null;
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
                const dur = businessMs(new Date(arrival).getTime(), new Date(a.created_at).getTime());
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

    const regionCount: Record<string, number> = {};
    for (const q of quotes) {
        const rn = ownerRegion[q.user_id] ?? 'Unknown';
        regionCount[rn] = (regionCount[rn] ?? 0) + 1;
    }
    const volumeByRegion = Object.entries(regionCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const boilerCount: Record<string, number> = {};
    for (const q of quotes) {
        const codes = new Set(((q as any).quote_items ?? []).map((it: any) => it.boiler_code).filter(Boolean));
        for (const c of codes) boilerCount[c as string] = (boilerCount[c as string] ?? 0) + 1;
    }
    const volumeByBoiler = Object.entries(boilerCount)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        .slice(0, 10);

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
        const st = slaStateBusiness(since, now);
        if (st === 'overdue') overdueCount++;
        else if (st === 'aging') agingCount++;
        else onTrack++;
        const boilers = [...new Set(((q as any).quote_items ?? []).map((it: any) => it.boiler_code).filter(Boolean))];
        agingList.push({
            id: q.id,
            reference: (q as any).reference,
            levelLabel: LEVEL_LABEL[(q as any).current_level] ?? `Level ${(q as any).current_level}`,
            boiler: boilers.join(', ') || '—',
            region: ownerRegion[q.user_id] ?? 'Unknown',
            since,
            created_at: q.created_at,
            state: st
        });
    }
    agingList.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const THIRTY_MS = 30 * DAY_MS;
    const thirtyAgo = now - THIRTY_MS;

    const activeCustomers = new Set<string>();
    for (const q of quotes) {
        if (q.user_id && new Date(q.created_at).getTime() >= thirtyAgo) activeCustomers.add(q.user_id);
    }
    const activeStaff = new Set<string>();
    let actions30 = 0;
    for (const a of approvals) {
        if (new Date(a.created_at).getTime() >= thirtyAgo) {
            actions30++;
            if ((a as any).reviewer_id) activeStaff.add((a as any).reviewer_id);
        }
    }

    let enquiries30 = 0;
    for (const e of enquiries) {
        if (new Date(e.created_at).getTime() >= thirtyAgo) enquiries30++;
    }
    const activitySummary = {
        activeCustomers: activeCustomers.size, 
        activeStaff: activeStaff.size, 
        actions: actions30, 
        enquiries: enquiries30
    };

    const custCount: Record<string, number> = {};
    for (const q of quotes) if (q.user_id) custCount[q.user_id] = (custCount[q.user_id] ?? 0) + 1;
    const topCustomers = Object.entries(custCount)
        .map(([id, count]) => ({ name: person[id]?.name ?? 'User', company: person[id]?.company ?? null, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const staffCount: Record<string, number> = {};
    for (const a of approvals) {
        const rid = (a as any).reviewer_id;
        if (rid) staffCount[rid] = (staffCount[rid] ?? 0) + 1;
    }
    const staffActivity = Object.entries(staffCount)
        .map(([id, count]) => ({ name: person[id]?.name ?? 'User', role: person[id]?.role ?? null, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const quoteRef: Record<string, string> = {};
    for (const q of quotes) quoteRef[q.id] = (q as any).reference;

    const events: { ts: string; who: string; action: string; detail: string; kind: string }[] = [];
    for (const q of quotes) {
        events.push({ 
            ts: q.created_at, 
            who: person[q.user_id]?.name ?? 'Customer', 
            action: 'submitted request', 
            detail: (q as any).reference ?? '', 
            kind: 'request' 
        });
    }
    for (const a of approvals) {
        const rid = (a as any).reviewer_id;
        events.push({
            ts: a.created_at, 
            who: rid ? (person[rid]?.name ?? 'Staff') : 'Staff', 
            action: a.action === 'closed' ? 'closed request' : (a.action === 'reopened' ? 'reopened request' : String(a.action)), 
            detail: quoteRef[a.quote_id] ?? '', 
            kind: String(a.action)
        });
    }
    for (const e of enquiries) {
        events.push({ 
            ts: e.created_at, 
            who: (e as any).name || 'Someone', 
            action: 'sent an enquiry', 
            detail: '', 
            kind: 'enquiry'
        });
    }
    events.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const recentActivity = events.slice(0, 12);

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
    }
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
        volumeByRegion, 
        volumeByBoiler, 
        openAging: { onTrack, aging: agingCount, overdue: overdueCount }, 
        agingList, 
        activitySummary, 
        topCustomers, 
        staffActivity, 
        recentActivity, 
        dailyActivity
    };
};