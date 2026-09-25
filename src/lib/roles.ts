export type Role = 'customer' | 'shipping' | 'admin' | 'manager' | 'coo' | 'developer';

export const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
    { value: 'customer', label: 'Customer' },
    { value: 'shipping', label: 'Shipping/Packing' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'coo', label: 'Chief Operating Officer' },
    { value: 'developer', label: 'Developer' }
];

export const ROLE_LABEL: Record<string, string> = {
    customer: 'Customer',
    shipping: 'Shipping/Packing',
    admin: 'Admin',
    manager: 'Manager',
    coo: 'COO',
    developer: 'Developer'
};

export const CUSTOMER_ROLES: ReadonlySet<string> = new Set(['customer', 'shipping']);

export const OTHERS_ROLES: ReadonlySet<string> = new Set(['developer', 'shipping']);

export const isCustomerRole = (role: string | null | undefined) => CUSTOMER_ROLES.has(role ?? '');
export const canUseOthers = (role: string | null | undefined) => OTHERS_ROLES.has(role ?? '');