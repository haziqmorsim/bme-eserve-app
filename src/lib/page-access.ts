import { error, redirect } from "@sveltejs/kit";
import { canAccessPage, firstPageHref, type PageKey } from "./roles";

export function requirePage(profile: any, key: PageKey): void {
    if (canAccessPage(profile, key)) return;
    const fallback = firstPageHref(profile);
    if (fallback) throw redirect(303, fallback);
    throw error(403, 'You do not have access to this page.');
}