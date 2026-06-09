import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    throw redirect(303, session ? '/app' : '/login');
};