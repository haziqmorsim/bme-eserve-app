export interface Attachment {
    filename: string;
    content: string;
    contentType?: string;
}

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function guessContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'csv') return 'text/csv';
    if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return 'application/octet-stream';
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function acquireGraphToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) {
        return cachedToken.value;
    }

    const tenantId = Deno.env.get('GRAPH_TENANT_ID');
    const clientId = Deno.env.get('GRAPH_CLIENT_ID');
    const clientSecret = Deno.env.get('GRAPH_CLIENT_SECRET');

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error(
            'Graph configuration is incomplete. ' +
            'Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET.'
        );
    }

    const res = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                scope: GRAPH_SCOPE,
                grant_type: 'client_credentials'
            })
        }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        const error = data.error_description ?? `HTTP ${res.status}`;
        throw new Error(`Failed to acquire Microsoft Graph token: ${error}`);
    }

    cachedToken = {
        value: data.access_token,
        expiresAt: now + (data.expires_in ?? 3600) * 1000
    };
    return cachedToken.value;
}

export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: Attachment[]
) {
    const senderEmail = Deno.env.get('SENDER_EMAIL');
    if (!senderEmail) {
        throw new Error('Graph email configuration is incomplete. Set SENDER_EMAIL.');
    }

    const recipients = to
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
        .map((address) => ({ emailAddress: { address } }));

    if (recipients.length === 0) {
        throw new Error('No valid recipient email address found.');
    }

    const message: Record<string, unknown> = {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: recipients
    };

    if (attachments?.length) {
        message.attachments = attachments.map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentType: a.contentType ?? guessContentType(a.filename),
            contentBytes: a.content
        }));
    }

    const token = await acquireGraphToken();

    const res = await fetch(
        `${GRAPH_BASE_URL}/users/${encodeURIComponent(senderEmail)}/sendMail`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message, saveToSentItems: true })
        }
    );

    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Microsoft Graph sendMail failed: HTTP ${res.status} - ${detail}`);
    }
}