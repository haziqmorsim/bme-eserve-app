export type PasswordChecks = {
    length: boolean;
    upper: boolean;
    number: boolean;
    symbol: boolean;
};

export const PASSWORD_RULES: Array<{ key: keyof PasswordChecks; label: string }> = [
    { key: 'length', label: 'At least 8 characters.'},
    { key: 'upper', label: 'At least 1 capital letter.'},
    { key: 'number', label: 'At least 1 number.'},
    { key: 'symbol', label: 'At least 1 symbol.'}
];

export function passwordChecks(pw: string): PasswordChecks {
    return {
        length: pw.length >= 8,
        upper: /[A-Z]/.test(pw),
        number: /[0-9]/.test(pw),
        symbol: /[^A-Za-z0-9]/.test(pw)
    };
}

export function isStrongPassword(pw: string): boolean {
    const c = passwordChecks(pw);
    return c.length && c.upper && c.number && c.symbol;
}