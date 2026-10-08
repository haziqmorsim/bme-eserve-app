import { requirePage } from "$lib/page-access";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
    const { profile } = await parent();
    requirePage(profile, 'others');

    const TABS = ['invoice', 'packing'] as const;
    const requested = url.searchParams.get('tab');
    const tab = (TABS as readonly string[]).includes(requested ?? '') ? requested! : 'invoice';

    return {
        tab,
        canRun: true,
        title: "Others"
    };
};