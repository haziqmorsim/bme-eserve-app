import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const STAFF = new Set(['admin', 'manager', 'coo', 'developer']);

export const load: PageServerLoad = async ({ parent, url }) => {
    const { profile } = await parent();
    if (!profile || !STAFF.has(profile.role)) throw error(403, 'Only staff have access.');

    const TABS = ['invoice', 'packing'] as const;
    const requested = url.searchParams.get('tab');
    const tab = (TABS as readonly string[]).includes(requested ?? '') ? requested! : 'invoice';

    return {
        tab,
        canRun: profile.role === 'admin' || profile.role === 'manager' || profile.role === 'coo' || profile.role === 'developer',
        title: "Others"
    };
};