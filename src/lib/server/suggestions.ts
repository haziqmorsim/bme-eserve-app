import { getSupabaseAdmin } from './whatsapp';
import type { RetrievedPart } from './retrieval';

export type SuggestionInput = {
	id?: string;
	userId: string | null;
	sessionId?: string | null;
	channel?: 'web' | 'whatsapp';
	queryText: string;
	boilerCode?: string | null;
	retrieved: RetrievedPart[];
	suggestedPartId?: string | null;
	suggestedPartNumber?: string | null;
	reasoning?: string | null;
	confidence?: 'high' | 'medium' | 'low' | null;
	hasImage?: boolean;
	imageDescription?: string | null;
};

export async function logSuggestion(input: SuggestionInput): Promise<string | null> {
	try {
		const supabase = getSupabaseAdmin();
		const { data, error } = await supabase
			.from('part_suggestions')
			.insert({
				...(input.id ? { id: input.id } : {}),
				user_id: input.userId,
				session_id: input.sessionId ?? null,
				channel: input.channel ?? 'web',
				query_text: input.queryText.slice(0, 4000),
				boiler_code: input.boilerCode ?? null,
				retrieved: input.retrieved.map((p) => ({
					part_id: p.id,
					part_number: p.part_number,
					similarity: Number(p.similarity?.toFixed(4) ?? 0)
				})),
				suggested_part_id: input.suggestedPartId ?? null,
				suggested_part_number: input.suggestedPartNumber ?? null,
				reasoning: input.reasoning?.slice(0, 2000) ?? null,
				model_confidence: input.confidence ?? null,
				has_image: input.hasImage ?? false,
				image_description: input.imageDescription?.slice(0, 500) ?? null
			})
			.select('id')
			.single();

		if (error) {
			console.error('logSuggestion error:', error.message);
			return null;
		}
		return data?.id ?? null;
	} catch (e) {
		console.error('logSuggestion threw:', e);
		return null;
	}
}

export async function resolveSuggestion(
	suggestionId: string,
	outcome: 'accepted' | 'rejected' | 'corrected',
	opts: { actualPartId?: string | null; source?: 'quote' | 'staff' | 'customer' } = {}
): Promise<boolean> {
	try {
		const supabase = getSupabaseAdmin();
		const { error } = await supabase
			.from('part_suggestions')
			.update({
				outcome,
				actual_part_id: opts.actualPartId ?? null,
				outcome_source: opts.source ?? 'customer',
				outcome_at: new Date().toISOString()
			})
			.eq('id', suggestionId)
			.eq('outcome', 'pending');

		if (error) {
			console.error('resolveSuggestion error:', error.message);
			return false;
		}
		return true;
	} catch (e) {
		console.error('resolveSuggestion threw:', e);
		return false;
	}
}

export async function labelFromQuote(
	userId: string,
	partIds: string[],
	windowMinutes = 120
): Promise<number> {
	if (!userId || !partIds.length) return 0;

	try {
		const supabase = getSupabaseAdmin();
		const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

		const { data: pending } = await supabase
			.from('part_suggestions')
			.select('id, suggested_part_id')
			.eq('user_id', userId)
			.eq('outcome', 'pending')
			.gte('created_at', since);

		if (!pending?.length) return 0;

		const ordered = new Set(partIds);
		let labelled = 0;

		for (const s of pending) {
			if (!s.suggested_part_id) continue;
			const accepted = ordered.has(s.suggested_part_id);
			const ok = await resolveSuggestion(s.id, accepted ? 'accepted' : 'rejected', {
				actualPartId: accepted ? s.suggested_part_id : null,
				source: 'quote'
			});
			if (ok) labelled++;
		}
		return labelled;
	} catch (e) {
		console.error('labelFromQuote threw:', e);
		return 0;
	}
}
