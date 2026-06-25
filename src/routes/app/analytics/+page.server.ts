import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
const LEVEL_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'COO'};

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Staff only');

    const [{ data: quoteRows }, { data: approvalRows }, { data: regionRows }] = await Promise.all([
        supabase.from('quotes').select('id, status, created_at, reviewed_at, user_id, quote_items(boiler_code)'), 
        supabase.from('quotes_approvals').select('quote_id, level, action, created_at'), 
        supabase.from('regions').select('id, name')
    ]);

    const quotes = quoteRows ?? [];
    const approvals = approvalRows ?? [];
    const regions = regionRows ?? [];

    const RegionMap: Record<string, string> = {};
    for (const r of regions) RegionMap[r.id] = r.name;
    const ownerIds = [...new Set(quotes.map((q) => q.user_id).filter(Boolean))];
    const ownerRegion: Record<string, string | null> = {};
    if (ownerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, region_id').in('id', ownerIds);
        for (const p of profs ?? []) {
            ownerRegion[p.id] = p.region_id ? (RegionMap[p.region_id] ?? null) : null;
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
                const dur = new Date(a.created_at).getTime() - new Date(arrival).getTime();
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
        .sort ((a, b) => b.count - a.count);

    const boilerCount: Record<string, number> = {};
    for (const q of quotes) {
        const codes = new Set(((q as any).quote_items ?? []).map((it: any) => it.boiler_code).filter(Boolean));
        for (const c of codes) boilerCount[c as string] = (boilerCount[c as string] ?? 0) + 1;
    }
    const volumeByBoiler = Object.entries(boilerCount)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        title: 'Analytics', 
        total: quotes.length, 
        open, 
        closed, 
        avgResolutionMs, 
        handlingPerLevel, 
        volumeByRegion, 
        volumeByBoiler
    };
};