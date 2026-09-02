import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface Attachment {
	filename: string;
	content: string;
	contentType?: string;
}

export interface EmailMeta {
	kind?: string;
	relatedRef?: string;
}

function guessContentType(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop();
	if (ext === 'pdf') return 'application/pdf';
	if (ext === 'csv') return 'text/csv';
	if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	return 'application/octet-stream';
}

function normaliseRecipients(to: string): string {
	const list = to
		.split(/[,;]/)
		.map((a) => a.trim())
		.filter(Boolean);
	if (list.length === 0) {
		throw new Error('No valid recipient email addresses found.');
	}
	return list.join(';');
}

let logClient: ReturnType<typeof createClient> | null = null;

function getLogClient() {
	if (logClient) return logClient;
	const url = Deno.env.get('SUPABASE_URL');
	const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	if (!url || !key) return null;
	logClient = createClient(url, key);
	return logClient;
}

async function recordAttempt(
	to: string,
	subject: string,
	status: 'sent' | 'failed',
	attachments: number,
	meta?: EmailMeta,
	errorText?: string
) {
	try {
		const client = getLogClient();
		if (!client) return;
		await client.from('email_log').insert({
			to_email: to,
			subject,
			kind: meta?.kind ?? null,
			related_ref: meta?.relatedRef ?? null,
			status,
			error: errorText ? String(errorText).slice(0, 2000) : null,
			attachments
		});
	} catch (e) {
		console.error('email_log write failed:', e);
	}
}

export async function sendEmail(
	to: string,
	subject: string,
	html: string,
	attachments?: Attachment[],
	meta?: EmailMeta
) {
	const attachmentCount = (attachments ?? []).length;

	let recipients: string;
	try {
		recipients = normaliseRecipients(to);
	} catch (e) {
		await recordAttempt(to ?? '', subject, 'failed', attachmentCount, meta, String(e));
		throw e;
	}

	const flowUrl = Deno.env.get('POWER_AUTOMATE_EMAIL_URL');
	if (!flowUrl) {
		const msg =
			'E-mail configuration is incomplete. Set POWER_AUTOMATE_EMAIL_URL to the Power Automate flow HTTP trigger URL.';
		await recordAttempt(recipients, subject, 'failed', attachmentCount, meta, msg);
		throw new Error(msg);
	}
	const sharedKey = Deno.env.get('POWER_AUTOMATE_EMAIL_KEY');

	const payload = {
		to: recipients,
		subject,
		html,
		attachments: (attachments ?? []).map((a) => ({
			name: a.filename,
			contentBytes: a.content,
			contentType: a.contentType ?? guessContentType(a.filename)
		}))
	};

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };

	if (sharedKey) headers['x-eserve-key'] = sharedKey;

	let res: Response;
	try {
		res = await fetch(flowUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload)
		});
	} catch (e) {
		await recordAttempt(recipients, subject, 'failed', attachmentCount, meta, String(e));
		throw e;
	}

	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		const msg = `Power Automate sendEmail failed: HTTP ${res.status} - ${detail}`;
		await recordAttempt(recipients, subject, 'failed', attachmentCount, meta, msg);
		throw new Error(msg);
	}

	await recordAttempt(recipients, subject, 'sent', attachmentCount, meta);
}
