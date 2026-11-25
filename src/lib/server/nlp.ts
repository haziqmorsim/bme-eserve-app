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

const FALLBACK_PAGES: Array<{ key: string; line: string; subs?: string[] }> = [
    { key: 'home', line: '[Home](/app): your projects and boilers. Choose a boiler to open its Spare Parts (and Dashboard, if enabled) tab.' },
    {
        key: 'parts',
        line: 'Spare Parts: open a boiler from [Home](/app), then its Spare Parts tab. Click a section on the 3D boiler or pick it from the Boiler sections list, choose a component and part, set the quantity and click Add. Search by part number, name or description. Parts can show a 3D view or a Photo.'
    },
    {
        key: 'dashboard',
        line: 'Dashboard: open a boiler from [Home](/app), then its Dashboard tab. Sub-tabs: Overview (3D model, click a section for readings), Trends, Motors, Alerts, Analytics, Indicators, Inspection, Log Sheet, Programme, Maintenance.'
    },
    { key: 'cart', line: '[Cart](/app/quotes): check quantities, add notes and attachments (PDF, Word, Excel, CSV, text, PNG/JPG/WEBP, up to 10 MB in total), then Submit a quotation request.' },
    { key: 'history', line: '[History](/app/history): submitted requests with reference, status, parts and attachments; Request Again adds the parts back to the Cart.' },
    { key: 'profile', line: '[Profile](/app/profile): Edit Profile for name, company, e-mail, phone and address; Change Password.' },
    { key: 'requests', line: '[Requests](/app/requests): open customer quotation requests with SLA badges (staff).' },
    { key: 'enquiries', line: '[Enquiries](/app/enquiries): general enquiries from the sign-in page, Unreplied and Replied tabs (staff).' },
    {
        key: 'analytics',
        line: '[Analytics](/app/analytics): staff reporting pages.',
        subs: [
            '[Audit Log](/app/analytics/audit-log): who changed what, and when.',
            '[Customer Requests](/app/analytics/customer-requests): quotation request statistics.',
            '[Demand Forecasts](/app/analytics/forecasts): projected monthly demand per project and predicted replacements (weekly estimates).',
            '[E-mail Deliveries](/app/analytics/email-log): whether app e-mails were sent.',
            '[Service Records](/app/analytics/service-records): parts replaced, repaired or inspected on customer boilers; Add service record.',
            '[Suggestion Reviews](/app/analytics/suggestions): confirm or correct the part the assistant suggested.',
            '[Training Data](/app/analytics/training-data): labelled data and the assistant\'s current accuracy.',
            '[User Activities](/app/analytics/user-activities): sign-ins and user actions.'
        ]
    },
    {
        key: 'others',
        line: '[Others](/app/others): convert PDFs to Excel. Drop PDFs in, click Extract, then Download Excel.',
        subs: ['[Shipping Invoice](/app/others?tab=invoice)', '[Packing List](/app/others?tab=packing)']
    },
    { key: 'settings', line: '[Settings](/app/settings): tabs Projects, Boilers, Parts, Users, General and FAQ (staff).' }
];

export function fallbackAppMap(user: NlpUser | null, path: string | null): string {
    const lines = ['', '', 'App map (the NLP service is unavailable; link ONLY these paths, exactly as written):'];
    if (!user) {
        lines.push('- The user\'s access could not be checked. Give plain directions and only link [Home](/app), [Cart](/app/quotes), [History](/app/history) and [Profile](/app/profile).');
        return lines.join('\n');
    }
    const allowed = new Set(user.allowed);
    const hidden: string[] = [];
    for (const p of FALLBACK_PAGES) {
        if (!allowed.has(p.key)) {
            hidden.push(p.key);
            continue;
        }
        lines.push(`- ${p.line}`);
        for (const sub of p.subs ?? []) lines.push(`  - ${sub}`);
    }
    lines.push('- Everyone: [FAQ](/app/faq) and [Privacy Policy](/app/policy) (footer), the bell for notifications, the light/dark toggle, and Sign Out (top right).');
    if (hidden.length) lines.push(`- Not available to this user (do not offer them): ${hidden.join(', ')}`);
    lines.push(`- User role: ${user.role}`);
    if (path) lines.push(`- The user is currently on: ${path.slice(0, 200)}`);
    if (user.boilers.length) {
        const shown = user.boilers
            .slice(0, 8)
            .map((b) => `${b.code ?? 'Boiler'} [${b.code ?? 'Boiler'} Spare Parts](/app?boiler=${b.id}&tab=parts)`)
            .join(', ');
        lines.push(`- Boilers assigned to this user: ${shown}`);
    } else if (isCustomerRole(user.role)) {
        lines.push('- This user has no boilers assigned yet.');
    }
    return lines.join('\n');
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