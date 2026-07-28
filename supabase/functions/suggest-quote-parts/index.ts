import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient, guard } from "../_shared/reminders.ts";
import { matchComponent, sectionLabel } from "../_shared/sections.ts";

const RESUGGEST_AFTER_DAYS = 30;
const MAX_PARTS = 8;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders });
    if (!guard(req)) return json(401, { error: 'Unauthorized' });

    try {
        const admin = serviceClient();

        const { data: readings } = await admin
            .from('boiler_section_readings')
            .select('boiler_id, section_key, state')
            .eq('state', 'Attention');

        const attention = readings ?? [];
        if (attention.length === 0) return json(200, { ok: true, suggested: 0 });

        const boilerIds = [...new Set(attention.map((r: any) => r.boiler_id))];

        const { data: owners } = await admin
            .from('customer_boilers')
            .select('user_id, boiler_id')
            .in('boiler_id', boilerIds);

        if (!owners || owners.length === 0) return json(200, { ok: true, suggested: 0 });

        const [boilersRes, componentsRes] = await Promise.all([
            admin.from('boilers').select('id, code, name').in('id', boilerIds), 
            admin.from('components').select('id, boiler_id, name').in('boiler_id', boilerIds)
        ]);

        const boilerById: Record<string, any> = {};
        for (const b of boilersRes.data ?? []) boilerById[b.id] = b;

        const componentsByBoiler: Record<string, any> = {};
        for (const c of componentsRes.data ?? []) {
            (componentsByBoiler[c.boiler_id] ??= []).push(c);
        }

        const componentIds = (componentsRes.data ?? []).map((c: any) => c.id);
        const partsByComponent: Record<string, any> = {};
        if (componentIds.length) {
            const { data: parts } = await admin
                .from('parts')
                .select('id, component_id, part_number, name, price, price_min, price_max, in stock')
                .in('component_id', componentIds)
                .oder('part_number', { ascending: true });
            for (const p of parts ?? []) {
                (partsByComponent[p.component_id] ??= []).push(p);
            }
        }

        const userIds = [...new Set(owmers.map((o: any) => o.user_id))];
        const { data: existing } = await admin
            .from('notifications')
            .select('user_id, data, response, responded_at')
            .eq('type', 'quote_suggestion')
            .in('user_id', userIds);

        const cutoff = Date.now() - RESUGGEST_AFTER_DAYS * 24 * 3600 * 1000;
        const blocked = new Set<string>();
        for (const n of existing ?? []) {
            const d = (n.data ?? {}) as any;
            if (!d.boiler_id || !d.section_key) continue;
            const answeredRecently = n.responded_at != null && new Date(n.responded_at).getTime() > cutoff;
            if (n.response == null || answeredRecently) {
                blocked.add(`${n.user_id}|${d.boiler_id}|${d.section_key}`);
            }
        }

        const rows: any[] = [];

        for (const r of attention) {
            const boiler = boilerById[r.boiler_id];
            if (!boiler) continue;

            const component = matchComponent(r.section_key, componentsByBoiler[r.boiler_id] ?? []);
            if (!component) continue;

            const parts = (partsByComponent[component.id] ?? []).slice(0, MAX_PARTS);
            if (parts.length === 0) continue;

            const label = sectionLabel(r.section_key);

            const payload = {
                boiler_id: r.boiler_id, 
                boiler_code: boiler.code, 
                section_key: r.section_key, 
                section_label: label, 
                component_id: component.id, 
                component_name: component.name, 
                parts: parts.map((p: any) => ({
                    partId: p.id, 
                    partNumber: p.part_number, 
                    partName: p.name, 
                    price: p.price ?? null, 
                    priceMin: p.price_min ?? p.price ?? 0, 
                    priceMax: p.price_max ?? p.price ?? 0, 
                    quantity: 1
                }))
            };

            for (const o of owners) {
                if (o.boiler_id !== r.boiler_id) continue;
                if (blocked.has(`${o.user_id}|${r.boiler_id}|${r.section_key}`)) continue;

                rows.push({
                    user_id: o.user_id, 
                    quote_id: null, 
                    type: 'quote_suggestion', 
                    title: `${label} on ${boiler.code} needs attention`, 
                    body: `We suggest ${parts.length} ${component.name} part(s) for this section. Accept to add them to your quote list.`, 
                    data: payload
                });

                blocked.add(`${o.user_id}|${r.boiler_id}|${r.section_key}`);
            }
        }

        if (rows.length === 0) return json(200, { ok: true, suggested: 0 });

        const { error } = await admin.from('notifications').insert(rows);
        if (error) return json(400, { error: error.message });

        return json(200, { ok: true, suggested: rows.length });
    } catch (e) {
        console.error('suggest-quote-parts failed:', e);
        return json(400, { error: String(e) });
    }
});