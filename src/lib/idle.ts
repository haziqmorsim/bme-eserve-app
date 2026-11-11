export const IDLE_LIMIT_SECONDS = 60 * 60;
export const SEEN_LIMIT_SECONDS = 60 * 60 * 24 * 365;

export const ACTIVE_COOKIE = 'bme_active';
export const SEEN_COOKIE = 'bme_seen';

export function hasCookie(name: string): boolean {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
}

function writeCookie(name: string, maxAge: number): void {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function idleLimitReached(): boolean {
    return hasCookie(SEEN_COOKIE) && !hasCookie(ACTIVE_COOKIE);
}

export function touchActivity(): void {
    writeCookie(ACTIVE_COOKIE, IDLE_LIMIT_SECONDS);
    writeCookie(SEEN_COOKIE, SEEN_LIMIT_SECONDS);
}