import { requirePage } from "$lib/page-access";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ parent }) => {
    const { profile } = await parent();
    requirePage(profile, 'analytics');
    return {};
}