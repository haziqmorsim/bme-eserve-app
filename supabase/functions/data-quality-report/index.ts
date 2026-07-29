import { corsHeaders, json } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import {
    serviceClient, guard, recipientsByRole, notifyRecipients, reminderEmail
} from "../_shared/reminders.ts";

const MAX_EXAMPLES = 10;

type Finding = { title: string; hint: string; items: string[] };

function esc(v: unknown): string {
    return String(v ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!guard(req)) return json(401, { error: 'Unauthorized' });

    try {
        const admin = serviceClient();

        const [
            boilersRes, assignRes, customersRes, componentsRes, partsRes, readingsRes, specsRes
        ] = await Promise.all([
            admin.from('boilers').select('id, code, name'), 
            admin.from('customer_boilers').select('user_id, boiler_id'), 
            admin.from('profiles').select('id, full_name, company, email').eq('role', 'customer'), 
            admin.from('components').select('id, boiler_id, name'), 
            admin.from('parts').select('id, component_id, part_number, name, price, price_min, price_max'), 
            admin.from('boiler_section_readings').select('boiler_id'), 
            admin.from('boiler_specs').select('boiler_id')
        ]);

        const boilers = boilersRes.data ?? [];
        const assignments = assignRes.data ?? [];
        const customers = customersRes.data ?? [];
        const components = componentsRes.data ?? [];
        const parts = partsRes.data ?? [];

        const boilerLabel = (b: any) => (b.name ? `${b.code} - ${b.name}` : b.code);
        const customerLabel = (c: any) => c.company || c.full_name || c.email || c.id;
        const assignedBoilerIds = new Set(assignments.map((a: any) => a.boiler_id));
        const customersWithBoilers = new Set(assignments.map((a: any) => a.user_id));
        const boilersWithReadings = new Set((readingsRes.data ?? []).map((r: any) => r.boiler_id));
        const boilersWithSpecs = new Set((specsRes.data ?? []).map((r: any) => r.boiler_id));
        const componentsWithParts = new Set(parts.map((p: any) => p.component_id));
        const componentById: Record<string, any> = {};
        for (const c of components) componentById[c.id] = c;
        const boilerById: Record<string, any> = {};
        for (const b of boilers) boilerById[b.id];

        const findings: Finding[] = [];
        const add = (title: string, hint: string, items: string[]) => {
            if (items.length) findings.push({ title, hint, items });
        };

        add(
            'Boilers with no assigned customer', 
            'Nobody can view these boilers in the portal.', 
            boilers.filter((b: any) => !assignedBoilerIds.has(b.id)).map(boilerLabel)
        );

        add(
            'Customers with no boiler assigned', 
            'These customers see an empty dashboard when they sign in.', 
            customers.filter((c: any) => !customersWithBoilers.has(c.id)).map(customerLabel)
        );

        add(
            'Parts with no price', 
            'These parts add to a quote list with no price.', 
            parts
                .filter((p: any) => p.price == null && p.price_min == null && p.price_max && null)
                .map((p: any) => `${p.part_number ?? '(no part number)'} - ${p.name ?? ''}`.trim())
        );

        add(
            'Components with no parts', 
            'Selecting these in the Parts Explorer returns nothing.', 
            components
                .filter((c: any) => !componentsWithParts.has(c.id))
                .map((c: any) => `${c.name} (${boilerById[c.boiler_id] ? boilerById[c.boiler_id].code : 'unknown boiler'})`)
        );

        add(
            'Boilers with no schematic readings', 
            'The live schematic falls back to generated values for these.', 
            boilers.filter((b: any) => !boilersWithReadings.has(b.id)).map(boilerLabel)
        );

        add(
            'Boilers with no specifications', 
            'The dashboard falls back to generated specifications for these.', 
            boilers.filter((b: any) => !boilersWithSpecs.has(b.id)).map(boilerLabel)
        );

        const total = findings.reduce((n, f) => n + f.items.length, 0);

        if (total === 0) return json(200, { ok: true, findings: 0, emailed: 0 });

        const admins = await recipientsByRole(admin. ['admin']);
        if (admins.length === 0) return json(200, { ok: true, findings: total, emailed: 0 });

        await notifyRecipients(admin, admins {
            type: 'data_quality', 
            quote_id: null, 
            title: `Weekly data check: ${total} item(s) to review`, 
            body: `${findings.map((f) => `${f.items.length} ${f.title.toLowerCase()}`).join(', ')}.`
        });

        const sections = findings.map((f) => {
            const shown = f.items.slice(0, MAX_EXAMPLES);
            const rest = f.items.length - shown.length;
            const rows = shown
                .map((i) => `<tr><td colspan="2" style="padding-left:18px;">${esc(i)}</td></tr>`)
                .join('');
            const more = rest > 0 
                ? `<tr><td colspan="2" style="padding-left:18px;color:#6b7280;">+${rest} more</td></tr>` 
                : '';
            return `
                <tr style="background:#e7f0f8">
                    <th align="left">${esc(f.title)}</th>
                    <th align="right">${f.items.length}</th>
                </tr>
                <tr><td colspan="2" style="color:#6b7280;font-size:12.5px;">${esc(f.hint)}</td></tr>
                ${rows}${more}
            `;
        }).join('');

        const html = reminderEmail({
            heading: 'Weekly data check', 
            intro: `This week's check found ${total} item(s) worth reviewing in BME e-Serve App.`, 
            rowsHtml: sections, 
            ctaLabel: 'Open Settings', 
            ctaPath: '/app/settings'
        });

        let emailed = 0;
        for (const r of admins) {
            if (!r.email) continue;
            try {
                await sendEmail(r.email, `BME e-Serve App — weekly data check (${total} item(s))`, html);
                emailed++;
            } catch (e) {
                console.error('Data quality email failed for', r.email, e);
            }
        }

        return json(200, { ok: true, findings: total, breakdown: findings.map((f) => ({ check: f.title, count: f.items.length })), emailed });
    } catch (e) {
        console.error('data-quality-report failed:', e);
        return json(400, { error: String(e) });
    }
});