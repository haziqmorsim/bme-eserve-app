import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { slaStateWeekday, DEFAULT_SLA } from "$lib/sla";
import { toMap, num } from "$lib/settings";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [{ data: quoteRows }, { data: approvalRows }] = await Promise.all([
        supabase.from('quotes').select('id, reference, status, created_at, reviewed_at, quote_items(boiler_code, part_name, part_number)'), 
        supabase.from('quote_approvals').select('quote_id, created_at')
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];

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

    const TOP_PARTS = 10;
    const partGroups = new Map<string, { count: number; names: Map<string, number> }>();
    for (const q of quotes) {
        for (const it of ((q as any).quote_items ?? []) as any[]) {
            const raw = String(it.part_name ?? it.part_number ?? '').replace(/\s+/g, ' ').trim();
            if (!raw) continue;
            const key = raw.toLowerCase();
            const g = partGroups.get(key) ?? { count: 0, names: new Map<string, number>() };
            g.count++;
            g.names.set(raw, (g.names.get(raw) ?? 0) + 1);
            partGroups.set(key, g);
        }
    }
    const allParts = [...partGroups.values()].map((g) => ({
        name: [...g.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
        count: g.count
    }));
    allParts.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { numeric: true }));
    const volumeByPart = allParts.slice(0, TOP_PARTS);
    const partsTotal = allParts.length;

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
            boiler: boilers.join(', ') || '—',
            since,
            created_at: q.created_at,
            state: st
        });
    }
    agingList.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    return {
        title: 'Customer Requests', 
        total: quotes.length, 
        newThisWeek, 
        open, 
        closed, 
        avgResolutionMs, 
        volumeByBoiler, 
        volumeByProject, 
        volumeByPart, 
        partsTotal, 
        openAging: { onTrack, aging: agingCount, overdue: overdueCount }, 
        slaThresholds, 
        agingList
    };
};