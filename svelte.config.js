import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV === 'development';

const SUPABASE_HTTP = ['https://*.supabase.co'];
const SUPABASE_ALL = ['https://*.supabase.co', 'wss://*.supabase.co'];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),

		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],

				'script-src': dev ? ['self', 'unsafe-inline', 'unsafe-eval'] : ['self'],

				'style-src': ['self', 'unsafe-inline', 'https://cdn.jsdelivr.net'],
				'font-src': ['self', 'data:', 'https://cdn.jsdelivr.net'],

				'img-src': ['self', 'data:', 'blob:', ...SUPABASE_HTTP],

				'connect-src': dev
					? ['self', 'ws://localhost:*', 'http://localhost:*', ...SUPABASE_ALL]
					: ['self', ...SUPABASE_ALL],

				'form-action': ['self'],
				'base-uri': ['self'],
				'frame-ancestors': ['none'],
				'object-src': ['none'],
				'worker-src': ['self', 'blob:']
			}
		}
	}
};

export default config;
