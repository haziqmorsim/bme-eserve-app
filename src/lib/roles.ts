export type Role = 'customer' | 'staff' | 'developer';

export const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
    { value: 'customer', label: 'Customer' },
    { value: 'staff', label: 'Staff' },
    { value: 'developer', label: 'Developer' }
];

export const ROLE_LABEL: Record<string, string> = {
    customer: 'Customer',
    staff: 'Staff',
    developer: 'Developer'
};

const LEGACY_ROLE_LABEL: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    coo: 'COO',
    shipping: 'Shipping/Packing'
};

export const STAFF_ROLES: ReadonlySet<string> = new Set(['staff', 'developer']);

export const ACTOR_ROLES: ReadonlySet<string> = new Set(['staff']);

export const isCustomerRole = (role: string | null | undefined) => (role ?? 'customer') === 'customer';
export const isStaffRole = (role: string | null | undefined) => STAFF_ROLES.has(role ?? '');
export const isActorRole = (role: string | null | undefined) => ACTOR_ROLES.has(role ?? '');

export const hasJobDetails = (role: string | null | undefined) => !isCustomerRole(role);

export function roleLabel(role: string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABEL[role] ?? LEGACY_ROLE_LABEL[role] ?? role;
}

export function staffTitle(position: string | null | undefined, role: string | null | undefined): string {
    const p = (position ?? '').trim();
    return p || roleLabel(role);
}

export type PageKey =
    | 'home'
    | 'cart'
    | 'history'
    | 'profile'
    | 'requests'
    | 'enquiries'
    | 'analytics'
    | 'others';

export const PAGE_OPTIONS: Array<{ key: PageKey; label: string; href: string }> = [
    { key: 'home', label: 'Home', href: '/app' },
    { key: 'cart', label: 'Cart', href: '/app/quotes' },
    { key: 'history', label: 'History', href: '/app/history' },
    { key: 'profile', label: 'Profile', href: '/app/profile' },
    { key: 'requests', label: 'Requests', href: '/app/requests' },
    { key: 'enquiries', label: 'Enquiries', href: '/app/enquiries' },
    { key: 'analytics', label: 'Analytics', href: '/app/analytics' }
    // { key: 'others', label: 'Others', href: '/app/others' }
];

const ALL_PAGES: PageKey[] = PAGE_OPTIONS.map((p) => p.key);

export const BASE_PAGES: readonly PageKey[] = ['home', 'cart', 'history', 'profile'];

export const STAFF_ONLY_PAGES: readonly PageKey[] = ['requests', 'enquiries', 'analytics'];

export function defaultPages(role: string | null | undefined): PageKey[] {
    return isCustomerRole(role) ? [...BASE_PAGES] : [...ALL_PAGES];
}

export function availablePages(role: string | null | undefined): PageKey[] {
    return isCustomerRole(role) ? ALL_PAGES.filter((k) => !STAFF_ONLY_PAGES.includes(k)) : [...ALL_PAGES];
}

type PageProfile = { role?: string | null; pages?: string[] | null } | null | undefined;

export function userPages(profile: PageProfile): PageKey[] {
    if (!profile) return [];
    const allowed = availablePages(profile.role);
    const ticked = Array.isArray(profile.pages) ? profile.pages : defaultPages(profile.role);
    return allowed.filter((k) => ticked.includes(k));
}

export function canAccessPage(profile: PageProfile, key: PageKey): boolean {
    return userPages(profile).includes(key);
}

export type ProjectTab = 'dashboard' | 'parts';

export const PROJECT_TAB_OPTIONS: Array<{ key: ProjectTab; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'parts', label: 'Spare Parts' }
];

const ALL_PROJECT_TABS: ProjectTab[] = PROJECT_TAB_OPTIONS.map((t) => t.key);

export const DEFAULT_CUSTOMER_TABS: readonly ProjectTab[] = ['parts'];

export function defaultProjectTabs(role: string | null | undefined): ProjectTab[] {
    return isCustomerRole(role) ? [...DEFAULT_CUSTOMER_TABS] : [...ALL_PROJECT_TABS];
}

type TabProfile = { role?: string | null; project_tabs?: string[] | null } | null | undefined;

export function userProjectTabs(profile: TabProfile): ProjectTab[] {
    if (!profile) return [];
    if (!isCustomerRole(profile.role)) return [...ALL_PROJECT_TABS];
    const ticked = Array.isArray(profile.project_tabs) ? profile.project_tabs : [...DEFAULT_CUSTOMER_TABS];
    const tabs = ALL_PROJECT_TABS.filter((k) => ticked.includes(k));
    return tabs.length ? tabs : [...DEFAULT_CUSTOMER_TABS];
}

export function firstPageHref(profile: PageProfile): string | null {
    const first = userPages(profile)[0];
    return first ? PAGE_OPTIONS.find((p) => p.key === first)!.href : null;
}