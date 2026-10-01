export function isPlaceholder(value: string | null | undefined): boolean {
    const v = (value ?? '').trim();
    return v === '' || v === '-';
}

export function hasImage(url: string | null | undefined): boolean {
    return !isPlaceholder(url);
}

export function textLines(value: string | null | undefined): string[] {
    if (isPlaceholder(value)) return [];
    return (value ?? '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
}