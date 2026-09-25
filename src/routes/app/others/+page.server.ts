import { error } from "@sveltejs/kit";
import { canUseOthers } from "$lib/roles";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
    const { profile } = await parent();
    if (!profile || !canUseOthers(profile.role)) {
        throw error(403, 'Only Shipping/Packing and Developer accounts have access.');
    }

    const TABS = ['invoice', 'packing'] as const;
    const requested = url.searchParams.get('tab');
    const tab = (TABS as readonly string[]).includes(requested ?? '') ? requested! : 'invoice';

    return {
        tab,
        canRun: true,
        title: "Others"
    };
};