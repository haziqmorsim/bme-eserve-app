export function formatMoney(value: number): string {
    return Math.round(value).toLocaleString('en-MY', { maximumFractionDigits: 0});
}

export function priceRangeLabel(
    min: number | null | undefined, 
    max: number | null | undefined
): string {
    if (min == null || max == null) return 'Price on request';
    return `RM${formatMoney(min)} - RM${formatMoney(max)}`;
}