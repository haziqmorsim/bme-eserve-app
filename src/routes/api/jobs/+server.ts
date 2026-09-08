import { enqueueJob, type JobType } from "$lib/server/jobs";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);
const TYPES: JobType[] = ['embed_parts', 'bulk_tag_enquiries'];

export const POST: RequestHandler = async ({ request, locals }) => {
    const { session } = await locals.safeGetSession();
    if (!session?.user?.id) return json({ error: 'Unauthorized'}, { status: 401 });

    const { data: profle } = await locals.supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (!profle || !STAFF.has(profle.role)) return json({ error: 'Forbidden' }, { status: 403 });
    if (profle.role === 'developer') return json ({ error: 'Read-only role'}, { status: 403 });

    let body: { type?: string; payload?: unknown };
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Bad request'}, { status: 400 });
    }

    if (!TYPES.includes(body.type as JobType)) {
        return json({ error: 'Unknown job type'}, { status: 400 });
    }

    const result = await enqueueJob(
        body.type as JobType,
        (body.payload ?? {}) as any,
        session.user.id
    );

    if ('error' in result) return json(result, { status: 400 });
    return json({ ok: true, jobId: result.id });
};

export const GET: RequestHandler = async ({ locals }) => {
    const { session } = await locals.safeGetSession();
    if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await locals.supabase
        .from('jobs')
        .select('id, job_type, status, attempts, max_attempts, result, error, created_at, finished_at')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return json({ error: error.message }, { status: 400 });
    return json({ jobs: data ?? [] });
};