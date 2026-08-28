import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

const LABELS_PER_PART_TARGET = 50;

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Forbidden');

    const [statsRes, calibRes, coverageRes] = await Promise.all([
        supabase
            .from('training_label_stats')
            .select('*')
            .single(),
        supabase
            .from('training_confidence_calibration')
            .select('*'),
        supabase
            .from('training_part_coverage')
            .select('part_number, name, chat_labels, enquiry_labels, service_intervals, text_labels')
            .order('text_labels', { ascending: false })
    ]);

    const s: any = statsRes.data ?? [];
    const coverage: any[] = coverageRes.data ?? [];

    const baselineResolved = Number(s.baseline_resolved ?? 0);
    const baselineCorrect = Number(s.baseline_correct ?? 0);
    const baselineAccuracy = baselineResolved > 0 ? Math.round((baselineCorrect / baselineResolved) * 1000) / 10 : null;
    const labelledParts = coverage.filter((c) => c.text_labels > 0).length;
    const readyParts = coverage.filter((c) => c.text_labels >= LABELS_PER_PART_TARGET).length;
    const topParts = coverage.filter((c) => c.text_labels > 0).slice(0, 12);

    return {
        stats: {
            suggestionsTotal: Number(s.suggestions_total ?? 0),
            suggestionsPending: Number(s.suggestions_pending ?? 0),
            labelsFromChat: Number(s.labels_from_chat ?? 0),
            enquiriesTotal: Number(s.enquiries_total ?? 0),
            enquiriesUntagged: Number(s.enquiries_untagged ?? 0),
            labelsFromEnquiries: Number(s.labels_from_enquiries ?? 0),
            serviceRecords: Number(s.service_records_total ?? 0),
            serviceIntervals: Number(s.service_intervals_total ?? 0),
            partsTotal: Number(s.parts_total ?? 0),
        },
        baseline: { 
            accuracy: baselineAccuracy,
            correct: baselineCorrect,
            resolved: baselineResolved
        },
        calibration: calibRes.data ?? [],
        coverage: {
            labelledParts,
            readyParts,
            topParts,
            target: LABELS_PER_PART_TARGET
        },
        title: "Training Data"
    };
};