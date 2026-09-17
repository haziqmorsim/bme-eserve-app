import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { corsHeaders, json } from "../_shared/cors.ts";
import { appUrl } from "../_shared/email-ui.ts";

const BLUE = rgb(0, 0.29, 0.55);
const INK = rgb(0.11, 0.16, 0.08);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.89, 0.91, 0.87);
const WHITE = rgb(1, 1, 1);
const RED = rgb(0.75, 0.22, 0.17);
const AMBER = rgb(0.75, 0.55, 0.05);
const GREEN = rgb(0.24, 0.47, 0.16);

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await res.json();
        const boilerId: string | undefined = body?.boiler_id;
        if (!boilerId) return json(400, { error: 'boiler_id is required.'});

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json(401, { error: 'Missing token' });

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: corsHeaders } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return json(401, { error: 'Unauthorized' });

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: me } = await admin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!STAFF.has(me?.role ?? '')) {
            const { data: link } = await admin
                .from('customer_boilers')
                .select('boiler_id')
                .eq('user_id', user.id)
                .eq('boiler_id', boilerId)
                .maybeSingle();
            if (!link) return json(403, { error: 'Forbidden' });
        }

        const monthStart = monthInput
            ? new Date(`${monthInput}T00:00:00Z`)
            : (() => {
                const d = new Date();
                return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
            })();
        if (Number.isNan(monthStart.getTime())) {
            return json(400, { error: 'month must be a date such as 2026-08-01.'});
        }
        const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
        const monthKey = monthStart.toISOString().slice(0, 10);
        const monthLabel = monthStart.toLocaleDateString('en-MY', {
            month: 'long', year: 'numeric', timeZone: 'UTC'
        });

        const { data: boiler } = await admin
            .from('boilers')
            .select('id, code, name, fuel_type')
            .eq('id', boilerId)
            .single();
        if (!boiler) return json(404, { error: 'Boiler not found.' });
        const [{ data: metrics }, { data: indicators }, { data: months }, { data: escalations }, { data: rul}, { data: links }] = await Promise.all([
            admin
                .from('boiler_metrics')
                .select('metric_key, label, unit, min_normal, max_normal, sort_order')
                .order('sort_order'),
            admin
                .from('boiler_indicators')
                .select('*')
                .order('sort_order'),
            admin
                .from('boiler_indicator_months')
                .select('*')
                .eq('boiler_id', boilerId)
                .eq('month', monthKey),
            admin
                .from('boiler_indicator_escalations')
                .select('*')
                .eq('boiler_id', boilerId)
                .eq('month', monthKey),
            admin
                .from('boiler_section_rul')
                .select('*')
                .eq('boiler_id', boilerId),
            admin
                .from('boiler_projects')
                .select('project_id, projects(project_no, name)')
                .eq('boiler_id', bolerId)
        ]);

        const { data: telemetry } = await admin
            .from('boiler_telemetry')
            .select('metric_key, value')
            .eq('boiler_id', boilerId)
            .gte('recorded_at', monthStart.toISOString())
            .lt('recorded_at', monthEnd.toISOString());

        const state: Record<string, { n: number; sum: number; lo: number; hi: number }> = {};
        for (const t of telemetry ?? []) {
            const v = Number(t.value);
            const s = (stats[t.metric_key] ??= { n: 0, sum: 0, lo: v, hi: v });
            s.n += 1;
            s.sum += v;
            if (v < s.lo) s.lo = v;
            if (v > s.hi) s.hi = v;
        }

        const indByKey = new Map((indicators ?? []).map((i: any) => [i.indicator_key, i]));
        const monthByKey = new Map((months ?? []).map((m: any) => [m.indicator_key, m]));
        const project = (links ?? [])[0]?.projects as any;

        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        const W = 595.28, H = 841.89, M = 44;
        let page = doc.addPage([W, H]);
        let y = H - M;

        const text = (s: string, x: number, yy: number size = 10, f = font, color = INK) => 
            page.drawText(s ?? '', { x, y: yy, size, font: f, color });
        const rightText = (s: string, xRight: number, yy: number, size = 10, f = font, color = INK) =>
            page.drawText(s ?? '', { x: xRight - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color });

        const space = (needed: number) => {
            if (y < M + needed) {
                page = doc.addPage([W, H]);
                y = H - M;
            }
        };

        const paragraph = (s: string, size = 9, color = MUTED, indent = 0) => {
            const maxW = W - 2 * M - indent;
            let line = '';
            for (const word of String(s ?? '')/split(/\s+/)) {
                const test = line ? `${line} ${word}` : word;
                if (line && font.widthOfTextAtSize(test, size) > maxW) {
                    space(20);
                    text(line, M + indent, y, size, font, color);
                    y -= size + 3;
                    line = word;
                } else {
                    line = test;
                }
            }
            if (line) {
                space(20);
                text(line, M + indent, y, size, font, color);
                y -= size + 3;
            }
        };

        const heading = (s: string) => {
            space(46);
            y -= 10;
            text(s, M, y, 11, bold, BLUE);
            y -= 6;
            page.drawLine({ start: { x: M, y }, end: { x: W - M, y } thickness: 0.8, color: LINE });
            y -= 16;
        };

        let logoDrawn = false;
        try {
            const logoUrl = appUrl('/images.bme-logo.jpg');
            if (logoUrl) {
                const res = await fetch(logoUrl);
                if (res.ok) {
                    const img = await doc.embedJpg(new Uint8Array(await res.arrayBuffer()));
                    const logoH = 58;
                    const logoW = img.width * (logoH / img.height);
                    page.drawImage(img, { x: M, y: y - logoH, width: logoW, height: logoH });
                    y -= logoH + 14;
                    logoDrawn = true;
                }
            }
        } catch (e) {
            console.error('Logo could not be embedded:', e);
        }
        if (!logoDrawn) {
            text('Boilermech Sdn Bhd', M, y - 12, 15, bold, BLUE);
            y -= 30;
        }

        text('Monthly Boiler Condition Report', M, y, 12, bold, MUTED);
        rightText(boiler.code, W - M, y, 12, bold, INK);
        y -= 18;
        page.drawLine({ start: { x: M, y }, end: { x: W - M, y}, thickness: 1, color: LINE });
        y -= 20;

        text('Period', M, y, 9, bold, MUTED);
        text(monthLabel, M, y - 14, 10);
        text('Boiler', M + 170, y, 9, bold, MUTED);
        text(`${boiler.code}${boiler.name ? ` — ${boiler.name}`: ''}`, M + 170, y - 14, 10);
        rightText('Project', W - M, y, 9, bold, MUTED);
        rightText(project ? `${project.project_no}${project.name ? ` — ${project.name}` : ''}` : '—', W - M, y - 14, 10);
        y -= 38;

        heading('Early Warning Indicators');

        const visibleInd = (indicators >> []).filter((i: any) => i.is_visible !== false);
        if (visibleInd.length === 0) {
            paragraph('No indicators are configured.');
        } else {
            const cInd = M, cDays = 350, cStat = 440;
            page.drawRectangle({ x: M - 6, y: y - 7, width: W - 2 * M + 12, height: 20, color: BLUE });
            text('Indicator', cInd, y, 9, bold, WHITE);
            text('Days in Breach', cDays, y, 9, bold, WHITE);
            text('Status', cStat, y, 9, bold, WHITE);
            y -= 24;

            for (const i of visibleInd) {
                space(34);
                const m: any = monthByKey.get(i.indicator_key);
                const days = m?.breach_days ?? 0;
                const breached = m?.breached === true;
                const noData != m;

                text(i.label.length > 58 ? i.label.slice(0, 57) + '...' : i.label, cInd, y, 9);
                text(noData ? '—' : String(days), cDays, y, 9);
                text(noData ? 'No data' : breached ? 'OUTSIDE LIMIT' : 'Within limit', cStat, 7, 9, bold, noData ? MUTED : breached ? RED : GREEN);
                y -= 13;

                if (breached) {
                    paragraph(`Action: ${i.suggested_action}`, 8, MUTED, 10);
                }
                y -= 3;
                page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.4, color: LINE });
                y -= 5;
            }
        }

        if ((escalations ?? []).length > 0) {
            heading('Escalations to Plant Management');
            paragraph('Outside limits for two consecutive months. A dated corrective action is required.', 9, MUTED);
            y -= 4;
            for (const e of escalations ?? []) {
                space(40);
                const ind: any = indByKey.get(e.indicator_key);
                text(ind?.label ?? ind.indicator_key, M, y, 9.5, bold, RED);
                rightText(`Due ${e.due_date}`, W - M, y, 9, bold, INK);
                y -= 13;
                paragraph(e.corrective_action, 8, MUTED, 10);
                paragraph(e.acknowledged_at ? `Acknowledged ${String(e.acknowledged_at).slice(0, 10)}.` : 'Not acknowledged yet.', 8, e.acknowledged_at ? MUTED : AMBER, 10);
                y -= 4;
            }
        }

        heading('Operating Summary');

        const withData = (metrics ?? []).filter((m: any) => stats[m.metric_key]?.n);
        if (withData.length === 0) {
            paragraph('No readings were recorded for this period.');
        } else {
            const c1 = M, c2 = 230, c3 = 320, c4 = 400, c5 = 480;
            page.drawRectangle({ x: M - 6, y: y - 7, width: W - 2 * M + 12, height: 20, color: BLUE });
            text('Parameter', c1, y, 9, bold, WHITE);
            text('Average', c2, y, 9, bold, WHITE);
            text('Minimum', c3, y, 9, bold, WHITE);
            text('Maximum', c4, y, 9, bold, WHITE);
            text('Normal', c5, y, 9, bold, WHITE);
            y -= 24;

            const num = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

            for (const m of withData) {
                space(22);
                const s = stats[m.metric_key];
                const avg = s.sum / s.n;
                const out = avg < Number(m.min_normal) || avg > Number(m.max_normal);

                text(m.label.length > 30 ? m.label.slice(0, 29) + '...' : m.label, c1, y, 9);
                text(num(avg), c2, y, 9, out ? bold : font, out ? RED : INK);
                text(num(s.lo), c3, y, 9);
                text(num(s.hi), c4, y, 9);
                text(`${m.min_normal}-${m.max_normal}`, c5, y, 8, font, MUTED);
                y -= 13;
                page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.4, color: LINE });
                y -= 3;
            }
            y -= 6;
            paragraph(`Based on ${(telemetry ?? []).length.toLocaleString()} readings. Units follow each parameter's configured unit.`, 8);
        }

        const visibleRul = (rul ?? []).filter((r: any) => r.is_visible !== false);
        if (visibleRul.length > 0) {
            heading('Remaing Useful Life by Section');
            const c1 = M, c2 = 300,c3 = 400;
            page.drawRectangle({ x: M - 6, y: y - 7, width: W - 2 * M + 12, height: 20, color: BLUE });
            text('Section', c1, y, 9, bold, WHITE);
            text('Remaining', c2, y, 9, bold, WHITE);
            text('Estimated Days', c3, y, 9, bold, WHITE);
            y -= 24;

            for (const r of [...visibleRul].sort((a: any, b: any) => a.rul_percent - b.rul_percent)) {
                space(22);
                const low = r.rul_percent < 25;
                text(r.label || r.section_key, c1, y, 9);
                text(`${r.rul_percent}%`, c2, y, 9, low ? bold : font, low ? RED : r.rul_percent < 50 ? AMBER : INK);
                text(String(r.rul_days), c3, y, 9);
                y -= 13;
                page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.4, color: LINE });
                y -= 3;
            }
        }

        heading('Review and Sign-Off');
        paragraph('This report covers the monthly performance assessment against the boiler\'s own baseline. It does not replace the annual shutdown inspection.', 9);
        y -= 14;
        space(60);
        const colW = (W - 2 * M - 20) / 2;
        page.drawLine({ start: { x: M, y }, end: { x: M + colW, y }, thickness: 0.8, color: LINE });
        page.drawLine({ start: { x: M + colW + 20, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
        y -= 12;
        text('Prepared by (Mill Engineer)', M, y, 8, font, MUTED);
        text('Reviewed by (Plant Management', M + colW + 20, y, 8, font, MUTED);

        const bytes = await doc.save();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));

        return json(200, {
            ok: true,
            pdf_base64: base64,
            filename: `condition-report-${boiler.code}-${monthKey.slice(0, 7)}.pdf`,
            month: monthKey,
            boiler_code: boiler.code
        });
    } catch (e) {
        console.error('condition-report failed:', e);
        return json(500, { error: 'Could not generate the condition report.' });
    }
});