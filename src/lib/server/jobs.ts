import { getSupabaseAdmin } from "./whatsapp";

export type JobType = 'embed_parts' | 'bulk_tag_enquiries';

export type EnqueueResult = { id: string } | { error: string };

type Payloads = {
    embed_parts: { all?: boolean; part_ids?: string[] };
    bulk_tag_enquiries: {
        enquiry_ids: string[];
        part_id?: string | null;
        resolution?: 'part_identified' | 'no_part_needed' | 'not_applicable';
        resolved_by?: string | null;
    };
};

const MAX_IDS = 500;

function validate(type: JobType, payload: any): string | null {
    if (type === 'embed_parts') {
        if (payload?.part_ids && !Array.isArray(payload.part_ids)) return 'part_ids must be an array';
        if (payload?.part_ids?.length > MAX_IDS) return `part_ids exceeds ${MAX_IDS}`;
        return null;
    }

    if (type === 'bulk_tag_enquiries') {
        const ids = payload?.enquiry_ids;
        if (!Array.isArray(ids) || ids.length === 0) return 'enquiry_ids is required';
        if (ids.length > MAX_IDS) return `enquiry_ids exceeds ${MAX_IDS}`;
        if (!ids.every((i: unknown) => typeof i === 'string' && i.length > 0)) return 'enquiry_ids must be strings';

        const resolution = payload?.resolution ?? 'part_identified';
        if (!['part_identified', 'no_parts_needed', 'not_applicable'].includes(resolution)) return 'invalid resolution';
        if (resolution === 'part_identified' && !payload?.part_id) return 'part_id is required when resolution is part_id entified';
        return null;
    }

    return 'unknown job type';
}

export async function enqueueJob<T extends JobType>(
    type: T,
    payload: Payloads[T],
    requestedBy: string | null
): Promise<EnqueueResult> {
    const problem = validate(type, payload);
    if (problem) return { error: problem };

    try {
        const supabase = getSupabaseAdmin();

        if (type === 'embed_parts' && !(payload as any)?.part_ids) {
            const { data: existing } = await supabase
                .from('jobs')
                .select('id')
                .eq('job_type', 'embed_parts')
                .in('status', ['queued', 'running'])
                .limit(1);
            if (existing?.length) return { id: existing[0].id };
        }
        
        const { data, error } = await supabase
            .from('jobs')
            .insert({ job_type: type, payload, requested_by: requestedBy })
            .select('id')
            .single();

        if (error) return { error: error.message };
        return { id: data.id };
    } catch (e) {
        console.error('enqueueJob failed:', e);
        return { error: 'Could not enqueue job' };
    }
}