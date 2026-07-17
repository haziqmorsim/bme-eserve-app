export function appUrl(path: string): string {
    const base = (Deno.env.get('APP_BASE_URL') ?? '').replace(/\/+$/, '');
    if (!base) return '';
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${base}${clean}`;
}

export function ctaButton(label: string, url: string, color: '#2F5E18'): string {
    if (!url) return '';
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0">
            <tr>
                <td align="center" bgcolor="${color}" style="border-radius:6px">
                <a href="${url}" target="_blank"
                    style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;line-height:1;color:#ffffff;text-decoration:none;border-radius:6px">
                    ${label}
                </a>
                </td>
            </tr>
        </table>
    `;
}