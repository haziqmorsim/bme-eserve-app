import { env } from "$env/dynamic/private";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCustomerRole, isStaffRole, userPages, userProjectTabs } from "$lib/roles";
import type { RetrievedPart } from "./retrieval";

const TIMEOUT_MS = 2500;
const USER_CACHE_MS = 60 * 1000;

export type NlpUser = {
    role: string;
    allowed: string[];
    boilers: Array<{ id: string; code: string | null; name: string | null }>;
};

export type NlpPart = {
    id: string | null;
    part_number: string | null;
    name: string;
    description: string | null;
    score: number;
    boiler_id: string | null;
    boiler_code: string | null;
};

export type NlpResult = {
    mode: 'direct' | 'assist';
    source: string | null;
    answer: string | null;
    intent: string;
    confidence: number;
    context: string;
    parts: NlpPart[];
    faqs: Array<{ id: string; question: string; score: number }>;
    links: Array<{ label: string; href: string }>;
};

const userCache = new Map<string, { at: number; value: NlpUser }>();

export async function loadNlpUser(supabase: SupabaseClient, userId: string): Promise<NlpUser | null> {
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.value;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, pages, project_tabs')
            .eq('id', userId)
            .single();
        if (!profile) return null;

        const pages: string[] = userPages(profile);
        const allowed = new Set<string>(pages);
        if (allowed.has('home')) {
            for (const tab of userProjectTabs(profile)) allowed.add(tab);
        }
        if (isStaffRole(profile.role)) allowed.add('settings');

        const { data: boilerRows } = await supabase
            .from('boilers')
            .select('id, code, name')
            .order('code', { ascending: true });
        let boilers = (boilerRows ?? []) as NlpUser['boilers'];

        if (isCustomerRole(profile.role)) {
            const { data: assigned } = await supabase
                .from("customer_boilers")
                .select("boiler_id")
                .eq("user_id", userId);
            const ids = new Set((assigned ?? []).map((r: { boiler_id: string }) => r.boiler_id));
            boilers = boilers.filter((b) => ids.has(b.id));
        }

        const value: NlpUser = { role: profile.role ?? 'customer', allowed: [...allowed], boilers };
        userCache.set(userId, { at: Date.now(), value });
        return value;
    } catch (e) {
        console.warn('nlp: could not load user context', e);
        return null;
    }
}

export async function analyzeMessage(input: {
    message: string;
    path: string | null;
    user: NlpUser;
    hasImage: boolean;
}): Promise<NlpResult | null> {
    const base = env.NLP_SERVICE_URL;
    if (!base || !input.message.trim()) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${base.replace(/\/+$/, '')}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(env.NLP_SERVICE_KEY ? { 'x-eserve-key': env.NLP_SERVICE_KEY } : {})
            },
            body: JSON.stringify({
                message: input.message.slice(0, 4000),
                path: input.path?.slice(0, 500) ?? null,
                role: input.user.role,
                allowed: input.user.allowed,
                boilers: input.user.boilers,
                has_image: input.hasImage
            }),
            signal: controller.signal
        });
        if (!res.ok) {
            console.warn('nlp: analyze returned', res.status);
            return null;
        }
        return (await res.json()) as NlpResult;
    } catch (e) {
        console.warn('nlp: service unavailable, using LLM only', e);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export function nlpPartsAsRetrieved(parts: NlpPart[]): RetrievedPart[] {
    return parts
        .filter((p): p is NlpPart & { id: string; part_number: string } => !!p.id && !!p.part_number)
        .map((p) => ({
            id: p.id,
            part_number: p.part_number,
            name: p.name,
            description: p.description,
            in_stock: null,
            similarity: p.score
        }));
}