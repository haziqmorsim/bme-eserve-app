export type Tier = { threshold: number; percent: number };

export const TIERS: Tier[] = [
    { threshold: 10, percent: 5 }, 
    { threshold: 20, percent: 10 }, 
    { threshold: 30, percent: 15 }
];

export function couponCode(userId: string, percent: number): string {
    let h = 0;
    const str = `${userId}:${percent}`;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return `BME${percent}-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}

export function earnedCoupons(userId: string, requestCount: number) {
    return TIERS.filter((t) => requestCount >= t.threshold).map((t) => ({
        percent: t.percent, 
        code: couponCode(userId, t.percent)
    }));
}

export function normaliseCode(code: string): string {
    return (code ?? '').trim().toUpperCase();
}