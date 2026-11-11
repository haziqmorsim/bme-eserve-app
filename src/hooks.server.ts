import { createServerClient } from '@supabase/ssr';
import { type Handle, type RequestEvent, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { ACTIVE_COOKIE, SEEN_COOKIE, IDLE_LIMIT_SECONDS, SEEN_LIMIT_SECONDS } from '$lib/idle';

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

function activityCookieOptions(event: RequestEvent) {
	return {
		path: '/',
		httpOnly: false,
		sameSite: 'lax' as const,
		secure: event.url.protocol === 'https:'
	};
}

function markActive(event: RequestEvent) {
	event.cookies.set(ACTIVE_COOKIE, '1', { ...activityCookieOptions(event), maxAge: IDLE_LIMIT_SECONDS });
	if (!event.cookies.get(SEEN_COOKIE)) {
		event.cookies.set(SEEN_COOKIE, '1', { ...activityCookieOptions(event), maxAge: SEEN_LIMIT_SECONDS });
	}
}

function clearActive(event: RequestEvent) {
	for (const name of [ACTIVE_COOKIE, SEEN_COOKIE]) {
		if (event.cookies.get(name) !== undefined) event.cookies.delete(name, { path: '/' });
	}
}

async function endIdleSession(event: RequestEvent, userId: string) {
	try {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('role')
			.eq('id', userId)
			.maybeSingle();
		if (profile?.role !== 'developer') {
			await event.locals.supabase.from('activity_events').insert({
				user_id: userId,
				role: profile?.role ?? null,
				event_type: 'sign_out',
				path: null,
				meta: { reason: 'closed' }
			});
		}
	} catch {
		// Logging must never block sign-out.
	}
	try {
		await event.locals.supabase.auth.signOut({ scope: 'local' });
	} catch {
		// The cookies are cleared below either way.
	}
	clearActive(event);
}

const authGuard: Handle = async ({ event, resolve }) => {
	let { session, user } = await event.locals.safeGetSession();

	if (session && user) {
		const away = !!event.cookies.get(SEEN_COOKIE) && !event.cookies.get(ACTIVE_COOKIE);
		if (away) {
			await endIdleSession(event, user.id);
			session = null;
			user = null;
			const path = event.url.pathname;
			if (path === '/' || path.startsWith('/app')) throw redirect(303, '/login?reason=idle');
		} else {
			markActive(event);
		}
	} else {
		clearActive(event);
	}

	event.locals.session = session;
	event.locals.user = user;

	if (event.url.pathname.startsWith('/app') && !session) {
		throw redirect(303, '/login');
	}
	return resolve(event);
};

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');

	response.headers.set('X-Content-Type-Options', 'nosniff');

	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
	);

	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

export const handle: Handle = sequence(supabase, authGuard, securityHeaders);